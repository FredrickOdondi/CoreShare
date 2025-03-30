import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Rental } from "@shared/schema";
import { Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface ActiveInstanceCardProps {
  rental: Rental;
  gpuName: string;
  vram: string;
  pricePerHour: number;
  onViewDetails: (rentalId: number) => void;
  onStop: (rentalId: number) => void;
  onPay?: (rentalId: number) => void;
  className?: string;
}

export function ActiveInstanceCard({
  rental,
  gpuName,
  vram,
  pricePerHour,
  onViewDetails,
  onStop,
  onPay,
  className
}: ActiveInstanceCardProps) {
  const startTime = new Date(rental.startTime);
  const duration = formatDistanceToNow(startTime, { addSuffix: false });
  
  return (
    <Card className={cn("", className)}>
      <CardContent className="p-4">
        <div className="flex justify-between items-start">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-md bg-opacity-20 bg-primary flex items-center justify-center text-primary mr-3">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium">{gpuName}</div>
              <div className="text-xs text-muted-foreground">{vram}</div>
            </div>
          </div>
          {rental.status === "running" && (
            <span className="px-2 text-xs font-semibold rounded-full bg-green-900 bg-opacity-50 text-green-300">
              Running
            </span>
          )}
          {rental.status === "approved" && (
            <span className="px-2 text-xs font-semibold rounded-full bg-purple-900 bg-opacity-50 text-purple-300">
              Approved
            </span>
          )}
          {rental.status === "pending_approval" && (
            <span className="px-2 text-xs font-semibold rounded-full bg-yellow-900 bg-opacity-50 text-yellow-300">
              Pending
            </span>
          )}
          {rental.status === "requires_payment" && (
            <span className="px-2 text-xs font-semibold rounded-full bg-amber-800 bg-opacity-50 text-amber-300">
              Payment Required
            </span>
          )}
          {rental.status === "completed" && (
            <span className="px-2 text-xs font-semibold rounded-full bg-blue-900 bg-opacity-50 text-blue-300">
              Completed
            </span>
          )}
          {rental.status === "cancelled" && (
            <span className="px-2 text-xs font-semibold rounded-full bg-red-900 bg-opacity-50 text-red-300">
              Cancelled
            </span>
          )}
          {rental.status === "rejected" && (
            <span className="px-2 text-xs font-semibold rounded-full bg-red-900 bg-opacity-50 text-red-300">
              Rejected
            </span>
          )}
        </div>
        
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Task</p>
            <p>{rental.task || "N/A"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Duration</p>
            <p>{duration}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Price</p>
            <p>Ksh {pricePerHour}/hr</p>
          </div>
        </div>
        
        <div className="mt-3 flex justify-end space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="text-primary"
            onClick={() => onViewDetails(rental.id)}
          >
            Details
          </Button>
          
          {rental.status === "requires_payment" && onPay && (
            <Button 
              variant="outline" 
              size="sm"
              className="bg-green-900/20 text-green-400 hover:bg-green-900/30 hover:text-green-300"
              onClick={() => onPay(rental.id)}
            >
              Pay Now
            </Button>
          )}
          
          {rental.status === "running" && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => onStop(rental.id)}
            >
              Stop
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
