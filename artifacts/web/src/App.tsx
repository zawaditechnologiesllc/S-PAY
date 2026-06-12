import { useEffect, useState } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getToken } from "@/lib/auth";
import Maintenance from "@/pages/maintenance";

import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Profile from "@/pages/profile";
import Wallet from "@/pages/wallet";
import Banking from "@/pages/banking";
import Withdraw from "@/pages/withdraw";
import ExchangeWithdraw from "@/pages/exchange-withdraw";
import CardPage from "@/pages/card";
import Jobs from "@/pages/jobs";
import JobDetail from "@/pages/job-detail";
import PublicJobs from "@/pages/public-jobs";
import PublicJobDetail from "@/pages/public-job-detail";
import AdminDashboard from "@/pages/admin/dashboard";
import AdminUsers from "@/pages/admin/users";
import AdminTransactions from "@/pages/admin/transactions";
import AdminSettings from "@/pages/admin/settings";
import AdminJobs from "@/pages/admin/jobs";
import About from "@/pages/about";
import HowItWorks from "@/pages/how-it-works";
import ResetPassword from "@/pages/reset-password";
import EmailVerified from "@/pages/email-verified";
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
      // Instant tab switching: serve cached data immediately and refresh in
      // the background only after it's 30s old.
      staleTime: 30 * 1000,
      gcTime: 10 * 60 * 1000,
    },
  },
});

// Redirects to /login, storing the intended destination so we can return after auth.
function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const [location, setLocation] = useLocation();
  const token = getToken();

  useEffect(() => {
    if (!token) {
      setLocation(`/login?next=${encodeURIComponent(location)}`);
    }
  }, [token, location, setLocation]);

  if (!token) return null;
  return <Component />;
}

// Jobs: public browsers see the public page; logged-in users see the app version.
function JobsRoute() {
  const token = getToken();
  return token ? <Jobs /> : <PublicJobs />;
}

function JobDetailRoute() {
  const token = getToken();
  return token ? <JobDetail /> : <PublicJobDetail />;
}

function Router() {
  const [location, setLocation] = useLocation();
  const token = getToken();
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message?: string }>({ enabled: false });

  // Maintenance gate: ask the public status endpoint once per load. Login and
  // the admin panel stay reachable so an admin can switch maintenance off.
  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL ?? ""}/api/status`)
      .then((r) => r.json())
      .then((s) => setMaintenance({ enabled: Boolean(s?.maintenance), message: s?.message }))
      .catch(() => setMaintenance({ enabled: false }));
  }, []);

  // Already logged in — bounce away from auth pages.
  useEffect(() => {
    if (token && (location === "/login" || location === "/register")) {
      setLocation("/dashboard");
    }
  }, [token, location, setLocation]);

  if (maintenance.enabled && !location.startsWith("/admin") && location !== "/login" && location !== "/auth/callback") {
    return <Maintenance message={maintenance.message} />;
  }

  return (
    <Switch>
      {/* ── Public marketing pages ── */}
      <Route path="/" component={Landing} />
      <Route path="/about" component={About} />
      <Route path="/how-it-works" component={HowItWorks} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/contact" component={Contact} />
      <Route path="/careers" component={Careers} />
      <Route path="/blog" component={Blog} />
      <Route path="/cookies" component={Cookies} />

      {/* ── Auth pages ── */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/forgot-password" component={ForgotPassword} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/auth/verified" component={EmailVerified} />
      <Route path="/auth/callback" component={AuthCallback} />

      {/* ── Jobs: public browse, auth required to apply ── */}
      <Route path="/jobs" component={JobsRoute} />
      <Route path="/jobs/:jobId" component={JobDetailRoute} />

      {/* ── User panel (auth required) ── */}
      <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/profile"><ProtectedRoute component={Profile} /></Route>
      <Route path="/wallet"><ProtectedRoute component={Wallet} /></Route>
      <Route path="/banking"><ProtectedRoute component={Banking} /></Route>
      <Route path="/banking/withdraw"><ProtectedRoute component={Withdraw} /></Route>
      <Route path="/wallet/exchange"><ProtectedRoute component={ExchangeWithdraw} /></Route>
      <Route path="/card"><ProtectedRoute component={CardPage} /></Route>

      {/* ── Admin panel (auth + server-enforced admin-email check) ── */}
      <Route path="/admin"><ProtectedRoute component={AdminDashboard} /></Route>
      <Route path="/admin/users"><ProtectedRoute component={AdminUsers} /></Route>
      <Route path="/admin/transactions"><ProtectedRoute component={AdminTransactions} /></Route>
      <Route path="/admin/jobs"><ProtectedRoute component={AdminJobs} /></Route>
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
