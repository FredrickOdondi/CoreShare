import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { StatCard } from "@/components/dashboard/stat-card";
import { Cpu, Clock, DollarSign, CreditCard } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState } from "react";
import { GpuCard } from "@/components/dashboard/gpu-card";
import { Gpu, Rental } from "@shared/schema";
import { useLocation } from "wouter";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
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
import { formatDistanceToNow } from "date-fns";
import { ActiveInstanceCard } from "@/components/dashboard/active-instance-card";

// Define interfaces for stats responses
interface RenterStats {
  activeRentals: number;
  totalSpent: number;
  totalHours: number;
  activeGpus: number;
}

interface RenteeStats {
  totalGpus: number;
  activeGpus: number;
  availableGpus: number;
  totalIncome: number;
}

interface DashboardStats {
  renter?: RenterStats;
  rentee?: RenteeStats;
}

// Helper function to calculate current hourly rate based on active rentals
function getCurrentHourlyRate(activeRentals: Rental[] | undefined, gpus: Gpu[] | undefined): string {
  if (!activeRentals || !gpus || activeRentals.length === 0) return "0";
  
  let totalHourlyRate = 0;
  activeRentals.forEach(rental => {
    const gpu = gpus.find(g => g.id === rental.gpuId);
    if (gpu) {
      totalHourlyRate += gpu.pricePerHour;
    }
  });
  
  return totalHourlyRate.toFixed(2);
}

