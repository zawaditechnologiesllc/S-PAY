import { Link } from "wouter";
import {
  Wallet, Landmark, CreditCard, Briefcase, ArrowRight,
  Globe, Shield, Zap, CheckCircle,
  ScanLine, ArrowUpFromLine, ArrowDownToLine, Send,
} from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

const FEATURES = [
  {
    icon: <Wallet size={28} />,
    color: "#4DC9EE",
    title: "Digital Dollar Wallet",
    desc: "Hold and send digital dollars instantly. Access your money anywhere with near-zero transfer fees.",
  },
  {
    icon: <Landmark size={28} />,
    color: "#22C55E",
    title: "Virtual Bank Account",
    desc: "Get a US (ACH) and EU (IBAN) virtual account number. Let clients pay you like a local.",
  },
  {
    icon: <CreditCard size={28} />,
    color: "#1A2B4A",
    title: "S-PAY Virtual Card",
    desc: "Spend your balance anywhere Visa is accepted — online and in stores. Coming soon.",
  },
  {
    icon: <Briefcase size={28} />,
    color: "#F59E0B",
    title: "Remote Jobs Board",
    desc: "Discover top remote roles from leading job platforms — all in one feed.",
  },
];

const QUICK_ACTIONS = [
  { icon: <ScanLine size={20} />, label: "Scan & Pay", color: "#4DC9EE" },
  { icon: <Send size={20} />, label: "Transfer", color: "#F59E0B" },
  { icon: <ArrowDownToLine size={20} />, label: "Deposit", color: "#22C55E" },
  { icon: <ArrowUpFromLine size={20} />, label: "Withdraw", color: "#2E8FD6" },
];

const STEPS = [
  { num: "01", title: "Create your account", desc: "Sign up in 2 minutes with just your email and a password. No branch visit needed." },
  { num: "02", title: "Verify your identity", desc: "Complete a quick identity check to unlock full limits and instant transfers." },
  { num: "03", title: "Send, receive & earn", desc: "Use your digital wallet, virtual accounts, and job board from day one." },
];

const MARKETS = [
  { flag: "🇰🇪", country: "Kenya", method: "M-Pesa", color: "#22C55E" },
  { flag: "🇳🇬", country: "Nigeria", method: "Bank", color: "#22C55E" },
  { flag: "🇬🇭", country: "Ghana", method: "MTN", color: "#F59E0B" },
  { flag: "🇺🇬", country: "Uganda", method: "Mobile Money", color: "#4DC9EE" },
  { flag: "🇹🇿", country: "Tanzania", method: "M-Pesa", color: "#22C55E" },
  { flag: "🇷🇼", country: "Rwanda", method: "MoMo", color: "#4DC9EE" },
  { flag: "🇵🇭", country: "Philippines", method: "GCash", color: "#2E8FD6" },
  { flag: "🇧🇷", country: "Brazil", method: "PIX", color: "#4DC9EE" },
  { flag: "🇨🇴", country: "Colombia", method: "Nequi", color: "#F59E0B" },
  { flag: "🇮🇩", country: "Indonesia", method: "GoPay", color: "#22C55E" },
  { flag: "🇲🇽", country: "Mexico", method: "SPEI", color: "#4DC9EE" },
  { flag: "🇪🇺", country: "EU", method: "SEPA", color: "#2E8FD6" },
  { flag: "🇺🇸", country: "USA", method: "ACH", color: "#1A2B4A" },
  { flag: "🇿🇦", country: "South Africa", method: "Bank", color: "#F59E0B" },
];

