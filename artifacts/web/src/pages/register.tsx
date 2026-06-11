import { useState } from "react";
import { useLocation, Link } from "wouter";
import { useRegister } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { setToken } from "@/lib/auth";
import { CheckCircle, Eye, EyeOff, User, Building2 } from "lucide-react";
import { POPULAR_COUNTRIES, ALL_COUNTRIES } from "@/lib/countries";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

const BENEFITS = [
  "Virtual USD & EUR bank account",
  "Instant cash-out to M-Pesa, MTN, PIX & more",
  "Celo wallet created instantly — no seed phrase",
  "3,000–5,000 remote job listings daily",
  "Zero monthly fees",
  "Works in 50+ countries",
];

const SUPPORTED_COUNTRIES_FLAGS = [
  { flag: "🇰🇪", label: "Kenya" },
  { flag: "🇳🇬", label: "Nigeria" },
  { flag: "🇬🇭", label: "Ghana" },
  { flag: "🇵🇭", label: "Philippines" },
  { flag: "🇧🇷", label: "Brazil" },
  { flag: "🇨🇴", label: "Colombia" },
];


// Acquisition attribution: /register?from=jobs&jobId=… (public jobs board links)
// or /register?source=… — recorded on the account so admin can see where signups come from.
function getSignupSource(): string {
  const params = new URLSearchParams(window.location.search);
  const explicit = params.get("source");
  if (explicit) return explicit.slice(0, 64);
  const from = params.get("from");
  if (from) {
    const jobId = params.get("jobId");
    return jobId ? `${from}:${jobId}`.slice(0, 64) : from.slice(0, 64);
  }
  return "direct";
}

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [country, setCountry] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [signupSource] = useState(getSignupSource);
  // /register?type=business pre-selects a business (KYB) account
  const [accountType, setAccountType] = useState<"personal" | "business">(() =>
    new URLSearchParams(window.location.search).get("type") === "business" ? "business" : "personal"
  );
  const [businessName, setBusinessName] = useState("");

  const passwordsMatch = password === confirmPassword;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordsMatch) {
      toast({
        title: "Passwords don't match",
        description: "Please re-enter the same password in both fields.",
        variant: "destructive",
      });
      return;
    }
    if (accountType === "business" && !businessName.trim()) {
      toast({
        title: "Business name required",
        description: "Enter your registered business name to open a business account.",
        variant: "destructive",
      });
      return;
    }
    registerMutation.mutate(
      {
        data: {
          email, password, fullName, phoneNumber, country, signupSource,
          accountType,
          businessName: accountType === "business" ? businessName.trim() : undefined,
        },
      },
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
    <div className="min-h-screen flex bg-gray-50">

      {/* ─── LEFT BRAND PANEL (desktop only) ─── */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[42%] flex-col justify-between p-12 bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38] rounded-none relative overflow-hidden flex-shrink-0">
        {/* Radial glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 20% 70%, rgba(77,201,238,0.2) 0%, transparent 50%), radial-gradient(circle at 80% 10%, rgba(168,222,255,0.1) 0%, transparent 45%)",
        }} />

        {/* Top: logo + app name */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-12">
            <img src={spayLogo} alt="S-PAY" className="w-12 h-12 rounded-[22%] flex-shrink-0 shadow-lg" />
            <div>
              <div className="text-white font-black text-xl tracking-tight">S-PAY</div>
              <div className="text-blue-300 text-xs">Your digital money account</div>
            </div>
          </div>

          <h2 className="text-4xl font-black text-white leading-tight mb-8">
            Get paid globally.<br />
            <span className="text-[#4DC9EE]">Cash out locally.</span>
          </h2>

          <ul className="space-y-4 mb-12">
            {BENEFITS.map((benefit) => (
              <li key={benefit} className="flex items-start gap-3">
                <CheckCircle size={18} className="text-[#4DC9EE] flex-shrink-0 mt-0.5" />
                <span className="text-blue-100 text-sm leading-relaxed">{benefit}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom: supported countries */}
        <div className="relative z-10">
          <p className="text-blue-400 text-xs font-medium mb-3 uppercase tracking-wide">Supported countries</p>
          <div className="flex items-center gap-2 flex-wrap">
            {SUPPORTED_COUNTRIES_FLAGS.map((c) => (
              <div
                key={c.label}
                title={c.label}
                className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-lg cursor-default"
              >
                {c.flag}
              </div>
            ))}
            <div className="w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-bold text-blue-300">
              +50
            </div>
          </div>
        </div>
      </div>

      {/* ─── RIGHT FORM PANEL ─── */}
      <div className="flex-1 flex items-center justify-center px-4 py-10 overflow-y-auto">
        <div className="w-full max-w-md">

          {/* Mobile-only logo */}
          <div className="lg:hidden text-center mb-8">
            <img src={spayLogo} alt="S-PAY" className="mx-auto w-14 h-14 rounded-[22%] shadow-xl mb-3 block" />
            <h1 className="text-xl font-black text-[#1A2B4A] tracking-tight">S-PAY</h1>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="px-5 sm:px-8 pt-6 sm:pt-8 pb-2">
              <h1 className="text-2xl font-black text-[#1A2B4A] mb-1">Create your account</h1>
              <p className="text-sm text-gray-500 mb-7">Free forever · No credit card needed</p>

              {/* Google button */}
              <button
                type="button"
                onClick={() => { window.location.href = `${import.meta.env.VITE_API_URL ?? ""}/api/auth/google?source=${encodeURIComponent(signupSource)}`; }}
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
              <div className="relative my-5">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-white px-4 text-xs text-gray-400 font-medium">or</span>
                </div>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4 pb-6">
                {/* Account type: Personal (Noah KYC) or Business (Noah KYB) */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-gray-700">Account Type</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {([
                      { value: "personal" as const, icon: <User size={16} />, title: "Personal", desc: "For remote workers & freelancers" },
                      { value: "business" as const, icon: <Building2 size={16} />, title: "Business", desc: "For companies & partnerships" },
                    ]).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setAccountType(opt.value)}
                        className={`text-left rounded-xl border p-3 transition-all ${
                          accountType === opt.value
                            ? "border-[#4DC9EE] bg-[#4DC9EE]/5 ring-2 ring-[#4DC9EE]/20"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <div className={`flex items-center gap-1.5 text-sm font-semibold mb-0.5 ${
                          accountType === opt.value ? "text-[#1A2B4A]" : "text-gray-700"
                        }`}>
                          <span className={accountType === opt.value ? "text-[#4DC9EE]" : "text-gray-400"}>{opt.icon}</span>
                          {opt.title}
                        </div>
                        <p className="text-[11px] text-gray-400 leading-tight">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Business Name (business accounts only) */}
                {accountType === "business" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="businessName" className="text-sm font-medium text-gray-700">Registered Business Name</Label>
                    <Input
                      id="businessName"
                      placeholder="Acme Ltd"
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className="rounded-xl border-gray-200 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11"
                    />
                    <p className="text-[11px] text-gray-400">
                      You'll verify the business and its representative (KYB) after sign-up. Your virtual US account &amp; EU IBAN are issued in the business name — USDC &amp; USDT supported.
                    </p>
                  </div>
                )}

                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">
                    {accountType === "business" ? "Representative Full Name" : "Full Name"}
                  </Label>
                  <Input
                    id="fullName"
                    placeholder="Jane Doe"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="rounded-xl border-gray-200 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11"
                  />
                </div>

                {/* Email */}
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

                {/* Phone Number */}
                <div className="space-y-1.5">
                  <Label htmlFor="phoneNumber" className="text-sm font-medium text-gray-700">
                    Phone Number{" "}
                    <span className="text-gray-400 font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+254 7XX XXX XXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="rounded-xl border-gray-200 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11"
                  />
                  <p className="text-[11px] text-gray-400">Used for M-Pesa / Mobile Money cash-outs and receiving money from friends.</p>
                </div>

                {/* Country */}
                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-sm font-medium text-gray-700">Country</Label>
                  <select
                    id="country"
                    required
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20 transition-colors"
                  >
                    <option value="">Select your country</option>
                    <optgroup label="Popular">
                      {POPULAR_COUNTRIES.map((c) => (
                        <option key={`pop-${c}`} value={c}>{c}</option>
                      ))}
                    </optgroup>
                    <optgroup label="All countries">
                      {ALL_COUNTRIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </optgroup>
                  </select>
                  <p className="text-[11px] text-gray-400">We use this to show your local cash-out methods (M-Pesa, GCash, PIX…).</p>
                </div>

                {/* Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Min. 8 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="rounded-xl border-gray-200 focus:border-[#4DC9EE] focus:ring-[#4DC9EE]/20 h-11 pr-11"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                </div>

                {/* Confirm Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirm ? "text" : "password"}
                      required
                      minLength={8}
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`rounded-xl h-11 pr-11 focus:ring-[#4DC9EE]/20 ${
                        confirmPassword && !passwordsMatch
                          ? "border-red-300 focus:border-red-400"
                          : "border-gray-200 focus:border-[#4DC9EE]"
                      }`}
                    />
                    <button
                      type="button"
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      onClick={() => setShowConfirm((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirm ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-[11px] text-red-500 font-medium">Passwords don't match yet.</p>
                  )}
                  {confirmPassword && passwordsMatch && (
                    <p className="text-[11px] text-green-600 font-medium flex items-center gap-1"><CheckCircle size={11} /> Passwords match</p>
                  )}
                </div>

                {/* Terms checkbox */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    required
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#4DC9EE] flex-shrink-0"
                  />
                  <span className="text-xs text-gray-500 leading-relaxed">
                    By creating an account, you agree to our{" "}
                    <Link href="/terms" className="text-[#4DC9EE] hover:underline font-medium">
                      Terms of Service
                    </Link>
                    {" "}and{" "}
                    <Link href="/privacy" className="text-[#4DC9EE] hover:underline font-medium">
                      Privacy Policy
                    </Link>
                  </span>
                </label>

                {/* Submit */}
                <Button
                  className="w-full h-12 rounded-xl bg-[#4DC9EE] hover:bg-[#1A2B4A] text-white font-bold transition-colors text-base shadow-md shadow-[#4DC9EE]/20"
                  type="submit"
                  disabled={registerMutation.isPending || !agreedToTerms}
                >
                  {registerMutation.isPending ? "Creating account..." : "Create Free Account →"}
                </Button>
              </form>
            </div>

            {/* Card footer */}
            <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 text-center">
              <p className="text-sm text-gray-500">
                Already have an account?{" "}
                <Link href="/login" className="text-[#4DC9EE] hover:underline font-semibold">
                  Sign in
                </Link>
              </p>
            </div>
          </div>

          {/* Bottom links */}
          <p className="text-center text-xs text-gray-400 mt-5">
            <Link href="/about" className="hover:text-[#4DC9EE] transition-colors">About S-PAY</Link>
            {" · "}
            <Link href="/privacy" className="hover:text-[#4DC9EE] transition-colors">Privacy</Link>
            {" · "}
            <Link href="/terms" className="hover:text-[#4DC9EE] transition-colors">Terms</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
