import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Eye, EyeOff, KeyRound } from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.webp";

/** Landing page for the emailed reset link: /reset-password?token=… */
export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const reset = useResetPassword();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    reset.mutate(
      { data: { token, password } },
      {
        onSuccess: () => {
          setDone(true);
          setTimeout(() => setLocation("/login"), 2500);
        },
        onError: (err) => setError((err as { data?: { message?: string } })?.data?.message ?? "This link is invalid or expired — request a new one."),
      },
    );
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#4DC9EE]/10 to-[#1A2B4A]/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-3xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <img src={spayLogo} alt="S-PAY" className="w-10 h-10 rounded-[22%]" />
          <div>
            <span className="font-black text-[#1A2B4A] text-lg leading-none block">S-PAY</span>
            <span className="text-[10px] text-[#2E8FD6] font-semibold uppercase tracking-wide">Digital Wallet</span>
          </div>
        </div>

        {done ? (
          <div className="flex flex-col items-center text-center gap-3 py-6">
            <CheckCircle2 size={56} className="text-green-500" />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Password updated 🎉</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Taking you to sign in…</p>
            <Link href="/login" className="text-sm font-semibold text-[#2E8FD6] hover:underline">Sign in now</Link>
          </div>
        ) : !token ? (
          <div className="text-center py-6 space-y-3">
            <KeyRound size={40} className="text-gray-300 mx-auto" />
            <p className="text-sm text-gray-600 dark:text-gray-400">This reset link is incomplete. Open the link from your email, or request a new one.</p>
            <Link href="/forgot-password" className="text-sm font-semibold text-[#2E8FD6] hover:underline">Request a new link</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Choose a new password</h1>
            <div className="space-y-1.5">
              <Label htmlFor="rp-pass">New password</Label>
              <div className="relative">
                <Input id="rp-pass" type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
                <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" aria-label="Toggle password visibility">
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-confirm">Confirm new password</Label>
              <Input id="rp-confirm" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Repeat the password" />
            </div>
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <Button type="submit" disabled={reset.isPending} className="w-full bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold">
              {reset.isPending ? "Updating…" : "Update password"}
            </Button>
            <p className="text-center"><Link href="/login" className="text-sm text-gray-500 dark:text-gray-400 hover:underline">Back to sign in</Link></p>
          </form>
        )}
      </div>
    </div>
  );
}
