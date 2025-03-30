import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { Cpu, DollarSign, Users, Clock, Loader2 } from "lucide-react";
import { Gpu, Rental } from "@shared/schema";
import { useEffect, useState } from "react";
import { format, subDays, startOfWeek, differenceInDays, subMonths, isSameMonth, isSameDay } from "date-fns";

export default function AnalyticsPage() {
  const { user } = useAuth();
  
  // Get dashboard stats
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });
  
  // Get all GPU data
  const { data: gpus = [], isLoading: isLoadingGpus } = useQuery<Gpu[]>({
    queryKey: ['/api/my/gpus'],
    queryFn: async () => {
      const res = await fetch('/api/my/gpus');
      if (!res.ok) throw new Error('Failed to fetch GPUs');
      return res.json();
    },
    enabled: user?.role === 'rentee' || user?.role === 'both',
  });
  
  // Get all rental transactions
  const { data: customerRentals = [], isLoading: isLoadingRentals } = useQuery<Rental[]>({
    queryKey: ['/api/my/customers'],
    queryFn: async () => {
      const res = await fetch('/api/my/customers');
      if (!res.ok) throw new Error('Failed to fetch customer rentals');
      return res.json();
    },
    enabled: user?.role === 'rentee' || user?.role === 'both',
  });
  
  // Generate daily rental data from the past week
  const [dailyRentals, setDailyRentals] = useState<Array<{name: string, rentals: number}>>([]);
  const [monthlyRevenue, setMonthlyRevenue] = useState<Array<{name: string, revenue: number}>>([]);
  const [gpuUsageData, setGpuUsageData] = useState<Array<{name: string, value: number}>>([]);
  const [topCustomers, setTopCustomers] = useState<Array<{id: number, name: string, rentals: number, spent: number}>>([]);
  
  // Process daily rentals data
  useEffect(() => {
    if (customerRentals.length > 0) {
      // Create data for each day of the last week
      const today = new Date();
      const weekStart = startOfWeek(today);
      const daysData = Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(today, 6 - i);
        return { 
          date,
          name: format(date, "EEE"), 
          rentals: 0 
        };
      });
      
      // Count rentals for each day
      customerRentals.forEach(rental => {
        if (rental.startTime) {
          const rentalDate = new Date(rental.startTime);
          // Only include rentals from the past week
          const daysDiff = differenceInDays(today, rentalDate);
          if (daysDiff <= 7) {
            const dayIndex = daysData.findIndex(day => 
              isSameDay(day.date, rentalDate)
            );
            
            if (dayIndex !== -1) {
              daysData[dayIndex].rentals += 1;
            }
          }
        }
      });
      
      setDailyRentals(daysData.map(({ name, rentals }) => ({ name, rentals })));
    } else {
      // Create empty data if no rentals
      const emptyData = Array.from({ length: 7 }).map((_, i) => {
        const date = subDays(new Date(), 6 - i);
        return { name: format(date, "EEE"), rentals: 0 };
      });
      setDailyRentals(emptyData);
    }
  }, [customerRentals]);
  
  // Process monthly revenue data
  useEffect(() => {
    if (customerRentals.length > 0) {
      // Create data for the last 6 months
      const monthsData = Array.from({ length: 6 }).map((_, i) => {
        const date = subMonths(new Date(), 5 - i);
        return { 
          date,
          name: format(date, "MMM"), 
          revenue: 0 
        };
      });
      
      // Sum revenue for each month
      customerRentals.forEach(rental => {
        if (rental.totalCost && rental.endTime) {
          const rentalDate = new Date(rental.endTime);
          const monthIndex = monthsData.findIndex(month => 
            isSameMonth(month.date, rentalDate)
          );
          
          if (monthIndex !== -1) {
            monthsData[monthIndex].revenue += rental.totalCost;
          }
        }
      });
      
      setMonthlyRevenue(monthsData.map(({ name, revenue }) => ({ 
        name, 
        revenue: Math.round(revenue) 
      })));
    } else {
      // Create empty data if no rentals
      const emptyData = Array.from({ length: 6 }).map((_, i) => {
        const date = subMonths(new Date(), 5 - i);
        return { name: format(date, "MMM"), revenue: 0 };
      });
      setMonthlyRevenue(emptyData);
    }
  }, [customerRentals]);
  
  // Process GPU usage data
  useEffect(() => {
    if (customerRentals.length > 0 && gpus.length > 0) {
      // Create a map of GPU usage hours
      const gpuHoursMap: Record<string, number> = {};
      
      // Calculate hours for each GPU
      customerRentals.forEach(rental => {
        if (rental.startTime && rental.endTime) {
          const gpu = gpus.find(g => g.id === rental.gpuId);
          if (gpu) {
            const gpuName = gpu.name;
            const startTime = new Date(rental.startTime);
            const endTime = new Date(rental.endTime);
            const hours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
            
            if (!gpuHoursMap[gpuName]) {
              gpuHoursMap[gpuName] = 0;
            }
            gpuHoursMap[gpuName] += hours;
          }
        }
      });
      
      // Convert to chart data format
      const chartData = Object.entries(gpuHoursMap).map(([name, value]) => ({
        name,
        value: Math.round(value)
      }));
      
      // Sort by value descending and limit to top 5
      chartData.sort((a, b) => b.value - a.value);
      setGpuUsageData(chartData.slice(0, 5));
    } else if (gpus.length > 0) {
      // Create empty data for all GPUs
      setGpuUsageData(gpus.slice(0, 5).map(gpu => ({
        name: gpu.name,
        value: 0
      })));
    } else {
      setGpuUsageData([]);
    }
  }, [customerRentals, gpus]);
  
  // Process top customers data
  useEffect(() => {
    if (customerRentals.length > 0) {
      // Group rentals by renter ID
      const customerMap: Record<number, { id: number, name: string, rentals: number, spent: number }> = {};
      
      customerRentals.forEach(rental => {
        const renterId = rental.renterId;
        if (!customerMap[renterId]) {
          customerMap[renterId] = {
            id: renterId,
            name: `User ${renterId}`, // We would need to fetch actual names
            rentals: 0,
            spent: 0
          };
        }
        
        customerMap[renterId].rentals += 1;
        if (rental.totalCost) {
          customerMap[renterId].spent += rental.totalCost;
        }
      });
      
      // Convert to array and sort by amount spent
      const topCustomersList = Object.values(customerMap)
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 3);
      
      setTopCustomers(topCustomersList);
    } else {
      setTopCustomers([]);
    }
  }, [customerRentals]);
  
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];
  
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
            <h1 className="text-2xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground">Monitor the performance of your GPU rentals</p>
          </div>
          
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {isLoadingStats ? (
              // Loading skeleton
              Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="p-6 flex justify-center items-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </Card>
              ))
            ) : stats?.rentee ? (
              // Real data from API
              <>
                <StatCard
                  title="Total Rentals"
                  value={customerRentals.length.toString()}
                  icon={Cpu}
                  description="All time transactions"
                />
                <StatCard
                  title="Active Rentals"
                  value={customerRentals.filter(r => r.status === "running").length.toString()}
                  icon={Clock}
                  description="Current active rentals"
                />
                <StatCard
                  title="Total Revenue"
                  value={`Ksh ${stats.rentee.totalIncome.toFixed(2)}`}
                  icon={DollarSign}
                  description="All time earnings"
                />
                <StatCard
                  title="Unique Customers"
                  value={new Set(customerRentals.map(r => r.renterId)).size.toString()}
                  icon={Users}
                  description="Distinct customer count"
                />
              </>
            ) : (
              // Fallback for users without data
              <>
                <StatCard
                  title="Total Rentals"
                  value="0"
                  icon={Cpu}
                  description="All time transactions"
                />
                <StatCard
                  title="Active Rentals"
                  value="0"
                  icon={Clock}
                  description="Current active rentals"
                />
                <StatCard
                  title="Total Revenue"
                  value="Ksh 0.00"
                  icon={DollarSign}
                  description="All time earnings"
                />
                <StatCard
                  title="Unique Customers"
                  value="0"
                  icon={Users}
                  description="Distinct customer count"
                />
              </>
            )}
          </div>
          
          {/* Charts Row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Daily Rentals Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Rentals</CardTitle>
                <CardDescription>Number of GPU rentals per day</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dailyRentals} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="rentals" fill="var(--primary)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            {/* Monthly Revenue Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Revenue</CardTitle>
                <CardDescription>Revenue generated per month (Ksh)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyRevenue} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="revenue" stroke="var(--primary)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Charts Row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* GPU Usage Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>GPU Usage Distribution</CardTitle>
                <CardDescription>Rental time in hours by GPU model</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={gpuUsageData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                        label={({name, percent}) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {gpuUsageData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            {/* Top Customers */}
            <Card>
              <CardHeader>
                <CardTitle>Top Customers</CardTitle>
                <CardDescription>Users who rent your GPUs the most</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingRentals ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : topCustomers.length > 0 ? (
                  <div className="space-y-4">
                    {topCustomers.map((customer) => (
                      <div key={customer.id} className="flex justify-between items-center py-2 border-b border-border">
                        <div className="flex items-center">
                          <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-white font-bold mr-3">
                            {customer.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="text-base font-medium">{customer.name}</h4>
                            <p className="text-xs text-muted-foreground">{customer.rentals} total rentals</p>
                          </div>
                        </div>
                        <p className="font-medium">Ksh {customer.spent.toFixed(2)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No customer data found.
                  </div>
                )}
              </CardContent>
              <CardFooter>
                <button className="text-sm text-primary hover:underline w-full text-center">
                  View all customers
                </button>
              </CardFooter>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
