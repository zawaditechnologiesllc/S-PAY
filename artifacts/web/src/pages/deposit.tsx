import { useEffect, useState } from "react";
import { Link } from "wouter";
import { brandedQRDataUrl } from "@/lib/branded-qr";
import { Layout } from "@/components/layout";
import { useAddFunds, useGetMe, getGetMeQueryKey, useInitiateDeposit } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone, Landmark, Coins, ChevronRight, ArrowLeft, Copy, Download,
  Share2, ShieldCheck, CheckCircle2,
} from "lucide-react";
import { NetworkIcon } from "@/components/network-icon";

/**
 * Deposit ("Add money") — MiniPay-style: three methods, each opening to its
 * specific options. Crypto works today (QR + address, JIT wallet); Mobile
 * Money and Bank transfer unlock with verification + the payout partner.
 */

type Method = null | "momo" | "bank" | "crypto";

const MOMO_OPTIONS = [
  { flag: "🇰🇪", name: "M-Pesa", region: "Kenya · Tanzania", method: "mpesa" },
  { flag: "🇺🇬", name: "MTN Mobile Money", region: "Uganda · Ghana · Cameroon", method: "mtn_momo" },
  { flag: "🇳🇬", name: "Airtel Money / Bank USSD", region: "Nigeria", method: "airtel" },
  { flag: "🇵🇭", name: "GCash", region: "Philippines", method: "gcash" },
  { flag: "🇧🇷", name: "PIX", region: "Brazil", method: "pix" },
] as const;

export default function Deposit() {
  const initial = (new URLSearchParams(window.location.search).get("m") as Method) ?? null;
  const [method, setMethod] = useState<Method>(
    initial === "momo" || initial === "bank" || initial === "crypto" ? initial : null,
  );

  return (
    <Layout back title="Deposit">
      <div className="max-w-xl mx-auto space-y-4 mt-2">
        {method === null && <MethodList onPick={setMethod} />}
        {method === "momo" && <MomoPanel onBack={() => setMethod(null)} />}
        {method === "bank" && <BankPanel onBack={() => setMethod(null)} />}
        {method === "crypto" && <CryptoPanel onBack={() => setMethod(null)} />}
      </div>
    </Layout>
  );
}

function MethodList({ onPick }: { onPick: (m: Method) => void }) {
  return (
    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardContent className="p-2">
        <MethodRow
          icon={<Smartphone size={22} />} color="#22C55E"
          title="Mobile money"
          subtitle="M-Pesa, MTN MoMo, Airtel, GCash, PIX…"
          onClick={() => onPick("momo")}
        />
        <MethodRow
          icon={<Landmark size={22} />} color="#2E8FD6"
          title="Bank transfer"
          subtitle="Your US account & EU IBAN — get paid like a local"
          onClick={() => onPick("bank")}
        />
        <MethodRow
          icon={<Coins size={22} />} color="#F59E0B"
          title="Exchange or wallet"
          subtitle="From Binance, Bybit, Coinbase or any Celo wallet — instant"
          onClick={() => onPick("crypto")}
        />
      </CardContent>
    </Card>
  );
}

function MethodRow({ icon, color, title, subtitle, badge, onClick }: {
  icon: React.ReactNode; color: string; title: string; subtitle: string; badge?: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          {title}
          {badge && <span className="text-[10px] font-bold uppercase bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{badge}</span>}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
    </button>
  );
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 flex items-center justify-center text-gray-600 dark:text-gray-400 transition-colors" aria-label="Back to methods">
        <ArrowLeft size={17} />
      </button>
      <h2 className="font-bold text-gray-900 dark:text-gray-100">{title}</h2>
    </div>
  );
}

// ─── Mobile money ─────────────────────────────────────────────────────────────

