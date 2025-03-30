import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MPesaPaymentForm } from './mpesa-payment-form';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface MPesaPaymentDialogProps {
  rentalId: number;
  trigger?: React.ReactNode;
  onSuccess?: () => void;
  onCancel?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function MPesaPaymentDialog({ 
  rentalId, 
  trigger, 
  onSuccess, 
  onCancel,
  open: controlledOpen,
  onOpenChange: setControlledOpen
}: MPesaPaymentDialogProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rentalData, setRentalData] = useState<{
    gpuName: string;
    amount: number;
  } | null>(null);

  // Handle controlled/uncontrolled state
  const isControlled = controlledOpen !== undefined && setControlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : open;
  const setIsOpen = isControlled ? setControlledOpen : setOpen;

  // Fetch rental data when dialog opens
  useEffect(() => {
    if (isOpen && rentalId) {
      const fetchRentalData = async () => {
        setLoading(true);
        try {
          const response = await apiRequest('GET', `/api/rentals/${rentalId}`);
          
          if (response.ok) {
            const rental = await response.json();
            // Fetch the GPU details
            const gpuResponse = await apiRequest('GET', `/api/gpus/${rental.gpuId}`);
            
            if (gpuResponse.ok) {
              const gpu = await gpuResponse.json();
              
              setRentalData({
                gpuName: gpu.name,
                amount: gpu.pricePerHour
              });
            } else {
              throw new Error('Failed to fetch GPU details');
            }
          } else {
            throw new Error('Failed to fetch rental details');
          }
        } catch (err: any) {
          console.error('Error loading payment details:', err);
          
          // Check for authentication issues (401)
          if (err.status === 401) {
            setError('Authentication required. Please log in again to continue.');
            toast({
              variant: 'destructive',
              title: 'Session Expired',
              description: 'Your session has expired. Please log in again to continue.',
            });
          } else {
            setError(err.message || 'Failed to load rental details');
            toast({
              variant: 'destructive',
              title: 'Error',
              description: 'Failed to load payment details. Please try again.',
            });
          }
        } finally {
          setLoading(false);
        }
      };
      
      fetchRentalData();
    }
  }, [isOpen, rentalId, toast]);

  const handlePaymentSuccess = () => {
    setIsOpen(false);
    if (onSuccess) onSuccess();
  };

  const handleCancel = () => {
    setIsOpen(false);
    if (onCancel) onCancel();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>M-Pesa Payment</DialogTitle>
          <DialogDescription>
            Complete your GPU rental payment using M-Pesa
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="py-6 flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
          </div>
        ) : error ? (
          <div className="py-6">
            <p className="text-destructive">{error}</p>
            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={handleCancel}>Close</Button>
            </DialogFooter>
          </div>
        ) : rentalData && (
          <MPesaPaymentForm
            rentalId={rentalId}
            gpuName={rentalData.gpuName}
            amount={rentalData.amount}
            onSuccess={handlePaymentSuccess}
            onCancel={handleCancel}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}