const STATS = [
  { value: "500K+", label: "Users worldwide" },
  { value: "$0", label: "Monthly fee" },
  { value: "180+", label: "Countries supported" },
  { value: "<1 min", label: "Withdrawals" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img
              src={spayLogo}
              alt="S-PAY"
              className="w-8 h-8 rounded-lg object-cover shadow-sm"
            />
            <span className="font-bold text-[#1A2B4A] text-lg tracking-tight">S-PAY</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <a href="#features" className="hover:text-[#4DC9EE] transition-colors">Features</a>
            <a href="#how" className="hover:text-[#4DC9EE] transition-colors">How it works</a>
            <a href="#markets" className="hover:text-[#4DC9EE] transition-colors">Markets</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <button className="text-sm font-medium text-gray-700 hover:text-[#1A2B4A] transition-colors px-4 py-2">Sign in</button>
            </Link>
            <Link href="/register">
              <button className="text-sm font-semibold bg-[#4DC9EE] text-white px-5 py-2.5 rounded-full hover:bg-[#1A2B4A] transition-colors">
                Get Started
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6 relative overflow-hidden bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, #4DC9EE 0%, transparent 50%), radial-gradient(circle at 80% 20%, #A8DEFF 0%, transparent 50%)"
        }} />
        <div className="relative max-w-6xl mx-auto">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
              <Globe size={12} /> Built for remote workers worldwide
            </div>
            <h1 className="text-5xl md:text-6xl font-black text-white leading-tight mb-6">
              Get paid globally.<br />
              <span className="text-[#4DC9EE]">Cash out locally.</span>
            </h1>
            <p className="text-xl text-blue-200 mb-10 max-w-2xl leading-relaxed">
              Your virtual USD &amp; EUR bank account, digital wallet, and cash-out tool — all in one app. Built for remote workers everywhere.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <button className="flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-8 py-4 rounded-2xl hover:bg-[#3ab8dd] transition-all text-base shadow-lg shadow-[#4DC9EE]/30">
                  Open Free Account <ArrowRight size={18} />
                </button>
              </Link>
              <a href="#how">
                <button className="flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-white/20 transition-all text-base border border-white/20">
                  See How It Works
                </button>
              </a>
            </div>
            <p className="text-blue-300 text-sm mt-5">
              Or sign in with{" "}
              <Link href="/login" className="text-[#4DC9EE] font-medium hover:underline">
                your existing account
              </Link>
            </p>
            {/* Stats row */}
            <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-6">
              {STATS.map((s) => (
                <div key={s.label} className="text-center md:text-left">
                  <div className="text-3xl font-black text-white">{s.value}</div>
                  <div className="text-sm text-blue-300 mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* App preview card */}
        <div className="relative max-w-6xl mx-auto mt-16">
          <div className="md:absolute md:right-0 md:-top-80 w-full md:w-80">
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-6 shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <p className="text-blue-300 text-xs">Total Balance</p>
                  <p className="text-white text-3xl font-black mt-1">$1,245.60</p>
                </div>
                <div className="bg-[#4DC9EE]/20 text-[#4DC9EE] text-xs font-semibold px-3 py-1 rounded-full border border-[#4DC9EE]/30">Digital Dollars</div>
              </div>
              <div className="grid grid-cols-4 gap-3 mt-6 pt-4 border-t border-white/10">
                {QUICK_ACTIONS.map((a) => (
                  <div key={a.label} className="flex flex-col items-center gap-2">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: a.color }}>
                      {a.icon}
                    </div>
                    <span className="text-[10px] text-blue-200 font-medium text-center">{a.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#1A2B4A] mb-4">Everything you need</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">One super app replaces your bank, payment processor, card, and job board.</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform" style={{ backgroundColor: f.color }}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-[#1A2B4A] text-lg mb-2">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#1A2B4A] mb-4">Up and running in minutes</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">No branch visits. No paperwork. No waiting.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-[#4DC9EE] to-transparent z-0 -translate-x-4" />
                )}
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4DC9EE] to-[#1A2B4A] flex items-center justify-center text-white font-black text-xl mb-5 shadow-lg">
                    {s.num}
                  </div>
                  <h3 className="font-bold text-[#1A2B4A] text-xl mb-2">{s.title}</h3>
                  <p className="text-gray-500 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust / Security */}
      <section className="py-16 px-6 bg-gradient-to-r from-[#1A2B4A] to-[#0d1f38]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-white">
            {[
              { icon: <Shield size={28} />, title: "You Control Your Money", desc: "Your funds, your access. We use a secure network so only you can authorize transfers." },
              { icon: <Zap size={28} />, title: "Instant Transfers", desc: "Send and receive digital money in seconds, not days. Available around the clock." },
              { icon: <CheckCircle size={28} />, title: "Identity Verified", desc: "Full identity verification protects you and keeps the platform safe for everyone." },
            ].map((t) => (
              <div key={t.title} className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#4DC9EE] flex-shrink-0">
                  {t.icon}
                </div>
                <div>
                  <h4 className="font-bold mb-1">{t.title}</h4>
                  <p className="text-blue-200 text-sm leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Markets */}
      <section id="markets" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#1A2B4A] mb-4">Withdraw to your local currency</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Live FX rates. Multiple payout methods. Money where you need it.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {MARKETS.map((m) => (
              <div key={m.country} className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100 hover:shadow-md transition-all">
                <div className="text-3xl mb-2">{m.flag}</div>
                <div className="font-semibold text-[#1A2B4A] text-xs">{m.country}</div>
                <div className="text-[10px] font-bold mt-1.5 px-2 py-0.5 rounded-full inline-block text-white" style={{ backgroundColor: m.color }}>
                  {m.method}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-[#4DC9EE]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-6">Start receiving money today</h2>
          <p className="text-blue-100 text-lg mb-10">Join hundreds of thousands of remote workers who use S-PAY to manage their global income.</p>
          <Link href="/register">
            <button className="inline-flex items-center gap-2 bg-[#1A2B4A] text-white font-bold px-10 py-5 rounded-2xl hover:bg-[#0d1f38] transition-colors text-lg shadow-xl">
              Open Free Account <ArrowRight size={20} />
            </button>
          </Link>
          <p className="text-blue-100 text-sm mt-6">No credit card required · Free to open · Cancel anytime</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1A2B4A] py-12 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img
                  src={spayLogo}
                  alt="S-PAY"
                  className="w-7 h-7 rounded-lg object-cover"
                />
                <span className="font-bold text-white text-base">S-PAY</span>
              </div>
              <p className="text-blue-300 text-sm leading-relaxed">Digital money super app for remote workers worldwide.</p>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Product</h5>
              <ul className="space-y-2">
                <li><a href="#features" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Digital Wallet</a></li>
                <li><a href="#features" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Virtual Banking</a></li>
                <li><a href="#features" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Virtual Card</a></li>
                <li><a href="#features" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Remote Jobs</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Company</h5>
              <ul className="space-y-2">
                <li><Link href="/about" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">About Us</Link></li>
                <li><a href="#" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Blog</a></li>
                <li><a href="#" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Careers</a></li>
                <li><a href="#" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Press</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Legal</h5>
              <ul className="space-y-2">
                <li><Link href="/privacy" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Terms of Service</Link></li>
                <li><a href="#" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-blue-400 text-sm">© 2026 S-PAY · spayewallet.com · All rights reserved</p>
            <p className="text-blue-400 text-xs">Built for remote workers in Africa, Southeast Asia &amp; Latin America</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
