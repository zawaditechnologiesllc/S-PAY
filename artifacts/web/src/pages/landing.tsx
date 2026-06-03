import { Link } from "wouter";
import {
  Wallet, Landmark, CreditCard, Briefcase, ArrowRight,
  Globe, Shield, Zap, CheckCircle,
  ScanLine, ArrowUpFromLine, ArrowDownToLine, Send,
} from "lucide-react";

const FEATURES = [
  {
    icon: <Wallet size={28} />,
    color: "#4DC9EE",
    title: "USDC Wallet",
    desc: "Hold and send USDC on Celo instantly, anywhere in the world with near-zero fees.",
  },
  {
    icon: <Landmark size={28} />,
    color: "#22C55E",
    title: "Virtual Banking",
    desc: "Get a US (ACH) and EU (IBAN) virtual account. Receive client payments like a local.",
  },
  {
    icon: <CreditCard size={28} />,
    color: "#1A2B4A",
    title: "Virtual Card",
    desc: "Spend your balance anywhere Visa is accepted — online or in-store. Coming soon.",
  },
  {
    icon: <Briefcase size={28} />,
    color: "#F59E0B",
    title: "Remote Jobs",
    desc: "Discover top remote roles from Himalayas, RemoteOK and Remotive — all in one feed.",
  },
];

const QUICK_ACTIONS = [
  { icon: <ScanLine size={20} />, label: "Scan & Pay", color: "#4DC9EE" },
  { icon: <Send size={20} />, label: "Transfer", color: "#F59E0B" },
  { icon: <ArrowDownToLine size={20} />, label: "Recharge", color: "#22C55E" },
  { icon: <ArrowUpFromLine size={20} />, label: "Withdraw", color: "#2E8FD6" },
];

const STEPS = [
  { num: "01", title: "Create your account", desc: "Sign up in 2 minutes with just your email and a password." },
  { num: "02", title: "Verify your identity", desc: "Complete a quick KYC check to unlock full limits and transfers." },
  { num: "03", title: "Send, receive & earn", desc: "Use your wallet, virtual accounts, and job board from day one." },
];

const MARKETS = [
  { flag: "🇰🇪", country: "Kenya", method: "M-Pesa", color: "#22C55E" },
  { flag: "🇧🇷", country: "Brazil", method: "PIX", color: "#4DC9EE" },
  { flag: "🇩🇪", country: "Europe", method: "SEPA", color: "#2E8FD6" },
  { flag: "🇵🇭", country: "Philippines", method: "Wire", color: "#F59E0B" },
  { flag: "🇳🇬", country: "Nigeria", method: "Bank", color: "#22C55E" },
  { flag: "🇮🇩", country: "Indonesia", method: "Wire", color: "#4DC9EE" },
];

const STATS = [
  { value: "180+", label: "Countries supported" },
  { value: "$0", label: "Monthly fee" },
  { value: "~0s", label: "Celo settlement" },
  { value: "3", label: "Withdrawal methods" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#4DC9EE] to-[#1A2B4A] flex items-center justify-center">
              <span className="text-white font-bold text-sm">S</span>
            </div>
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
              Bank global.<br />
              <span className="text-[#4DC9EE]">Live local.</span>
            </h1>
            <p className="text-xl text-blue-200 mb-10 max-w-2xl leading-relaxed">
              Earn in USDC on Celo, hold virtual USD &amp; EUR accounts, withdraw to M-Pesa, SEPA or PIX — and find your next remote job. One app.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <button className="flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-8 py-4 rounded-2xl hover:bg-[#3ab8dd] transition-all text-base shadow-lg shadow-[#4DC9EE]/30">
                  Open Free Account <ArrowRight size={18} />
                </button>
              </Link>
              <Link href="/login">
                <button className="flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-white/20 transition-all text-base border border-white/20">
                  Sign In
                </button>
              </Link>
            </div>
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
                <div className="bg-[#4DC9EE]/20 text-[#4DC9EE] text-xs font-semibold px-3 py-1 rounded-full border border-[#4DC9EE]/30">USDC on Celo</div>
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
              { icon: <Shield size={28} />, title: "Non-custodial Wallet", desc: "Your keys, your crypto. Built on Celo with Privy embedded wallets." },
              { icon: <Zap size={28} />, title: "Instant Settlement", desc: "USDC transfers settle in seconds, not days. Powered by the Celo blockchain." },
              { icon: <CheckCircle size={28} />, title: "KYC Verified", desc: "Full KYC verification protects you and keeps the platform compliant." },
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
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Live FX rates. Multiple payout rails. Money where you need it.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {MARKETS.map((m) => (
              <div key={m.country} className="bg-white rounded-2xl p-5 text-center shadow-sm border border-gray-100 hover:shadow-md transition-all">
                <div className="text-4xl mb-3">{m.flag}</div>
                <div className="font-semibold text-[#1A2B4A] text-sm">{m.country}</div>
                <div className="text-xs font-bold mt-1 px-2 py-0.5 rounded-full inline-block text-white" style={{ backgroundColor: m.color }}>
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
          <h2 className="text-4xl font-black text-white mb-6">Start earning globally today</h2>
          <p className="text-blue-100 text-lg mb-10">Join thousands of remote workers who use S-PAY to manage their global income.</p>
          <Link href="/register">
            <button className="inline-flex items-center gap-2 bg-[#1A2B4A] text-white font-bold px-10 py-5 rounded-2xl hover:bg-[#0d1f38] transition-colors text-lg shadow-xl">
              Create Free Account <ArrowRight size={20} />
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
                <div className="w-7 h-7 rounded-lg bg-[#4DC9EE] flex items-center justify-center">
                  <span className="text-white font-bold text-xs">S</span>
                </div>
                <span className="font-bold text-white text-base">S-PAY</span>
              </div>
              <p className="text-blue-300 text-sm leading-relaxed">Digital wallet super app for remote workers worldwide.</p>
            </div>
            {[
              { title: "Product", links: ["Wallet", "Banking", "Card", "Jobs"] },
              { title: "Company", links: ["About", "Blog", "Careers", "Press"] },
              { title: "Legal", links: ["Privacy Policy", "Terms of Service", "Cookie Policy"] },
            ].map((col) => (
              <div key={col.title}>
                <h5 className="text-white font-semibold mb-4">{col.title}</h5>
                <ul className="space-y-2">
                  {col.links.map((link) => (
                    <li key={link}><a href="#" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">{link}</a></li>
                  ))}
                </ul>
              </div>
            ))}
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
