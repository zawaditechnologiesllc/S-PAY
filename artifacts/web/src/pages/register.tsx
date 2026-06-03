import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setToken } from "@/lib/auth";
import { CheckCircle } from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

const PERKS = [
  "Virtual USD & EUR bank account",
  "Instant withdrawals to mobile money & bank",
  "Access to 1000s of remote job listings",
];

const COUNTRIES = [
  "Kenya",
  "Nigeria",
  "Ghana",
  "Philippines",
  "Brazil",
  "Colombia",
  "Indonesia",
  "USA",
  "UK",
  "Germany",
  "France",
  "Other",
];

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    registerMutation.mutate(
      { data: { email, password, fullName, phoneNumber } },
      {
        onSuccess: (data) => {
          setToken(data.token);
          setLocation("/dashboard");
        },
        onError: (error) => {
          toast({
            title: "Registration Failed",
            description: error.message || "An error occurred during registration",
            variant: "destructive",
          });
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 px-4 py-10">
      <div className="w-full max-w-md">

        {/* Logo + brand block */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 rounded-2xl overflow-hidden border-4 border-white shadow-xl flex items-center justify-center mb-4">
            <img src={spayLogo} alt="S-PAY" className="w-full h-full object-cover" />
          </div>
          <h1 className="text-2xl font-black text-[#1A2B4A] tracking-tight">S-PAY</h1>
          <p className="text-sm text-gray-500 mt-1">Your global digital wallet</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">

          {/* Google button */}
          <div className="px-8 pt-8 pb-6">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-xs text-gray-400 font-medium">or</span>
              </div>
            </div>

            {/* What you'll get */}
            <div className="bg-[#4DC9EE]/8 border border-[#4DC9EE]/20 rounded-2xl p-4 mb-6">
              <p className="text-xs font-bold text-[#1A2B4A] uppercase tracking-wide mb-3">What you'll get</p>
              <ul className="space-y-2">
                {PERKS.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5">
                    <CheckCircle size={15} className="text-[#4DC9EE] flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-gray-700">{perk}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">Full Name</Label>
                <Input
                  id="fullName"
                  placeholder="John Doe"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
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

              <div className="space-y-1.5">
                <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
                  Phone Number <span className="text-gray-400 font-normal">(Optional)</span>
                </Label>
                <Input
                  id="phoneNumber"
                  type="tel"
                  placeholder="+1 234 567 8900"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="country" className="text-sm font-medium text-gray-700">
                  Country <span className="text-gray-400 font-normal">(Optional)</span>
                </Label>
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20 transition-colors"
                >
                  <option value="">Select your country</option>
                  {COUNTRIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-xl border-gray-200 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11"
                />
              </div>

              {/* Terms checkbox */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  required
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#4DC9EE] focus:ring-[#4DC9EE]/20 accent-[#4DC9EE] flex-shrink-0"
                />
                <span className="text-xs text-gray-500 leading-relaxed">
                  By creating an account, you agree to our{" "}
                  <Link href="/terms" className="text-[#4DC9EE] hover:underline font-medium">Terms of Service</Link>
                  {" "}and{" "}
                  <Link href="/privacy" className="text-[#4DC9EE] hover:underline font-medium">Privacy Policy</Link>
                </span>
              </label>

              <Button
                className="w-full h-11 rounded-xl bg-[#4DC9EE] hover:bg-[#1A2B4A] text-white font-semibold transition-colors"
                type="submit"
                disabled={registerMutation.isPending || !agreedToTerms}
              >
                {registerMutation.isPending ? "Creating account..." : "Create Free Account"}
              </Button>
            </form>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{" "}
              <Link href="/login" className="text-[#4DC9EE] hover:underline font-semibold">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Bottom link */}
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
