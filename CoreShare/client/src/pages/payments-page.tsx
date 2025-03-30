import { useAuth } from "@/hooks/use-auth";
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
import { Button } from "@/components/ui/button";
import { CreditCard, PlusCircle, Clock, CheckCircle, AlertCircle } from "lucide-react";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function PaymentsPage() {
  const { user } = useAuth();
  
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
            <h1 className="text-2xl font-bold">Payments</h1>
            <p className="text-muted-foreground">Manage your payment methods and transaction history</p>
          </div>
          
          {/* Payment Tabs */}
          <Tabs defaultValue="methods" className="mb-6">
            <TabsList>
              <TabsTrigger value="methods">Payment Methods</TabsTrigger>
              <TabsTrigger value="history">Transaction History</TabsTrigger>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
            </TabsList>
            
            {/* Payment Methods Tab */}
            <TabsContent value="methods">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Add Payment Method Card */}
                <Card className="bg-muted/40 border-dashed hover:bg-muted/70 transition-colors cursor-pointer">
                  <CardContent className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                    <PlusCircle className="h-10 w-10 mb-4" />
                    <p>Add payment method</p>
                  </CardContent>
                </Card>
                
                {/* Demo Payment Method Card */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center">
                        <div className="h-10 w-10 rounded-md bg-opacity-20 bg-primary flex items-center justify-center text-primary mr-3">
                          <CreditCard className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-base font-medium">•••• •••• •••• 4234</h3>
                          <p className="text-xs text-muted-foreground">Expires 12/25</p>
                        </div>
                      </div>
                      <Badge>Default</Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">VISA</span>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="ghost">Edit</Button>
                        <Button size="sm" variant="ghost" className="text-destructive">Remove</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            
            {/* Transaction History Tab */}
            <TabsContent value="history">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>Your recent payment history for GPU rentals</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Sample transaction items */}
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <div className="flex items-start">
                        <div className="h-8 w-8 rounded-md bg-opacity-20 bg-green-700 flex items-center justify-center text-green-700 mr-3">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-medium">GPU Rental Payment</h4>
                          <p className="text-xs text-muted-foreground">NVIDIA RTX 4090 - 2 hours</p>
                          <p className="text-xs text-muted-foreground">March 26, 2025</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Ksh 156.00</p>
                        <Badge variant="outline" className="bg-green-900/20 text-green-400 hover:bg-green-900/30">
                          Completed
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <div className="flex items-start">
                        <div className="h-8 w-8 rounded-md bg-opacity-20 bg-primary flex items-center justify-center text-primary mr-3">
                          <Clock className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-medium">GPU Rental Payment</h4>
                          <p className="text-xs text-muted-foreground">AMD Radeon RX 7900 - 5 hours</p>
                          <p className="text-xs text-muted-foreground">March 22, 2025</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Ksh 275.00</p>
                        <Badge variant="outline" className="bg-orange-900/20 text-orange-400 hover:bg-orange-900/30">
                          Processing
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">View All Transactions</Button>
                </CardFooter>
              </Card>
            </TabsContent>
            
            {/* Invoices Tab */}
            <TabsContent value="invoices">
              <Card>
                <CardHeader>
                  <CardTitle>Invoices</CardTitle>
                  <CardDescription>Manage and download your invoices</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Sample invoices */}
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-md bg-opacity-20 bg-primary flex items-center justify-center text-primary mr-3">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-medium">March 2025</h4>
                          <p className="text-xs text-muted-foreground">3 GPU rentals</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center">
                        <p className="font-medium mr-4">Ksh 456.00</p>
                        <Button size="sm" variant="outline">Download</Button>
                      </div>
                    </div>
                    
                    <div className="flex justify-between items-center py-2 border-b border-border">
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded-md bg-opacity-20 bg-primary flex items-center justify-center text-primary mr-3">
                          <CreditCard className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="text-base font-medium">February 2025</h4>
                          <p className="text-xs text-muted-foreground">5 GPU rentals</p>
                        </div>
                      </div>
                      <div className="text-right flex items-center">
                        <p className="font-medium mr-4">Ksh 782.00</p>
                        <Button size="sm" variant="outline">Download</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="outline" className="w-full">Request Custom Invoice</Button>
                </CardFooter>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
