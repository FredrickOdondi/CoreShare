import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DataTable } from "@/components/ui/data-table";
import { Rental, Gpu } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Cpu, Clock } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ActiveInstanceCard } from "@/components/dashboard/active-instance-card";

export default function MyRentalsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("running");
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  
  // Fetch GPUs for reference
  const { data: gpus } = useQuery<Gpu[]>({
    queryKey: ["/api/gpus"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gpus");
      return res.json();
    }
  });
  
  // Fetch rentals for the current user
  const { data: rentals, isLoading: isLoadingRentals } = useQuery<Rental[]>({
    queryKey: ["/api/my/rentals"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/my/rentals");
      return res.json();
    }
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
      
      setDetailsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to stop rental: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Get GPU by ID
  const getGpuById = (gpuId: number) => {
    return gpus?.find(gpu => gpu.id === gpuId);
  };
  
  // View rental details
  const handleViewDetails = (rentalId: number) => {
    const rental = rentals?.find(r => r.id === rentalId);
    if (rental) {
      setSelectedRental(rental);
      setDetailsDialogOpen(true);
    }
  };
  
  // Filter rentals based on selected status
  const filteredRentals = rentals?.filter(rental => 
    selectedTab === "all" ? true : rental.status === selectedTab
  );
  
  // Calculate total cost
  const calculateCost = (rental: Rental) => {
    const gpu = getGpuById(rental.gpuId);
    if (!gpu) return 0;
    
    if (rental.totalCost !== null) {
      return rental.totalCost;
    }
    
    // Calculate current cost for running rentals
    const startTime = new Date(rental.startTime);
    const endTime = rental.endTime ? new Date(rental.endTime) : new Date();
    const hoursElapsed = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    return parseFloat((hoursElapsed * gpu.pricePerHour).toFixed(2));
  };
  
  // Prepare column configuration for rental table
  const rentalColumns = [
    {
      header: "GPU",
      accessorKey: "gpuId",
      cell: (row: Rental) => {
        const gpu = getGpuById(row.gpuId);
        return gpu ? (
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-md bg-opacity-20 bg-primary flex items-center justify-center text-primary mr-3">
              <Cpu className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium">{gpu.name}</div>
              <div className="text-xs text-muted-foreground">{gpu.vram}GB VRAM</div>
            </div>
          </div>
        ) : "Unknown GPU";
      }
    },
    {
      header: "Task",
      accessorKey: "task",
      cell: (row: Rental) => row.task || "N/A"
    },
    {
      header: "Start Time",
      accessorKey: "startTime",
      cell: (row: Rental) => format(new Date(row.startTime), "PPp")
    },
    {
      header: "Duration",
      accessorKey: (row: Rental) => {
        const startTime = new Date(row.startTime);
        if (row.status === "running") {
          return formatDistanceToNow(startTime, { addSuffix: false });
        } else if (row.endTime) {
          const endTime = new Date(row.endTime);
          const durationMs = endTime.getTime() - startTime.getTime();
          const hours = Math.floor(durationMs / (1000 * 60 * 60));
          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          return `${hours}h ${minutes}m`;
        }
        return "N/A";
      }
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (row: Rental) => {
        const statusMap = {
          running: <Badge className="bg-green-700 hover:bg-green-700">Running</Badge>,
          completed: <Badge className="bg-blue-700 hover:bg-blue-700">Completed</Badge>,
          cancelled: <Badge className="bg-red-700 hover:bg-red-700">Cancelled</Badge>
        };
        return statusMap[row.status as keyof typeof statusMap] || row.status;
      }
    },
    {
      header: "Cost",
      accessorKey: (row: Rental) => `Ksh ${calculateCost(row)}`,
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: Rental) => (
        <div className="flex justify-end space-x-2">
          <Button 
            variant="ghost" 
            size="sm"
            className="text-primary"
            onClick={() => handleViewDetails(row.id)}
          >
            Details
          </Button>
          {row.status === "running" && (
            <Button 
              variant="destructive" 
              size="sm"
              onClick={() => stopRentalMutation.mutate(row.id)}
              disabled={stopRentalMutation.isPending}
            >
              Stop
            </Button>
          )}
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
        <Header />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold">My Rentals</h1>
            <p className="text-muted-foreground">Manage all your GPU rentals</p>
          </div>
          
          {/* Tabs for filtering rentals */}
          <Tabs 
            defaultValue="running" 
            value={selectedTab}
            onValueChange={setSelectedTab}
            className="mb-6"
          >
            <TabsList>
              <TabsTrigger value="running">Running</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              <TabsTrigger value="all">All</TabsTrigger>
            </TabsList>
          </Tabs>
          
          {/* Desktop View - Table */}
          <div className="hidden md:block">
            <DataTable 
              data={filteredRentals || []}
              columns={rentalColumns}
              isLoading={isLoadingRentals}
            />
            
            {filteredRentals?.length === 0 && !isLoadingRentals && (
              <Card className="mt-6">
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No {selectedTab} rentals</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    {selectedTab === "running" 
                      ? "You don't have any active GPU rentals. Visit the marketplace to rent GPUs."
                      : `You don't have any ${selectedTab} rentals yet.`
                    }
                  </p>
                  {selectedTab === "running" && (
                    <Button 
                      className="mt-4"
                      onClick={() => window.location.href = "/marketplace"}
                    >
                      Explore Marketplace
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* Mobile View - Cards */}
          <div className="md:hidden space-y-4">
            {isLoadingRentals ? (
              Array(3).fill(0).map((_, index) => (
                <div 
                  key={index}
                  className="h-[200px] bg-card rounded-xl animate-pulse"
                />
              ))
            ) : filteredRentals && filteredRentals.length > 0 ? (
              filteredRentals.map(rental => {
                const gpu = getGpuById(rental.gpuId);
                return gpu ? (
                  <ActiveInstanceCard
                    key={rental.id}
                    rental={rental}
                    gpuName={gpu.name}
                    vram={`${gpu.vram}GB VRAM`}
                    pricePerHour={gpu.pricePerHour}
                    onViewDetails={() => handleViewDetails(rental.id)}
                    onStop={() => stopRentalMutation.mutate(rental.id)}
                    className={rental.status !== "running" ? "opacity-75" : ""}
                  />
                ) : null;
              })
            ) : (
              <Card className="mt-6">
                <CardContent className="flex flex-col items-center justify-center py-10">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No {selectedTab} rentals</h3>
                  <p className="text-muted-foreground text-center max-w-md">
                    {selectedTab === "running" 
                      ? "You don't have any active GPU rentals. Visit the marketplace to rent GPUs."
                      : `You don't have any ${selectedTab} rentals yet.`
                    }
                  </p>
                  {selectedTab === "running" && (
                    <Button 
                      className="mt-4"
                      onClick={() => window.location.href = "/marketplace"}
                    >
                      Explore Marketplace
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
      
      {/* Rental Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rental Details</DialogTitle>
            {selectedRental && (
              <DialogDescription>
                {selectedRental.status === "running" ? "Current" : "Completed"} rental for 
                {" "}{getGpuById(selectedRental.gpuId)?.name}
              </DialogDescription>
            )}
          </DialogHeader>
          
          {selectedRental && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">GPU</p>
                  <p className="font-medium">{getGpuById(selectedRental.gpuId)?.name || "Unknown"}</p>
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
                  <p className="font-medium">
                    {format(new Date(selectedRental.startTime), "PPp")}
                  </p>
                </div>
                
                {selectedRental.endTime && (
                  <div>
                    <p className="text-sm text-muted-foreground">Ended</p>
                    <p className="font-medium">
                      {format(new Date(selectedRental.endTime), "PPp")}
                    </p>
                  </div>
                )}
                
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">
                    {selectedRental.status === "running" 
                      ? formatDistanceToNow(new Date(selectedRental.startTime), { addSuffix: false })
                      : selectedRental.endTime 
                        ? formatDistanceToNow(
                            new Date(selectedRental.startTime), 
                            { addSuffix: false, end: new Date(selectedRental.endTime) }
                          )
                        : "N/A"
                    }
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">
                    {selectedRental.status === "running" ? "Current Cost" : "Total Cost"}
                  </p>
                  <p className="font-medium">
                    Ksh {calculateCost(selectedRental)}
                  </p>
                </div>
                
                <div>
                  <p className="text-sm text-muted-foreground">Rate</p>
                  <p className="font-medium">
                    Ksh {getGpuById(selectedRental.gpuId)?.pricePerHour || 0}/hr
                  </p>
                </div>
              </div>
              
              {selectedRental.status === "running" && (
                <DialogFooter>
                  <Button 
                    variant="destructive"
                    onClick={() => stopRentalMutation.mutate(selectedRental.id)}
                    disabled={stopRentalMutation.isPending}
                  >
                    {stopRentalMutation.isPending ? "Processing..." : "Stop Rental"}
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
