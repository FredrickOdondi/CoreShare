import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/hooks/use-theme";
import { ProtectedRoute } from "@/lib/protected-route";
import ChatWithCori from "@/components/chat/chat-with-cori";

// Pages
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import NotFound from "@/pages/not-found";
import MarketplacePage from "@/pages/marketplace-page";
import MyRentalsPage from "@/pages/my-rentals-page";
import MyGpusPage from "@/pages/my-gpus-page";
import PaymentsPage from "@/pages/payments-page";
import AnalyticsPage from "@/pages/analytics-page";
import IncomePage from "@/pages/income-page";
import ExplorePage from "@/pages/explore-page";
import VideoManagementPage from "@/pages/admin/video-management";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/marketplace" component={MarketplacePage} />
      <ProtectedRoute path="/my-rentals" component={MyRentalsPage} />
      <ProtectedRoute path="/my-gpus" component={MyGpusPage} />
      <ProtectedRoute path="/payments" component={PaymentsPage} />
      <ProtectedRoute path="/analytics" component={AnalyticsPage} />
      <ProtectedRoute path="/income" component={IncomePage} />
      <ProtectedRoute path="/explore" component={ExplorePage} />
      <ProtectedRoute path="/admin/video-management" component={VideoManagementPage} />
      
      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router />
          <ChatWithCori />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
