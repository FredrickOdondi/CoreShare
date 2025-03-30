import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, CheckCircle, AlertCircle, PhoneCall } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface MPesaPaymentFormProps {
  rentalId: number;
  gpuName: string;
  amount: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function MPesaPaymentForm({ rentalId, gpuName, amount, onSuccess, onCancel }: MPesaPaymentFormProps) {
  const { toast } = useToast();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'pending' | 'success' | 'failed'>('idle');
  const [checkoutRequestId, setCheckoutRequestId] = useState('');
  const [error, setError] = useState('');

  // Format the Kenyan phone number
  const formatPhoneNumber = (value: string) => {
    // Remove any non-digit characters
    let digits = value.replace(/\D/g, '');
    
    // Ensure number starts with 254 (Kenya code)
    if (digits.startsWith('0')) {
      digits = '254' + digits.substring(1);
    } else if (!digits.startsWith('254')) {
      digits = '254' + digits;
    }
    
    return digits;
  };

  const handlePhoneNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhoneNumber(e.target.value);
  };

  const initiatePayment = async () => {
    if (!phoneNumber) {
      setError('Please enter a valid phone number');
      return;
    }

    setError('');
    setLoading(true);
    
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      const response = await apiRequest('POST', `/api/rentals/${rentalId}/mpesa-payment`, {
        phoneNumber: formattedPhone,
        amount
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setPaymentStatus('pending');
        setCheckoutRequestId(data.checkoutRequestId);
        
        toast({
          title: 'Payment Initiated',
          description: 'Check your phone for the M-Pesa prompt to complete payment.',
        });
        
        // Start polling for payment status
        pollPaymentStatus();
      } else {
        setPaymentStatus('failed');
        setError(data.message || 'Failed to initiate payment');
        
        toast({
          variant: 'destructive',
          title: 'Payment Failed',
          description: data.message || 'Something went wrong when initiating payment.',
        });
      }
    } catch (err: any) {
      setPaymentStatus('failed');
      console.error('Payment initiation error:', err);
      
      // Handle specific error cases
      if (err.status === 401) {
        setError('Authentication required. Please log in again to continue.');
        toast({
          variant: 'destructive',
          title: 'Session Expired',
          description: 'Your session has expired. Please log in again to continue.',
        });
      } else if (err.status === 403) {
        setError('You do not have permission to make this payment.');
        toast({
          variant: 'destructive',
          title: 'Permission Denied',
          description: 'You do not have permission to make this payment.',
        });
      } else {
        setError(err.message || 'Failed to connect to payment service');
        toast({
          variant: 'destructive',
          title: 'Connection Error',
          description: 'Unable to connect to payment service. Please try again.',
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const pollPaymentStatus = async () => {
    if (!checkoutRequestId) return;
    
    // Poll every 5 seconds for up to 2 minutes (24 attempts)
    let attempts = 0;
    const maxAttempts = 24;
    
    const checkStatus = async () => {
      try {
        const response = await apiRequest('GET', `/api/rentals/${rentalId}/payment-status`);
        const data = await response.json();
        
        if (response.ok) {
          if (data.status === 'succeeded') {
            setPaymentStatus('success');
            toast({
              title: 'Payment Successful',
              description: 'Your payment has been processed successfully.',
            });
            
            // Notify parent component of success
            if (onSuccess) {
              onSuccess();
            }
            
            return true; // Stop polling
          } else if (data.status === 'failed' || data.status === 'cancelled') {
            setPaymentStatus('failed');
            setError(data.details?.ResultDesc || 'Payment failed or was cancelled');
            
            toast({
              variant: 'destructive',
              title: 'Payment Failed',
              description: data.details?.ResultDesc || 'Payment was not completed successfully.',
            });
            
            return true; // Stop polling
          }
        }
      } catch (err: any) {
        console.error('Error checking payment status:', err);
        
        // Don't show errors for network issues during polling to avoid confusion
        // Only stop polling for authentication problems
        if (err.status === 401 || err.status === 403) {
          setPaymentStatus('failed');
          setError('Session expired. Please log in again to check payment status.');
          return true; // Stop polling
        }
      }
      
      attempts++;
      if (attempts >= maxAttempts) {
        setPaymentStatus('failed');
        setError('Payment verification timed out. If you completed the payment, it may still process.');
        return true; // Stop polling after max attempts
      }
      
      return false; // Continue polling
    };
    
    const poll = async () => {
      const shouldStop = await checkStatus();
      if (!shouldStop) {
        setTimeout(poll, 5000); // Check again in 5 seconds
      }
    };
    
    // Auto-complete payment in test mode after 8 seconds
    // This is only for development to avoid endless waiting
    if (import.meta.env.DEV) {
      setTimeout(async () => {
        console.log("Auto-completing payment in test mode...");
        try {
          const response = await apiRequest('POST', `/api/test/mpesa-callback`, {
            rentalId: rentalId,
            success: true
          });
          
          if (response.ok) {
            console.log("Test payment auto-completed successfully");
            // Force a status check
            checkStatus();
          }
        } catch (err) {
          console.error("Failed to auto-complete payment in test mode:", err);
        }
      }, 8000);
    }
    
    // Start polling
    poll();
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>M-Pesa Payment</CardTitle>
        <CardDescription>
          Pay for your GPU rental using M-Pesa
        </CardDescription>
      </CardHeader>
      <CardContent>
        {paymentStatus === 'idle' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number (Safaricom)</Label>
              <Input
                id="phone"
                placeholder="e.g. 254722000000"
                type="tel"
                value={phoneNumber}
                onChange={handlePhoneNumberChange}
              />
              <p className="text-xs text-muted-foreground">
                Enter your Safaricom M-Pesa number starting with 254
              </p>
            </div>
            
            <div className="bg-muted p-3 rounded-md">
              <div className="flex justify-between">
                <span>GPU:</span>
                <span className="font-medium">{gpuName}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span>Amount:</span>
                <span className="font-medium">Ksh {amount.toFixed(2)}</span>
              </div>
            </div>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
        
        {paymentStatus === 'pending' && (
          <div className="space-y-4">
            <Alert>
              <PhoneCall className="h-4 w-4" />
              <AlertTitle>Payment Pending</AlertTitle>
              <AlertDescription>
                Please check your phone for the M-Pesa prompt and enter your PIN to complete the payment.
              </AlertDescription>
            </Alert>
            
            <div className="flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Waiting for your payment to be confirmed...
            </p>
          </div>
        )}
        
        {paymentStatus === 'success' && (
          <div className="space-y-4">
            <Alert className="bg-green-900/20 text-green-400 border-green-500">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Payment Successful</AlertTitle>
              <AlertDescription>
                Your payment has been processed successfully. You can now access the GPU.
              </AlertDescription>
            </Alert>
            
            <div className="flex justify-center">
              <CheckCircle className="h-16 w-16 text-green-500" />
            </div>
            <p className="text-center text-sm">
              Transaction completed. Thank you for your payment.
            </p>
          </div>
        )}
        
        {paymentStatus === 'failed' && (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Payment Failed</AlertTitle>
              <AlertDescription>
                {error || 'Your payment could not be processed. Please try again.'}
              </AlertDescription>
            </Alert>
            <p className="text-center text-sm text-muted-foreground">
              If money was deducted from your account, it will be refunded automatically.
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-end space-x-2">
        {paymentStatus === 'idle' && (
          <>
            <Button variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button onClick={initiatePayment} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing
                </>
              ) : (
                'Pay with M-Pesa'
              )}
            </Button>
          </>
        )}
        
        {paymentStatus === 'pending' && (
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
        )}
        
        {(paymentStatus === 'success' || paymentStatus === 'failed') && (
          <Button onClick={onSuccess || handleCancel}>
            {paymentStatus === 'success' ? 'Continue' : 'Try Again'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}