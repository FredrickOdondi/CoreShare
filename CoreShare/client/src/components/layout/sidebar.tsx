import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Cpu, 
  Clock, 
  CreditCard, 
  FileCog,
  LineChart,
  DollarSign,
  LogOut
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  
  if (!user) return null;
  
  // Get first letter of name for avatar
  const nameInitial = user.name.charAt(0).toUpperCase();
  const isRentee = user.role === "rentee" || user.role === "both";
  const isRenter = user.role === "renter" || user.role === "both";
  
  const navItems = [
    // Common items
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    
    // Renter items
    ...(isRenter ? [
      { href: "/marketplace", label: "GPU Marketplace", icon: Cpu },
      { href: "/my-rentals", label: "My Rentals", icon: Clock },
      { href: "/payments", label: "Payments", icon: CreditCard },
    ] : []),
    
    // Rentee items
    ...(isRentee ? [
      { href: "/my-gpus", label: "My GPUs", icon: FileCog },
      { href: "/analytics", label: "Analytics", icon: LineChart },
      { href: "/income", label: "Income", icon: DollarSign },
    ] : []),
  ];

  return (
    <div className={cn("flex flex-col w-64 bg-card border-r border-border", className)}>
      <div className="p-4 flex items-center border-b border-border">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-white font-bold mr-2">C</div>
        <h1 className="text-xl font-bold">CoreShare</h1>
      </div>
      
      {/* User Profile */}
      <div className="p-4 flex items-center border-b border-border">
        <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-white font-bold">
          {nameInitial}
        </div>
        <div className="ml-3">
          <h2 className="text-sm font-medium">{user.name}</h2>
          <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
        </div>
      </div>
      
      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="flex flex-col gap-1">
          {navItems.map((item, i) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            
            return (
              <Link key={i} href={item.href}>
                <a className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 transition-all",
                  "hover:bg-primary/10",
                  isActive ? "bg-primary/20 text-primary border-l-2 border-primary" : "text-muted-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
      
      {/* Logout */}
      <div className="p-4 border-t border-border">
        <Button 
          variant="ghost" 
          className="w-full justify-start text-muted-foreground hover:text-foreground"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          <LogOut className="mr-2 h-5 w-5" />
          Log out
        </Button>
      </div>
    </div>
  );
}
