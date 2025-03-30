import { useAuth } from "@/hooks/use-auth";
import { MobileNav } from "./mobile-nav";
import { Input } from "@/components/ui/input";
import { NotificationMenu } from "./notification-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface HeaderProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
}

export function Header({ search }: HeaderProps) {
  const { user } = useAuth();
  
  if (!user) return null;
  
  const nameInitial = user.name.charAt(0).toUpperCase();
  
  return (
    <header className="bg-card border-b border-border p-4 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center">
        <MobileNav />
        
        {/* App title */}
        <div className="flex items-center">
          <h1 className="text-xl font-bold text-primary hidden md:block">CoreShare</h1>
          <h1 className="text-lg font-bold md:hidden">Dashboard</h1>
        </div>
        
        {/* Search (shown conditionally) */}
        {search && (
          <div className="hidden md:flex items-center ml-4 bg-background rounded-lg px-3 py-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <Input 
              type="text" 
              placeholder={search.placeholder || "Search..."}
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              className="bg-transparent border-none text-foreground ml-2 focus:outline-none w-64"
            />
          </div>
        )}
      </div>
      
      {/* User actions */}
      <div className="flex items-center">
        <ThemeToggle />
        <NotificationMenu />
        
        <div className="ml-4 hidden md:flex items-center cursor-pointer">
          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center text-white font-bold">
            {nameInitial}
          </div>
          <div className="ml-2">
            <p className="text-sm">{user.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
