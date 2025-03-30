import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { DataTable } from "@/components/dashboard/data-table";
import { Gpu, InsertGpu, Rental } from "@shared/schema";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { 
  PlusCircle, 
  Pencil, 
  Trash2, 
  Cpu, 
  CheckCircle, 
  AlertCircle, 
  Users,
  Loader2
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { z } from "zod";
import { format } from "date-fns";
import { gpuFormSchema, GpuFormValues } from "@/types/gpu-form";

// Column type definition (with the same structure as the DataTable component expects)
interface Column<T> {
  header: string;
  accessorKey: keyof T | string | ((row: T) => any);
  cell?: (row: T) => React.ReactNode;
}

export default function MyGpusPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedGpu, setSelectedGpu] = useState<Gpu | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customersDialogOpen, setCustomersDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Fetch GPUs owned by the current user
  const { data: gpus, isLoading: isLoadingGpus } = useQuery<Gpu[]>({
    queryKey: ["/api/my/gpus"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/my/gpus");
      return res.json();
    }
  });
  
  // Fetch active rentals for GPUs
  const { data: customerRentals } = useQuery<Rental[]>({
    queryKey: ["/api/my/customers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/my/customers");
      return res.json();
    }
  });
  
  // Create GPU form
  const createForm = useForm<GpuFormValues>({
    resolver: zodResolver(gpuFormSchema),
    defaultValues: {
      name: "",
      manufacturer: "",
      vram: "0",
      cudaCores: "",
      baseClock: "",
      boostClock: "",
      pricePerHour: "0",
      tdp: "",
      maxTemp: "",
      powerDraw: "",
      coolingSystem: "",
      memoryType: "",
      psuRecommendation: "",
      powerConnectors: "",
    }
  });
  
  // Edit GPU form
  const editForm = useForm<GpuFormValues>({
    resolver: zodResolver(gpuFormSchema),
    defaultValues: {
      name: "",
      manufacturer: "",
      vram: "0",
      cudaCores: "",
      baseClock: "",
      boostClock: "",
      pricePerHour: "0",
      tdp: "",
      maxTemp: "",
      powerDraw: "",
      coolingSystem: "",
      memoryType: "",
      psuRecommendation: "",
      powerConnectors: "",
    }
  });
  
  // Add GPU mutation
  const addGpuMutation = useMutation({
    mutationFn: async (data: InsertGpu) => {
      await apiRequest("POST", "/api/gpus", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/gpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Success",
        description: "GPU has been added successfully",
      });
      
      setAddDialogOpen(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to add GPU: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Update GPU mutation
  const updateGpuMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number, data: Partial<Gpu> }) => {
      await apiRequest("PATCH", `/api/gpus/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/gpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gpus"] });
      
      toast({
        title: "Success",
        description: "GPU has been updated successfully",
      });
      
      setEditDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to update GPU: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Delete GPU mutation
  const deleteGpuMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/gpus/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/my/gpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gpus"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      
      toast({
        title: "Success",
        description: "GPU has been deleted successfully",
      });
      
      setDeleteDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `Failed to delete GPU: ${error.message}`,
        variant: "destructive",
      });
    }
  });
  
  // Handle add GPU form submission
  const onAddSubmit = (data: GpuFormValues) => {
    // Convert string fields to appropriate types
    const gpuData: InsertGpu = {
      name: data.name,
      manufacturer: data.manufacturer,
      vram: Number(data.vram),
      cudaCores: data.cudaCores ? Number(data.cudaCores) : null,
      baseClock: data.baseClock ? Number(data.baseClock) : null,
      boostClock: data.boostClock ? Number(data.boostClock) : null,
      pricePerHour: Number(data.pricePerHour),
      ownerId: user!.id,
      tdp: data.tdp ? Number(data.tdp) : null,
      maxTemp: data.maxTemp ? Number(data.maxTemp) : null,
      powerDraw: data.powerDraw ? Number(data.powerDraw) : null,
      coolingSystem: data.coolingSystem || null,
      // New fields
      memoryType: data.memoryType || null,
      psuRecommendation: data.psuRecommendation ? Number(data.psuRecommendation) : null,
      powerConnectors: data.powerConnectors || null,
    };
    
    addGpuMutation.mutate(gpuData);
  };
  
  // Handle edit GPU form submission
  const onEditSubmit = (data: GpuFormValues) => {
    if (!selectedGpu) return;
    
    // Convert string fields to appropriate types
    const gpuData: Partial<Gpu> = {
      name: data.name,
      manufacturer: data.manufacturer,
      vram: Number(data.vram),
      cudaCores: data.cudaCores ? Number(data.cudaCores) : null,
      baseClock: data.baseClock ? Number(data.baseClock) : null,
      boostClock: data.boostClock ? Number(data.boostClock) : null,
      pricePerHour: Number(data.pricePerHour),
      tdp: data.tdp ? Number(data.tdp) : null,
      maxTemp: data.maxTemp ? Number(data.maxTemp) : null,
      powerDraw: data.powerDraw ? Number(data.powerDraw) : null,
      coolingSystem: data.coolingSystem || null,
      // New fields
      memoryType: data.memoryType || null,
      psuRecommendation: data.psuRecommendation ? Number(data.psuRecommendation) : null,
      powerConnectors: data.powerConnectors || null,
    };
    
    updateGpuMutation.mutate({ id: selectedGpu.id, data: gpuData });
  };
  
  // Handle delete GPU
  const handleDeleteGpu = () => {
    if (selectedGpu) {
      deleteGpuMutation.mutate(selectedGpu.id);
    }
  };
  
  // Handle edit GPU dialog
  const handleEditGpu = (gpu: Gpu) => {
    setSelectedGpu(gpu);
    editForm.reset({
      name: gpu.name,
      manufacturer: gpu.manufacturer,
      vram: gpu.vram.toString(),
      cudaCores: gpu.cudaCores ? gpu.cudaCores.toString() : "",
      baseClock: gpu.baseClock ? gpu.baseClock.toString() : "",
      boostClock: gpu.boostClock ? gpu.boostClock.toString() : "",
      pricePerHour: gpu.pricePerHour.toString(),
      tdp: gpu.tdp ? gpu.tdp.toString() : "",
      maxTemp: gpu.maxTemp ? gpu.maxTemp.toString() : "",
      powerDraw: gpu.powerDraw ? gpu.powerDraw.toString() : "",
      coolingSystem: gpu.coolingSystem || "",
      // New fields
      memoryType: gpu.memoryType || "",
      psuRecommendation: gpu.psuRecommendation ? gpu.psuRecommendation.toString() : "",
      powerConnectors: gpu.powerConnectors || "",
    });
    setEditDialogOpen(true);
  };
  
  // Handle delete GPU dialog
  const handleConfirmDelete = (gpu: Gpu) => {
    setSelectedGpu(gpu);
    setDeleteDialogOpen(true);
  };
  
  // Handle view customers dialog
  const handleViewCustomers = (gpu: Gpu) => {
    setSelectedGpu(gpu);
    setCustomersDialogOpen(true);
  };
  
  // Get rentals for a specific GPU
  const getRentalsForGpu = (gpuId: number) => {
    return customerRentals?.filter(rental => rental.gpuId === gpuId) || [];
  };
  
  // Filter GPUs by search query
  const filteredGpus = gpus?.filter(gpu => 
    gpu.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    gpu.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Prepare column configuration for GPU table
  const gpuColumns: Column<Gpu>[] = [
    {
      header: "GPU",
      accessorKey: "name",
      cell: (row: Gpu) => (
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-md bg-opacity-20 bg-primary flex items-center justify-center text-primary mr-3">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-medium">{row.name}</div>
            <div className="text-xs text-muted-foreground">{row.manufacturer}</div>
          </div>
        </div>
      )
    },
    {
      header: "VRAM",
      accessorKey: "vram",
      cell: (row: Gpu) => `${row.vram} GB`
    },
    {
      header: "Clock Speed",
      accessorKey: "boostClock",
      cell: (row: Gpu) => row.boostClock ? `${row.boostClock} GHz` : "N/A"
    },
    {
      header: "Price",
      accessorKey: "pricePerHour",
      cell: (row: Gpu) => `Ksh ${row.pricePerHour}/hr`
    },
    {
      header: "Status",
      accessorKey: "available",
      cell: (row: Gpu) => row.available ? (
        <Badge className="bg-green-700 hover:bg-green-700">Available</Badge>
      ) : (
        <Badge className="bg-orange-700 hover:bg-orange-700">In Use</Badge>
      )
    },
    {
      header: "Actions",
      accessorKey: "id",
      cell: (row: Gpu) => (
        <div className="flex justify-end space-x-2">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => handleViewCustomers(row)}
            disabled={getRentalsForGpu(row.id).length === 0}
          >
            <Users className="h-4 w-4 mr-1" />
            <span>Rentals</span>
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-primary"
            onClick={() => handleEditGpu(row)}
            disabled={!row.available}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            className="text-destructive"
            onClick={() => handleConfirmDelete(row)}
            disabled={!row.available}
          >
            <Trash2 className="h-4 w-4" />
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
          placeholder: "Search your GPUs..." 
        }} />
        
        {/* Content Area */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {/* Page Title with Add Button */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold">My GPUs</h1>
              <p className="text-muted-foreground">Manage your GPU listings</p>
            </div>
            
            <Button 
              onClick={() => setAddDialogOpen(true)}
              className="flex items-center"
            >
              <PlusCircle className="h-5 w-5 mr-2" />
              Add New GPU
            </Button>
          </div>
          
          {/* Mobile Search - only visible on mobile */}
          <div className="md:hidden relative mb-4">
            <Input
              type="text"
              placeholder="Search your GPUs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          
          {/* GPU Table */}
          <DataTable 
            data={filteredGpus || []}
            columns={gpuColumns}
            isLoading={isLoadingGpus}
          />
          
          {/* Empty state */}
          {filteredGpus?.length === 0 && !isLoadingGpus && (
            <Card className="mt-6">
              <CardContent className="flex flex-col items-center justify-center py-10">
                <Cpu className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No GPUs found</h3>
                <p className="text-muted-foreground text-center max-w-md">
                  You haven't added any GPUs yet. Add your first GPU to start renting it out.
                </p>
                <Button 
                  className="mt-4"
                  onClick={() => setAddDialogOpen(true)}
                >
                  <PlusCircle className="h-5 w-5 mr-2" />
                  Add New GPU
                </Button>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
      
      {/* Add GPU Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New GPU</DialogTitle>
            <DialogDescription>
              Enter the details of the GPU you want to list for rent
            </DialogDescription>
          </DialogHeader>
          
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onAddSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GPU Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. RTX 4090" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. NVIDIA GeForce" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={createForm.control}
                name="vram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VRAM (GB)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="e.g. 24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="cudaCores"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CUDA Cores (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="e.g. 16384" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="baseClock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Clock (GHz) (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="e.g. 2.23" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={createForm.control}
                  name="boostClock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Boost Clock (GHz) (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="e.g. 2.52" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={createForm.control}
                  name="pricePerHour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per Hour (Ksh)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" placeholder="e.g. 250" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Thermal and Power Specifications</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="tdp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TDP (W) (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="e.g. 450" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="maxTemp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Temp (°C) (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="e.g. 90" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={createForm.control}
                    name="powerDraw"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Power Draw (W) (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="e.g. 400" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="coolingSystem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cooling System (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Triple Fan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Additional Specifications</h3>
                <FormField
                  control={createForm.control}
                  name="memoryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Memory Type (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. GDDR6X" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={createForm.control}
                    name="psuRecommendation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PSU Recommended (W) (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="e.g. 850" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="powerConnectors"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Power Connectors (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1x 16-pin" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <DialogFooter className="mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setAddDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createForm.formState.isSubmitting || addGpuMutation.isPending}
                >
                  {(createForm.formState.isSubmitting || addGpuMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add GPU
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit GPU Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit GPU</DialogTitle>
            <DialogDescription>
              Update the details of your GPU
            </DialogDescription>
          </DialogHeader>
          
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GPU Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. RTX 4090" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="manufacturer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manufacturer</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. NVIDIA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={editForm.control}
                name="vram"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>VRAM (GB)</FormLabel>
                    <FormControl>
                      <Input type="number" min="1" placeholder="e.g. 24" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="cudaCores"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CUDA Cores (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" placeholder="e.g. 16384" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="baseClock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Clock (GHz) (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="e.g. 2.23" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="boostClock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Boost Clock (GHz) (optional)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" min="0" placeholder="e.g. 2.52" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="pricePerHour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price per Hour (Ksh)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" step="0.01" placeholder="e.g. 250" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Thermal and Power Specifications</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="tdp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>TDP (W) (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="e.g. 450" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="maxTemp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Temp (°C) (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="e.g. 90" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={editForm.control}
                    name="powerDraw"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Power Draw (W) (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="e.g. 400" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="coolingSystem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cooling System (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Triple Fan" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-3">Additional Specifications</h3>
                <FormField
                  control={editForm.control}
                  name="memoryType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Memory Type (optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. GDDR6X" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={editForm.control}
                    name="psuRecommendation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PSU Recommended (W) (optional)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" placeholder="e.g. 850" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="powerConnectors"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Power Connectors (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 1x 16-pin" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <DialogFooter className="mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={editForm.formState.isSubmitting || updateGpuMutation.isPending}
                >
                  {(editForm.formState.isSubmitting || updateGpuMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update GPU
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Delete GPU Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete GPU</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this GPU? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          
          {selectedGpu && (
            <div className="py-4">
              <div className="flex items-center mb-4">
                <div className="h-10 w-10 rounded-md bg-opacity-20 bg-primary flex items-center justify-center text-primary mr-3">
                  <Cpu className="h-6 w-6" />
                </div>
                <div>
                  <div className="font-medium">{selectedGpu.name}</div>
                  <div className="text-sm text-muted-foreground">{selectedGpu.manufacturer}</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-y-2 text-sm">
                <div className="text-muted-foreground">VRAM:</div>
                <div>{selectedGpu.vram} GB</div>
                
                <div className="text-muted-foreground">Clock Speed:</div>
                <div>{selectedGpu.boostClock ? `${selectedGpu.boostClock} GHz` : "N/A"}</div>
                
                <div className="text-muted-foreground">Price per Hour:</div>
                <div>Ksh {selectedGpu.pricePerHour}</div>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="button"
              variant="destructive"
              onClick={handleDeleteGpu}
              disabled={deleteGpuMutation.isPending}
            >
              {deleteGpuMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete GPU
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* View Customers Dialog */}
      <Dialog open={customersDialogOpen} onOpenChange={setCustomersDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>GPU Rentals</DialogTitle>
            <DialogDescription>
              {selectedGpu && `Viewing rental history for ${selectedGpu.name}`}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            {selectedGpu && customerRentals && (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4">Renter</th>
                      <th className="text-left py-2 px-4">Start Time</th>
                      <th className="text-left py-2 px-4">End Time</th>
                      <th className="text-left py-2 px-4">Duration</th>
                      <th className="text-left py-2 px-4">Status</th>
                      <th className="text-left py-2 px-4">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getRentalsForGpu(selectedGpu.id).map(rental => {
                      const duration = rental.endTime 
                        ? Math.round((new Date(rental.endTime).getTime() - new Date(rental.startTime).getTime()) / (1000 * 60 * 60)) 
                        : Math.round((new Date().getTime() - new Date(rental.startTime).getTime()) / (1000 * 60 * 60));
                        
                      const cost = duration * selectedGpu.pricePerHour;
                      
                      return (
                        <tr key={rental.id} className="border-b">
                          <td className="py-2 px-4">User #{rental.renterId}</td>
                          <td className="py-2 px-4">{format(new Date(rental.startTime), "PPp")}</td>
                          <td className="py-2 px-4">
                            {rental.endTime ? format(new Date(rental.endTime), "PPp") : "Ongoing"}
                          </td>
                          <td className="py-2 px-4">{duration} hour(s)</td>
                          <td className="py-2 px-4">
                            {rental.endTime ? (
                              <Badge className="bg-green-700 hover:bg-green-700">Completed</Badge>
                            ) : (
                              <Badge className="bg-orange-700 hover:bg-orange-700">Active</Badge>
                            )}
                          </td>
                          <td className="py-2 px-4">Ksh {cost}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              type="button" 
              onClick={() => setCustomersDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}