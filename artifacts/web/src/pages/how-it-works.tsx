import { Link } from "wouter";
import { PublicLayout } from "@/components/public-layout";
import { Layout } from "@/components/layout";
import { getToken } from "@/lib/auth";
import {
  UserPlus, QrCode, ArrowRightLeft, Banknote, Landmark, ShieldCheck,
  CreditCard, Briefcase, ScanLine, Wallet2, MailCheck, ChevronRight,
} from "lucide-react";

const STEPS = [
  {
    icon: <UserPlus size={22} />,
    title: "1 · Create your free account",
    body: "Sign up in under 2 minutes with your email (or one tap with Google). We send a confirmation link to your inbox — click it to secure your account. No fees, no minimum balance, works in 50+ countries.",
  },
  {
    icon: <QrCode size={22} />,
    title: "2 · Get paid — your QR code & wallet address",
    body: "Tap “Recharge” on your dashboard: S-PAY instantly creates your personal Celo wallet (no seed phrase, ever) and shows your QR code + address. Share either one — clients, friends, or your own exchange account (Binance, Bybit, Coinbase) can send you USDC/USDT on the Celo network and it lands in seconds.",
  },
  {
    icon: <ScanLine size={22} />,
    title: "3 · Pay anyone with Scan or Transfer",
    body: "Tap “Scan” to point your camera at someone's S-PAY QR code, or “Transfer” to send by phone number (free between S-PAY members) or to any Celo wallet address. Transfers settle on-chain in about 5 seconds.",
  },
  {
    icon: <ShieldCheck size={22} />,
    title: "4 · Verify your identity (KYC)",
    body: "When you're ready for more, verify with a government ID and selfie. Verification is automated — no waiting queues — and unlocks your virtual bank accounts and local cash-outs.",
  },
  {
    icon: <Landmark size={22} />,
    title: "5 · Receive bank transfers like a local",
    body: "After verification you get a real US bank account (ACH routing + account number) and a European IBAN. Give them to your employer or clients — incoming wires are auto-converted to USDC and credited to your wallet.",
  },
  {
    icon: <Banknote size={22} />,
    title: "6 · Cash out where you live",
    body: "Withdraw to M-Pesa, MTN Mobile Money, PIX, SEPA, or bank transfer in 180+ countries — most arrive in under a minute. Or send straight to a crypto exchange with the guided withdrawal flow.",
  },
  {
    icon: <CreditCard size={22} />,
    title: "7 · Spend with the virtual card",
    body: "Create a virtual Visa-network card for online purchases and subscriptions, funded by your wallet balance. Available to verified users as the program rolls out.",
  },
  {
    icon: <Briefcase size={22} />,
    title: "Bonus · Find remote work, free forever",
    body: "The jobs board lists 3,000–5,000 remote-only roles daily from 60+ sources, refreshed hourly. Find work, get paid into S-PAY, cash out locally — the whole loop in one app.",
  },
];

const FAQS = [
  {
    q: "Where does my money actually live?",
    a: "Your balance is USDC/USDT (digital dollars) held in your own wallet on the Celo network — visible on-chain at all times. S-PAY never holds your private keys; they're secured in hardware by our wallet infrastructure partners.",
  },
  {
    q: "What does it cost?",
    a: "Signing up, receiving money, and S-PAY-to-S-PAY transfers are free. Withdrawals carry a small fee (about 1%, shown before you confirm). No monthly fees.",
  },
  {
    q: "Why do I see a 'confirm your email' banner?",
    a: "We email a confirmation link at sign-up to secure your account. Click it and the banner disappears — you can use the app in the meantime.",
  },
  {
    q: "Is the Celo network safe?",
    a: "Celo is a public Ethereum-family blockchain used by apps like Opera MiniPay, with ~5-second finality and sub-cent fees. Every transaction has a public receipt on celoscan.io.",
  },
];

export default function HowItWorks() {
  // Signed-in users stay INSIDE the app (app shell + back button);
  // visitors get the marketing shell. Same content, no context switch.
  const authed = Boolean(getToken());
  if (authed) {
    return (
      <Layout back title="How it works">
        <Content authed />
      </Layout>
    );
  }
  return (
    <PublicLayout>
      <Content />
    </PublicLayout>
  );
}

function Content({ authed = false }: { authed?: boolean }) {
  return (
    <>
      <div className="max-w-3xl mx-auto px-4 py-12 md:py-16">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-[#4DC9EE]/10 text-[#2E8FD6] text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full mb-4">
            <Wallet2 size={14} /> How S-PAY works
          </div>
          <h1 className="text-3xl md:text-4xl font-black text-[#1A2B4A] tracking-tight mb-3">
            From sign-up to cash-out, explained
          </h1>
          <p className="text-gray-500 max-w-xl mx-auto">
            S-PAY is a digital dollar wallet for remote workers: get paid globally, hold USD, and cash out locally — no bank gatekeepers.
          </p>
        </div>

        <div className="space-y-4 mb-16">
          {STEPS.map((s) => (
            <div key={s.title} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex gap-4">
              <div className="w-11 h-11 rounded-xl bg-[#4DC9EE]/10 text-[#2E8FD6] flex items-center justify-center flex-shrink-0">
                {s.icon}
              </div>
              <div>
                <h3 className="font-bold text-[#1A2B4A] mb-1">{s.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>

        <h2 className="text-xl font-black text-[#1A2B4A] mb-4 flex items-center gap-2">
          <MailCheck size={20} className="text-[#4DC9EE]" /> Common questions
        </h2>
        <div className="space-y-3 mb-12">
          {FAQS.map((f) => (
            <div key={f.q} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-[#1A2B4A] text-sm mb-1.5">{f.q}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        <div className="bg-gradient-to-br from-[#4DC9EE] to-[#2E8FD6] rounded-3xl p-8 text-center text-white">
          <h2 className="text-2xl font-black mb-2">Ready in 2 minutes</h2>
          <p className="text-white/85 text-sm mb-6">Free account · free Celo wallet · 3,000+ remote jobs daily</p>
          <Link
            href={authed ? "/deposit" : "/register?source=how-it-works"}
            className="inline-flex items-center gap-1.5 bg-white text-[#1A2B4A] font-bold px-7 py-3 rounded-2xl hover:scale-[1.02] transition-transform"
          >
            {authed ? "Add money to my wallet" : "Create my free account"} <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </>
  );
}
