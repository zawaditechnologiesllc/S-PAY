import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Mail, CheckCircle } from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call — replace with real endpoint when available
    await new Promise((r) => setTimeout(r, 1000));
    setLoading(false);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-10">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <img src={spayLogo} alt="S-PAY" className="mx-auto w-20 h-20 rounded-[22%] shadow-xl mb-4 block" />
          <h1 className="text-2xl font-black text-[#1A2B4A] tracking-tight">S-PAY</h1>
          <p className="text-sm text-gray-500 mt-1">Your global digital wallet</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="px-8 pt-8 pb-6">

            {submitted ? (
              <div className="text-center py-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-[#4DC9EE]/10 flex items-center justify-center mb-5">
                  <CheckCircle size={32} className="text-[#4DC9EE]" />
                </div>
                <h2 className="text-xl font-black text-[#1A2B4A] mb-2">Check your inbox</h2>
                <p className="text-gray-500 text-sm leading-relaxed mb-6">
                  If an account exists for <span className="font-semibold text-[#1A2B4A]">{email}</span>,
                  you'll receive a password reset link within a few minutes.
                </p>
                <p className="text-xs text-gray-400 mb-6">
                  Didn't receive it? Check your spam folder or try again.
                </p>
                <Button
                  variant="outline"
                  className="w-full rounded-xl h-11 border-gray-200"
                  onClick={() => { setSubmitted(false); setEmail(""); }}
                >
                  Try another email
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-[#4DC9EE]/10 flex items-center justify-center">
                    <Mail size={20} className="text-[#4DC9EE]" />
                  </div>
                  <div>
                    <h2 className="font-black text-[#1A2B4A] text-lg">Reset your password</h2>
                    <p className="text-gray-500 text-xs mt-0.5">We'll send a reset link to your email</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                      Email address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="rounded-xl border-gray-200 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11"
                    />
                  </div>
                  <Button
                    className="w-full h-11 rounded-xl bg-[#4DC9EE] hover:bg-[#1A2B4A] text-white font-semibold transition-colors"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Sending..." : "Send reset link"}
                  </Button>
                </form>
              </>
            )}
          </div>

          <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
            <Link href="/login">
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#4DC9EE] transition-colors cursor-pointer font-medium">
                <ArrowLeft size={14} /> Back to sign in
              </span>
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
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
