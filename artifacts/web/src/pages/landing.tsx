import { Link } from "wouter";
import {
  Wallet, Landmark, CreditCard, Briefcase, ArrowRight,
  Globe, Shield, Zap, CheckCircle,
  ScanLine, ArrowUpFromLine, ArrowDownToLine, Send,
  Star,
} from "lucide-react";
import { PublicLayout } from "@/components/public-layout";

const FEATURES = [
  {
    icon: <Wallet size={28} />,
    color: "#4DC9EE",
    title: "Digital Dollar Wallet",
    desc: "Hold and send money globally with near-zero fees. Your balance is always in digital dollars, ready to use.",
  },
  {
    icon: <Landmark size={28} />,
    color: "#22C55E",
    title: "Virtual Bank Account",
    desc: "Get a real US account number (ACH routing) and European IBAN. Let employers and clients pay you like a local.",
  },
  {
    icon: <CreditCard size={28} />,
    color: "#1A2B4A",
    title: "S-PAY Card",
    desc: "A virtual card linked to your balance for online payments globally. Apply for early access.",
    badge: "Coming soon",
  },
  {
    icon: <Briefcase size={28} />,
    color: "#F59E0B",
    title: "Remote Jobs Board",
    desc: "Browse thousands of remote-only roles updated daily. Filter by category. Apply directly. Free for all members.",
  },
];

const QUICK_ACTIONS = [
  { icon: <ScanLine size={20} />, label: "Scan", color: "#4DC9EE" },
  { icon: <Send size={20} />, label: "Transfer", color: "#F59E0B" },
  { icon: <ArrowDownToLine size={20} />, label: "Deposit", color: "#22C55E" },
  { icon: <ArrowUpFromLine size={20} />, label: "Withdraw", color: "#2E8FD6" },
];

const STEPS = [
  { num: "01", title: "Create your account", desc: "Sign up in 2 minutes with just your email. No branch visit, no paperwork required." },
  { num: "02", title: "Get your account number", desc: "Receive a real US ACH account number and European IBAN instantly after sign-up." },
  { num: "03", title: "Cash out instantly", desc: "Withdraw to M-Pesa, MTN, PIX and 50+ local payout methods in seconds." },
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
  { flag: "🇪🇺", country: "Europe", method: "SEPA", color: "#2E8FD6" },
  { flag: "🇺🇸", country: "USA", method: "ACH", color: "#1A2B4A" },
  { flag: "🇿🇦", country: "South Africa", method: "Bank", color: "#F59E0B" },
];

const STATS = [
  { value: "500K+", label: "Users worldwide" },
  { value: "$0", label: "Monthly fee" },
  { value: "180+", label: "Countries supported" },
  { value: "<1 min", label: "Withdrawals" },
];

const TICKER_ITEMS = [
  "🇰🇪 Kenya", "🇳🇬 Nigeria", "🇬🇭 Ghana", "🇺🇬 Uganda", "🇹🇿 Tanzania",
  "🇷🇼 Rwanda", "🇵🇭 Philippines", "🇧🇷 Brazil", "🇨🇴 Colombia",
  "🇮🇩 Indonesia", "🇲🇽 Mexico", "🇪🇺 Europe", "🇺🇸 USA", "🇿🇦 South Africa",
];

const MOCK_JOBS = [
  { title: "Senior Frontend Engineer", company: "Remote", tag: "Engineering", color: "#4DC9EE", isNew: true },
  { title: "Product Designer", company: "Global", tag: "Design", color: "#22C55E", isNew: false },
  { title: "Growth Marketing Lead", company: "Worldwide", tag: "Marketing", color: "#F59E0B", isNew: true },
  { title: "Customer Success Manager", company: "Remote", tag: "Operations", color: "#2E8FD6", isNew: false },
];

const TESTIMONIALS = [
  {
    quote: "I moved from PayPal to S-PAY. My clients pay in USD, I withdraw to M-Pesa in minutes. No more 3–5 day waits.",
    name: "James O.",
    role: "Full-Stack Developer",
    location: "Nairobi",
    flag: "🇰🇪",
    initials: "JO",
    color: "#4DC9EE",
  },
  {
    quote: "I got a real US account number in minutes. Now my US startup clients pay me like a local — zero friction.",
    name: "Amara D.",
    role: "Product Designer",
    location: "Lagos",
    flag: "🇳🇬",
    initials: "AD",
    color: "#22C55E",
  },
  {
    quote: "The jobs board is how I found my current contract. I get paid straight into my wallet. It's effortless.",
    name: "Maria F.",
    role: "Marketing Manager",
    location: "São Paulo",
    flag: "🇧🇷",
    initials: "MF",
    color: "#F59E0B",
  },
];

const TRUST_BADGES = [
  { icon: <Shield size={22} />, label: "No monthly fee" },
  { icon: <Globe size={22} />, label: "180+ countries" },
  { icon: <Zap size={22} />, label: "Instant withdrawals" },
  { icon: <CheckCircle size={22} />, label: "Verified & Secure" },
];