function MomoPanel({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const deposit = useInitiateDeposit();
  const [picked, setPicked] = useState<typeof MOMO_OPTIONS[number] | null>(null);
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!picked || !Number.isFinite(value) || value <= 0 || !phone.trim()) {
      toast({ title: "Check the details", description: "Enter the amount and your mobile money number.", variant: "destructive" });
      return;
    }
    deposit.mutate(
      { data: { amount: value, method: picked.method, phoneNumber: phone.trim() } },
      {
        onSuccess: (r) => toast({ title: "Top-up started", description: (r as { message?: string })?.message ?? "Follow the prompt on your phone." }),
        onError: (err) => toast({
          title: picked.name,
          description: (err as { data?: { message?: string } })?.data?.message ?? "Could not start the top-up — try again.",
        }),
      },
    );
  };

  if (picked) {
    return (
      <Card className="border-0 shadow-lg rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <PanelHeader title={`Top up with ${picked.name}`} onBack={() => setPicked(null)} />
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100" htmlFor="dep-amount">Amount (USD)</label>
              <Input id="dep-amount" type="number" min="1" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-900 dark:text-gray-100" htmlFor="dep-phone">{picked.name} number</label>
              <Input id="dep-phone" placeholder="+254712345678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <Button type="submit" disabled={deposit.isPending} className="w-full bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold">
              {deposit.isPending ? "Starting…" : `Top up with ${picked.name}`}
            </Button>
            <p className="text-[11px] text-gray-400 text-center">You'll get a payment prompt on your phone to approve.</p>
          </form>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-lg rounded-2xl">
      <CardContent className="p-5 space-y-2">
        <PanelHeader title="Deposit with mobile money" onBack={onBack} />
        <p className="text-xs text-gray-500 dark:text-gray-400 pb-2">Top up your S-PAY balance straight from your mobile money account.</p>
        {MOMO_OPTIONS.map((o) => (
          <button key={o.name} onClick={() => setPicked(o)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-700 dark:hover:bg-gray-800 transition-colors text-left">
            <span className="text-2xl">{o.flag}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{o.name}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{o.region}</p>
            </div>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
        <div className="bg-blue-50 dark:bg-blue-950/40 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          Tip: the <strong>Exchange or wallet</strong> method is instant today — many members top up Binance with mobile money, then deposit here in seconds.
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Bank transfer ────────────────────────────────────────────────────────────

function BankPanel({ onBack }: { onBack: () => void }) {
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const verified = me?.kycStatus === "approved";
  return (
    <Card className="border-0 shadow-lg rounded-2xl">
      <CardContent className="p-5 space-y-3">
        <PanelHeader title="Deposit by bank transfer" onBack={onBack} />
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Verified members get a <strong>real US bank account</strong> (ACH routing + account number) and a <strong>European IBAN</strong>. Share them with your employer or clients — incoming transfers are converted to digital dollars and credited to your balance automatically.
        </p>
        <div className="space-y-2">
          {["US bank account (ACH)", "European IBAN (SEPA)"].map((label) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60">
              <Landmark size={18} className="text-[#2E8FD6]" />
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1">{label}</p>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
          ))}
        </div>
        {verified ? (
          <Link href="/banking">
            <Button className="w-full bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold mt-1">View my account details</Button>
          </Link>
        ) : (
          <Link href="/profile">
            <Button className="w-full bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold mt-1">
              <ShieldCheck size={16} className="mr-1.5" /> Verify identity to unlock
            </Button>
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Crypto / exchange — guided per-exchange steps; "My QR code" is one option ─

const RECEIVE_SOURCES = [
  {
    id: "binance", name: "Binance", brand: "binance",
    steps: [
      "Open Binance → Assets → Withdraw",
      "Choose USDC (or USDT)",
      "Network: select CELO — this is the critical step",
      "Paste your S-PAY address below → confirm",
    ],
  },
  {
    id: "bybit", name: "Bybit", brand: "bybit",
    steps: [
      "Open Bybit → Assets → Withdraw",
      "Choose USDC (or USDT)",
      "Chain type: select CELO",
      "Paste your S-PAY address below → confirm",
    ],
  },
  {
    id: "okx", name: "OKX", brand: "okx",
    steps: [
      "Open OKX → Assets → Withdraw",
      "Choose USDC (or USDT) → on-chain withdrawal",
      "Network: select Celo",
      "Paste your S-PAY address below → confirm",
    ],
  },
  {
    id: "wallet", name: "Another Celo wallet (MiniPay, Valora…)", brand: "wallet",
    steps: [
      "Open the sender's wallet app",
      "Choose Send → USDC or USDT",
      "Paste your S-PAY address below (or scan your QR)",
      "Send — it arrives in ~5 seconds",
    ],
  },
] as const;

function CryptoPanel({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const addFunds = useAddFunds();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const [qrUrl, setQrUrl] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<null | "qr" | typeof RECEIVE_SOURCES[number]["id"]>(null);
  const source = RECEIVE_SOURCES.find((s) => s.id === view);

  useEffect(() => {
    // Money action: JIT-provisions the wallet on first use
    addFunds.mutate(
      { data: { amount: 0, currency: "USDC", method: "bank_transfer" } },
      {
        onSuccess: (res) => {
          const addr = (res as { celoAddress?: string })?.celoAddress;
          if (addr) setAddress(addr);
          else setError("Your wallet is still being prepared — try again in a moment.");
        },
        onError: (err) => setError((err as { data?: { message?: string } })?.data?.message ?? "Your wallet is still being prepared — try again shortly."),
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // MiniPay-style branded QR (only in the "My QR code" option): brand-navy
  // modules + the S-PAY logo stamped in the middle. Shared with the S-PAY ID
  // modal via lib/branded-qr so every QR the app produces looks identical.
  // Render the branded QR as a square PNG and show it via <img> at a fixed
  // aspect — never CSS-scale a canvas, which is what made it look stretched.
  useEffect(() => {
    if (view !== "qr" || !address) { setQrUrl(""); return; }
    brandedQRDataUrl(address, 480).then(setQrUrl).catch(() => setQrUrl(""));
  }, [view, address]);

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = "spay-receive-qr.png";
    a.click();
    toast({ title: "QR code saved", description: "Share the image — anyone can scan it to pay you." });
  };

  const share = async () => {
    if (!address) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Pay me on S-PAY", text: `Send USDC/USDT on the Celo network to my S-PAY address: ${address}` });
      } catch { /* user dismissed */ }
    } else {
      await copy();
      toast({ title: "Address copied", description: "Sharing isn't supported in this browser — the address is on your clipboard." });
    }
  };

  const AddressCard = () => (
    <button onClick={copy} className="w-full bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 flex items-center gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors" title="Tap to copy">
      <code className="text-[11px] text-gray-700 dark:text-gray-300 break-all flex-1">{address}</code>
      {copied ? <CheckCircle2 size={15} className="text-green-500 flex-shrink-0" /> : <Copy size={15} className="text-gray-400 flex-shrink-0" />}
    </button>
  );

  if (error) {
    return (
      <Card className="border-0 shadow-lg rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <PanelHeader title="Receive from an exchange or wallet" onBack={onBack} />
          <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-4">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!address) {
    return (
      <Card className="border-0 shadow-lg rounded-2xl">
        <CardContent className="p-5 space-y-3">
          <PanelHeader title="Receive from an exchange or wallet" onBack={onBack} />
          <p className="text-sm text-gray-400 text-center py-10">Preparing your wallet…</p>
        </CardContent>
      </Card>
    );
  }

  // Per-exchange guided steps — business-style, like the exchange withdrawal flow
  if (source) {
    return (
      <Card className="border-0 shadow-lg rounded-2xl">
        <CardContent className="p-5 space-y-4">
          <PanelHeader title={`Receive from ${source.name.split(" (")[0]}`} onBack={() => setView(null)} />
          <ol className="space-y-3">
            {source.steps.map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="w-6 h-6 rounded-full bg-[#4DC9EE] text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <div>
            <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1.5">Your S-PAY address (tap to copy)</p>
            <AddressCard />
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 leading-relaxed">
            ⚠ The network must be <strong>Celo</strong>. Funds sent on any other network can be lost. Arrives in seconds.
          </div>
        </CardContent>
      </Card>
    );
  }

  // "My QR code" — one option among the sources
  if (view === "qr") {
    return (
      <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <PanelHeader title="My QR code" onBack={() => setView(null)} />
          <div className="bg-gradient-to-b from-[#FCFF52]/40 to-white rounded-3xl border border-gray-100 dark:border-gray-800 p-4 sm:p-6 flex flex-col items-center gap-3 w-full">
            <p className="font-bold text-gray-900">{me?.fullName ?? "My S-PAY"}</p>
            {/* Square PNG via <img>: caps at 240px, aspect-square + object-contain guarantee it never stretches */}
            {qrUrl
              ? <img src={qrUrl} alt="Your S-PAY receive QR code" className="w-full max-w-[240px] aspect-square object-contain rounded-xl bg-white" />
              : <div className="w-full max-w-[240px] aspect-square rounded-xl bg-gray-100 animate-pulse" />}
            <button onClick={copy} className="font-mono text-[11px] text-gray-600 break-all text-center hover:text-gray-900 transition-colors" title="Tap to copy">
              {address}
            </button>
            <p className="text-[11px] text-gray-400 -mt-1">Tap the address to copy</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" className="rounded-xl" onClick={copy}>
              {copied ? <CheckCircle2 size={15} className="mr-1 text-green-500" /> : <Copy size={15} className="mr-1" />} {copied ? "Copied" : "Copy"}
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={download}>
              <Download size={15} className="mr-1" /> Save
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={share}>
              <Share2 size={15} className="mr-1" /> Share
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Source chooser — the process for each, easier and business-oriented
  return (
    <Card className="border-0 shadow-lg rounded-2xl">
      <CardContent className="p-5 space-y-2">
        <PanelHeader title="Receive from an exchange or wallet" onBack={onBack} />
        <p className="text-xs text-gray-500 pb-1">Where is the money coming from? Each option shows the exact steps.</p>
        {RECEIVE_SOURCES.map((s) => (
          <button key={s.id} onClick={() => setView(s.id)} className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left">
            <NetworkIcon brand={s.brand} size={40} />
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex-1">{s.name}</p>
            <ChevronRight size={16} className="text-gray-300" />
          </button>
        ))}
        <button onClick={() => setView("qr")} className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left">
          <NetworkIcon brand="qr" size={40} />
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">My QR code</p>
            <p className="text-[11px] text-gray-500">Show, save or share it — anyone can scan to pay you</p>
          </div>
          <ChevronRight size={16} className="text-gray-300" />
        </button>
        <div>
          <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1.5 mt-2">Your S-PAY address (tap to copy)</p>
          <AddressCard />
        </div>
      </CardContent>
    </Card>
  );
}
