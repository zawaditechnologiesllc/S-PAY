import { Link } from "wouter";
import {
  Globe, ArrowRight, Landmark, Wallet, CreditCard, Briefcase,
  Shield, Zap, Users, DollarSign, Clock, HeartHandshake,
} from "lucide-react";
import { PublicLayout } from "@/components/public-layout";

const MARKETS = [
  { flag: "🇰🇪", country: "Kenya", method: "M-Pesa", color: "#22C55E" },
  { flag: "🇳🇬", country: "Nigeria", method: "Bank Transfer", color: "#4DC9EE" },
  { flag: "🇬🇭", country: "Ghana", method: "Mobile Money", color: "#F59E0B" },
  { flag: "🇺🇬", country: "Uganda", method: "MTN MoMo", color: "#F59E0B" },
  { flag: "🇹🇿", country: "Tanzania", method: "M-Pesa", color: "#22C55E" },
  { flag: "🇷🇼", country: "Rwanda", method: "Mobile Money", color: "#4DC9EE" },
  { flag: "🇿🇦", country: "South Africa", method: "Bank Transfer", color: "#2E8FD6" },
  { flag: "🇵🇭", country: "Philippines", method: "GCash", color: "#F59E0B" },
  { flag: "🇧🇷", country: "Brazil", method: "PIX", color: "#4DC9EE" },
  { flag: "🇮🇩", country: "Indonesia", method: "Bank Transfer", color: "#22C55E" },
  { flag: "🇨🇴", country: "Colombia", method: "Bank Transfer", color: "#F59E0B" },
  { flag: "🇲🇽", country: "Mexico", method: "SPEI", color: "#22C55E" },
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

const PRODUCTS = [
  {
    icon: <Wallet size={22} />,
    color: "#4DC9EE",
    title: "Digital Dollar Wallet",
    desc: "Hold and send USD globally with near-zero fees.",
  },
  {
    icon: <Landmark size={22} />,
    color: "#22C55E",
    title: "Virtual Bank Account",
    desc: "Real US ACH routing number and EU IBAN, issued instantly.",
  },
  {
    icon: <CreditCard size={22} />,
    color: "#1A2B4A",
    title: "S-PAY Card",
    desc: "Virtual card for online payments. Coming soon.",
    badge: "Coming soon",
  },
  {
    icon: <Briefcase size={22} />,
    color: "#F59E0B",
    title: "Remote Jobs Board",
    desc: "Thousands of remote-only roles, free for all members.",
  },
];

const TIMELINE = [
  {
    year: "2016",
    title: "The Breaking Point",
    desc: "PayPal begins systematically blocking and freezing accounts belonging to remote workers in Africa and Southeast Asia — legitimate freelancers earning real income. A team of full-stack fintech and crypto engineers decides to build the alternative.",
  },
  {
    year: "2018",
    title: "Early Prototypes",
    desc: "The team builds early cross-border payment prototypes, testing mobile money rails in Kenya and Nigeria and exploring crypto-based settlement to make transfers borderless and uncensorable.",
  },
  {
    year: "2021",
    title: "Architecture Refined",
    desc: "After deep research across 40+ countries, the team converges on a hybrid model: established local rails (M-Pesa, MTN, ACH, SEPA) combined with a modern payments infrastructure that doesn't rely on any single gatekeeper.",
  },
  {
    year: "2024",
    title: "S-PAY Launches",
    desc: "Zawadi Technologies LLC is formally incorporated in the United States. S-PAY launches publicly with virtual USD/EUR bank accounts, instant mobile money withdrawals, and a remote jobs board — everything PayPal never gave you.",
  },
  {
    year: "2025",
    title: "500K+ Users · 180+ Countries",
    desc: "S-PAY reaches half a million registered users. Virtual US ACH and EU IBAN accounts go live. The S-PAY Card enters closed beta.",
  },
  {
    year: "2026",
    title: "Built on Celo · Business Accounts",
    desc: "Instant Celo wallets with USDC/USDT for everyone, and S-PAY for Business launches: KYB-verified companies get business virtual accounts and pay teams worldwide. The mission continues.",
  },
];

export default function About() {
  return (
    <PublicLayout active="about">
      {/* ─── HERO ─── */}
      <section className="pt-16 pb-16 md:pb-24 relative overflow-hidden bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 15% 60%, #4DC9EE 0%, transparent 50%), radial-gradient(circle at 85% 15%, #A8DEFF 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-4xl mx-auto px-5 md:px-6 pt-14 md:pt-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-semibold px-4 py-1.5 rounded-full mb-6 md:mb-8 border border-white/20">
            <Globe size={12} /> Our story
          </div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white leading-tight mb-5 md:mb-6">
            We believe everyone deserves{" "}
            <span className="text-[#4DC9EE]">access to global financial tools.</span>
          </h1>
          <p className="text-base md:text-xl text-blue-200 max-w-2xl mx-auto leading-relaxed">
            S-PAY was built for the billions of talented people who earn income across borders but are locked out of the financial infrastructure that makes it simple.
          </p>
        </div>
      </section>

      {/* ─── MISSION ─── */}
      <section className="py-12 md:py-24 px-5 md:px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div>
              <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">Our Mission</span>
              <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-[#1A2B4A] mt-3 mb-5 md:mb-6 leading-tight">
                Eliminate the gap between where remote workers live and where they get paid.
              </h2>
              <p className="text-gray-500 text-lg leading-relaxed mb-5">
                The global remote work economy has created incredible opportunity — but the financial plumbing hasn't kept up. A developer in Nairobi, a designer in Lagos, or a marketer in Manila should be able to get paid just as easily as someone sitting in San Francisco.
              </p>
              <p className="text-gray-500 text-lg leading-relaxed mb-5">
                Every year, cross-border workers lose billions of dollars to fees and delays. The average remittance cost globally is still above 6%. Wire transfers can take 3–5 business days. Many workers are locked out entirely because they don't have a US or European bank account.
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

      {/* ─── OUR STORY / TIMELINE ─── */}
      <section className="py-12 md:py-20 px-5 md:px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 md:mb-14">
            <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">Our Story</span>
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-black text-[#1A2B4A] mt-3 mb-4">How S-PAY came to be.</h2>
            <p className="text-gray-500 text-lg max-w-2xl mx-auto leading-relaxed">
              S-PAY was born in 2016 — built by a team of full-stack fintech and crypto engineers who were tired of watching PayPal block legitimate remote workers and watching talented people lose 5–10% of every payment to fees. We built the alternative.
            </p>
          </div>
          <div className="relative">
            <div className="absolute left-5 md:left-8 top-0 bottom-0 w-px bg-gradient-to-b from-[#4DC9EE] via-[#4DC9EE]/50 to-transparent" />
            <div className="space-y-6 md:space-y-10">
              {TIMELINE.map((t, i) => (
                <div key={i} className="flex gap-4 md:gap-8 relative">
                  <div className="flex-shrink-0 w-10 md:w-16 flex flex-col items-center">
                    <div className="w-4 h-4 rounded-full bg-[#4DC9EE] border-2 border-white shadow-md mt-1.5 relative z-10" />
                  </div>
                  <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex-1 -mt-1">
                    <span className="text-[#4DC9EE] text-xs font-bold uppercase tracking-widest">{t.year}</span>
                    <h4 className="font-bold text-[#1A2B4A] text-lg mt-1 mb-2">{t.title}</h4>
                    <p className="text-gray-500 text-sm leading-relaxed">{t.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHAT WE BUILD ─── */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">What We Build</span>
            <h2 className="text-3xl font-black text-[#1A2B4A] mt-3 mb-3">The S-PAY platform</h2>
            <p className="text-gray-500 max-w-xl mx-auto">One super app covering everything a remote worker needs financially.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {PRODUCTS.map((p) => (
              <div key={p.title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100 relative overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all">
                {p.badge && (
                  <span className="absolute top-4 right-4 text-[9px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide">
                    {p.badge}
                  </span>
                )}
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform shadow-sm"
                  style={{ backgroundColor: p.color }}
                >
                  {p.icon}
                </div>
                <h4 className="font-bold text-[#1A2B4A] mb-2">{p.title}</h4>
                <p className="text-gray-500 text-sm leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── STATS ─── */}
      <section className="py-16 px-6 bg-gradient-to-r from-[#1A2B4A] to-[#0d1f38]">
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

      {/* ─── GLOBAL COVERAGE ─── */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
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
                className="bg-white rounded-2xl p-4 text-center border border-gray-100 hover:shadow-md hover:-translate-y-1 transition-all duration-200"
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

      {/* ─── TEAM ─── */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <span className="text-[#4DC9EE] font-bold text-sm uppercase tracking-widest">Our Team</span>
          <h2 className="text-4xl font-black text-[#1A2B4A] mt-3 mb-6">A remote-first team.</h2>
          <p className="text-gray-500 text-lg leading-relaxed mb-6 max-w-2xl mx-auto">
            We are a distributed team of engineers, product designers, compliance specialists, and operations professionals spread across three continents. We work remotely by default — because we are building for remote workers, and we live the same reality.
          </p>
          <p className="text-gray-500 text-lg leading-relaxed mb-10 max-w-2xl mx-auto">
            The team brings deep expertise in fintech, mobile money networks, cross-border payment rails, and regulatory compliance across Africa, Southeast Asia, and Latin America. We have spent our careers inside banks, mobile operators, and payments startups — and we built S-PAY because we knew it could be done better.
          </p>
          <div className="inline-flex items-center gap-3 bg-[#4DC9EE]/10 text-[#1A2B4A] rounded-2xl px-6 py-4 border border-[#4DC9EE]/20">
            <Globe size={20} className="text-[#4DC9EE]" />
            <span className="font-semibold text-sm">
              Headquartered in the United States · Team members across 3 continents
            </span>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-20 px-6 bg-[#4DC9EE]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl font-black text-white mb-6">Join us on the mission.</h2>
          <p className="text-blue-100 text-lg mb-10 leading-relaxed">
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
    </PublicLayout>
  );
}
