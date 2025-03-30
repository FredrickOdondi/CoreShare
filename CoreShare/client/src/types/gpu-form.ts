import { z } from "zod";

// Form schema validation
export const gpuFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  manufacturer: z.string().min(2, "Manufacturer is required"),
  vram: z.string().transform(val => parseInt(val)).refine(val => !isNaN(val) && val > 0, "VRAM must be a positive number"),
  cudaCores: z.string().transform(val => val === "" ? null : parseInt(val)).nullable(),
  baseClock: z.string().transform(val => val === "" ? null : parseFloat(val)).nullable(),
  boostClock: z.string().transform(val => val === "" ? null : parseFloat(val)).nullable(),
  pricePerHour: z.string().transform(val => parseFloat(val)).refine(val => !isNaN(val) && val > 0, "Price must be a positive number"),
  // Thermal and power efficiency fields
  tdp: z.string().transform(val => val === "" ? null : parseInt(val)).nullable(),
  maxTemp: z.string().transform(val => val === "" ? null : parseInt(val)).nullable(),
  powerDraw: z.string().transform(val => val === "" ? null : parseInt(val)).nullable(),
  coolingSystem: z.string().nullable().optional(),
  // Additional fields for detailed specs
  memoryType: z.string().nullable().optional(),
  psuRecommendation: z.string().transform(val => val === "" ? null : parseInt(val)).nullable(),
  powerConnectors: z.string().nullable().optional(),
});

// This type will have all string fields for the form values (before transformation)
export type GpuFormValues = {
  name: string;
  manufacturer: string;
  vram: string;
  cudaCores: string;
  baseClock: string;
  boostClock: string;
  pricePerHour: string;
  tdp: string;
  maxTemp: string;
  powerDraw: string;
  coolingSystem: string;
  memoryType: string;
  psuRecommendation: string;
  powerConnectors: string;
};