import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { GpuCard } from "@/components/dashboard/gpu-card";
import { Gpu } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { GpuReviews } from "@/components/reviews/gpu-reviews";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";

export default function MarketplacePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGpu, setSelectedGpu] = useState<Gpu | null>(null);
  const [rentalDialogOpen, setRentalDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [gpuType, setGpuType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("price");
  const [maxPrice, setMaxPrice] = useState<number>(80);
  
  // Fetch available GPUs
  const { data: gpus, isLoading: isLoadingGpus } = useQuery<Gpu[]>({
    queryKey: ["/api/gpus", { available: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gpus?available=true");
      return res.json();
    }
  });
  
  // Rental form schema
  const rentalFormSchema = z.object({
    task: z.string().min(1, "Task description is required")
  });
  
  // Rental form
  const rentalForm = useForm<z.infer<typeof rentalFormSchema>>({
    resolver: zodResolver(rentalFormSchema),
    defaultValues: {
      task: ""
    }
  });
  
  // Rent GPU mutation
  const rentGpuMutation = useMutation({
    mutationFn: async (data: { gpuId: number, task: string }) => {
      const response = await apiRequest("POST", "/api/rentals", {
        gpuId: data.gpuId,
        task: data.task
      });
      
      // Check if response is ok before continuing
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to rent GPU");
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Refresh all relevant data
      queryClient.invalidateQueries({ queryKey: ["/api/my/rentals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread"] });
      
      toast({
        title: "Success",
        description: "GPU has been rented successfully",
      });
      
      setRentalDialogOpen(false);
      rentalForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Rental Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle renting a GPU
  const handleRentGpu = (gpuId: number) => {
    const gpu = gpus?.find(g => g.id === gpuId);
    if (gpu) {
      setSelectedGpu(gpu);
      setRentalDialogOpen(true);
    }
  };
  
  // Handle viewing GPU details
  const handleViewDetails = (gpuId: number) => {
    const gpu = gpus?.find(g => g.id === gpuId);
    if (gpu) {
      setSelectedGpu(gpu);
      setDetailsDialogOpen(true);
    }
  };
  
  // Handle form submission for renting
  const onRentalSubmit = (data: z.infer<typeof rentalFormSchema>) => {
    if (selectedGpu) {
      rentGpuMutation.mutate({
        gpuId: selectedGpu.id,
        task: data.task
      });
    }
  };
  
  // Filter and sort GPUs
  const filteredGpus = gpus
    ?.filter(gpu => 
      // Search filter
      (gpu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
       gpu.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())) &&
      // Type filter
      (gpuType === "all" || 
       (gpuType === "nvidia" && gpu.manufacturer.toLowerCase().includes("nvidia")) ||
       (gpuType === "amd" && gpu.manufacturer.toLowerCase().includes("amd"))) &&
      // Price filter
      gpu.pricePerHour <= maxPrice
    )
    .sort((a, b) => {
      // Sort by selected criteria
      switch (sortBy) {
        case "price":
          return a.pricePerHour - b.pricePerHour;
        case "performance":
          return (b.cudaCores || 0) - (a.cudaCores || 0);
        case "vram":
          return b.vram - a.vram;
        default:
          return 0;
      }
    });
  
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground">
      {/* Sidebar - hidden on mobile */}
      <Sidebar className="hidden md:flex" />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header search={{ 
          value: searchQuery, 
          onChange: setSearchQuery,
          placeholder: "Search GPUs..." 
        }} />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">GPU Marketplace</h1>
            <p className="text-muted-foreground">Browse and rent high-performance GPUs</p>
          </div>
          
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4 sm:mb-6">
            {/* First row on mobile, first items on desktop */}
            <div className="flex w-full sm:w-auto gap-2 sm:gap-3">
              <Select 
                value={gpuType} 
                onValueChange={setGpuType}
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm flex-1 sm:w-32 md:w-40">
                  <SelectValue placeholder="GPU Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All GPU Types</SelectItem>
                  <SelectItem value="nvidia">NVIDIA GPUs</SelectItem>
                  <SelectItem value="amd">AMD GPUs</SelectItem>
                </SelectContent>
              </Select>
              
              <Select 
                value={sortBy} 
                onValueChange={setSortBy}
              >
                <SelectTrigger className="h-9 text-xs sm:text-sm flex-1 sm:w-36 md:w-48">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Sort by: Price</SelectItem>
                  <SelectItem value="performance">Sort by: Performance</SelectItem>
                  <SelectItem value="vram">Sort by: VRAM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Second row on mobile, search and price range */}
            <div className="flex flex-wrap w-full sm:flex-1 gap-3">
              {/* Search - visible on all screens */}
              <div className="w-full sm:w-auto sm:flex-1 sm:max-w-sm">
                <Input
                  type="text"
                  placeholder="Search GPUs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 text-xs sm:text-sm w-full"
                />
              </div>
              
              {/* Price range slider */}
              <div className="w-full sm:w-auto sm:flex-1 flex items-center gap-2">
                <span className="text-muted-foreground text-xs whitespace-nowrap">Price:</span>
                <div className="flex-1 flex items-center gap-2">
                  <Slider
                    value={[maxPrice]}
                    max={100}
                    step={1}
                    onValueChange={(value) => setMaxPrice(value[0])}
                    className="flex-1"
                  />
                  <span className="text-xs whitespace-nowrap">≤{maxPrice}Ksh/h</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* GPU Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
            {isLoadingGpus ? (
              Array(6).fill(0).map((_, index) => (
                <div 
                  key={index}
                  className="h-[240px] sm:h-[280px] bg-card rounded-xl animate-pulse"
                />
              ))
            ) : filteredGpus && filteredGpus.length > 0 ? (
              filteredGpus.map(gpu => (
                <div key={gpu.id} className="flex flex-col">
                  <GpuCard 
                    gpu={gpu} 
                    onRent={handleRentGpu}
                    disableRent={user?.role !== "renter" && user?.role !== "both"}
                  />
                  <Button 
                    variant="ghost" 
                    className="mt-1 sm:mt-2 h-8 sm:h-9 text-xs sm:text-sm w-full" 
                    onClick={() => handleViewDetails(gpu.id)}
                  >
                    <span className="sm:inline hidden">View Details & Reviews</span>
                    <span className="inline sm:hidden">Details & Reviews</span>
                  </Button>
                </div>
              ))
            ) : (
              <div className="col-span-3 py-10 text-center">
                <p className="text-muted-foreground">No GPUs available matching your criteria</p>
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Rental Dialog */}
      <Dialog open={rentalDialogOpen} onOpenChange={setRentalDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">Rent GPU: {selectedGpu?.name}</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Enter details to rent this GPU. You will be charged Ksh {selectedGpu?.pricePerHour} per hour.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...rentalForm}>
            <form onSubmit={rentalForm.handleSubmit(onRentalSubmit)} className="space-y-3 sm:space-y-4">
              <FormField
                control={rentalForm.control}
                name="task"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs sm:text-sm">Task Description</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="e.g., ML Training, Rendering, etc." 
                        className="h-8 sm:h-9 text-xs sm:text-sm" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="gap-2 sm:gap-0 flex-col-reverse sm:flex-row sm:justify-end mt-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setRentalDialogOpen(false)}
                  className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm sm:order-1"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={rentGpuMutation.isPending}
                  className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm sm:order-2"
                >
                  {rentGpuMutation.isPending ? "Processing..." : "Rent Now"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* GPU Details Dialog with Reviews */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          {selectedGpu && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedGpu.name}</DialogTitle>
                <DialogDescription>
                  {selectedGpu.manufacturer} GPU Details and Reviews
                </DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="details" className="w-full mt-2 sm:mt-4">
                <div className="overflow-x-auto pb-1">
                  <TabsList className="mb-2 sm:mb-4 w-auto inline-flex sm:flex">
                    <TabsTrigger value="details" className="text-xs sm:text-sm">GPU Details</TabsTrigger>
                    <TabsTrigger value="thermal" className="text-xs sm:text-sm">Thermal Info</TabsTrigger>
                    <TabsTrigger value="reviews" className="text-xs sm:text-sm">Reviews</TabsTrigger>
                  </TabsList>
                </div>
                
                {/* Details Tab */}
                <TabsContent value="details" className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <h3 className="text-sm sm:text-base font-medium mb-1 sm:mb-2">Basic Information</h3>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:gap-2 text-xs sm:text-sm">
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Manufacturer</p>
                          <p className="font-medium truncate">{selectedGpu.manufacturer}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Model</p>
                          <p className="font-medium truncate">{selectedGpu.name}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">VRAM</p>
                          <p className="font-medium">{selectedGpu.vram} GB</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Status</p>
                          <p className={`font-medium ${selectedGpu.available ? "text-green-500" : "text-orange-500"}`}>
                            {selectedGpu.available ? "Available" : "In Use"}
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm sm:text-base font-medium mb-1 sm:mb-2">Performance</h3>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:gap-2 text-xs sm:text-sm">
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">CUDA Cores</p>
                          <p className="font-medium truncate">{selectedGpu.cudaCores?.toLocaleString() || "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Base Clock</p>
                          <p className="font-medium">{selectedGpu.baseClock ? `${selectedGpu.baseClock} GHz` : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Boost Clock</p>
                          <p className="font-medium">{selectedGpu.boostClock ? `${selectedGpu.boostClock} GHz` : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Memory Type</p>
                          <p className="font-medium truncate">{selectedGpu.memoryType || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-3 sm:pt-4 border-t border-border">
                    <h3 className="text-sm sm:text-base font-medium mb-1 sm:mb-2">Rental Information</h3>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                      <div>
                        <p className="text-muted-foreground text-[10px] sm:text-xs">Price</p>
                        <p className="text-base sm:text-xl font-semibold text-primary">Ksh {selectedGpu.pricePerHour} / hour</p>
                      </div>
                      
                      <Button
                        onClick={() => {
                          setDetailsDialogOpen(false);
                          setRentalDialogOpen(true);
                        }}
                        disabled={!selectedGpu.available || (user?.role !== "renter" && user?.role !== "both")}
                        className="w-full sm:w-auto h-9 text-xs sm:text-sm"
                      >
                        Rent Now
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Thermal Info Tab */}
                <TabsContent value="thermal" className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <h3 className="text-sm sm:text-base font-medium mb-1 sm:mb-2">Power Specifications</h3>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:gap-2 text-xs sm:text-sm">
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">TDP</p>
                          <p className="font-medium">{selectedGpu.tdp ? `${selectedGpu.tdp} W` : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">PSU Recommendation</p>
                          <p className="font-medium truncate">{selectedGpu.psuRecommendation ? `${selectedGpu.psuRecommendation} W` : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Power Connectors</p>
                          <p className="font-medium truncate">{selectedGpu.powerConnectors || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm sm:text-base font-medium mb-1 sm:mb-2">Thermal Characteristics</h3>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 sm:gap-2 text-xs sm:text-sm">
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Max Temperature</p>
                          <p className="font-medium">{selectedGpu.maxTemp ? `${selectedGpu.maxTemp}°C` : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-[10px] sm:text-xs">Cooling Solution</p>
                          <p className="font-medium truncate">{selectedGpu.coolingSystem || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                {/* Reviews Tab */}
                <TabsContent value="reviews">
                  {selectedGpu && (
                    <GpuReviews gpu={selectedGpu} />
                  )}
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="sm:justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => setDetailsDialogOpen(false)}
                  className="w-full sm:w-auto h-8 sm:h-9 text-xs sm:text-sm"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
