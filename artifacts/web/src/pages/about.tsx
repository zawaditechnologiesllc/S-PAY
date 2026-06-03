import { Link } from "wouter";
import {
  Globe, ArrowRight, Landmark, Wallet, ArrowDownToLine,
  Shield, Zap, Clock, HeartHandshake, Users, DollarSign,
} from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

const HOW_IT_WORKS = [
  {
    icon: <Landmark size={28} />,
    color: "#4DC9EE",
    title: "Receive Like a Local",
    desc: "Get a real virtual USD or EUR bank account. Share your routing number, IBAN, or PIX key with any employer or client and receive payments exactly like a local business would — via ACH, SEPA, or PIX.",
  },
  {
    icon: <Wallet size={28} />,
    color: "#1A2B4A",
    title: "Hold & Manage",
    desc: "Your Digital Dollars sit safely in your S-PAY wallet, accessible 24 hours a day, 7 days a week. Convert between USD and EUR, track every transaction, and always know your balance in real time.",
  },
  {
    icon: <ArrowDownToLine size={28} />,
    color: "#22C55E",
    title: "Cash Out Instantly",
    desc: "Withdraw to M-Pesa, MTN Mobile Money, your local bank account, or via SEPA and PIX — often within minutes. Competitive exchange rates with no hidden markups.",
  },
];

const MARKETS = [
  { flag: "🇰🇪", country: "Kenya", method: "M-Pesa", color: "#22C55E" },
  { flag: "🇳🇬", country: "Nigeria", method: "Bank Transfer", color: "#4DC9EE" },
  { flag: "🇬🇭", country: "Ghana", method: "Mobile Money", color: "#F59E0B" },
  { flag: "🇺🇬", country: "Uganda", method: "MTN Mobile Money", color: "#F59E0B" },
  { flag: "🇹🇿", country: "Tanzania", method: "M-Pesa", color: "#22C55E" },
  { flag: "🇷🇼", country: "Rwanda", method: "Mobile Money", color: "#4DC9EE" },
  { flag: "🇿🇦", country: "South Africa", method: "Bank Transfer", color: "#2E8FD6" },
  { flag: "🇵🇭", country: "Philippines", method: "Bank / GCash", color: "#F59E0B" },
  { flag: "🇧🇷", country: "Brazil", method: "PIX", color: "#4DC9EE" },
  { flag: "🇮🇩", country: "Indonesia", method: "Bank Transfer", color: "#22C55E" },
  { flag: "🇨🇴", country: "Colombia", method: "Bank Transfer", color: "#F59E0B" },
  { flag: "🇲🇽", country: "Mexico", method: "SPEI / Bank", color: "#22C55E" },
  { flag: "🇪🇺", country: "EU / SEPA", method: "SEPA", color: "#2E8FD6" },
  { flag: "🇺🇸", country: "USA", method: "ACH / Wire", color: "#1A2B4A" },
];

const STATS = [
  { icon: <DollarSign size={22} />, value: "$0", label: "Monthly fee" },
  { icon: <Globe size={22} />, value: "180+", label: "Countries supported" },
  { icon: <Clock size={22} />, value: "< 1 min", label: "Average withdrawal" },
  { icon: <HeartHandshake size={22} />, value: "24/7", label: "Customer support" },
];

const VALUES = [
  {
    icon: <Shield size={24} />,
    title: "Security First",
    desc: "Bank-grade encryption protects every transaction and piece of personal data we handle.",
  },
  {
    icon: <Zap size={24} />,
    title: "Speed Matters",
    desc: "We obsess over settlement times because your rent, groceries, and family don't wait.",
  },
  {
    icon: <Users size={24} />,
    title: "Built for You",
    desc: "We design every feature with remote workers in emerging markets at the center.",
  },
];

