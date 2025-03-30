import { Express, Request, Response, NextFunction } from 'express';
import { Server, createServer } from 'http';
import { initiateSTKPush, processMPesaCallback, checkTransactionStatus } from './mpesa';
import { storage } from './storage';
import * as z from 'zod';

interface AuthenticatedRequest extends Request {
  user: Express.User;
}

const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
};

const hasRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as any;
  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  if (roles.includes(user.role) || user.role === 'both') {
    return next();
  }
  
  return res.status(403).json({ message: 'Forbidden' });
};

// M-Pesa payment request validation schema
const mpesaPaymentSchema = z.object({
  phoneNumber: z.string().min(10).max(12),
  amount: z.number().min(1), 
  rentalId: z.number(),
});

export async function registerMPesaRoutes(app: Express): Promise<void> {
  // Initiate M-Pesa payment
  app.post("/api/rentals/:id/mpesa-payment", isAuthenticated, hasRole(["renter"]), async (req: Request, res: Response) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rental ID" });
      }
      
      // Validate payment request
      const validation = mpesaPaymentSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid payment data", 
          errors: validation.error.format() 
        });
      }
      
      const { phoneNumber, amount } = validation.data;
      
      // Get the rental
      const rental = await storage.getRental(id);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      // Verify that the rental is in approved status
      if (rental.status !== "approved") {
        return res.status(400).json({ 
          message: "Only approved rentals can be paid for" 
        });
      }
      
      // Verify the renter is the one making the payment
      if (rental.renterId !== authenticatedReq.user.id) {
        return res.status(403).json({ message: "Only the renter can complete payment" });
      }
      
      const gpu = await storage.getGpu(rental.gpuId);
      if (!gpu) {
        return res.status(404).json({ message: "Associated GPU not found" });
      }
      
      // Initiate M-Pesa STK push
      const stkResponse = await initiateSTKPush({
        phoneNumber,
        amount: amount || gpu.pricePerHour,
        accountReference: `Rental-${id}`, // Reference for tracking the payment
        transactionDesc: `Payment for ${gpu.name} GPU rental`
      });
      
      // Update rental with checkout request ID for tracking
      await storage.updateRental(id, {
        paymentIntentId: stkResponse.CheckoutRequestID
      });
      
      // Record initial payment attempt
      await storage.createPayment({
        userId: authenticatedReq.user.id,
        rentalId: id,
        amount: amount || gpu.pricePerHour,
        paymentIntentId: stkResponse.CheckoutRequestID,
        status: 'pending',
        paymentMethod: 'mpesa',
        metadata: JSON.stringify(stkResponse)
      });
      
      res.json({
        message: "Payment request sent to your phone. Please complete the payment.",
        checkoutRequestId: stkResponse.CheckoutRequestID
      });
    } catch (error: any) {
      console.error('M-Pesa payment error:', error);
      res.status(500).json({ 
        message: "Payment initiation failed", 
        error: error.message 
      });
    }
  });
  
  // Check payment status
  app.get("/api/rentals/:id/payment-status", isAuthenticated, hasRole(["renter"]), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rental ID" });
      }
      
      const rental = await storage.getRental(id);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      if (!rental.paymentIntentId) {
        return res.status(400).json({ message: "No payment has been initiated for this rental" });
      }
      
      // Check payment status from M-Pesa
      const statusResponse = await checkTransactionStatus(rental.paymentIntentId);
      
      // Update payment record
      const payment = await storage.getPaymentByPaymentIntentId(rental.paymentIntentId);
      if (payment) {
        let status = 'pending';
        
        // Interpret the response
        if (statusResponse.ResultCode === '0') {
          status = 'succeeded';
          
          // If payment successful, also update the rental status
          await storage.updateRental(id, {
            status: "running",
            paymentStatus: "paid"
          });
          
          // Notify the GPU owner of successful payment
          const gpu = await storage.getGpu(rental.gpuId);
          if (gpu) {
            await storage.createNotification({
              userId: gpu.ownerId,
              title: "Payment Received",
              message: `Payment has been received for rental of your GPU ${gpu.name}.`,
              type: 'payment_received',
              relatedId: rental.id
            });
          }
        } else if (statusResponse.ResultCode === '1032') {
          status = 'cancelled'; // Transaction cancelled by user
        } else {
          status = 'failed';
        }
        
        await storage.updatePayment(payment.id, {
          status,
          metadata: JSON.stringify(statusResponse)
        });
        
        return res.json({
          status,
          details: statusResponse
        });
      } else {
        return res.status(404).json({ message: "Payment record not found" });
      }
    } catch (error: any) {
      console.error('Payment status check error:', error);
      res.status(500).json({ 
        message: "Failed to check payment status", 
        error: error.message 
      });
    }
  });
  
  // M-Pesa callback endpoint - this receives the payment notification from Safaricom
  app.post("/api/callback/mpesa", async (req: Request, res: Response) => {
    try {
      // Process the callback data
      const callbackResult = processMPesaCallback(req.body);
      
      if (callbackResult.success) {
        // Extract the rental ID from accountReference (format: "Rental-{id}")
        const accountReference = req.body.Body?.stkCallback?.CallbackMetadata?.Item?.find((item: any) => 
          item.Name === 'AccountReference'
        )?.Value;
        
        let rentalId: number | null = null;
        if (accountReference && accountReference.startsWith('Rental-')) {
          rentalId = parseInt(accountReference.substring(7));
        } else {
          // Try to find the rental by checkout request ID
          const checkoutRequestId = req.body.Body?.stkCallback?.CheckoutRequestID;
          if (checkoutRequestId) {
            const payment = await storage.getPaymentByPaymentIntentId(checkoutRequestId);
            if (payment && payment.rentalId) {
              rentalId = payment.rentalId;
            }
          }
        }
        
        if (rentalId) {
          // Update the rental and payment status
          const rental = await storage.getRental(rentalId);
          if (rental) {
            await storage.updateRental(rentalId, {
              status: "running",
              paymentStatus: "paid"
            });
            
            // Update the payment
            const payment = await storage.getPaymentByPaymentIntentId(rental.paymentIntentId || '');
            if (payment) {
              await storage.updatePayment(payment.id, {
                status: 'succeeded',
                metadata: JSON.stringify(callbackResult)
              });
            }
            
            // Notify the GPU owner
            const gpu = await storage.getGpu(rental.gpuId);
            if (gpu) {
              await storage.createNotification({
                userId: gpu.ownerId,
                title: "Payment Received",
                message: `Payment has been received for rental of your GPU ${gpu.name}.`,
                type: 'payment_received',
                relatedId: rental.id
              });
            }
            
            // Notify the renter
            await storage.createNotification({
              userId: rental.renterId,
              title: "Payment Successful",
              message: `Your payment for GPU ${gpu?.name || 'rental'} was successful. You can now access the GPU.`,
              type: 'payment_successful',
              relatedId: rental.id
            });
          }
        }
      } else {
        // Payment failed - update records accordingly
        // Extract checkout request ID to find the related payment and rental
        const checkoutRequestId = req.body.Body?.stkCallback?.CheckoutRequestID;
        if (checkoutRequestId) {
          const payment = await storage.getPaymentByPaymentIntentId(checkoutRequestId);
          if (payment) {
            await storage.updatePayment(payment.id, {
              status: 'failed',
              metadata: JSON.stringify({
                ...callbackResult,
                rawCallback: req.body
              })
            });
            
            // Notify the renter of failed payment
            if (payment.rentalId) {
              const rental = await storage.getRental(payment.rentalId);
              if (rental) {
                await storage.createNotification({
                  userId: rental.renterId,
                  title: "Payment Failed",
                  message: `Your M-Pesa payment failed: ${callbackResult.resultDesc}. Please try again.`,
                  type: 'payment_failed',
                  relatedId: rental.id
                });
              }
            }
          }
        }
      }
      
      // Always respond with success to M-Pesa
      res.status(200).json({ 
        ResultCode: 0,
        ResultDesc: "Callback received successfully"
      });
    } catch (error: any) {
      console.error('M-Pesa callback processing error:', error);
      // Always respond with success to M-Pesa even if we have an error
      // Handle internal errors separately and don't affect the callback response
      res.status(200).json({ 
        ResultCode: 0,
        ResultDesc: "Callback acknowledged"
      });
    }
  });
}