import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import QRCode from "qrcode";
import { Layout } from "@/components/layout";
import { useAddFunds, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Smartphone, Landmark, Coins, ChevronRight, ArrowLeft, Copy, Download,
  Share2, ShieldCheck, CheckCircle2, Clock,
} from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.jpg";

/**
 * Deposit ("Add money") — MiniPay-style: three methods, each opening to its
 * specific options. Crypto works today (QR + address, JIT wallet); Mobile
 * Money and Bank transfer unlock with verification + the payout partner.
 */

type Method = null | "momo" | "bank" | "crypto";

const MOMO_OPTIONS = [
  { flag: "🇰🇪", name: "M-Pesa", region: "Kenya · Tanzania" },
  { flag: "🇺🇬", name: "MTN Mobile Money", region: "Uganda · Ghana · Cameroon" },
  { flag: "🇳🇬", name: "Airtel Money / Bank USSD", region: "Nigeria" },
  { flag: "🇵🇭", name: "GCash", region: "Philippines" },
  { flag: "🇧🇷", name: "PIX", region: "Brazil" },
];

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
          badge="Works now"
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
    <button onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors text-left">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white flex-shrink-0" style={{ backgroundColor: color }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 flex items-center gap-2">
          {title}
          {badge && <span className="text-[10px] font-bold uppercase bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{badge}</span>}
        </p>
        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="text-gray-300 flex-shrink-0" />
    </button>
  );
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      <button onClick={onBack} className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors" aria-label="Back to methods">
        <ArrowLeft size={17} />
      </button>
      <h2 className="font-bold text-gray-900">{title}</h2>
    </div>
  );
}

// ─── Mobile money ─────────────────────────────────────────────────────────────

function MomoPanel({ onBack }: { onBack: () => void }) {
  return (
    <Card className="border-0 shadow-lg rounded-2xl">
      <CardContent className="p-5 space-y-2">
        <PanelHeader title="Deposit with mobile money" onBack={onBack} />
        <p className="text-xs text-gray-500 pb-2">Top up your S-PAY balance straight from your mobile money account.</p>
        {MOMO_OPTIONS.map((o) => (
          <div key={o.name} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
            <span className="text-2xl">{o.flag}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900">{o.name}</p>
              <p className="text-[11px] text-gray-500">{o.region}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-1 rounded-full">
              <Clock size={10} /> Soon
            </span>
          </div>
        ))}
        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 leading-relaxed">
          Mobile money deposits are activating with our payments partner. Meanwhile, the <strong>Exchange or wallet</strong> method works today — many members top up via Binance with M-Pesa, then deposit here instantly.
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
        <p className="text-xs text-gray-500">
          Verified members get a <strong>real US bank account</strong> (ACH routing + account number) and a <strong>European IBAN</strong>. Share them with your employer or clients — incoming transfers are converted to digital dollars and credited to your balance automatically.
        </p>
        <div className="space-y-2">
          {["US bank account (ACH)", "European IBAN (SEPA)"].map((label) => (
            <div key={label} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
              <Landmark size={18} className="text-[#2E8FD6]" />
              <p className="text-sm font-semibold text-gray-900 flex-1">{label}</p>
              {verified ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-amber-700 bg-amber-50 px-2 py-1 rounded-full"><Clock size={10} /> Provisioning</span>
              ) : (
                <span className="text-[10px] font-bold uppercase text-gray-400">Locked</span>
              )}
            </div>
          ))}
        </div>
        {!verified && (
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

// ─── Crypto / exchange — MiniPay-style receive card ──────────────────────────

function CryptoPanel({ onBack }: { onBack: () => void }) {
  const { toast } = useToast();
  const addFunds = useAddFunds();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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

  // MiniPay-style QR: high error-correction + brand logo stamped in the middle
  useEffect(() => {
    if (!address || !canvasRef.current) return;
    const canvas = canvasRef.current;
    QRCode.toCanvas(canvas, address, { width: 560, margin: 2, errorCorrectionLevel: "H", color: { dark: "#1A2B4A" } }, () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        const size = canvas.width * 0.2;
        const x = (canvas.width - size) / 2;
        // white rounded backing so the logo never breaks scannability
        const pad = size * 0.12;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.roundRect(x - pad, x - pad, size + pad * 2, size + pad * 2, size * 0.22);
        ctx.fill();
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x, x, size, size, size * 0.22);
        ctx.clip();
        ctx.drawImage(img, x, x, size, size);
        ctx.restore();
      };
      img.src = spayLogo;
    });
  }, [address]);

  const copy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
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

  return (
    <Card className="border-0 shadow-lg rounded-2xl overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <PanelHeader title="Receive from an exchange or wallet" onBack={onBack} />
        {error ? (
          <p className="text-sm text-amber-700 bg-amber-50 rounded-xl p-4">{error}</p>
        ) : !address ? (
          <p className="text-sm text-gray-400 text-center py-10">Preparing your wallet…</p>
        ) : (
          <>
            {/* MiniPay-style identity card */}
            <div className="bg-gradient-to-b from-[#FCFF52]/40 to-white rounded-3xl border border-gray-100 p-6 flex flex-col items-center gap-3">
              <p className="font-bold text-gray-900">{me?.fullName ?? "My S-PAY"}</p>
              <canvas ref={canvasRef} className="w-56 h-56 rounded-xl" aria-label="Your S-PAY receive QR code" />
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

            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-700 leading-relaxed">
              ⚠ Send <strong>USDC or USDT</strong> on the <strong>Celo network only</strong>. From Binance/Bybit: Withdraw → USDC → network <strong>CELO</strong> → paste your address. Funds appear in seconds.
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