export default function HomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGpu, setSelectedGpu] = useState<Gpu | null>(null);
  const [rentalDialogOpen, setRentalDialogOpen] = useState(false);
  const [rentalDetailsOpen, setRentalDetailsOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  
  // Fetch dashboard stats
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });
  
  // Fetch available GPUs
  const { data: gpus, isLoading: isLoadingGpus } = useQuery<Gpu[]>({
    queryKey: ["/api/gpus", { available: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gpus?available=true");
      return res.json();
    }
  });
  
  // Fetch active rentals for the current user
  const { data: activeRentals, isLoading: isLoadingRentals } = useQuery<Rental[]>({
    queryKey: ["/api/my/rentals", { status: "running" }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/my/rentals?status=running");
      return res.json();
    },
    enabled: user?.role === "renter" || user?.role === "both"
  });
  
  // Stop rental mutation
  const stopRentalMutation = useMutation({
    mutationFn: async (rentalId: number) => {
      await apiRequest("PATCH", `/api/rentals/${rentalId}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/rentals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gpus"] });
      
      toast({
        title: "Success",
        description: "Rental has been stopped",
      });
      
      setRentalDetailsOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to stop rental: ${error.message}`,
        variant: "destructive",
      });
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
      await apiRequest("POST", "/api/rentals", {
        gpuId: data.gpuId,
        task: data.task
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/rentals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gpus"] });
      
      toast({
        title: "Success",
        description: "GPU has been rented successfully",
      });
      
      setRentalDialogOpen(false);
      rentalForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to rent GPU: ${error.message}`,
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
  
  // Handle form submission for renting
  const onRentalSubmit = (data: z.infer<typeof rentalFormSchema>) => {
    if (selectedGpu) {
      rentGpuMutation.mutate({
        gpuId: selectedGpu.id,
        task: data.task
      });
    }
  };
  
  // View rental details
  const handleViewRentalDetails = (rentalId: number) => {
    const rental = activeRentals?.find(r => r.id === rentalId);
    if (rental) {
      setSelectedRental(rental);
      setRentalDetailsOpen(true);
    }
  };
  
  // Get GPU name for rental
  const getGpuForRental = (gpuId: number) => {
    return gpus?.find(g => g.id === gpuId);
  };
  
  // Filter GPUs by search query
  const filteredGpus = gpus?.filter(gpu => 
    gpu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    gpu.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Get stats based on user role
  const defaultRenterStats: RenterStats = {
    activeRentals: 0,
    totalSpent: 0,
    totalHours: 0,
    activeGpus: 0
  };
  
  const defaultRenteeStats: RenteeStats = {
    totalGpus: 0,
    activeGpus: 0,
    availableGpus: 0,
    totalIncome: 0
  };
  
  const renterStats = stats?.renter || defaultRenterStats;
  const renteeStats = stats?.rentee || defaultRenteeStats;
  
  // Prepare active rentals for data table
  const activeRentalColumns = [
    {
      header: "GPU",
      accessorKey: (row: Rental) => row.gpuId,
      cell: (row: Rental) => {
        const gpu = getGpuForRental(row.gpuId);
        return (
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-md bg-opacity-20 bg-primary flex items-center justify-center text-primary mr-3">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium">{gpu?.name || "Unknown GPU"}</div>
              <div className="text-xs text-muted-foreground">{gpu?.vram}GB VRAM</div>
            </div>
          </div>
        );
      }
    },
    {
      header: "Task",
      accessorKey: (row: Rental) => row.task
    },
    {
      header: "Duration",
      accessorKey: (row: Rental) => {
        return formatDistanceToNow(new Date(row.startTime), { addSuffix: false });
      }
    },
    {
      header: "Status",
      accessorKey: (row: Rental) => row.status,
      cell: () => (
        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-900 bg-opacity-50 text-green-300">
          Running
        </span>
      )
    },
    {
      header: "Price",
      accessorKey: (row: Rental) => row.gpuId,
      cell: (row: Rental) => {
        const gpu = getGpuForRental(row.gpuId);
        return <span>Ksh {gpu?.pricePerHour || 0}/hr</span>;
      }
    },
    {
      header: "Actions",
      accessorKey: (row: Rental) => row.id,
      cell: (row: Rental) => (
        <div className="flex justify-end space-x-2">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-primary"
            onClick={() => handleViewRentalDetails(row.id)}
          >
            Details
          </Button>
          <Button 
            variant="destructive" 
            size="sm"
            onClick={() => stopRentalMutation.mutate(row.id)}
            disabled={stopRentalMutation.isPending}
          >
            Stop
          </Button>
        </div>
      )
    }
  ];
  
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
          {/* Dashboard Welcome */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Welcome back, {user?.name}</h1>
              <p className="text-muted-foreground">Here's what's happening with your GPU rentals</p>
            </div>
            
            {/* Action Button - only show for renters */}
            {(user?.role === "renter" || user?.role === "both") && (
              <div className="mt-4 md:mt-0 flex space-x-3">
                <Button 
                  className="flex items-center"
                  onClick={() => setLocation("/marketplace")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Rent a GPU
                </Button>
              </div>
            )}
          </div>
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {/* Show appropriate stats based on user role */}
            {(user?.role === "renter" || user?.role === "both") && (
              <>
                <StatCard
                  title="Active GPUs"
                  value={`${renterStats.activeGpus}`}
                  icon={Cpu}
                />
                <StatCard
                  title="Usage Time"
                  value={`${renterStats.totalHours.toFixed(1)} hours`}
                  icon={Clock}
                />
                <StatCard
                  title="Current Cost"
                  value={`Ksh ${getCurrentHourlyRate(activeRentals, gpus)}/hr`}
                  icon={DollarSign}
                />
                <StatCard
                  title="Total Spent"
                  value={`Ksh ${renterStats.totalSpent.toFixed(2)}`}
                  icon={CreditCard}
                />
              </>
            )}
            
            {(user?.role === "rentee" || user?.role === "both") && (
              <>
                <StatCard
                  title="Total GPUs"
                  value={renteeStats.totalGpus}
                  icon={Cpu}
                />
                <StatCard
                  title="Active Rentals"
                  value={renteeStats.activeGpus}
                  icon={Clock}
                />
                <StatCard
                  title="Available GPUs"
                  value={renteeStats.availableGpus}
                  icon={Cpu}
                />
                <StatCard
                  title="Total Income"
                  value={`Ksh ${renteeStats.totalIncome}`}
                  icon={DollarSign}
                />
              </>
            )}
          </div>
          
          {/* Mobile Search - only visible on mobile */}
          <div className="md:hidden relative mt-4">
            <Input
              type="text"
              placeholder="Search GPUs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          
          {/* Active Instances Section - only show for renters */}
          {(user?.role === "renter" || user?.role === "both") && activeRentals && activeRentals.length > 0 && (
            <div className="mt-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Active Instances</h2>
                <div className="flex items-center mt-2 md:mt-0 space-x-2">
                  <Button variant="outline" size="sm" className="text-sm">
                    All
                  </Button>
                  <Button variant="secondary" size="sm" className="text-sm bg-card">
                    Running
                  </Button>
                  <Button variant="outline" size="sm" className="text-sm text-muted-foreground">
                    Completed
                  </Button>
                </div>
              </div>
              
              {/* Desktop table view */}
              <div className="hidden md:block">
                <DataTable 
                  data={activeRentals}
                  columns={activeRentalColumns}
                  isLoading={isLoadingRentals}
                />
              </div>
              
              {/* Mobile cards view */}
              <div className="md:hidden space-y-3">
                {activeRentals.map(rental => {
                  const gpu = getGpuForRental(rental.gpuId);
                  return (
                    <ActiveInstanceCard
                      key={rental.id}
                      rental={rental}
                      gpuName={gpu?.name || "Unknown GPU"}
                      vram={`${gpu?.vram || 0}GB VRAM`}
                      pricePerHour={gpu?.pricePerHour || 0}
                      onViewDetails={() => handleViewRentalDetails(rental.id)}
                      onStop={() => stopRentalMutation.mutate(rental.id)}
                    />
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Available GPUs Section */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Available GPUs for Rent</h2>
            
            {/* GPU Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {isLoadingGpus ? (
                Array(3).fill(0).map((_, index) => (
                  <div 
                    key={index}
                    className="h-[280px] bg-card rounded-xl animate-pulse"
                  />
                ))
              ) : filteredGpus && filteredGpus.length > 0 ? (
                filteredGpus.slice(0, 3).map(gpu => (
                  <GpuCard 
                    key={gpu.id} 
                    gpu={gpu} 
                    onRent={handleRentGpu}
                    disableRent={user?.role !== "renter" && user?.role !== "both"}
                  />
                ))
              ) : (
                <div className="col-span-3 py-10 text-center">
                  <p className="text-muted-foreground">No GPUs available matching your search</p>
                </div>
              )}
            </div>
            
            {/* Show more button */}
            {filteredGpus && filteredGpus.length > 3 && (
              <div className="mt-4 text-center">
                <Button 
                  variant="outline" 
                  className="bg-card"
                  onClick={() => setLocation("/marketplace")}
                >
                  Show more GPUs
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </Button>
              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Rental Dialog */}
      <Dialog open={rentalDialogOpen} onOpenChange={setRentalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rent GPU: {selectedGpu?.name}</DialogTitle>
            <DialogDescription>
              Enter details to rent this GPU. You will be charged Ksh {selectedGpu?.pricePerHour} per hour.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...rentalForm}>
            <form onSubmit={rentalForm.handleSubmit(onRentalSubmit)} className="space-y-4">
              <FormField
                control={rentalForm.control}
                name="task"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Task Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., ML Training, Rendering, etc." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setRentalDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={rentGpuMutation.isPending}
                >
                  {rentGpuMutation.isPending ? "Processing..." : "Rent Now"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Rental Details Dialog */}
      <Dialog open={rentalDetailsOpen} onOpenChange={setRentalDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rental Details</DialogTitle>
          </DialogHeader>
          
          {selectedRental && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">GPU</p>
                  <p className="font-medium">{getGpuForRental(selectedRental.gpuId)?.name || "Unknown"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium capitalize">{selectedRental.status}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Task</p>
                  <p className="font-medium">{selectedRental.task || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Started</p>
                  <p className="font-medium">{new Date(selectedRental.startTime).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{formatDistanceToNow(new Date(selectedRental.startTime), { addSuffix: false })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Current Cost</p>
                  <p className="font-medium">
                    Ksh {getGpuForRental(selectedRental.gpuId)?.pricePerHour || 0}/hr
                  </p>
                </div>
              </div>
              
              <DialogFooter>
                <Button 
                  variant="destructive"
                  onClick={() => stopRentalMutation.mutate(selectedRental.id)}
                  disabled={stopRentalMutation.isPending}
                >
                  {stopRentalMutation.isPending ? "Processing..." : "Stop Rental"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
