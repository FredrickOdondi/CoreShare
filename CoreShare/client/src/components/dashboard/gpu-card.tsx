import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Gpu } from "@shared/schema";
import { Cpu, Gauge, TrendingUp, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThermalCalculator } from "./thermal-calculator";
import { Badge } from "@/components/ui/badge";

interface GpuCardProps {
  gpu: Gpu;
  onRent: (gpuId: number) => void;
  disableRent?: boolean;
  className?: string;
}

export function GpuCard({ gpu, onRent, disableRent = false, className }: GpuCardProps) {
  const [showThermalCalculator, setShowThermalCalculator] = useState(false);
  
  // Format popularity score for display
  const getPopularityLabel = (score: number | null | undefined) => {
    if (!score) return null;
    if (score >= 80) return "Very Popular";
    if (score >= 60) return "Popular";
    if (score >= 40) return "Moderate";
    if (score >= 20) return "Low";
    return "Very Low";
  };
  
  // Format badge color based on popularity
  const getPopularityBadgeColor = (score: number | null | undefined) => {
    if (!score) return "bg-slate-700";
    if (score >= 80) return "bg-red-900 text-red-300";
    if (score >= 60) return "bg-orange-900 text-orange-300";
    if (score >= 40) return "bg-yellow-900 text-yellow-300";
    if (score >= 20) return "bg-blue-900 text-blue-300";
    return "bg-slate-900 text-slate-300";
  };
  
  const popularityLabel = getPopularityLabel(gpu.popularityScore);
  const popularityBadgeColor = getPopularityBadgeColor(gpu.popularityScore);
  
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
          
          {/* AI Analysis Section - Only show if we have data */}
          {(gpu.popularityScore || gpu.commonTasks) && (
            <div className="border-t border-b border-border py-2 mb-3">
              <div className="flex items-center mb-1">
                <Activity className="h-3 w-3 mr-1 text-primary" />
                <p className="text-xs font-medium">AI Analysis</p>
              </div>
              
              {/* Popularity Badge */}
              {popularityLabel && (
                <div className="flex items-center mb-1">
                  <Badge variant="outline" className={cn("text-[10px]", popularityBadgeColor)}>
                    <TrendingUp className="h-2 w-2 mr-1" />
                    {popularityLabel}
                  </Badge>
                </div>
              )}
              
              {/* Common Tasks */}
              {gpu.commonTasks && (
                <div className="mt-1">
                  <p className="text-[10px] text-muted-foreground">Common tasks:</p>
                  <p className="text-xs">{gpu.commonTasks}</p>
                </div>
              )}
            </div>
          )}
          
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
