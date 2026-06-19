import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useLogin, useVerifyLoginCode } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setToken } from "@/lib/auth";
import { Eye, EyeOff, ArrowLeft, Mail } from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

export default function Login() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const loginMutation = useLogin();
  const verifyCodeMutation = useVerifyLoginCode();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState<"login" | "verify">("login");
  const [verificationCode, setVerificationCode] = useState("");

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

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loginMutation.mutate(
      { data: { email, password } },
      {
        onSuccess: (data: any) => {
          if (data.requiresVerification) {
            setStep("verify");
            setVerificationCode("");
            toast({ title: "Code sent", description: "Check your email for the verification code." });
          } else {
            // Legacy: if no requiresVerification, direct login
            setToken(data.token);
            setLocation(nextUrl);
          }
        },
        onError: (error: any) => {
          const isNetwork = !error?.status && /failed to fetch|networkerror|load failed|fetch/i.test(error?.message ?? "");
          toast({
            title: isNetwork ? "Can't reach the server" : "Login failed",
            description: isNetwork
              ? "Check your internet connection and try again. If you just opened the app, the server may be waking up — wait a few seconds and retry."
              : (error?.data?.message ?? error?.message ?? "Invalid email or password."),
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    verifyCodeMutation.mutate(
      { data: { email, code: verificationCode } },
      {
        onSuccess: (data: any) => {
          setToken(data.token);
          setLocation(nextUrl);
        },
        onError: (error: any) => {
          toast({
            title: "Verification failed",
            description: error?.data?.message ?? "Invalid or expired code. Please try signing in again.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleBackToLogin = () => {
    setStep("login");
    setVerificationCode("");
    setPassword("");
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

          {step === "login" && (
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

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-gray-900 px-4 text-xs text-gray-400 font-medium">or</span>
              </div>
            </div>

            <p className="text-sm font-semibold text-[#1A2B4A] mb-4">Sign in with email</p>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
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

        {step === "verify" && (
          <div className="px-8 pt-8 pb-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <Mail size={24} />
              </div>
              <h2 className="text-lg font-bold text-[#1A2B4A] mb-1">Check your email</h2>
              <p className="text-sm text-gray-600">We sent a 6-digit code to {email}</p>
              <p className="text-xs text-gray-500 mt-2">Code expires in 10 minutes</p>
            </div>

            <form onSubmit={handleCodeSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-sm font-medium text-gray-700 dark:text-gray-300">Verification code</Label>
                <Input
                  id="code"
                  type="text"
                  placeholder="000000"
                  maxLength={6}
                  required
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))}
                  className="rounded-xl border-gray-200 dark:border-gray-700 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11 text-center text-2xl tracking-widest font-mono"
                />
              </div>
              <Button
                className="w-full h-11 rounded-xl bg-[#4DC9EE] hover:bg-[#1A2B4A] text-white font-semibold transition-colors"
                type="submit"
                disabled={verifyCodeMutation.isPending || verificationCode.length !== 6}
              >
                {verifyCodeMutation.isPending ? "Verifying..." : "Verify"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleBackToLogin}
                disabled={verifyCodeMutation.isPending}
              >
                Back to sign in
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
