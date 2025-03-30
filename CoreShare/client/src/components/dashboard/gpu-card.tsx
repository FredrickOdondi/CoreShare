import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gpu } from "@shared/schema";
import { Cpu, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThermalCalculator } from "./thermal-calculator";

interface GpuCardProps {
  gpu: Gpu;
  onRent: (gpuId: number) => void;
  disableRent?: boolean;
  className?: string;
}

export function GpuCard({ gpu, onRent, disableRent = false, className }: GpuCardProps) {
  const [showThermalCalculator, setShowThermalCalculator] = useState(false);
  
  return (
    <>
      <Card className={cn("overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg", className)}>
        <CardContent className="p-4">
          <div className="flex justify-between mb-3">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-md bg-opacity-20 bg-primary flex items-center justify-center text-primary mr-3">
                <Cpu className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-medium">{gpu.name}</h3>
                <p className="text-xs text-muted-foreground">{gpu.manufacturer}</p>
              </div>
            </div>
            <span className={cn(
              "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
              gpu.available 
                ? "bg-green-900 bg-opacity-50 text-green-300" 
                : "bg-orange-900 bg-opacity-50 text-orange-300"
            )}>
              {gpu.available ? "Available" : "In Use"}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm mb-4">
            <div>
              <p className="text-muted-foreground text-xs">VRAM</p>
              <p>{gpu.vram} GB</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">CUDA Cores</p>
              <p>{gpu.cudaCores?.toLocaleString() || "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Base Clock</p>
              <p>{gpu.baseClock ? `${gpu.baseClock} GHz` : "N/A"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs">Boost Clock</p>
              <p>{gpu.boostClock ? `${gpu.boostClock} GHz` : "N/A"}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-muted-foreground text-xs">Price</p>
              <p className="text-lg font-semibold text-primary">Ksh {gpu.pricePerHour} / hour</p>
            </div>
            <Button 
              onClick={() => onRent(gpu.id)} 
              disabled={disableRent || !gpu.available}
              variant="default"
            >
              Rent Now
            </Button>
          </div>
          
          {/* Thermal Calculator Button */}
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full mt-2 text-xs"
            onClick={() => setShowThermalCalculator(true)}
          >
            <Gauge className="h-3 w-3 mr-1" />
            Calculate Thermal Efficiency
          </Button>
        </CardContent>
      </Card>
      
      {/* Thermal Calculator Dialog */}
      <ThermalCalculator 
        gpu={gpu} 
        open={showThermalCalculator} 
        onOpenChange={setShowThermalCalculator} 
      />
    </>
  );
}
