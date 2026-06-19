import { Link } from "wouter";
import { useGetSiteContent, getGetSiteContentQueryKey } from "@workspace/api-client-react";
import {
  Wallet, Landmark, CreditCard, Briefcase, ArrowRight,
  Globe, Shield, Zap, CheckCircle,
  ScanLine, ArrowUpFromLine, ArrowDownToLine, Send,
  Star, Quote, Building2, Handshake,
} from "lucide-react";
import { PublicLayout } from "@/components/public-layout";

// ─── Data ────────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  { icon: <ScanLine size={20} />, label: "Scan", color: "#4DC9EE" },
  { icon: <Send size={20} />, label: "Transfer", color: "#F59E0B" },
  { icon: <ArrowDownToLine size={20} />, label: "Deposit", color: "#22C55E" },
  { icon: <ArrowUpFromLine size={20} />, label: "Withdraw", color: "#2E8FD6" },
];

const STEPS = [
  { num: "01", title: "Create your account", desc: "Sign up in 2 minutes with just your email. No branch visit, no paperwork required." },
  { num: "02", title: "Get your account number", desc: "Receive a real US bank account and European account instantly after sign-up." },
  { num: "03", title: "Cash out instantly", desc: "Your money is held in US dollars. Withdraw to M-Pesa, MTN, PIX, Binance and 50+ destinations in seconds." },
];

const MARKETS = [
  { flag: "🇰🇪", country: "Kenya", method: "M-Pesa", color: "#22C55E" },
  { flag: "🇳🇬", country: "Nigeria", method: "Bank Transfer", color: "#22C55E" },
  { flag: "🇬🇭", country: "Ghana", method: "MTN MoMo", color: "#F59E0B" },
  { flag: "🇺🇬", country: "Uganda", method: "Mobile Money", color: "#4DC9EE" },
  { flag: "🇹🇿", country: "Tanzania", method: "M-Pesa", color: "#22C55E" },
  { flag: "🇷🇼", country: "Rwanda", method: "MoMo", color: "#4DC9EE" },
  { flag: "🇵🇭", country: "Philippines", method: "GCash", color: "#2E8FD6" },
  { flag: "🇧🇷", country: "Brazil", method: "PIX", color: "#4DC9EE" },
  { flag: "🇨🇴", country: "Colombia", method: "Nequi", color: "#F59E0B" },
  { flag: "🇮🇩", country: "Indonesia", method: "GoPay", color: "#22C55E" },
  { flag: "🇲🇽", country: "Mexico", method: "SPEI", color: "#4DC9EE" },
  { flag: "🇿🇦", country: "South Africa", method: "Bank Transfer", color: "#F59E0B" },
  { flag: "🇪🇺", country: "Europe", method: "SEPA", color: "#2E8FD6" },
  { flag: "🇺🇸", country: "USA", method: "ACH", color: "#1A2B4A" },
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
  { title: "Senior Frontend Engineer", company: "Andela", tag: "Engineering", color: "#4DC9EE", isNew: true },
  { title: "Product Designer", company: "Deel", tag: "Design", color: "#22C55E", isNew: false },
  { title: "Growth Marketing Lead", company: "Remote.com", tag: "Marketing", color: "#F59E0B", isNew: true },
  { title: "Customer Success Manager", company: "Oyster", tag: "Operations", color: "#2E8FD6", isNew: false },
];

