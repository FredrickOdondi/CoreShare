import { useState } from "react";
import { Gauge, Thermometer, Zap } from "lucide-react";
import { Gpu } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ThermalCalculatorProps {
  gpu: Gpu;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThermalCalculator({ gpu, open, onOpenChange }: ThermalCalculatorProps) {
  const [usage, setUsage] = useState<number>(75); // Default usage percentage at 75%
  const [ambientTemp, setAmbientTemp] = useState<number>(25); // Default ambient temperature in Celsius

  // Calculate power usage based on TDP and usage percentage
  const calculatePower = () => {
    if (!gpu.tdp) return null;
    const powerUsage = (gpu.tdp * usage) / 100;
    return {
      value: powerUsage,
      efficiency: getEfficiencyRating(powerUsage, gpu.tdp || 250)
    };
  };

  // Calculate estimated temperature based on specs, usage and ambient temperature
  const calculateTemperature = () => {
    if (!gpu.maxTemp) return null;
    
    // Base temperature increase is proportional to power usage and cooling efficiency
    const coolingEfficiency = getCoolingEfficiency(gpu.coolingSystem);
    const usageFactor = usage / 100;
    
    // Calculate temperature increase from ambient
    const tempIncrease = ((gpu.tdp || 250) * usageFactor) / coolingEfficiency;
    const estimatedTemp = ambientTemp + tempIncrease;
    
    // Cap the estimated temperature at the max temp
    const cappedTemp = Math.min(estimatedTemp, gpu.maxTemp);
    
    return {
      value: Math.round(cappedTemp),
      percentOfMax: (cappedTemp / gpu.maxTemp) * 100,
      safe: cappedTemp < gpu.maxTemp * 0.9
    };
  };

  // Helper function to get cooling efficiency factor based on cooling system
  const getCoolingEfficiency = (coolingSystem: string | null | undefined) => {
    if (!coolingSystem) return 12;
    
    switch (coolingSystem.toLowerCase()) {
      case 'liquid':
        return 18;
      case 'hybrid':
        return 15;
      case 'air':
      default:
        return 12;
    }
  };

  // Helper function to determine efficiency rating
  const getEfficiencyRating = (powerUsage: number, tdp: number) => {
    const ratio = powerUsage / tdp;
    
    if (ratio <= 0.6) return "Excellent";
    if (ratio <= 0.75) return "Good";
    if (ratio <= 0.85) return "Average";
    return "Poor";
  };

  // Get calculated values
  const power = calculatePower();
  const temperature = calculateTemperature();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Thermal & Power Efficiency Calculator</DialogTitle>
          <DialogDescription>
            Estimate the thermal and power performance of {gpu.name} under different workloads.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* GPU Info Card */}
          <Card className="mb-4 bg-muted/20">
            <CardContent className="p-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium">{gpu.name}</h3>
                  <p className="text-sm text-muted-foreground">{gpu.manufacturer}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Specifications</p>
                  <div className="flex space-x-2 text-sm">
                    {gpu.tdp && <span className="text-primary">{gpu.tdp}W TDP</span>}
                    {gpu.coolingSystem && <span>• {gpu.coolingSystem} Cooling</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Slider */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">GPU Utilization</label>
              <span className="text-sm">{usage}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="100"
              value={usage}
              onChange={(e) => setUsage(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Ambient Temperature Slider */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium">Ambient Temperature</label>
              <span className="text-sm">{ambientTemp}°C</span>
            </div>
            <input
              type="range"
              min="15"
              max="40"
              value={ambientTemp}
              onChange={(e) => setAmbientTemp(parseInt(e.target.value))}
              className="w-full"
            />
          </div>

          {/* Tabs for different metrics */}
          <Tabs defaultValue="power" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="power" className="flex-1">Power</TabsTrigger>
              <TabsTrigger value="temperature" className="flex-1">Temperature</TabsTrigger>
            </TabsList>

            {/* Power Tab Content */}
            <TabsContent value="power" className="space-y-4">
              {power ? (
                <div className="space-y-4">
                  <div className="text-center mt-4">
                    <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-2">
                      <Zap className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold">{Math.round(power.value)} Watts</h3>
                    <p className="text-sm text-muted-foreground">Estimated Power Consumption</p>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Efficiency Rating</span>
                      <span className={
                        power.efficiency === "Excellent" ? "text-green-500" :
                        power.efficiency === "Good" ? "text-blue-500" :
                        power.efficiency === "Average" ? "text-yellow-500" :
                        "text-red-500"
                      }>
                        {power.efficiency}
                      </span>
                    </div>
                    <Progress 
                      value={(power.value / (gpu.tdp || 250)) * 100} 
                      className="h-2"
                    />
                  </div>

                  <div className="bg-muted/30 p-3 rounded-md text-sm">
                    <p className="font-medium">Power efficiency insights:</p>
                    <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                      <li>
                        {power.value < (gpu.tdp || 250) * 0.7 
                          ? "Current settings provide good power efficiency" 
                          : "Consider lowering utilization to improve efficiency"}
                      </li>
                      <li>
                        {power.value < (gpu.tdp || 250) * 0.8
                          ? "Power draw is within efficient range for this GPU"
                          : "Operating close to TDP limit could reduce GPU lifespan"}
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Insufficient power data available for this GPU</p>
                </div>
              )}
            </TabsContent>

            {/* Temperature Tab Content */}
            <TabsContent value="temperature" className="space-y-4">
              {temperature ? (
                <div className="space-y-4">
                  <div className="text-center mt-4">
                    <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-2">
                      <Thermometer className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold">{temperature.value}°C</h3>
                    <p className="text-sm text-muted-foreground">Estimated GPU Temperature</p>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Temperature Level</span>
                      <span className={temperature.safe ? "text-green-500" : "text-red-500"}>
                        {temperature.safe ? "Safe" : "Warning"}
                      </span>
                    </div>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Progress 
                            value={temperature.percentOfMax} 
                            className={`h-2 ${
                              temperature.percentOfMax > 90 ? "bg-red-200" : 
                              temperature.percentOfMax > 80 ? "bg-yellow-200" : 
                              "bg-green-200"
                            }`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{temperature.value}°C of {gpu.maxTemp}°C max</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="bg-muted/30 p-3 rounded-md text-sm">
                    <p className="font-medium">Temperature insights:</p>
                    <ul className="list-disc list-inside space-y-1 mt-1 text-muted-foreground">
                      <li>
                        {temperature.percentOfMax < 80
                          ? "Temperature is in a safe operating range"
                          : "GPU is running hot, consider improving cooling"}
                      </li>
                      <li>
                        {gpu.coolingSystem?.toLowerCase() === "liquid"
                          ? "Liquid cooling provides optimal thermal management"
                          : gpu.coolingSystem?.toLowerCase() === "air"
                          ? "Air cooling is adequate for moderate workloads"
                          : "Improved cooling could enhance performance stability"}
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Insufficient temperature data available for this GPU</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}