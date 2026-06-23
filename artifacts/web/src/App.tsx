import { useEffect, useState, lazy, Suspense, type ComponentType } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { OfflineBanner } from "@/components/offline-banner";
import { queryClient } from "@/lib/query-client";
import { getToken } from "@/lib/auth";

// Eager: the landing page (home / LCP), the maintenance gate (rendered before
// the router), and the tiny 404 fallback. Everything else is code-split so the
// marketing entry doesn't ship the wallet/payroll/admin bundles.
import Maintenance from "@/pages/maintenance";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";

// Lazy import that survives a deploy. When the app is redeployed, the hashed
// chunk filenames change; a browser still holding the old page requests a chunk
// that no longer exists, the dynamic import rejects, and (without this) the
// route renders blank. On the first such failure we force one full reload to
// fetch the fresh assets; a sessionStorage guard prevents a reload loop.
function lazyWithReload<T extends ComponentType<unknown>>(factory: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      const mod = await factory();
      sessionStorage.removeItem("spay:chunkReloaded");
      return mod;
    } catch (err) {
      if (!sessionStorage.getItem("spay:chunkReloaded")) {
        sessionStorage.setItem("spay:chunkReloaded", "1");
        window.location.reload();
        return await new Promise<{ default: T }>(() => {}); // hold render while reloading
      }
      throw err; // already reloaded once — let the ErrorBoundary show a message
    }
  });
}

const Dashboard = lazyWithReload(() => import("@/pages/dashboard"));
const Login = lazyWithReload(() => import("@/pages/login"));
const Register = lazyWithReload(() => import("@/pages/register"));
const Profile = lazyWithReload(() => import("@/pages/profile"));
const Wallet = lazyWithReload(() => import("@/pages/wallet"));
const Banking = lazyWithReload(() => import("@/pages/banking"));
const Withdraw = lazyWithReload(() => import("@/pages/withdraw"));
const ExchangeWithdraw = lazyWithReload(() => import("@/pages/exchange-withdraw"));
const CardPage = lazyWithReload(() => import("@/pages/card"));
const Jobs = lazyWithReload(() => import("@/pages/jobs"));
const JobDetail = lazyWithReload(() => import("@/pages/job-detail"));
const PublicJobs = lazyWithReload(() => import("@/pages/public-jobs"));
const PublicJobDetail = lazyWithReload(() => import("@/pages/public-job-detail"));
const PayrollOverview = lazyWithReload(() => import("@/pages/payroll"));
const PayrollKeys = lazyWithReload(() => import("@/pages/payroll/keys"));
const PayrollBatches = lazyWithReload(() => import("@/pages/payroll/batches"));
const PayrollBatchDetail = lazyWithReload(() => import("@/pages/payroll/batch-detail"));
const AdminDashboard = lazyWithReload(() => import("@/pages/admin/dashboard"));
const AdminUsers = lazyWithReload(() => import("@/pages/admin/users"));
const AdminTransactions = lazyWithReload(() => import("@/pages/admin/transactions"));
const AdminSettings = lazyWithReload(() => import("@/pages/admin/settings"));
const AdminPayroll = lazyWithReload(() => import("@/pages/admin/payroll"));
const AdminJobs = lazyWithReload(() => import("@/pages/admin/jobs"));
const AdminEnquiries = lazyWithReload(() => import("@/pages/admin/enquiries"));
const AdminSeo = lazyWithReload(() => import("@/pages/admin/seo"));
const About = lazyWithReload(() => import("@/pages/about"));
const HowItWorks = lazyWithReload(() => import("@/pages/how-it-works"));
const ResetPassword = lazyWithReload(() => import("@/pages/reset-password"));
const Deposit = lazyWithReload(() => import("@/pages/deposit"));
const Support = lazyWithReload(() => import("@/pages/support"));
const Security = lazyWithReload(() => import("@/pages/security"));
const EmailVerified = lazyWithReload(() => import("@/pages/email-verified"));
const Privacy = lazyWithReload(() => import("@/pages/privacy"));
const Terms = lazyWithReload(() => import("@/pages/terms"));
const Contact = lazyWithReload(() => import("@/pages/contact"));
const Careers = lazyWithReload(() => import("@/pages/careers"));
const Blog = lazyWithReload(() => import("@/pages/blog"));
const BlogPost = lazyWithReload(() => import("@/pages/blog-post"));
const Cookies = lazyWithReload(() => import("@/pages/cookies"));
const ForgotPassword = lazyWithReload(() => import("@/pages/forgot-password"));
const AuthCallback = lazyWithReload(() => import("@/pages/auth-callback"));

// Lightweight fallback shown while a route chunk loads.
function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="w-8 h-8 rounded-full border-2 border-gray-200 border-t-[#4DC9EE] animate-spin" />
    </div>
  );
}

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
    <ErrorBoundary resetKey={location}>
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
      <Route path="/blog/:slug" component={BlogPost} />
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
      <Route path="/admin/seo"><ProtectedRoute component={AdminSeo} /></Route>
      <Route path="/admin/settings"><ProtectedRoute component={AdminSettings} /></Route>

      <Route component={NotFound} />
    </Switch>
    </Suspense>
    </ErrorBoundary>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <OfflineBanner />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