const TESTIMONIALS = [
  {
    quote: "I get paid in USD from clients in 3 countries. S-PAY lets me withdraw to M-Pesa in under 3 minutes. I moved from PayPal and never looked back.",
    name: "James Odhiambo",
    role: "Full-Stack Developer",
    location: "Nairobi, Kenya",
    flag: "🇰🇪",
    initials: "JO",
    color: "#4DC9EE",
    earning: "Earns $4,200/mo remotely",
  },
  {
    quote: "Getting a real US bank account number changed everything. My US startup clients pay me like I'm local. Settlement to my Nigerian account is same-day.",
    name: "Amara Diallo",
    role: "Product Designer",
    location: "Lagos, Nigeria",
    flag: "🇳🇬",
    initials: "AD",
    color: "#22C55E",
    earning: "Earns $3,800/mo remotely",
  },
  {
    quote: "PIX cashout is instant. I found my current remote contract on the S-PAY jobs board and get paid straight to my wallet. It replaced three apps for me.",
    name: "Maria Ferreira",
    role: "Marketing Manager",
    location: "São Paulo, Brazil",
    flag: "🇧🇷",
    initials: "MF",
    color: "#F59E0B",
    earning: "Earns $2,900/mo remotely",
  },
  {
    quote: "MTN Mobile Money integration is seamless. I receive dollars from European clients and cash out the same day. Lowest fees I've found anywhere — period.",
    name: "David Kofi",
    role: "Data Analyst",
    location: "Accra, Ghana",
    flag: "🇬🇭",
    initials: "DK",
    color: "#2E8FD6",
    earning: "Earns $3,100/mo remotely",
  },
  {
    quote: "I found my current contract on the jobs board and get paid directly into my wallet. GCash withdrawal is instant. Perfect for freelancers in the Philippines.",
    name: "Priya Santos",
    role: "Virtual Assistant",
    location: "Manila, Philippines",
    flag: "🇵🇭",
    initials: "PS",
    color: "#8B5CF6",
    earning: "Earns $1,800/mo remotely",
  },
  {
    quote: "Getting paid internationally in Colombia was a nightmare. Now I have a real US ACH account and a European IBAN. Nequi cashout works in seconds.",
    name: "Carlos Mendez",
    role: "Freelance Developer",
    location: "Medellín, Colombia",
    flag: "🇨🇴",
    initials: "CM",
    color: "#EC4899",
    earning: "Earns $5,200/mo remotely",
  },
  {
    quote: "I was skeptical but the Mobile Money integration is real. I receive payments from Europe weekly without any issues. Best app for remote workers in Uganda.",
    name: "Aisha Nakato",
    role: "Graphic Designer",
    location: "Kampala, Uganda",
    flag: "🇺🇬",
    initials: "AN",
    color: "#22C55E",
    earning: "Earns $2,200/mo remotely",
  },
  {
    quote: "GoPay cashout works perfectly and the exchange rate beats every bank I've tried. The virtual card handles all my international subscriptions.",
    name: "Budi Santoso",
    role: "Content Creator",
    location: "Jakarta, Indonesia",
    flag: "🇮🇩",
    initials: "BS",
    color: "#4DC9EE",
    earning: "Earns $1,600/mo remotely",
  },
  {
    quote: "Found a full-time remote role on the S-PAY jobs board paying in USD. S-PAY handles all my international income. It's a complete solution.",
    name: "Tariq Abrahams",
    role: "UX Researcher",
    location: "Cape Town, South Africa",
    flag: "🇿🇦",
    initials: "TA",
    color: "#EF4444",
    earning: "Earns $4,500/mo remotely",
  },
];

