import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer
} from "recharts";
import { format, subMonths, startOfMonth, isSameMonth } from "date-fns";
import { 
  DollarSign, 
  ArrowUpRight, 
  ArrowDownRight, 
  Wallet, 
  Calendar, 
  CreditCard, 
  Loader2,
  CircleDollarSign,
  AlertCircle 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Rental } from "@shared/schema";

export default function IncomePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // State for dialogs
  const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false);
  const [allTransactionsDialogOpen, setAllTransactionsDialogOpen] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  
  // Get dashboard stats for current user
  const { data: stats, isLoading: isLoadingStats } = useQuery({
    queryKey: ['/api/dashboard/stats'],
    queryFn: async () => {
      const res = await fetch('/api/dashboard/stats');
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
  });

  // Get all rental transactions for the user's GPUs
  const { data: customerRentals = [], isLoading: isLoadingRentals } = useQuery<Rental[]>({
    queryKey: ['/api/my/customers'],
    queryFn: async () => {
      const res = await fetch('/api/my/customers');
      if (!res.ok) throw new Error('Failed to fetch customer rentals');
      return res.json();
    },
    enabled: !!user && user.role !== 'renter',
  });

  // Function to calculate the current month's income
  const calculateMonthlyIncome = (rentals: Rental[]): number => {
    const currentDate = new Date();
    let monthlyIncome = 0;
    
    rentals.forEach(rental => {
      if (rental.totalCost && rental.endTime) {
        const rentalDate = new Date(rental.endTime);
        if (isSameMonth(currentDate, rentalDate)) {
          monthlyIncome += rental.totalCost;
        }
      }
    });
    
    return monthlyIncome;
  };

  // Calculate monthly earnings from rental data
  const [monthlyEarnings, setMonthlyEarnings] = useState<Array<{name: string, earnings: number}>>([]);
  
  useEffect(() => {
    if (customerRentals.length > 0) {
      // Create data for the last 6 months
      const monthsData = Array.from({ length: 6 }).map((_, i) => {
        const date = subMonths(new Date(), i);
        return { 
          date,
          name: format(date, "MMM"), 
          earnings: 0 
        };
      }).reverse();
      
      // Calculate earnings for each month
      customerRentals.forEach(rental => {
        if (rental.totalCost && rental.endTime) {
          const rentalDate = new Date(rental.endTime);
          const monthIndex = monthsData.findIndex(month => 
            isSameMonth(month.date, rentalDate)
          );
          
          if (monthIndex !== -1) {
            monthsData[monthIndex].earnings += rental.totalCost;
          }
        }
      });
      
      setMonthlyEarnings(monthsData.map(({ name, earnings }) => ({ 
        name, 
        earnings: parseFloat(earnings.toFixed(2)) 
      })));
    } else if (customerRentals.length === 0) {
      // If no rental data, create empty chart data
      const emptyData = Array.from({ length: 6 }).map((_, i) => {
        const date = subMonths(new Date(), i);
        return { name: format(date, "MMM"), earnings: 0 };
      }).reverse();
      
      setMonthlyEarnings(emptyData);
    }
  }, [customerRentals]);
  
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
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold">Income Dashboard</h1>
              <p className="text-muted-foreground">Track and withdraw your GPU rental earnings</p>
            </div>
            
            <Button 
              className="flex items-center"
              onClick={() => setWithdrawDialogOpen(true)}
            >
              <Wallet className="h-4 w-4 mr-2" />
              Withdraw Funds
            </Button>
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
                  title="Available Balance"
                  value={`Ksh ${stats.rentee.totalIncome.toFixed(2)}`}
                  icon={Wallet}
                  description="Available for withdrawal"
                />
                <StatCard
                  title="Active GPUs"
                  value={stats.rentee.activeGpus}
                  icon={Calendar}
                  description={`Out of ${stats.rentee.totalGpus} total GPUs`}
                />
                <StatCard
                  title="Monthly Income"
                  value={`Ksh ${calculateMonthlyIncome(customerRentals).toFixed(2)}`}
                  icon={DollarSign}
                />
                <StatCard
                  title="Total Income"
                  value={`Ksh ${stats.rentee.totalIncome.toFixed(2)}`}
                  icon={CreditCard}
                  description="All time earnings"
                />
              </>
            ) : (
              // Fallback if no data available
              <>
                <StatCard
                  title="Available Balance"
                  value="Ksh 0.00"
                  icon={Wallet}
                  description="Available for withdrawal"
                />
                <StatCard
                  title="Active GPUs"
                  value="0"
                  icon={Calendar}
                  description="Out of 0 total GPUs"
                />
                <StatCard
                  title="Monthly Income"
                  value="Ksh 0.00"
                  icon={DollarSign}
                />
                <StatCard
                  title="Total Income"
                  value="Ksh 0.00"
                  icon={CreditCard}
                  description="All time earnings"
                />
              </>
            )}
          </div>
          
          {/* Income Chart */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Monthly Earnings</CardTitle>
              <CardDescription>Your earnings over the past 6 months</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyEarnings} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <RechartsTooltip 
                      formatter={(value: number) => [`Ksh ${value}`, "Earnings"]}
                      labelFormatter={(label: string) => `Month: ${label}`}
                    />
                    <Bar dataKey="earnings" fill="var(--primary)" name="Earnings" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
          
          {/* Transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your recent earnings and withdrawals</CardDescription>
              </div>
              <Tabs defaultValue="all" className="w-[400px]">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="earnings">Earnings</TabsTrigger>
                  <TabsTrigger value="withdrawals">Withdrawals</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
            <CardContent>
              {isLoadingRentals ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : customerRentals.length > 0 ? (
                <div className="space-y-4">
                  {/* Display real customer rentals */}
                  {customerRentals
                    .filter(rental => rental.status === "completed" && rental.totalCost)
                    .sort((a, b) => new Date(b.endTime || 0).getTime() - new Date(a.endTime || 0).getTime())
                    .slice(0, 5)
                    .map(rental => (
                      <div key={rental.id} className="flex justify-between items-center py-2 border-b border-border">
                        <div className="flex items-start">
                          <div className="h-8 w-8 rounded-md bg-opacity-20 bg-green-700 flex items-center justify-center text-green-700 mr-3">
                            <ArrowUpRight className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-base font-medium">Rental Earning</h4>
                            <p className="text-xs text-muted-foreground">Rental ID: {rental.id}</p>
                            <p className="text-xs text-muted-foreground">
                              {rental.endTime ? format(new Date(rental.endTime), "PPp") : "Ongoing"}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-500">+Ksh {rental.totalCost?.toFixed(2)}</p>
                          <Badge variant="outline" className="bg-green-900/20 text-green-400 hover:bg-green-900/30">
                            {rental.status}
                          </Badge>
                        </div>
                      </div>
                    ))}

                  {/* Add a placeholder if not enough real transactions */}
                  {customerRentals.filter(rental => rental.status === "completed").length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      No completed rentals found.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No transaction history found.
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setAllTransactionsDialogOpen(true)}
              >
                View All Transactions
              </Button>
            </CardFooter>
          </Card>
        </main>
      </div>
    
      {/* Withdraw Funds Dialog */}
      <Dialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Withdraw Funds</DialogTitle>
            <DialogDescription>
              Enter the amount you want to withdraw and your payment method details.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="amount" className="text-right text-sm font-medium">
                Amount (Ksh)
              </label>
              <input
                id="amount"
                type="number"
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                placeholder="Enter amount"
                min={0}
                max={stats?.rentee?.totalIncome || 0}
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="payment-method" className="text-right text-sm font-medium">
                Payment Method
              </label>
              <select
                id="payment-method"
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
              >
                <option value="mpesa">M-Pesa</option>
                <option value="bank">Bank Transfer</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <label htmlFor="phone-email" className="text-right text-sm font-medium">
                Phone/Email
              </label>
              <input
                id="phone-email"
                type="text"
                className="col-span-3 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                placeholder="Enter phone number or email"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                setIsWithdrawing(true);
                // Simulate API call
                setTimeout(() => {
                  setIsWithdrawing(false);
                  setWithdrawDialogOpen(false);
                  toast({
                    title: "Withdrawal Requested",
                    description: "Your withdrawal has been requested and will be processed soon.",
                  });
                }, 1500);
              }}
              disabled={isWithdrawing}
            >
              {isWithdrawing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                "Withdraw Funds"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* All Transactions Dialog */}
      <Dialog open={allTransactionsDialogOpen} onOpenChange={setAllTransactionsDialogOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>All Transactions</DialogTitle>
            <DialogDescription>
              View all your earning and withdrawal transactions.
            </DialogDescription>
          </DialogHeader>

          {customerRentals && customerRentals.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Rental ID</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerRentals
                  .filter(rental => rental.status === "completed" && rental.totalCost)
                  .sort((a, b) => new Date(b.endTime || 0).getTime() - new Date(a.endTime || 0).getTime())
                  .map(rental => (
                    <TableRow key={rental.id}>
                      <TableCell>{rental.endTime ? format(new Date(rental.endTime), "PPp") : "Ongoing"}</TableCell>
                      <TableCell>{rental.id}</TableCell>
                      <TableCell>GPU Rental Income</TableCell>
                      <TableCell className="text-green-500">+Ksh {rental.totalCost?.toFixed(2)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-900/20 text-green-400 hover:bg-green-900/30">
                          {rental.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transaction history found.
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setAllTransactionsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
