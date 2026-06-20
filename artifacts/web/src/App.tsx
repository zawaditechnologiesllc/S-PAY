import { useEffect, useState, lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getToken } from "@/lib/auth";

// Eager: the landing page (home / LCP), the maintenance gate (rendered before
// the router), and the tiny 404 fallback. Everything else is code-split so the
// marketing entry doesn't ship the wallet/payroll/admin bundles.
import Maintenance from "@/pages/maintenance";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";

const Dashboard = lazy(() => import("@/pages/dashboard"));
const Login = lazy(() => import("@/pages/login"));
const Register = lazy(() => import("@/pages/register"));
const Profile = lazy(() => import("@/pages/profile"));
const Wallet = lazy(() => import("@/pages/wallet"));
const Banking = lazy(() => import("@/pages/banking"));
const Withdraw = lazy(() => import("@/pages/withdraw"));
const ExchangeWithdraw = lazy(() => import("@/pages/exchange-withdraw"));
const CardPage = lazy(() => import("@/pages/card"));
const Jobs = lazy(() => import("@/pages/jobs"));
const JobDetail = lazy(() => import("@/pages/job-detail"));
const PublicJobs = lazy(() => import("@/pages/public-jobs"));
const PublicJobDetail = lazy(() => import("@/pages/public-job-detail"));
const PayrollOverview = lazy(() => import("@/pages/payroll"));
const PayrollKeys = lazy(() => import("@/pages/payroll/keys"));
const PayrollBatches = lazy(() => import("@/pages/payroll/batches"));
const PayrollBatchDetail = lazy(() => import("@/pages/payroll/batch-detail"));
const AdminDashboard = lazy(() => import("@/pages/admin/dashboard"));
const AdminUsers = lazy(() => import("@/pages/admin/users"));
const AdminTransactions = lazy(() => import("@/pages/admin/transactions"));
const AdminSettings = lazy(() => import("@/pages/admin/settings"));
const AdminPayroll = lazy(() => import("@/pages/admin/payroll"));
const AdminJobs = lazy(() => import("@/pages/admin/jobs"));
const AdminEnquiries = lazy(() => import("@/pages/admin/enquiries"));
const About = lazy(() => import("@/pages/about"));
const HowItWorks = lazy(() => import("@/pages/how-it-works"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const Deposit = lazy(() => import("@/pages/deposit"));
const Support = lazy(() => import("@/pages/support"));
const Security = lazy(() => import("@/pages/security"));
const EmailVerified = lazy(() => import("@/pages/email-verified"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const Contact = lazy(() => import("@/pages/contact"));
const Careers = lazy(() => import("@/pages/careers"));
const Blog = lazy(() => import("@/pages/blog"));
const Cookies = lazy(() => import("@/pages/cookies"));
const ForgotPassword = lazy(() => import("@/pages/forgot-password"));
const AuthCallback = lazy(() => import("@/pages/auth-callback"));

// Lightweight fallback shown while a route chunk loads.
function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#4DC9EE] animate-spin" />
    </div>
  );
}

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
    <Suspense fallback={<PageFallback />}>
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
      <Route path="/deposit"><ProtectedRoute component={Deposit} /></Route>
      <Route path="/support"><ProtectedRoute component={Support} /></Route>
      <Route path="/security"><ProtectedRoute component={Security} /></Route>
      <Route path="/wallet/exchange"><ProtectedRoute component={ExchangeWithdraw} /></Route>
      <Route path="/card"><ProtectedRoute component={CardPage} /></Route>

      {/* ── Payroll / employer console (auth required) ── */}
      <Route path="/payroll"><ProtectedRoute component={PayrollOverview} /></Route>
      <Route path="/payroll/keys"><ProtectedRoute component={PayrollKeys} /></Route>
      <Route path="/payroll/batches"><ProtectedRoute component={PayrollBatches} /></Route>
      <Route path="/payroll/batches/:batchId"><ProtectedRoute component={PayrollBatchDetail} /></Route>

      {/* ── Admin panel (auth + server-enforced admin-email check) ── */}
      <Route path="/admin"><ProtectedRoute component={AdminDashboard} /></Route>
      <Route path="/admin/users"><ProtectedRoute component={AdminUsers} /></Route>
      <Route path="/admin/transactions"><ProtectedRoute component={AdminTransactions} /></Route>
      <Route path="/admin/payroll"><ProtectedRoute component={AdminPayroll} /></Route>
      <Route path="/admin/jobs"><ProtectedRoute component={AdminJobs} /></Route>
      <Route path="/admin/enquiries"><ProtectedRoute component={AdminEnquiries} /></Route>
      <Route path="/admin/settings"><ProtectedRoute component={AdminSettings} /></Route>

      <Route component={NotFound} />
    </Switch>
    </Suspense>
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