const TRUST_BADGES = [
  { icon: <Shield size={20} />, label: "No monthly fee" },
  { icon: <Globe size={20} />, label: "180+ countries" },
  { icon: <Zap size={20} />, label: "Instant withdrawals" },
  { icon: <CheckCircle size={20} />, label: "Bank-grade security" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Landing() {
  const { data: site } = useGetSiteContent({ query: { queryKey: getGetSiteContentQueryKey(), staleTime: 60_000 } });
  return (
    <PublicLayout>

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section className="pt-16 relative overflow-hidden bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 12% 65%, rgba(77,201,238,0.22) 0%, transparent 45%), radial-gradient(circle at 88% 12%, rgba(168,222,255,0.12) 0%, transparent 45%)",
        }} />

        <div className="relative max-w-6xl mx-auto px-5 md:px-6 pt-12 md:pt-16 pb-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">

            {/* Left column */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-semibold px-4 py-1.5 rounded-full border border-white/20">
                  <Globe size={11} /> Built for remote workers worldwide
                </div>
                {/* Built on Celo — same declaration MiniPay makes */}
                <div className="inline-flex items-center gap-2 bg-white/10 text-white text-xs font-semibold px-4 py-1.5 rounded-full border border-white/20">
                  <span className="w-2 h-2 rounded-full bg-[#FCFF52]" /> Built on Celo
                </div>
              </div>
              <h1 className="text-[2.1rem] sm:text-4xl md:text-5xl lg:text-[3.4rem] font-black text-white leading-[1.08] mb-5">
                {site?.heroTitle ?? <>The money app that works <span className="text-[#4DC9EE]">where you work.</span></>}
              </h1>
              <p className="text-base md:text-xl text-blue-200 mb-8 leading-relaxed max-w-lg">
                {site?.heroSubtitle ?? "Virtual USD & EUR bank accounts, a digital wallet, and instant local cash-outs — one app for remote workers in 180+ countries."}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <Link href="/register">
                  <button style={site?.primaryColor ? { backgroundColor: site.primaryColor } : undefined} className="flex items-center justify-center gap-2 bg-[#4DC9EE] text-white font-bold px-7 py-3.5 rounded-2xl hover:opacity-90 transition-all text-sm md:text-base shadow-lg shadow-[#4DC9EE]/30 w-full sm:w-auto">
                    {site?.heroCta ?? "Open Free Account"} <ArrowRight size={16} />
                  </button>
                </Link>
                <a href="#how">
                  <button className="flex items-center justify-center gap-2 bg-white/10 text-white font-semibold px-7 py-3.5 rounded-2xl hover:bg-white/20 transition-all text-sm md:text-base border border-white/20 w-full sm:w-auto">
                    See How It Works
                  </button>
                </a>
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-white/10 pt-8 pb-10 md:pb-16">
                {STATS.map((s) => (
                  <div key={s.label}>
                    <div className="text-xl md:text-2xl font-black text-white">{s.value}</div>
                    <div className="text-xs text-blue-300 mt-1">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: floating balance card — desktop only */}
            <div className="hidden lg:flex justify-center pb-0">
              <div className="w-full max-w-[320px]">
                <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-7 shadow-2xl shadow-black/40">
                  <div className="flex justify-between items-start mb-6">
                    <div>
                      <p className="text-blue-300 text-xs mb-1">Total Balance</p>
                      <p className="text-white text-4xl font-black">$1,245.60</p>
                    </div>
                    <div className="bg-[#4DC9EE]/20 text-[#4DC9EE] text-[10px] font-bold px-2.5 py-1 rounded-full border border-[#4DC9EE]/30">
                      Digital USD
                    </div>
                  </div>
                  <div className="h-px bg-white/10 mb-6" />
                  <div className="grid grid-cols-4 gap-3">
                    {QUICK_ACTIONS.map((a) => (
                      <div key={a.label} className="flex flex-col items-center gap-2">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md" style={{ backgroundColor: a.color }}>
                          {a.icon}
                        </div>
                        <span className="text-[10px] text-blue-200 font-medium">{a.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t border-white/10">
                    <div className="flex justify-between text-xs mb-2">
                      <span className="text-blue-300">Recent activity</span>
                      <span className="text-[#4DC9EE] font-medium">View all</span>
                    </div>
                    {[
                      { label: "Received from Toptal", amount: "+$500.00", color: "#22C55E" },
                      { label: "M-Pesa withdrawal", amount: "-$120.00", color: "#F59E0B" },
                      { label: "SEPA from client", amount: "+$320.00", color: "#22C55E" },
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

      {/* ─── MARQUEE TICKER ───────────────────────────────────────────────── */}
      <section className="bg-white border-y border-gray-200 py-3 overflow-hidden">
        <style>{`
          @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
          .marquee-track { display: flex; width: max-content; animation: marquee 30s linear infinite; }
        `}</style>
        <div className="marquee-track">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1A2B4A] px-5 whitespace-nowrap">
              {item}<span className="text-gray-300 ml-4">·</span>
            </span>
          ))}
        </div>
      </section>

      {/* ─── TRUST STRIP ──────────────────────────────────────────────────── */}
      <section className="py-7 md:py-10 px-5 md:px-6 bg-white border-b border-gray-100">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {TRUST_BADGES.map((b) => (
              <div key={b.label} className="flex items-center gap-2.5 justify-center">
                <div className="w-8 h-8 rounded-xl bg-[#4DC9EE]/10 flex items-center justify-center text-[#4DC9EE] flex-shrink-0">
                  {b.icon}
                </div>
                <span className="text-xs md:text-sm font-semibold text-[#1A2B4A]">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <section id="how" className="py-16 md:py-24 px-5 md:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <p className="text-[#4DC9EE] font-semibold text-sm mb-2 uppercase tracking-widest">Getting started</p>
            <h2 className="text-2xl md:text-4xl font-black text-[#1A2B4A] mb-3">Up and running in 3 minutes</h2>
            <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto">No branch visits. No paperwork. No waiting.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {STEPS.map((s, i) => (
              <div key={s.num} className="relative">
                {i < STEPS.length - 1 && (
                  <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-[#4DC9EE] to-transparent z-0 -translate-x-4" />
                )}
                <div className="relative z-10 bg-gray-50 rounded-2xl p-7 border border-gray-100 h-full">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4DC9EE] to-[#2E8FD6] flex items-center justify-center text-white font-black text-xl mb-5 shadow-lg shadow-[#4DC9EE]/20">
                    {s.num}
                  </div>
                  <h3 className="font-bold text-[#1A2B4A] text-lg mb-2">{s.title}</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── WALLET SHOWCASE (id="wallet"; "features" anchors the nav link) ── */}
      <section id="features" className="scroll-mt-16" />
      <section id="wallet" className="py-16 md:py-24 px-5 md:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
            {/* Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#4DC9EE]/10 text-[#4DC9EE] text-xs font-bold px-3 py-1.5 rounded-full mb-5 border border-[#4DC9EE]/20">
                <Wallet size={13} /> Digital Dollar Wallet
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-[#1A2B4A] leading-tight mb-4">
                Your money, ready<br className="hidden md:block" /> anywhere.
              </h2>
              <p className="text-gray-500 leading-relaxed mb-7 text-base md:text-lg">
                Hold US dollars, send money anywhere in the world, and receive payments from employers and clients — all with near-zero fees.
              </p>
              <ul className="space-y-3.5 mb-8">
                {[
                  "Hold digital US dollars with no monthly fee",
                  "Send to anyone in 180+ countries instantly",
                  "Receive from Toptal, Upwork, Deel, Stripe payouts",
                  "Real-time balance and transaction tracking",
                  "Multi-currency support — USD, EUR, GBP and more",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <CheckCircle size={17} className="text-[#4DC9EE] flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <button className="flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#2E8FD6] transition-colors text-sm shadow-md shadow-[#4DC9EE]/20">
                  Open Free Wallet <ArrowRight size={15} />
                </button>
              </Link>
            </div>

            {/* Visual — balance card */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-[340px] bg-gradient-to-br from-[#1A2B4A] to-[#0d1f38] rounded-3xl p-7 shadow-2xl shadow-[#1A2B4A]/30 border border-white/5">
                <div className="flex items-start justify-between mb-6">
                  <div>
                    <p className="text-blue-300 text-xs mb-1.5">Available balance</p>
                    <p className="text-white text-3xl font-black">$1,245.60</p>
                    <p className="text-[#4DC9EE] text-xs font-medium mt-1">+$500.00 this week</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-[#4DC9EE]/20 flex items-center justify-center">
                    <Wallet size={18} className="text-[#4DC9EE]" />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mb-6">
                  {QUICK_ACTIONS.map((a) => (
                    <div key={a.label} className="flex flex-col items-center gap-1.5">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: a.color }}>
                        {a.icon}
                      </div>
                      <span className="text-[10px] text-blue-300">{a.label}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {[
                    { who: "Toptal Inc.", flag: "🇺🇸", amount: "+$500.00", type: "Received", color: "#22C55E" },
                    { who: "M-Pesa KE", flag: "🇰🇪", amount: "-$120.00", type: "Cash-out", color: "#F59E0B" },
                    { who: "SEPA Transfer", flag: "🇩🇪", amount: "+$320.00", type: "Received", color: "#22C55E" },
                  ].map((tx) => (
                    <div key={tx.who} className="flex items-center justify-between py-1.5 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{tx.flag}</span>
                        <div>
                          <p className="text-white text-xs font-medium">{tx.who}</p>
                          <p className="text-blue-400 text-[10px]">{tx.type}</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold" style={{ color: tx.color }}>{tx.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BANKING SHOWCASE (id="banking") ─────────────────────────────── */}
      <section id="banking" className="py-16 md:py-24 px-5 md:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">

            {/* Visual — bank account card (left on desktop, top on mobile) */}
            <div className="flex justify-center lg:justify-start order-2 lg:order-1">
              <div className="w-full max-w-[340px] space-y-4">
                {/* US Account card */}
                <div className="bg-gradient-to-br from-[#1A2B4A] to-[#2E8FD6] rounded-2xl p-6 shadow-xl shadow-[#1A2B4A]/20">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">US Checking Account</p>
                    <span className="text-white text-lg">🇺🇸</span>
                  </div>
                  <p className="text-white font-mono text-lg font-bold tracking-widest mb-1">●●●● 4821</p>
                  <p className="text-blue-200 text-xs">Routing: 021000021 · ACH / Wire</p>
                  <div className="mt-4 pt-4 border-t border-white/15 flex items-center gap-2">
                    <CheckCircle size={13} className="text-[#4DC9EE]" />
                    <span className="text-blue-200 text-xs">Issued instantly · No credit check</span>
                  </div>
                </div>
                {/* EU IBAN card */}
                <div className="bg-gradient-to-br from-[#0d1f38] to-[#1A2B4A] rounded-2xl p-6 shadow-xl shadow-[#0d1f38]/20">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">European IBAN</p>
                    <span className="text-white text-lg">🇪🇺</span>
                  </div>
                  <p className="text-white font-mono text-base font-bold tracking-wider mb-1">DE●● ●●●● ●●●● ●●89</p>
                  <p className="text-blue-200 text-xs">BIC: TRWIBEB1XXX · SEPA / Swift</p>
                  <div className="mt-4 pt-4 border-t border-white/15 flex items-center gap-2">
                    <CheckCircle size={13} className="text-[#4DC9EE]" />
                    <span className="text-blue-200 text-xs">Accept EUR payments from anywhere</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Text */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 bg-[#22C55E]/10 text-[#22C55E] text-xs font-bold px-3 py-1.5 rounded-full mb-5 border border-[#22C55E]/20">
                <Landmark size={13} /> Virtual Bank Account
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-[#1A2B4A] leading-tight mb-4">
                Get paid like a local,<br className="hidden md:block" /> anywhere.
              </h2>
              <p className="text-gray-500 leading-relaxed mb-7 text-base md:text-lg">
                Get a real US checking account number (ACH routing) and a European IBAN — issued instantly, no address verification, no waiting.
              </p>
              <ul className="space-y-3.5 mb-8">
                {[
                  "US account: ACH + wire routing number",
                  "European IBAN for SEPA & SWIFT transfers",
                  "Works with Stripe, Wise, Payoneer payouts",
                  "Employers pay you as a domestic employee",
                  "Receive from any country, any currency",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <CheckCircle size={17} className="text-[#22C55E] flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <button className="flex items-center gap-2 bg-[#1A2B4A] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#0d1f38] transition-colors text-sm shadow-md">
                  Get Your Account Number <ArrowRight size={15} />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── S-PAY FOR BUSINESS (id="business") ──────────────────────────── */}
      <section id="business" className="py-16 md:py-24 px-5 md:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
            {/* Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-[#1A2B4A]/5 text-[#1A2B4A] text-xs font-bold px-3 py-1.5 rounded-full mb-5 border border-[#1A2B4A]/10">
                <Building2 size={13} /> S-PAY for Business
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-[#1A2B4A] leading-tight mb-4">
                Built for companies<br className="hidden md:block" /> and partnerships too.
              </h2>
              <p className="text-gray-500 leading-relaxed mb-7 text-base md:text-lg">
                Open a business account, verify your company and its representative with automated KYB,
                and get virtual US &amp; EU bank accounts in your business name.
              </p>
              <ul className="space-y-3.5 mb-8">
                {[
                  "Business verification (KYB) — company + representative, fully automated via Noah",
                  "Business virtual accounts: US ACH + EU IBAN in your company's name",
                  "Hold and pay in digital US dollars — same instant rails as personal accounts",
                  "Pay contractors and teams in 180+ countries, cash-outs to 50+ local methods",
                  "Post roles to 500K+ remote workers on the S-PAY jobs board",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-700">
                    <CheckCircle size={17} className="text-[#1A2B4A] flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/register?type=business">
                  <button className="flex items-center justify-center gap-2 bg-[#1A2B4A] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#0d1f38] transition-colors text-sm shadow-md w-full sm:w-auto">
                    Open a Business Account <ArrowRight size={15} />
                  </button>
                </Link>
                <a href="mailto:partnerships@spayewallet.com">
                  <button className="flex items-center justify-center gap-2 bg-white text-[#1A2B4A] font-semibold px-6 py-3 rounded-xl border border-gray-200 hover:border-[#1A2B4A]/30 transition-colors text-sm w-full sm:w-auto">
                    <Handshake size={15} /> Partner with us
                  </button>
                </a>
              </div>
            </div>

            {/* Visual — business account card */}
            <div className="flex justify-center lg:justify-end">
              <div className="w-full max-w-[340px] space-y-4">
                <div className="bg-gradient-to-br from-[#1A2B4A] to-[#0d1f38] rounded-2xl p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-5">
                    <p className="text-blue-200 text-xs font-medium uppercase tracking-wide">Business Account</p>
                    <span className="text-[10px] font-bold bg-[#4DC9EE]/20 text-[#4DC9EE] px-2 py-0.5 rounded-full border border-[#4DC9EE]/30">KYB VERIFIED</span>
                  </div>
                  <p className="text-white font-bold text-lg mb-1">Acme Technologies Ltd</p>
                  <p className="text-blue-200 text-xs mb-4">US ACH ●●●● 7310 · EU IBAN DE●● ●●12</p>
                  <div className="flex items-center justify-between pt-4 border-t border-white/15">
                    <div>
                      <p className="text-blue-300 text-[10px] uppercase">Balance</p>
                      <p className="text-white font-black text-xl">$48,250.00</p>
                    </div>
                    <div className="text-right">
                      <p className="text-blue-300 text-[10px] uppercase">Currency</p>
                      <p className="text-white text-sm font-semibold">USD</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-md border border-gray-100">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">Latest payroll</p>
                  {[
                    { who: "James O. — Nairobi", amount: "$1,200", flag: "🇰🇪" },
                    { who: "Maria F. — São Paulo", amount: "$950", flag: "🇧🇷" },
                    { who: "Priya S. — Manila", amount: "$800", flag: "🇵🇭" },
                  ].map((row) => (
                    <div key={row.who} className="flex items-center justify-between py-2 border-t border-gray-50 first:border-0">
                      <span className="text-xs text-gray-600 flex items-center gap-2"><span>{row.flag}</span>{row.who}</span>
                      <span className="text-xs font-bold text-[#1A2B4A]">{row.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CARD SHOWCASE (id="card") ────────────────────────────────────── */}
      <section id="card" className="py-16 md:py-24 px-5 md:px-6 bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: "radial-gradient(circle at 75% 30%, rgba(77,201,238,0.15) 0%, transparent 50%)",
        }} />
        <div className="relative max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Text */}
            <div>
              <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-bold px-3 py-1.5 rounded-full mb-5 border border-white/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4DC9EE] animate-pulse" />
                Coming soon — Join the waitlist
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-white leading-tight mb-4">
                The S-PAY virtual card.<br className="hidden md:block" />
                <span className="text-[#4DC9EE]">Spend anywhere.</span>
              </h2>
              <p className="text-blue-200 leading-relaxed mb-7 text-base md:text-lg">
                A virtual Visa card linked directly to your S-PAY wallet balance. Pay for subscriptions, shop online, and manage expenses — globally.
              </p>
              <ul className="space-y-3.5 mb-8">
                {[
                  "Virtual card — use instantly on sign-up",
                  "Physical card delivered to your door",
                  "Works anywhere Visa is accepted worldwide",
                  "Real-time spend notifications",
                  "No foreign transaction fees",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-blue-100">
                    <CheckCircle size={17} className="text-[#4DC9EE] flex-shrink-0 mt-0.5" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <button className="flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#2E8FD6] transition-colors text-sm shadow-md shadow-[#4DC9EE]/20">
                  Join the Waitlist <ArrowRight size={15} />
                </button>
              </Link>
            </div>

            {/* Card visual */}
            <div className="flex justify-center">
              <div className="relative w-full max-w-[340px]">
                {/* Shadow card */}
                <div className="absolute top-4 left-4 w-full h-48 bg-[#4DC9EE]/20 rounded-3xl blur-sm" />
                {/* Main card */}
                <div className="relative bg-gradient-to-br from-[#4DC9EE] to-[#2E8FD6] rounded-3xl p-7 shadow-2xl">
                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <p className="text-white/70 text-xs font-medium uppercase tracking-widest mb-1">S-PAY</p>
                      <p className="text-white text-xs">Virtual Card</p>
                    </div>
                    <CreditCard size={28} className="text-white/60" />
                  </div>
                  <p className="text-white font-mono text-lg font-bold tracking-[0.25em] mb-6">
                    4532 •••• •••• 8941
                  </p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-white/60 text-[10px] uppercase tracking-wide mb-0.5">Card Holder</p>
                      <p className="text-white text-sm font-semibold">JAMES ODHIAMBO</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60 text-[10px] uppercase tracking-wide mb-0.5">Expires</p>
                      <p className="text-white text-sm font-semibold">09/28</p>
                    </div>
                  </div>
                </div>
                {/* Card shine */}
                <div className="absolute top-0 left-0 w-full h-full rounded-3xl pointer-events-none"
                  style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 50%)" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ────────────────────────────────────────────────── */}
      <section className="py-16 md:py-24 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 md:px-6">
          <div className="text-center mb-12 md:mb-16">
            <p className="text-[#4DC9EE] font-semibold text-sm mb-2 uppercase tracking-widest">Real people. Real freedom.</p>
            <h2 className="text-2xl md:text-4xl font-black text-[#1A2B4A] mb-3">
              Loved by remote workers<br className="hidden md:block" /> in every corner of the world
            </h2>
            <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto">
              From Nairobi to Manila, Cape Town to Medellín — S-PAY works where you work.
            </p>
          </div>
        </div>

        {/* Desktop: 3-col grid | Mobile: horizontal scroll */}
        <div className="max-w-6xl mx-auto">
          {/* Mobile scroll container */}
          <div className="md:hidden flex gap-4 overflow-x-auto px-5 pb-4 snap-x snap-mandatory scrollbar-hide"
            style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="snap-start flex-shrink-0 w-[82vw] max-w-[320px]">
                <TestimonialCard t={t} />
              </div>
            ))}
          </div>

          {/* Desktop grid */}
          <div className="hidden md:grid md:grid-cols-3 gap-5 px-6">
            {TESTIMONIALS.map((t) => (
              <TestimonialCard key={t.name} t={t} />
            ))}
          </div>
        </div>
      </section>

      {/* ─── JOBS SECTION ─────────────────────────────────────────────────── */}
      <section id="jobs" className="py-16 md:py-24 px-5 md:px-6 bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 bg-[#4DC9EE]/20 text-[#4DC9EE] text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-[#4DC9EE]/30">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4DC9EE] animate-pulse" />
                Live · 3,000+ remote jobs from 60+ sources
              </div>
              <h2 className="text-2xl md:text-4xl font-black text-white mb-4 leading-tight">
                Find your next remote job — free
              </h2>
              <p className="text-blue-200 leading-relaxed mb-8 text-base md:text-lg">
                3,000–5,000 fully remote roles available every day — engineering, design, marketing, finance and more. Sourced from 60+ global platforms. Free for all S-PAY members.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "3,000–5,000 live remote-only listings daily",
                  "Search by keyword or category",
                  "Apply directly on the company site",
                  "Feed refreshed every hour, around the clock",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-blue-100">
                    <CheckCircle size={15} className="text-[#4DC9EE] flex-shrink-0" />{item}
                  </li>
                ))}
              </ul>
              <Link href="/register">
                <button className="flex items-center gap-2 bg-[#F59E0B] text-white font-bold px-7 py-3.5 rounded-2xl hover:bg-[#d97706] transition-colors text-sm shadow-lg">
                  Browse Jobs <ArrowRight size={16} />
                </button>
              </Link>
            </div>
            <div className="space-y-3">
              {MOCK_JOBS.map((job) => (
                <div key={job.title} className="bg-white/10 backdrop-blur-sm border border-white/10 rounded-2xl p-4 flex items-center gap-4 hover:bg-white/15 transition-colors">
                  <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-black text-sm" style={{ backgroundColor: job.color }}>
                    {job.title[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white text-sm font-semibold truncate">{job.title}</p>
                      {job.isNew && (
                        <span className="text-[10px] bg-[#4DC9EE]/30 text-[#4DC9EE] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0">New</span>
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

      {/* ─── MARKETS ──────────────────────────────────────────────────────── */}
      <section id="markets" className="py-16 md:py-24 px-5 md:px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 md:mb-16">
            <p className="text-[#4DC9EE] font-semibold text-sm mb-2 uppercase tracking-widest">Cash out</p>
            <h2 className="text-2xl md:text-4xl font-black text-[#1A2B4A] mb-3">Cash out where you live</h2>
            <p className="text-gray-500 text-base md:text-lg max-w-xl mx-auto">Live exchange rates · Same-day delivery · 50+ payout methods</p>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-2 md:gap-3">
            {MARKETS.map((m) => (
              <div key={m.country} className="bg-white rounded-xl md:rounded-2xl p-3 md:p-4 text-center shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all">
                <div className="text-2xl md:text-3xl mb-2">{m.flag}</div>
                <div className="font-semibold text-[#1A2B4A] text-[10px] md:text-xs leading-tight">{m.country}</div>
                <div className="text-[9px] md:text-[10px] font-bold mt-1.5 px-1.5 py-0.5 rounded-full inline-block text-white" style={{ backgroundColor: m.color }}>
                  {m.method}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── SECURITY STRIP ───────────────────────────────────────────────── */}
      <section className="py-14 md:py-20 px-5 md:px-6 bg-gradient-to-r from-[#1A2B4A] to-[#0d1f38]">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-white">
            {[
              { icon: <Shield size={26} />, title: "Bank-grade security", desc: "AES-256 encryption at rest, TLS 1.2+ in transit, and multi-factor authentication protect every account." },
              { icon: <Zap size={26} />, title: "Instant transfers, 24/7", desc: "Send and receive money in seconds, not days — available around the clock, every day of the year." },
              { icon: <CheckCircle size={26} />, title: "KYC verified", desc: "Full identity verification protects you and keeps the platform safe for every member on it." },
            ].map((t) => (
              <div key={t.title} className="flex items-start gap-5">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-[#4DC9EE] flex-shrink-0">
                  {t.icon}
                </div>
                <div>
                  <h4 className="font-bold mb-2 text-lg">{t.title}</h4>
                  <p className="text-blue-200 text-sm leading-relaxed">{t.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 px-5 md:px-6 bg-[#4DC9EE]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-white mb-5 leading-tight">
            Start in under 2 minutes.
            <br />
            <span className="text-blue-50">It's free, forever.</span>
          </h2>
          <p className="text-blue-50 text-base md:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Join 500,000+ remote workers who use S-PAY to get paid globally and spend locally — in 180+ countries.
          </p>
          <Link href="/register">
            <button className="inline-flex items-center gap-2 bg-[#1A2B4A] text-white font-bold px-8 py-4 md:px-12 md:py-5 rounded-2xl hover:bg-[#0d1f38] transition-colors text-base md:text-lg shadow-xl w-full sm:w-auto justify-center">
              Open Free Account <ArrowRight size={18} />
            </button>
          </Link>
          <p className="text-blue-100 text-sm mt-5">No credit card · No monthly fee · Cancel anytime</p>
        </div>
      </section>

    </PublicLayout>
  );
}

// ─── Testimonial Card subcomponent ───────────────────────────────────────────
function TestimonialCard({ t }: { t: typeof TESTIMONIALS[number] }) {
  return (
    <div className="bg-white rounded-2xl md:rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 flex flex-col h-full">
      {/* Stars */}
      <div className="flex gap-1 mb-4">
        {[...Array(5)].map((_, i) => (
          <Star key={i} size={13} className="text-[#F59E0B] fill-[#F59E0B]" />
        ))}
      </div>

      {/* Quote icon */}
      <Quote size={20} className="text-gray-200 mb-2" />

      {/* Quote text */}
      <p className="text-gray-700 text-sm leading-relaxed mb-5 flex-1">"{t.quote}"</p>

      {/* Earnings badge */}
      <div className="inline-flex items-center gap-1.5 bg-gray-50 text-gray-500 text-[10px] font-semibold px-2.5 py-1 rounded-full mb-4 border border-gray-100 self-start">
        <Briefcase size={9} />
        {t.earning}
      </div>

      {/* Person */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 shadow-sm" style={{ backgroundColor: t.color }}>
          {t.initials}
        </div>
        <div>
          <p className="font-bold text-[#1A2B4A] text-sm">{t.name}</p>
          <p className="text-gray-400 text-xs">{t.role}</p>
        </div>
        <div className="ml-auto flex items-center gap-1 bg-gray-50 border border-gray-100 rounded-full px-2.5 py-1">
          <span className="text-sm">{t.flag}</span>
          <span className="text-[10px] text-gray-500 font-medium hidden sm:inline">
            {t.location.split(",")[1]?.trim() ?? t.location}
          </span>
        </div>
      </div>
    </div>
  );
}
