import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getToken } from "@/lib/auth";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Profile from "@/pages/profile";
import Wallet from "@/pages/wallet";
import Banking from "@/pages/banking";
import Withdraw from "@/pages/withdraw";
import CardPage from "@/pages/card";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminTransactions from "@/pages/admin/transactions";
import AdminSettings from "@/pages/admin/settings";
import About from "@/pages/about";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import Contact from "@/pages/contact";
import Careers from "@/pages/careers";
import Blog from "@/pages/blog";
import Cookies from "@/pages/cookies";
import ForgotPassword from "@/pages/forgot-password";
import AuthCallback from "@/pages/auth-callback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [location, setLocation] = useLocation();
  const token = getToken();

  useEffect(() => {
    if (!token) {
      setLocation("/login");
    }
  }, [token, location, setLocation]);

  if (!token) return null;
  return <Component />;
}

function Router() {
  const [location, setLocation] = useLocation();
  const token = getToken();

  useEffect(() => {
    if (token && (location === "/login" || location === "/register")) {
      setLocation("/dashboard");
    }
  }, [token, location, setLocation]);

  return (
    <Switch>
      {/* Public */}
      <Route path="/" component={Landing} />
      <Route path="/about" component={About} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
      <Route path="/careers" component={Careers} />
      <Route path="/blog" component={Blog} />
      <Route path="/cookies" component={Cookies} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/auth/callback" component={AuthCallback} />
      <Route path="/jobs" component={Jobs} />
      <Route path="/jobs/:jobId" component={JobDetail} />

      {/* User panel */}
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
      <Route path="/wallet"><ProtectedRoute component={Wallet} /></Route>
      <Route path="/banking"><ProtectedRoute component={Banking} /></Route>
      <Route path="/banking/withdraw"><ProtectedRoute component={Withdraw} /></Route>
      <Route path="/card"><ProtectedRoute component={CardPage} /></Route>

      {/* Admin panel */}
      <Route path="/admin"><ProtectedRoute component={AdminDashboard} /></Route>
      <Route path="/admin/users"><ProtectedRoute component={AdminUsers} /></Route>
      <Route path="/admin/transactions"><ProtectedRoute component={AdminTransactions} /></Route>
      <Route path="/admin/settings"><ProtectedRoute component={AdminSettings} /></Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
