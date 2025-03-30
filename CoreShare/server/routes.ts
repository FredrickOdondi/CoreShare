import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertGpuSchema, 
  insertRentalSchema,
  insertReviewSchema,
  insertNotificationSchema
} from "@shared/schema";
import * as chatbot from "./chatbot";
import { registerMPesaRoutes } from "./routes-mpesa";

import { Request, Response, NextFunction } from "express";

interface AuthenticatedRequest extends Request {
  user: Express.User;
}

// Middleware to check if user is authenticated
const isAuthenticated = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Not authenticated" });
};

// Middleware to check user role
const hasRole = (roles: string[]) => (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  
  const authenticatedReq = req as AuthenticatedRequest;
  
  if (roles.includes(authenticatedReq.user.role) || authenticatedReq.user.role === "both") {
    return next();
  }
  
  res.status(403).json({ message: "Access forbidden" });
};

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);
  
  // GPU Management Routes
  
  // Get all GPUs
  app.get("/api/gpus", async (req, res) => {
    try {
      const available = req.query.available === "true" ? true : 
                        req.query.available === "false" ? false : 
                        undefined;
      
      const gpus = await storage.listGpus(available);
      res.json(gpus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Endpoint to get frequently listed GPUs
  app.get("/api/gpus/frequent", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 5;
      const gpus = await storage.getFrequentlyListedGpus(limit);
      res.json(gpus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Endpoint to trigger AI analysis of GPU usage
  app.post("/api/gpus/analyze", isAuthenticated, hasRole(["admin"]), async (req, res) => {
    try {
      await storage.analyzeGpuUsage();
      res.json({ success: true, message: "GPU usage analysis completed" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Temporary endpoint for development testing - no auth required
  app.post("/api/dev/analyze-gpus", async (req, res) => {
    try {
      await storage.analyzeGpuUsage();
      res.json({ success: true, message: "GPU usage analysis completed" });
    } catch (error: any) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get GPU by ID
  app.get("/api/gpus/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid GPU ID" });
      }
      
      const gpu = await storage.getGpu(id);
      if (!gpu) {
        return res.status(404).json({ message: "GPU not found" });
      }
      
      res.json(gpu);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create GPU (rentee only)
  app.post("/api/gpus", isAuthenticated, hasRole(["rentee"]), async (req: Request, res: Response) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const validation = insertGpuSchema.safeParse({
        ...req.body,
        ownerId: authenticatedReq.user.id
      });
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid GPU data", 
          errors: validation.error.format() 
        });
      }
      
      const newGpu = await storage.createGpu(validation.data);
      res.status(201).json(newGpu);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update GPU (owner only)
  app.patch("/api/gpus/:id", isAuthenticated, hasRole(["rentee"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid GPU ID" });
      }
      
      const gpu = await storage.getGpu(id);
      if (!gpu) {
        return res.status(404).json({ message: "GPU not found" });
      }
      
      // Owner verification
      if (gpu.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You don't own this GPU" });
      }
      
      const updatedGpu = await storage.updateGpu(id, req.body);
      res.json(updatedGpu);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete GPU (owner only)
  app.delete("/api/gpus/:id", isAuthenticated, hasRole(["rentee"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid GPU ID" });
      }
      
      const gpu = await storage.getGpu(id);
      if (!gpu) {
        return res.status(404).json({ message: "GPU not found" });
      }
      
      // Owner verification
      if (gpu.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You don't own this GPU" });
      }
      
      // Check if GPU is currently rented or has pending payments
      if (!gpu.available) {
        return res.status(400).json({ message: "Cannot delete a GPU that is currently rented" });
      }
      
      // Check if the GPU has any pending rentals in requires_payment status
      const pendingRentals = await storage.getRentalsByGpuId(id);
      if (pendingRentals.some(rental => rental.status === "requires_payment")) {
        return res.status(400).json({ message: "Cannot delete a GPU that has pending payment rentals" });
      }
      
      await storage.deleteGpu(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get GPUs by owner
  app.get("/api/users/:id/gpus", async (req, res) => {
    try {
      const ownerId = parseInt(req.params.id);
      if (isNaN(ownerId)) {
        return res.status(400).json({ message: "Invalid owner ID" });
      }
      
      const gpus = await storage.getGpusByOwnerId(ownerId);
      res.json(gpus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get my GPUs (for current user)
  app.get("/api/my/gpus", isAuthenticated, hasRole(["rentee"]), async (req, res) => {
    try {
      const gpus = await storage.getGpusByOwnerId(req.user.id);
      res.json(gpus);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Rental Management Routes
  
  // Request to rent a GPU
  app.post("/api/rentals", isAuthenticated, hasRole(["renter"]), async (req: Request, res: Response) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const validation = insertRentalSchema.safeParse({
        ...req.body,
        renterId: authenticatedReq.user.id
      });
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid rental data", 
          errors: validation.error.format() 
        });
      }
      
      // Fetch the latest GPU data directly from the database
      const gpu = await storage.getGpu(validation.data.gpuId);
      if (!gpu) {
        return res.status(404).json({ message: "GPU not found" });
      }
      
      // Double-check availability
      if (!gpu.available) {
        return res.status(400).json({ message: "GPU is not available for rent" });
      }
      
      // Get login credentials and owner info from GPU owner
      const gpuOwner = await storage.getUser(gpu.ownerId);
      if (!gpuOwner) {
        return res.status(404).json({ message: "GPU owner not found" });
      }
      
      // Create the rental with requires_payment status
      const rental = await storage.createRental({
        ...validation.data,
        status: "requires_payment" // Set initial status to requires payment
      });
      
      // Now update it with approval information
      await storage.updateRental(rental.id, {
        approvedAt: new Date(),
        approvedById: gpu.ownerId
      });
      
      // Mark GPU as temporarily unavailable
      await storage.updateGpu(gpu.id, { available: false });
      
      // Create a notification for the GPU owner about new rental
      await storage.createNotification({
        userId: gpu.ownerId,
        title: "New Rental Request",
        message: `${authenticatedReq.user.name || "Someone"} wants to rent your GPU ${gpu.name}. Rental will be approved once payment is received.`,
        type: 'rental_request',
        relatedId: rental.id
      });
      
      // Create a notification for the renter to make payment
      await storage.createNotification({
        userId: authenticatedReq.user.id,
        title: "Payment Required",
        message: `Your request to rent ${gpu.name} requires payment. Please complete the payment to start using the GPU.`,
        type: 'payment_required',
        relatedId: rental.id
      });
      
      res.status(201).json({
        ...rental,
        message: "Your rental request has been created. Please complete the payment to start using the GPU."
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Approve a rental request and provide login credentials
  app.patch("/api/rentals/:id/approve", isAuthenticated, hasRole(["rentee"]), async (req: Request, res: Response) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rental ID" });
      }
      
      // Validate that credentials are provided
      const { loginCredentials } = req.body;
      if (!loginCredentials) {
        return res.status(400).json({ message: "Login credentials are required for approval" });
      }
      
      const rental = await storage.getRental(id);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      // Verify that the rental is in requires_payment status
      if (rental.status !== "requires_payment") {
        return res.status(400).json({ 
          message: "Only rentals pending payment can be updated with credentials" 
        });
      }
      
      const gpu = await storage.getGpu(rental.gpuId);
      if (!gpu) {
        return res.status(404).json({ message: "Associated GPU not found" });
      }
      
      // Check that the current user is the GPU owner
      if (gpu.ownerId !== authenticatedReq.user.id) {
        return res.status(403).json({ message: "Only the GPU owner can approve rental requests" });
      }
      
      // Update the rental with approval information
      const updatedRental = await storage.updateRental(id, {
        status: "approved",
        approvedAt: new Date(),
        approvedById: authenticatedReq.user.id,
        loginCredentials
      });
      
      // Notify the renter that their request was approved
      await storage.createNotification({
        userId: rental.renterId,
        title: "Rental Request Approved",
        message: `Your request to rent ${gpu.name} has been approved. You can now proceed with payment.`,
        type: 'rental_approved',
        relatedId: rental.id
      });
      
      res.json({
        ...updatedRental,
        message: "Rental request approved successfully. The renter has been notified."
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reject a rental request
  app.patch("/api/rentals/:id/reject", isAuthenticated, hasRole(["rentee"]), async (req: Request, res: Response) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rental ID" });
      }
      
      const { rejectionReason } = req.body;
      
      const rental = await storage.getRental(id);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      // Verify that the rental is in requires_payment status
      if (rental.status !== "requires_payment") {
        return res.status(400).json({ 
          message: "Only rentals pending payment can be rejected" 
        });
      }
      
      const gpu = await storage.getGpu(rental.gpuId);
      if (!gpu) {
        return res.status(404).json({ message: "Associated GPU not found" });
      }
      
      // Check that the current user is the GPU owner
      if (gpu.ownerId !== authenticatedReq.user.id) {
        return res.status(403).json({ message: "Only the GPU owner can reject rental requests" });
      }
      
      // Update the rental status to rejected
      const updatedRental = await storage.updateRental(id, {
        status: "rejected",
        rejectionReason: rejectionReason || "Request rejected by GPU owner"
      });
      
      // Make the GPU available again
      await storage.updateGpu(gpu.id, { available: true });
      
      // Notify the renter that their request was rejected
      await storage.createNotification({
        userId: rental.renterId,
        title: "Rental Request Rejected",
        message: rejectionReason 
          ? `Your request to rent ${gpu.name} was rejected: ${rejectionReason}`
          : `Your request to rent ${gpu.name} was rejected by the owner.`,
        type: 'rental_rejected',
        relatedId: rental.id
      });
      
      res.json({
        ...updatedRental,
        message: "Rental request rejected successfully. The renter has been notified."
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Initiate M-Pesa payment for an approved rental
  app.post("/api/rentals/:id/initiate-payment", isAuthenticated, hasRole(["renter"]), async (req: Request, res: Response) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rental ID" });
      }
      
      const { phoneNumber } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ message: "Phone number is required for M-Pesa payment" });
      }
      
      const rental = await storage.getRental(id);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      // Verify that the rental is in requires_payment status
      if (rental.status !== "requires_payment") {
        return res.status(400).json({ 
          message: "Only rentals pending payment can be paid for" 
        });
      }
      
      // Verify the renter is the one making the payment
      if (rental.renterId !== authenticatedReq.user.id) {
        return res.status(403).json({ message: "Only the renter can initiate payment" });
      }
      
      const gpu = await storage.getGpu(rental.gpuId);
      if (!gpu) {
        return res.status(404).json({ message: "Associated GPU not found" });
      }
      
      // Import the M-Pesa module dynamically to avoid circular dependencies
      const { initiateSTKPush } = await import('./mpesa');
      
      // Calculate the amount to charge
      // For M-Pesa, we typically charge for a predetermined period, e.g., 1 hour
      const initialPaymentHours = 1;
      const amount = gpu.pricePerHour * initialPaymentHours;
      
      // Initiate M-Pesa STK Push
      const mpesaResponse = await initiateSTKPush({
        phoneNumber: phoneNumber.replace('+', ''), // Remove + sign if present
        amount,
        accountReference: `GPU-${gpu.id}-RENTAL-${rental.id}`,
        transactionDesc: `Payment for ${gpu.name} GPU Rental`
      });
      
      // Update the rental with the checkout request ID
      await storage.updateRental(id, {
        paymentIntentId: mpesaResponse.CheckoutRequestID,
        paymentStatus: "pending"
      });
      
      // Record the pending payment
      await storage.createPayment({
        userId: authenticatedReq.user.id,
        rentalId: id,
        amount,
        paymentIntentId: mpesaResponse.CheckoutRequestID,
        status: "pending",
        paymentMethod: "mpesa",
        metadata: JSON.stringify({
          phoneNumber,
          merchantRequestId: mpesaResponse.MerchantRequestID,
          checkoutRequestId: mpesaResponse.CheckoutRequestID
        })
      });
      
      res.json({
        success: true,
        message: "M-Pesa payment initiated. Please check your phone to complete the payment.",
        checkoutRequestId: mpesaResponse.CheckoutRequestID,
        merchantRequestId: mpesaResponse.MerchantRequestID
      });
    } catch (error: any) {
      console.error("M-Pesa payment error:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to initiate payment"
      });
    }
  });

  // M-Pesa payment callback endpoint
  app.post("/api/mpesa/callback", async (req: Request, res: Response) => {
    try {
      // Import the M-Pesa module dynamically
      const { processMPesaCallback } = await import('./mpesa');
      
      // Process the callback data
      const callbackData = req.body;
      const result = processMPesaCallback(callbackData);
      
      if (result.success) {
        // Payment was successful
        // Find the payment record using the CheckoutRequestID
        const checkoutRequestId = callbackData.Body.stkCallback.CheckoutRequestID;
        const payment = await storage.getPaymentByPaymentIntentId(checkoutRequestId);
        
        if (!payment) {
          console.error("Payment record not found for checkoutRequestId:", checkoutRequestId);
          return res.status(404).json({ message: "Payment record not found" });
        }
        
        // Update the payment status
        await storage.updatePayment(payment.id, {
          status: "succeeded",
          metadata: JSON.stringify({
            ...JSON.parse(payment.metadata || '{}'),
            mpesaTransactionId: result.transactionId,
            completedAt: new Date().toISOString()
          })
        });
        
        // Update the rental status to running
        if (payment.rentalId) {
          const rental = await storage.getRental(payment.rentalId);
          if (rental) {
            const updatedRental = await storage.updateRental(rental.id, {
              status: "running",
              paymentStatus: "paid"
            });
            
            // Get the GPU info for notification
            const gpu = await storage.getGpu(rental.gpuId);
            if (gpu) {
              // Notify the GPU owner that payment was received
              await storage.createNotification({
                userId: gpu.ownerId,
                title: "Payment Received",
                message: `M-Pesa payment has been received for rental of your GPU ${gpu.name}.`,
                type: 'payment_received',
                relatedId: rental.id
              });
              
              // Notify the renter that payment was successful
              await storage.createNotification({
                userId: rental.renterId,
                title: "Payment Successful",
                message: `Your M-Pesa payment for ${gpu.name} GPU rental was successful. You can now access the GPU.`,
                type: 'payment_success',
                relatedId: rental.id
              });
            }
          }
        }
      } else {
        // Payment failed
        console.error("M-Pesa payment failed:", result.resultDesc);
        
        // Find the payment record
        const checkoutRequestId = callbackData.Body.stkCallback.CheckoutRequestID;
        const payment = await storage.getPaymentByPaymentIntentId(checkoutRequestId);
        
        if (payment) {
          // Update the payment status
          await storage.updatePayment(payment.id, {
            status: "failed",
            metadata: JSON.stringify({
              ...JSON.parse(payment.metadata || '{}'),
              failureReason: result.resultDesc,
              failedAt: new Date().toISOString()
            })
          });
          
          // Notify the user that payment failed
          if (payment.rentalId) {
            const rental = await storage.getRental(payment.rentalId);
            if (rental) {
              await storage.createNotification({
                userId: rental.renterId,
                title: "Payment Failed",
                message: `Your M-Pesa payment failed: ${result.resultDesc}. Please try again.`,
                type: 'payment_failed',
                relatedId: rental.id
              });
            }
          }
        }
      }
      
      // Always return success to M-Pesa
      res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
    } catch (error: any) {
      console.error("M-Pesa callback error:", error);
      // Still return success to M-Pesa to prevent retries
      res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted with errors" });
    }
  });

  // Check payment status endpoint
  app.get("/api/rentals/:id/payment-status", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rental ID" });
      }
      
      const rental = await storage.getRental(id);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      // Verify the user has access to this rental
      const gpu = await storage.getGpu(rental.gpuId);
      if (!gpu) {
        return res.status(404).json({ message: "Associated GPU not found" });
      }
      
      if (rental.renterId !== authenticatedReq.user.id && gpu.ownerId !== authenticatedReq.user.id) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      // If the rental has a payment intent ID, check its status
      if (rental.paymentIntentId) {
        const payment = await storage.getPaymentByPaymentIntentId(rental.paymentIntentId);
        
        if (payment) {
          // Check if the payment is still pending and has been pending for a while
          if (payment.status === "pending") {
            // If it's been more than 5 minutes, we can check with M-Pesa
            const paymentCreatedTime = new Date(payment.createdAt || new Date()).getTime();
            const currentTime = new Date().getTime();
            const minutesPassed = (currentTime - paymentCreatedTime) / (1000 * 60);
            
            if (minutesPassed > 5) {
              try {
                // Import the M-Pesa module dynamically
                const { checkTransactionStatus } = await import('./mpesa');
                
                // Check the status with M-Pesa
                const statusResponse = await checkTransactionStatus(rental.paymentIntentId);
                
                // Update response based on M-Pesa status
                return res.json({
                  status: payment.status,
                  paymentMethod: payment.paymentMethod,
                  amount: payment.amount,
                  timestamp: payment.createdAt,
                  metadata: payment.metadata,
                  mpesaResponse: statusResponse
                });
              } catch (mpesaError: any) {
                console.error("Error checking M-Pesa status:", mpesaError);
                // Fall back to returning the stored payment data
              }
            }
          }
          
          // Return the payment status
          return res.json({
            status: payment.status,
            paymentMethod: payment.paymentMethod,
            amount: payment.amount,
            timestamp: payment.createdAt,
            metadata: payment.metadata
          });
        }
      }
      
      // If no payment record found
      res.json({
        status: rental.paymentStatus || "unknown",
        message: "No detailed payment information available"
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Stop rental (complete or cancel)
  app.patch("/api/rentals/:id/stop", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const authenticatedReq = req as AuthenticatedRequest;
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rental ID" });
      }
      
      const rental = await storage.getRental(id);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      const gpu = await storage.getGpu(rental.gpuId);
      if (!gpu) {
        return res.status(404).json({ message: "Associated GPU not found" });
      }
      
      // Permission check - only the renter or GPU owner can stop a rental
      if (rental.renterId !== authenticatedReq.user.id && gpu.ownerId !== authenticatedReq.user.id) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      // Only active rentals can be stopped
      if (rental.status !== "running") {
        return res.status(400).json({ message: "Only active rentals can be stopped" });
      }
      
      const endTime = new Date();
      const durationMs = endTime.getTime() - rental.startTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      const totalCost = parseFloat((durationHours * gpu.pricePerHour).toFixed(2));
      
      const updatedRental = await storage.updateRental(id, {
        status: "completed",
        endTime,
        totalCost
      });
      
      // Make GPU available again
      await storage.updateGpu(gpu.id, { available: true });
      
      // Create notification for GPU owner that rental is completed
      await storage.createNotification({
        userId: gpu.ownerId,
        title: "Rental Completed",
        message: `Your GPU ${gpu.name} rental has been completed`,
        type: 'rental_completed',
        relatedId: rental.id
      });
      
      // Create notification for renter with cost information
      await storage.createNotification({
        userId: rental.renterId,
        title: "Rental Bill",
        message: `Your rental of ${gpu.name} has been completed. Total cost: $${totalCost.toFixed(2)}`,
        type: 'rental_bill',
        relatedId: rental.id
      });
      
      res.json(updatedRental);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get my rentals (for current user)
  app.get("/api/my/rentals", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const status = req.query.status as string;
      let rentals = await storage.getRentalsByRenterId(req.user.id);
      
      if (status) {
        rentals = rentals.filter(rental => rental.status === status);
      }
      
      res.json(rentals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get a specific rental by ID
  app.get("/api/rentals/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid rental ID" });
      }
      
      const rental = await storage.getRental(id);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      // Security check: user must be either the renter or the GPU owner
      const gpu = await storage.getGpu(rental.gpuId);
      const authenticatedReq = req as AuthenticatedRequest;
      
      if (rental.renterId !== authenticatedReq.user.id && 
          gpu && gpu.ownerId !== authenticatedReq.user.id) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      res.json(rental);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get active rentals for GPU owner dashboard
  app.get("/api/my/customers", isAuthenticated, hasRole(["rentee"]), async (req, res) => {
    try {
      // Get all GPUs owned by the current user
      const ownedGpus = await storage.getGpusByOwnerId(req.user.id);
      const ownedGpuIds = ownedGpus.map(gpu => gpu.id);
      
      // Get all rentals
      const allRentals = await storage.listRentals();
      
      // Filter rentals for owned GPUs
      const customerRentals = allRentals.filter(rental => 
        ownedGpuIds.includes(rental.gpuId)
      );
      
      res.json(customerRentals);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Dashboard stats endpoints
  
  // Get dashboard stats for the current user
  app.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      const stats: any = {};
      
      if (user.role === "renter" || user.role === "both") {
        // Get active rentals for renter
        const activeRentals = await storage.getActiveRentalsByRenterId(user.id);
        
        // Calculate total spent and usage hours
        const allRentals = await storage.getRentalsByRenterId(user.id);
        let totalSpent = 0;
        let totalHours = 0;
        
        for (const rental of allRentals) {
          if (rental.totalCost) {
            totalSpent += rental.totalCost;
          }
          
          if (rental.startTime && rental.endTime) {
            const durationMs = rental.endTime.getTime() - rental.startTime.getTime();
            totalHours += durationMs / (1000 * 60 * 60);
          } else if (rental.startTime && rental.status === "running") {
            const durationMs = new Date().getTime() - rental.startTime.getTime();
            totalHours += durationMs / (1000 * 60 * 60);
          }
        }
        
        stats.renter = {
          activeRentals: activeRentals.length,
          totalSpent: parseFloat(totalSpent.toFixed(2)),
          totalHours: parseFloat(totalHours.toFixed(2)),
          activeGpus: activeRentals.length
        };
      }
      
      if (user.role === "rentee" || user.role === "both") {
        // Get GPUs for owner
        const ownedGpus = await storage.getGpusByOwnerId(user.id);
        const totalGpus = ownedGpus.length;
        const activeGpus = ownedGpus.filter(gpu => !gpu.available).length;
        
        // Calculate income
        const allRentals = await storage.listRentals();
        const ownedGpuIds = ownedGpus.map(gpu => gpu.id);
        const relevantRentals = allRentals.filter(rental => 
          ownedGpuIds.includes(rental.gpuId)
        );
        
        let totalIncome = 0;
        for (const rental of relevantRentals) {
          if (rental.totalCost) {
            totalIncome += rental.totalCost;
          }
        }
        
        stats.rentee = {
          totalGpus,
          activeGpus,
          availableGpus: totalGpus - activeGpus,
          totalIncome: parseFloat(totalIncome.toFixed(2))
        };
      }
      
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Reviews Management Routes
  
  // Get reviews for a GPU
  app.get("/api/gpus/:id/reviews", async (req, res) => {
    try {
      const gpuId = parseInt(req.params.id);
      if (isNaN(gpuId)) {
        return res.status(400).json({ message: "Invalid GPU ID" });
      }
      
      const reviews = await storage.getReviewsByGpuId(gpuId);
      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get average rating for a GPU
  app.get("/api/gpus/:id/rating", async (req, res) => {
    try {
      const gpuId = parseInt(req.params.id);
      if (isNaN(gpuId)) {
        return res.status(400).json({ message: "Invalid GPU ID" });
      }
      
      const averageRating = await storage.getAverageRatingForGpu(gpuId);
      res.json({ averageRating });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create a review
  app.post("/api/reviews", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const validation = insertReviewSchema.safeParse({
        ...req.body,
        reviewerId: req.user.id
      });
      
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid review data", 
          errors: validation.error.format() 
        });
      }
      
      // Check if the rental exists and belongs to the user
      const rental = await storage.getRental(validation.data.rentalId);
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      if (rental.renterId !== req.user.id) {
        return res.status(403).json({ message: "You can only review your own rentals" });
      }
      
      // Check if the rental is completed
      if (rental.status !== "completed") {
        return res.status(400).json({ message: "You can only review completed rentals" });
      }
      
      // Check if user already reviewed this rental
      const existingReviews = await storage.getReviewsByReviewerId(req.user.id);
      const alreadyReviewed = existingReviews.some(review => review.rentalId === validation.data.rentalId);
      
      if (alreadyReviewed) {
        return res.status(400).json({ message: "You have already reviewed this rental" });
      }
      
      const newReview = await storage.createReview(validation.data);
      res.status(201).json(newReview);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Update a review
  app.patch("/api/reviews/:id", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid review ID" });
      }
      
      const review = await storage.getReview(id);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }
      
      // Only the reviewer can update their review
      if (review.reviewerId !== req.user.id) {
        return res.status(403).json({ message: "You can only update your own reviews" });
      }
      
      const updatedReview = await storage.updateReview(id, req.body);
      res.json(updatedReview);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete a review
  app.delete("/api/reviews/:id", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid review ID" });
      }
      
      const review = await storage.getReview(id);
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }
      
      // Only the reviewer can delete their review
      if (review.reviewerId !== req.user.id) {
        return res.status(403).json({ message: "You can only delete your own reviews" });
      }
      
      await storage.deleteReview(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get reviews by the current user
  app.get("/api/my/reviews", isAuthenticated, hasRole(["renter"]), async (req, res) => {
    try {
      const reviews = await storage.getReviewsByReviewerId(req.user.id);
      res.json(reviews);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Chatbot Routes
  
  // Create a new chat session
  app.post("/api/chat/session", async (req, res) => {
    try {
      // Pass user ID if authenticated
      const userId = req.isAuthenticated() ? req.user?.id : undefined;
      const sessionId = chatbot.createChatSession(userId);
      res.json({ sessionId });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Active requests tracking for debouncing
  const activeRequests: Record<string, { timestamp: number, promiseResolve: any }> = {};
  const DEBOUNCE_INTERVAL = 1000; // 1 second debounce time
  
  // Send a message to the chatbot
  app.post("/api/chat/message", async (req, res) => {
    try {
      const { sessionId, message } = req.body;
      const startTime = performance.now();
      
      if (!sessionId || !message) {
        return res.status(400).json({ message: "Session ID and message are required" });
      }
      
      // Implement debouncing to prevent rapid-fire requests
      const now = Date.now();
      const requestKey = `${sessionId}-${now}`;
      
      // Check if there are recent requests from this session
      const recentRequests = Object.entries(activeRequests)
        .filter(([key, data]) => 
          key.startsWith(sessionId) && 
          now - data.timestamp < DEBOUNCE_INTERVAL
        );
      
      // If there's a very recent request, apply debouncing
      if (recentRequests.length > 0) {
        console.log(`Debouncing request for session ${sessionId}`);
        await new Promise(resolve => setTimeout(resolve, DEBOUNCE_INTERVAL));
      }
      
      // Add this request to active requests
      activeRequests[requestKey] = {
        timestamp: now,
        promiseResolve: null
      };
      
      // Process message 
      console.log(`Processing message from session ${sessionId}: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
      const response = await chatbot.processMessage(sessionId, message);
      
      // Remove this request from active requests
      delete activeRequests[requestKey];
      
      // Check for potential commands in the user's message
      const lowerMessage = message.toLowerCase();
      const session = chatbot.getChatSession(sessionId);
      const userId = session?.userId;
      
      // Log processing time
      const endTime = performance.now();
      console.log(`Message processed in ${Math.round(endTime - startTime)}ms`);
      
      // Handle stop rental command
      if (userId && 
          (lowerMessage.includes("stop rental") || 
           lowerMessage.includes("stop my gpu") || 
           lowerMessage.includes("stop the gpu") ||
           lowerMessage.includes("end rental") ||
           lowerMessage.includes("cancel rental"))) {
        try {
          // Try to extract a rental ID if any
          const rentalIdMatch = message.match(/rental\s*#?(\d+)/i) || 
                                message.match(/rental\s*id\s*:?\s*(\d+)/i) ||
                                message.match(/stop\s*#?(\d+)/i);
          
          const rentalId = rentalIdMatch ? parseInt(rentalIdMatch[1]) : undefined;
          
          // Call the stopRental function
          const result = await chatbot.stopRental(userId, rentalId);
          
          // Only override the response if this was a primary intent
          if (result.success) {
            // Override the chatbot response with the result
            response.content = result.message;
          }
        } catch (error) {
          console.error("Error executing rental stop command:", error);
        }
      }
      
      // Handle theme toggle command
      if (lowerMessage.includes("dark mode") || 
          lowerMessage.includes("light mode") || 
          lowerMessage.includes("toggle theme") ||
          lowerMessage.includes("switch theme") ||
          lowerMessage.includes("change theme")) {
        try {
          // Call the toggleTheme function
          const result = chatbot.toggleTheme();
          
          // Add the action to the response
          res.setHeader('X-Theme-Action', 'toggle');
          
          // Only override if this was a primary intent
          if (lowerMessage.includes("toggle theme") || 
              lowerMessage.includes("switch theme") ||
              lowerMessage.includes("change theme") ||
              lowerMessage.includes("dark mode") ||
              lowerMessage.includes("light mode")) {
            response.content = result.message;
          }
        } catch (error) {
          console.error("Error executing theme toggle command:", error);
        }
      }
      
      res.json(response);
    } catch (error: any) {
      console.error("Error processing chat message:", error);
      res.status(500).json({ message: error.message || "Error processing message" });
    }
  });
  
  // Get all messages for a chat session
  app.get("/api/chat/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }
      
      const messages = chatbot.getChatMessages(sessionId);
      
      if (!messages) {
        return res.status(404).json({ message: "Chat session not found" });
      }
      
      res.json(messages);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Create a GPU listing via Cori chatbot
  app.post("/api/chat/create-gpu", isAuthenticated, async (req, res) => {
    try {
      const { name, manufacturer, vram, pricePerHour, technicalSpecs } = req.body;
      
      if (!name || !manufacturer || !vram || !pricePerHour) {
        return res.status(400).json({ 
          success: false, 
          message: "Required fields: name, manufacturer, vram, and pricePerHour" 
        });
      }
      
      // Create the GPU listing
      const result = await chatbot.createGpuListing(
        req.user!.id, 
        name, 
        manufacturer, 
        Number(vram), 
        Number(pricePerHour),
        technicalSpecs
      );
      
      res.json(result);
    } catch (error: any) {
      console.error("Error creating GPU via chatbot:", error);
      res.status(500).json({ 
        success: false, 
        message: error.message || "Error creating GPU listing" 
      });
    }
  });

  // Notification Management Routes
  
  // Get all notifications for the current user
  app.get("/api/notifications", isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getNotificationsByUserId(req.user.id);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Get unread notifications for the current user
  app.get("/api/notifications/unread", isAuthenticated, async (req, res) => {
    try {
      const notifications = await storage.getUnreadNotificationsByUserId(req.user.id);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Mark a notification as read
  app.patch("/api/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      
      const notification = await storage.getNotification(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Make sure the notification belongs to the user
      if (notification.userId !== req.user.id) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      const updatedNotification = await storage.markNotificationAsRead(id);
      res.json(updatedNotification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Mark all notifications as read
  app.post("/api/notifications/mark-all-read", isAuthenticated, async (req, res) => {
    try {
      await storage.markAllNotificationsAsRead(req.user.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Delete a notification
  app.delete("/api/notifications/:id", isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid notification ID" });
      }
      
      const notification = await storage.getNotification(id);
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      // Make sure the notification belongs to the user
      if (notification.userId !== req.user.id) {
        return res.status(403).json({ message: "Permission denied" });
      }
      
      await storage.deleteNotification(id);
      res.status(204).send();
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  // Initialize M-Pesa routes
  await registerMPesaRoutes(app);
  
  const httpServer = createServer(app);
  return httpServer;
}
