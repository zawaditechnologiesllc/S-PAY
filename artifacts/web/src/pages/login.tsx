import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useLogin, useVerifyLoginCode } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setToken } from "@/lib/auth";
import { Eye, EyeOff, ArrowLeft, MailCheck } from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.webp";

export default function Login() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const verifyCodeMutation = useVerifyLoginCode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Two-step email MFA: "password" collects the credentials, "verify" collects
  // the 6-digit code we email after the password checks out.
  const [step, setStep] = useState<"password" | "verify">("password");
  const [code, setCode] = useState("");

  // Redirect to ?next= param after login, or dashboard by default.
  const nextUrl = (() => {
    try {
      const params = new URLSearchParams(location.split("?")[1] ?? "");
      const next = params.get("next");
      return next && next.startsWith("/") ? next : "/dashboard";
    } catch {
      return "/dashboard";
    }
  })();

  const networkError = (error: any, fallbackTitle: string) => {
    const isNetwork = !error?.status && /failed to fetch|networkerror|load failed|fetch/i.test(error?.message ?? "");
    toast({
      title: isNetwork ? "Can't reach the server" : fallbackTitle,
      description: isNetwork
        ? "Check your internet connection and try again. If you just opened the app, the server may be waking up — wait a few seconds and retry."
        : (error?.data?.message ?? error?.message ?? "Something went wrong. Please try again."),
      variant: "destructive",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: () => {
          // Password accepted — a 6-digit code is now on its way by email.
          setStep("verify");
          setCode("");
          toast({ title: "Check your email", description: `We sent a 6-digit code to ${email}.` });
        },
        onError: (error: any) => networkError(error, "Login failed"),
      }
    );
  };

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      toast({ title: "Enter the 6-digit code", description: "Check the email we just sent you.", variant: "destructive" });
      return;
    }
    verifyCodeMutation.mutate(
      { data: { email, code } },
      {
        onSuccess: (data) => {
          setToken(data.token);
          setLocation(nextUrl);
        },
        onError: (error: any) => networkError(error, "That code didn't work"),
      }
    );
  };

  const resendCode = () => {
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: () => toast({ title: "New code sent", description: `Check ${email} again.` }),
        onError: (error: any) => networkError(error, "Couldn't resend the code"),
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-10">
      <div className="w-full max-w-md">

        {/* Logo + brand block */}
        <div className="text-center mb-8">
          <img src={spayLogo} alt="S-PAY" className="mx-auto w-20 h-20 rounded-[22%] shadow-xl mb-4 block" />
          <h1 className="text-2xl font-black text-[#1A2B4A] tracking-tight">S-PAY</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Your global digital wallet</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-gray-800 overflow-hidden">

          {step === "verify" ? (
            /* ── Step 2: email MFA code ── */
            <div className="px-8 pt-8 pb-6">
              <div className="flex flex-col items-center text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-[#2E8FD6] mb-4">
                  <MailCheck size={26} />
                </div>
                <h2 className="text-lg font-bold text-[#1A2B4A] dark:text-gray-100">Enter your sign-in code</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  We emailed a 6-digit code to <span className="font-medium text-gray-700 dark:text-gray-300">{email}</span>.
                  It expires in 10 minutes.
                </p>
              </div>
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="code" className="text-sm font-medium text-gray-700 dark:text-gray-300">6-digit code</Label>
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    autoFocus
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="rounded-xl border-gray-200 dark:border-gray-700 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-12 text-center text-2xl font-bold tracking-[0.5em]"
                  />
                </div>
                <Button
                  className="w-full h-11 rounded-xl bg-[#4DC9EE] hover:bg-[#1A2B4A] text-white font-semibold transition-colors"
                  type="submit"
                  disabled={verifyCodeMutation.isPending}
                >
                  {verifyCodeMutation.isPending ? "Verifying..." : "Verify & sign in"}
                </Button>
              </form>
              <div className="flex items-center justify-between mt-4 text-sm">
                <button
                  type="button"
                  onClick={() => { setStep("password"); setCode(""); }}
                  className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-[#2E8FD6] transition-colors font-medium"
                >
                  <ArrowLeft size={15} /> Back to sign in
                </button>
                <button
                  type="button"
                  onClick={resendCode}
                  disabled={loginMutation.isPending}
                  className="text-[#4DC9EE] hover:underline font-semibold disabled:opacity-50"
                >
                  {loginMutation.isPending ? "Sending…" : "Resend code"}
                </button>
              </div>
            </div>
          ) : (
          /* ── Step 1: Google + email/password ── */
          <div className="px-8 pt-8 pb-6">
            <button
              type="button"
              onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL ?? ""}/api/auth/google`; }}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 dark:border-gray-700 rounded-xl py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-gray-900 px-4 text-xs text-gray-400 font-medium">or</span>
              </div>
            </div>

            {/* Email form */}
            <p className="text-sm font-semibold text-[#1A2B4A] mb-4">Sign in with email</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-xl border-gray-200 dark:border-gray-700 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-[#4DC9EE] hover:underline font-medium">Forgot password?</Link>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="rounded-xl border-gray-200 dark:border-gray-700 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-[#2E8FD6] transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              <Button
                className="w-full h-11 rounded-xl bg-[#4DC9EE] hover:bg-[#1A2B4A] text-white font-semibold transition-colors"
                type="submit"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </div>
          )}

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-gray-800/60 px-8 py-4 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Don't have an account?{" "}
              <Link href="/register" className="text-[#4DC9EE] hover:underline font-semibold">
                Create account
              </Link>
            </p>
          </div>
        </div>

        {/* Back to landing / app home */}
        <button
          type="button"
          onClick={() => setLocation("/")}
          className="mt-6 w-full flex items-center justify-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-[#2E8FD6] transition-colors"
        >
          <ArrowLeft size={16} /> Back to home
        </button>

        {/* Bottom link */}
        <p className="text-center text-xs text-gray-400 mt-4">
          <Link href="/about" className="hover:text-[#4DC9EE] transition-colors">About S-PAY</Link>
          {" · "}
          <Link href="/privacy" className="hover:text-[#4DC9EE] transition-colors">Privacy</Link>
          {" · "}
          <Link href="/terms" className="hover:text-[#4DC9EE] transition-colors">Terms</Link>
        </p>
      </div>
    </div>
  );
}
