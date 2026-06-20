import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, MailX } from "lucide-react";
import { getToken } from "@/lib/auth";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.webp";

/** Landing page for the email confirmation link: /auth/verified?status=ok|invalid|error */
export default function EmailVerified() {
  const [, setLocation] = useLocation();
  const ok = new URLSearchParams(window.location.search).get("status") === "ok";
  const signedIn = Boolean(getToken());

  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => setLocation(signedIn ? "/dashboard" : "/login"), 2500);
    return () => clearTimeout(t);
  }, [ok, signedIn, setLocation]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#4DC9EE]/10 to-[#1A2B4A]/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-6">
          <img src={spayLogo} alt="S-PAY" className="w-10 h-10 rounded-[22%]" />
          <span className="font-black text-[#1A2B4A] text-lg">S-PAY</span>
        </div>
        {ok ? (
          <div className="space-y-3">
            <CheckCircle2 size={56} className="text-green-500 mx-auto" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Email confirmed 🎉</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your account is secured. Taking you to the app…</p>
            <Link href={signedIn ? "/dashboard" : "/login"} className="text-sm font-semibold text-[#2E8FD6] hover:underline">
              Continue now
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <MailX size={56} className="text-amber-500 mx-auto" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Link expired or invalid</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Sign in and press “Resend” on the dashboard banner to get a fresh confirmation email.</p>
            <Link href={signedIn ? "/dashboard" : "/login"} className="text-sm font-semibold text-[#2E8FD6] hover:underline">
              {signedIn ? "Go to dashboard" : "Sign in"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