export default function About() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <img src={spayLogo} alt="S-PAY" className="w-8 h-8 rounded-[22%] flex-shrink-0" />
              <span className="font-bold text-[#1A2B4A] text-lg tracking-tight">S-PAY</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            <Link href="/#features">
              <span className="hover:text-[#4DC9EE] transition-colors cursor-pointer">Features</span>
            </Link>
            <Link href="/about">
              <span className="text-[#4DC9EE] font-semibold cursor-pointer">About</span>
            </Link>
            <Link href="/#markets">
              <span className="hover:text-[#4DC9EE] transition-colors cursor-pointer">Markets</span>
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <button className="text-sm font-medium text-gray-700 hover:text-[#1A2B4A] transition-colors px-4 py-2">
                Sign in
              </button>
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
      <section className="pt-32 pb-24 px-6 relative overflow-hidden bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 60%, #4DC9EE 0%, transparent 50%), radial-gradient(circle at 85% 15%, #A8DEFF 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-semibold px-4 py-1.5 rounded-full mb-8 border border-white/20">
            <Globe size={12} /> Our story
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white leading-tight mb-6">
            We believe everyone deserves<br />
            <span className="text-[#4DC9EE]">access to global financial tools.</span>
          </h1>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto leading-relaxed">
            S-PAY was built for the billions of talented people who earn income across borders but are locked out of the financial infrastructure that makes it simple.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">Our Mission</span>
              <h2 className="text-4xl font-black text-[#1A2B4A] mt-3 mb-6 leading-tight">
                Eliminate the gap between where remote workers live and where they get paid.
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-6">
                The global remote work economy has created incredible opportunity — but the financial plumbing hasn't kept up. A developer in Nairobi, a designer in Lagos, or a marketer in Manila should be able to get paid just as easily as someone sitting in San Francisco.
              </p>
              <p className="text-gray-500 text-lg leading-relaxed">
                S-PAY bridges that gap: a single platform that gives you a real US or European bank account, lets you hold your earnings in Digital Dollars, and moves money to your mobile wallet or local bank in minutes — not days.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5">
              {VALUES.map((v) => (
                <div
                  key={v.title}
                  className="flex items-start gap-4 bg-gray-50 rounded-2xl p-6 border border-gray-100"
                >
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#4DC9EE] to-[#1A2B4A] flex items-center justify-center text-white flex-shrink-0">
                    {v.icon}
                  </div>
                  <div>
                    <h4 className="font-bold text-[#1A2B4A] mb-1">{v.title}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">{v.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">How It Works</span>
            <h2 className="text-4xl font-black text-[#1A2B4A] mt-3 mb-4">
              Three steps to financial freedom.
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              No paperwork. No branch visits. No waiting.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.title}
                className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group"
              >
                <div className="flex items-center justify-between mb-6">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-white group-hover:scale-110 transition-transform"
                    style={{ backgroundColor: step.color }}
                  >
                    {step.icon}
                  </div>
                  <span className="text-5xl font-black text-gray-100 select-none">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="font-bold text-[#1A2B4A] text-xl mb-3">{step.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-6 bg-gradient-to-r from-[#1A2B4A] to-[#0d1f38]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {STATS.map((s) => (
              <div key={s.label} className="text-center">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#4DC9EE] mx-auto mb-4">
                  {s.icon}
                </div>
                <div className="text-4xl font-black text-white mb-1">{s.value}</div>
                <div className="text-blue-300 text-sm">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Markets */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">Global Coverage</span>
            <h2 className="text-4xl font-black text-[#1A2B4A] mt-3 mb-4">
              Built for the world's fastest-growing economies.
            </h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              We support the payment methods people actually use — from mobile money to local bank rails.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {MARKETS.map((m) => (
              <div
                key={m.country}
                className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200"
              >
                <div className="text-3xl mb-2">{m.flag}</div>
                <div className="font-semibold text-[#1A2B4A] text-xs leading-tight mb-1.5">
                  {m.country}
                </div>
                <div
                  className="text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-block text-white leading-tight"
                  style={{ backgroundColor: m.color }}
                >
                  {m.method}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Company */}
      <section className="py-24 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">The Company</span>
          <h2 className="text-4xl font-black text-[#1A2B4A] mt-3 mb-6">
            Who we are.
          </h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-6">
            Founded in 2024 by a team of fintech engineers and remittance experts, S-PAY (Zawadi Technologies LLC) is on a mission to make global payments simple, fast, and affordable for the 1 billion+ people earning income across borders.
          </p>
          <p className="text-gray-500 text-lg leading-relaxed mb-10">
            Our team has deep roots in financial services, mobile money networks, and cross-border payments. We've spent our careers watching talented people lose money to sky-high fees and slow transfers — and we built S-PAY to fix that.
          </p>
          <div className="inline-flex items-center gap-3 bg-[#4DC9EE]/10 text-[#1A2B4A] rounded-2xl px-6 py-4 border border-[#4DC9EE]/20">
            <Globe size={20} className="text-[#4DC9EE]" />
            <span className="font-semibold text-sm">
              Headquartered in the United States · Serving remote workers in 180+ countries
            </span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6 bg-[#4DC9EE]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-6">Join us on the mission.</h2>
          <p className="text-blue-100 text-lg mb-10">
            Open your free S-PAY account in minutes and start receiving global payments today.
          </p>
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
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 rounded-lg bg-[#4DC9EE] flex items-center justify-center">
                  <span className="text-white font-bold text-xs">S</span>
                </div>
                <span className="font-bold text-white text-base">S-PAY</span>
              </div>
              <p className="text-blue-300 text-sm leading-relaxed max-w-xs">
                Digital wallet for remote workers worldwide. Receive, hold, and withdraw with ease.
              </p>
            </div>
            <div className="flex flex-wrap gap-16">
              <div>
                <h5 className="text-white font-semibold mb-4">Product</h5>
                <ul className="space-y-2">
                  {["Wallet", "Banking", "Withdraw", "Jobs"].map((l) => (
                    <li key={l}>
                      <a href="#" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">{l}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="text-white font-semibold mb-4">Company</h5>
                <ul className="space-y-2">
                  <li>
                    <Link href="/about">
                      <span className="text-[#4DC9EE] text-sm cursor-pointer">About</span>
                    </Link>
                  </li>
                  <li><a href="#" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Blog</a></li>
                  <li><a href="#" className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors">Careers</a></li>
                </ul>
              </div>
              <div>
                <h5 className="text-white font-semibold mb-4">Legal</h5>
                <ul className="space-y-2">
                  <li>
                    <Link href="/privacy">
                      <span className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors cursor-pointer">Privacy Policy</span>
                    </Link>
                  </li>
                  <li>
                    <Link href="/terms">
                      <span className="text-blue-300 text-sm hover:text-[#4DC9EE] transition-colors cursor-pointer">Terms of Service</span>
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-blue-400 text-sm">© 2026 S-PAY · Zawadi Technologies LLC · All rights reserved</p>
            <p className="text-blue-400 text-xs">Built for remote workers in Africa, Southeast Asia &amp; Latin America</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