export default function Landing() {
  return (
    <PublicLayout>
      {/* ─── HERO ─── */}
      <section className="pt-16 pb-0 relative overflow-hidden bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 15% 60%, rgba(77,201,238,0.25) 0%, transparent 45%), radial-gradient(circle at 85% 15%, rgba(168,222,255,0.15) 0%, transparent 45%)",
        }} />

        <div className="relative max-w-6xl mx-auto px-6 pt-16 pb-0">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left column */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
                <Globe size={12} /> Built for remote workers
              </div>
              <h1 className="text-5xl md:text-6xl font-black text-white leading-[1.08] mb-6">
                The money app that works{" "}
                <span className="text-[#4DC9EE]">where you work.</span>
              </h1>
              <p className="text-xl text-blue-200 mb-10 leading-relaxed max-w-lg">
                Virtual USD &amp; EUR bank accounts, a digital wallet, and instant local cash-outs — one app for remote workers everywhere.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-12">
                <Link href="/register">
                  <button className="flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-8 py-4 rounded-2xl hover:bg-[#2E8FD6] transition-all text-base shadow-lg shadow-[#4DC9EE]/30">
                    Open Free Account <ArrowRight size={18} />
                  </button>
                </Link>
                <a href="#how">
                  <button className="flex items-center gap-2 bg-white/10 text-white font-semibold px-8 py-4 rounded-2xl hover:bg-white/20 transition-all text-base border border-white/20">
                    See How It Works
                  </button>
                </a>
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pb-16 border-t border-white/10 pt-8">
                {STATS.map((s) => (
                  <div key={s.label}>
                    <div className="text-2xl font-black text-white">{s.value}</div>
                    <div className="text-xs text-blue-300 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right column: floating balance card */}
            <div className="flex justify-center lg:justify-end pb-0 lg:pb-0">
              <div className="w-full max-w-xs">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-7 shadow-2xl shadow-black/40">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-blue-300 text-xs mb-1">Total Balance</p>
                      <p className="text-white text-4xl font-black">$1,245.60</p>
                    </div>
                    <div className="bg-[#4DC9EE]/20 text-[#4DC9EE] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#4DC9EE]/30 mt-1">
                      Digital Dollars
                    </div>
                  </div>
                  <div className="h-px bg-white/10 mb-6" />
                  <div className="grid grid-cols-4 gap-3">
                    {QUICK_ACTIONS.map((a) => (
                      <div key={a.label} className="flex flex-col items-center gap-2">
                        <div
                          className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md"
                          style={{ backgroundColor: a.color }}
                        >
                          {a.icon}
                        </div>
                        <span className="text-[10px] text-blue-200 font-medium">{a.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-blue-300">Recent</span>
                      <span className="text-[#4DC9EE] font-medium cursor-default">View all</span>
                    </div>
                    {[
                      { label: "Received from Toptal", amount: "+$500.00", color: "#22C55E" },
                      { label: "M-Pesa withdrawal", amount: "-$120.00", color: "#F59E0B" },
                    ].map((tx) => (
                      <div key={tx.label} className="flex justify-between items-center py-2">
                        <span className="text-blue-200 text-xs">{tx.label}</span>
                        <span className="text-xs font-bold" style={{ color: tx.color }}>{tx.amount}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MARQUEE TICKER ─── */}
      <section className="bg-white border-y border-gray-200 py-3 overflow-hidden">
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .marquee-track {
            display: flex;
            width: max-content;
            animation: marquee 28s linear infinite;
          }
        `}</style>
        <div className="marquee-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1A2B4A] px-6 whitespace-nowrap"
            >
              {item}
              <span className="text-gray-300 ml-4">·</span>
            </span>
          ))}
        </div>
      </section>

      {/* ─── TRUST STRIP ─── */}
      <section className="py-10 px-6 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {TRUST_BADGES.map((b) => (
              <div key={b.label} className="flex items-center gap-3 justify-center">
                <div className="w-9 h-9 rounded-xl bg-[#4DC9EE]/10 flex items-center justify-center text-[#4DC9EE] flex-shrink-0">
                  {b.icon}
                </div>
                <span className="text-sm font-semibold text-[#1A2B4A]">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─── */}
      <section id="how" className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#1A2B4A] mb-4">Up and running in 3 minutes</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">No branch visits. No paperwork. No waiting.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-[#4DC9EE] to-transparent z-0 -translate-x-4" />
                )}
                <div className="relative z-10">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#4DC9EE] to-[#2E8FD6] flex items-center justify-center text-white font-black text-xl mb-5 shadow-lg shadow-[#4DC9EE]/30">
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

      {/* ─── FEATURES ─── */}
      <section id="features" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#1A2B4A] mb-4">One app. Everything you need.</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Replace your bank, payment processor, card, and job board with one super app.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white rounded-3xl p-7 shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200 group relative overflow-hidden">
                {f.badge && (
                  <span className="absolute top-5 right-5 text-[10px] font-bold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full uppercase tracking-wide">
                    {f.badge}
                  </span>
                )}
                <div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-5 group-hover:scale-110 transition-transform shadow-sm"
                  style={{ backgroundColor: f.color }}
                >
                  {f.icon}
                </div>
                <h3 className="font-bold text-[#1A2B4A] text-xl mb-3">{f.title}</h3>
                <p className="text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ─── */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#1A2B4A] mb-4">Trusted by remote workers worldwide</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Real people. Real withdrawals. Real freedom.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="bg-gray-50 rounded-3xl p-7 border border-gray-100 hover:shadow-md transition-all duration-200 flex flex-col">
                <div className="flex gap-1 mb-5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={14} className="text-[#F59E0B] fill-[#F59E0B]" />
                  ))}
                </div>
                <p className="text-gray-700 leading-relaxed mb-6 flex-1">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="font-semibold text-[#1A2B4A] text-sm">{t.name}</p>
                    <p className="text-gray-500 text-xs">{t.role} · {t.flag} {t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── JOBS SECTION ─── */}
      <section id="jobs" className="py-24 px-6 bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left copy */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#4DC9EE]/20 text-[#4DC9EE] text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-[#4DC9EE]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4DC9EE] animate-pulse" />
                Live · Remote Jobs Board
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4 leading-tight">
                Find your next remote job — free
              </h2>
              <p className="text-blue-200 leading-relaxed mb-8">
                Thousands of fully remote roles updated daily — engineering, design, marketing, finance and more. Sourced from the best global platforms. All inside your S-PAY account.
              </p>
              <ul className="space-y-3 mb-10">
                {[
                  "Curated remote-only listings",
                  "Search by keyword or category",
                  "Apply directly on the company site",
                  "Free for all S-PAY members",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-blue-100">
                    <CheckCircle size={16} className="text-[#4DC9EE] flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <button className="flex items-center gap-2 bg-[#F59E0B] text-white font-bold px-7 py-3.5 rounded-2xl hover:bg-[#d97706] transition-colors text-sm shadow-lg">
                  Browse Jobs <ArrowRight size={16} />
                </button>
              </Link>
            </div>

            {/* Right: mock job cards */}
            <div className="space-y-3">
              {MOCK_JOBS.map((job) => (
                <div
                  key={job.title}
                  className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/15 transition-colors"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-sm"
                    style={{ backgroundColor: job.color }}
                  >
                    {job.title[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white text-sm font-semibold truncate">{job.title}</p>
                      {job.isNew && (
                        <span className="text-[10px] bg-[#4DC9EE]/30 text-[#4DC9EE] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-blue-300 text-xs">{job.company} · {job.tag}</p>
                  </div>
                </div>
              ))}
              <p className="text-blue-400 text-xs text-center pt-2">+ thousands more inside the app</p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MARKETS ─── */}
      <section id="markets" className="py-24 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-[#1A2B4A] mb-4">Cash out where you live</h2>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">Live exchange rates · Same-day delivery · 50+ payout methods</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {MARKETS.map((m) => (
              <div key={m.country} className="bg-white rounded-2xl p-4 text-center shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-3xl mb-2">{m.flag}</div>
                <div className="font-semibold text-[#1A2B4A] text-xs">{m.country}</div>
                <div
                  className="text-[10px] font-bold mt-2 px-2 py-0.5 rounded-full inline-block text-white"
                  style={{ backgroundColor: m.color }}
                >
                  {m.method}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECURITY STRIP ─── */}
      <section className="py-16 px-6 bg-gradient-to-r from-[#1A2B4A] to-[#0d1f38]">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 text-white">
            {[
              { icon: <Shield size={28} />, title: "Bank-grade security", desc: "AES-256 encryption at rest, TLS 1.2+ in transit, and multi-factor authentication protect every account." },
              { icon: <Zap size={28} />, title: "Instant transfers", desc: "Send and receive money in seconds, not days. Available around the clock, every day of the year." },
              { icon: <CheckCircle size={28} />, title: "Identity verified", desc: "Full KYC verification protects you and keeps the platform safe for everyone on it." },
            ].map((t) => (
              <div key={t.title} className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#4DC9EE] flex-shrink-0">
                  {t.icon}
                </div>
                <div>
                  <h4 className="font-bold mb-1 text-lg">{t.title}</h4>
                  <p className="text-blue-200 text-sm leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA BANNER ─── */}
      <section className="py-24 px-6 bg-[#4DC9EE]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
            Start in under 2 minutes
          </h2>
          <p className="text-blue-50 text-lg mb-10 max-w-xl mx-auto leading-relaxed">
            Join 500,000+ remote workers who use S-PAY to get paid globally and spend locally.
          </p>
          <Link href="/register">
            <button className="inline-flex items-center gap-2 bg-[#1A2B4A] text-white font-bold px-10 py-5 rounded-2xl hover:bg-[#0d1f38] transition-colors text-lg shadow-xl">
              Open Free Account →
            </button>
          </Link>
          <p className="text-blue-100 text-sm mt-6">No credit card · No monthly fee · Cancel anytime</p>
        </div>
      </section>
    </PublicLayout>
  );
}
