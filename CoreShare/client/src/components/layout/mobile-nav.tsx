import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Sidebar } from "./sidebar";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { Menu, LayoutDashboard, Cpu, Clock, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const [location] = useLocation();
  const { logoutMutation } = useAuth();
  
  const navItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/marketplace", icon: Cpu, label: "GPUs" },
    { href: "/my-rentals", icon: Clock, label: "Rentals" },
    {
      onClick: () => logoutMutation.mutate(),
      icon: LogOut,
      label: "Logout",
      isAction: true
    },
  ];
  
  return (
    <>
      {/* Mobile sheet for sidebar */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0">
          <Sidebar />
        </SheetContent>
      </Sheet>
      
      {/* Bottom navigation for mobile */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex justify-around items-center h-16 px-2 z-50">
        {navItems.map((item, i) => {
          const Icon = item.icon;
          const isActive = !item.isAction && location === item.href;
          
          if (item.isAction) {
            return (
              <button 
                key={i} 
                onClick={item.onClick} 
                className="flex flex-col items-center justify-center"
              >
                <Icon className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs mt-1 text-muted-foreground">
                  {item.label}
                </span>
              </button>
            );
          }
          
          return (
            <Link key={i} href={item.href || "/"}>
              <div className="flex flex-col items-center justify-center">
                <Icon className={cn(
                  "h-6 w-6",
                  isActive ? "text-primary" : "text-muted-foreground"
                )} />
                <span className={cn(
                  "text-xs mt-1",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}
