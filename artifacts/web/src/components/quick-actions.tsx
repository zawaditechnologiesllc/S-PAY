import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import jsQR from "jsqr";
import { useSendMoney, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  ScanLine, ArrowRightLeft, Plus, Banknote,
  CheckCircle2, Smartphone, Wallet2, Mail, Lock, ShieldAlert, ExternalLink, CameraOff,
} from "lucide-react";

/**
 * Alipay-style quick actions — all four work:
 *   Scan     → camera QR scanner; a scanned Celo address opens Transfer prefilled
 *   Transfer → P2P by phone number, or send to any 0x address (POST /wallet/send)
 *   Recharge → YOUR shareable QR code + address (this is where the QR for "Scan" comes from)
 *   Withdraw → cash-out flows (M-Pesa, bank, exchange)
 */

function apiMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { message?: string } })?.data;
  return data?.message ?? fallback;
}

const ADDRESS_RE = /0x[0-9a-fA-F]{40}/;

export function QuickActions() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState<null | "scan" | "transfer">(null);
  const [prefillAddress, setPrefillAddress] = useState("");

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
        <QuickAction icon={<ScanLine size={22} />} label="Scan" bgColor="#4DC9EE" onClick={() => setOpen("scan")} />
        <QuickAction icon={<ArrowRightLeft size={22} />} label="Transfer" bgColor="#F59E0B" onClick={() => { setPrefillAddress(""); setOpen("transfer"); }} />
        <QuickAction icon={<Plus size={24} strokeWidth={2.5} />} label="Recharge" bgColor="#22C55E" onClick={() => setLocation("/deposit")} />
        <QuickAction icon={<Banknote size={22} />} label="Withdraw" bgColor="#2E8FD6" onClick={() => setLocation("/banking/withdraw")} />
      </div>

      <ScanDialog
        open={open === "scan"}
        onClose={() => setOpen(null)}
        onAddress={(addr) => { setPrefillAddress(addr); setOpen("transfer"); }}
      />
      <TransferDialog open={open === "transfer"} onClose={() => setOpen(null)} initialAddress={prefillAddress} />
    </>
  );
}

function QuickAction({ icon, label, bgColor, onClick }: {
  icon: React.ReactNode; label: string; bgColor: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-2 cursor-pointer group" aria-label={label}>
      <div
        className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 group-active:scale-95 transition-transform duration-150"
        style={{ backgroundColor: bgColor }}
      >
        {icon}
      </div>
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{label}</span>
    </button>
  );
}

// ─── Transfer ─────────────────────────────────────────────────────────────────

type SendMode = "phone" | "email" | "address";

function TransferDialog({ open, onClose, initialAddress }: { open: boolean; onClose: () => void; initialAddress?: string }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const send = useSendMoney();
  const [mode, setMode] = useState<SendMode>("phone");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [result, setResult] = useState<{ txHash?: string; fee?: number; total?: number } | null>(null);

  useEffect(() => {
    if (open) {
      setResult(null); setAmount(""); setNote(""); setPin(""); setNeedsPinSetup(false);
      if (initialAddress) { setMode("address"); setRecipient(initialAddress); }
      else { setMode("phone"); setRecipient(""); }
    }
  }, [open, initialAddress]);

  const recipientField =
    mode === "phone" ? { recipientPhone: recipient.trim() } :
    mode === "email" ? { recipientEmail: recipient.trim() } :
    { recipientAddress: recipient.trim() };

  const submit = () => {
    const value = parseFloat(amount);
    if (!recipient.trim() || !Number.isFinite(value) || value <= 0) {
      toast({ title: "Check the details", description: "Enter a recipient and a valid amount.", variant: "destructive" });
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      toast({ title: "Enter your PIN", description: "Your 4–6 digit transaction PIN authorizes the transfer.", variant: "destructive" });
      return;
    }
    send.mutate(
      { data: { amount: value, currency: "USDC", ...recipientField, ...(note.trim() ? { note: note.trim() } : {}), pin } },
      {
        onSuccess: (tx) => {
          const t = tx as { txHash?: string; fee?: number; total?: number };
          setResult({ txHash: t.txHash, fee: t.fee, total: t.total });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: (err) => {
          const code = (err as { data?: { error?: string } })?.data?.error;
          setPin("");
          if (code === "pin_not_set") { setNeedsPinSetup(true); return; }
          toast({ title: "Transfer not completed", description: apiMessage(err, "Please try again."), variant: "destructive" });
        },
      },
    );
  };

  const modes: { id: SendMode; icon: React.ReactNode; label: string; placeholder: string }[] = [
    { id: "phone", icon: <Smartphone size={13} />, label: "Phone", placeholder: "+254712345678" },
    { id: "email", icon: <Mail size={13} />, label: "Email", placeholder: "name@email.com" },
    { id: "address", icon: <Wallet2 size={13} />, label: "Address", placeholder: "0x…" },
  ];
  const activeMode = modes.find((m) => m.id === mode)!;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        {result ? (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <CheckCircle2 size={56} className="text-green-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Money sent 🎉</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">USDC {amount} is on its way — settled on Celo in ~5 seconds.</p>
            {result.fee !== undefined && result.fee > 0 && (
              <p className="text-xs text-gray-400">Fee: {result.fee.toFixed(2)} USDC · Total charged: {result.total?.toFixed(2)} USDC</p>
            )}
            {result.txHash && (
              <a href={`https://celoscan.io/tx/${result.txHash}`} target="_blank" rel="noopener noreferrer"
                className="text-xs text-[#2E8FD6] hover:underline inline-flex items-center gap-1">
                View receipt on CeloScan <ExternalLink size={12} />
              </a>
            )}
            <Button className="mt-2 w-full bg-[#4DC9EE] hover:bg-[#2E8FD6]" onClick={onClose}>Done</Button>
          </div>
        ) : needsPinSetup ? (
          <div className="flex flex-col items-center text-center py-6 gap-3">
            <ShieldAlert size={48} className="text-amber-500" />
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">Set up your transaction PIN</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">For your security, sending money needs a 4–6 digit PIN. Set it once, then use it for every transfer and withdrawal.</p>
            <Button className="mt-2 w-full bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold" onClick={() => { onClose(); setLocation("/security"); }}>
              Set my PIN
            </Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Transfer</DialogTitle>
              <DialogDescription>Send USDC by phone, email, or to any Celo wallet.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-3 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
              {modes.map((m) => (
                <button key={m.id}
                  onClick={() => { setMode(m.id); setRecipient(""); }}
                  className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${mode === m.id ? "bg-white dark:bg-gray-900 shadow text-gray-900 dark:text-gray-100" : "text-gray-500 dark:text-gray-400"}`}>
                  {m.icon} {m.label}
                </button>
              ))}
            </div>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="qa-recipient">
                  {mode === "phone" ? "Recipient's phone number" : mode === "email" ? "Recipient's email" : "Recipient's Celo address"}
                </Label>
                <Input id="qa-recipient" placeholder={activeMode.placeholder} value={recipient} onChange={(e) => setRecipient(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qa-amount">Amount (USDC)</Label>
                <Input id="qa-amount" type="number" min="0" step="0.01" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qa-note">Note (optional)</Label>
                <Input id="qa-note" placeholder="What's it for?" maxLength={120} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="qa-pin" className="flex items-center gap-1.5"><Lock size={12} /> Transaction PIN</Label>
                <Input id="qa-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={6}
                  placeholder="••••" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
              </div>
              <Button className="w-full bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold" disabled={send.isPending} onClick={submit}>
                {send.isPending ? "Sending…" : "Send now"}
              </Button>
              <p className="text-[11px] text-gray-400 text-center">Settled on Celo in ~5s · any network fee shows on your receipt</p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

function ScanDialog({ open, onClose, onAddress }: { open: boolean; onClose: () => void; onAddress: (addr: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [cameraError, setCameraError] = useState(false);

  useEffect(() => {
    if (!open) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      const video = videoRef.current;
      if (video && ctx && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(img.data, img.width, img.height);
        const match = code?.data.match(ADDRESS_RE);
        if (match) {
          onAddress(match[0]); // hands the address to Transfer, prefilled
          return;
        }
      }
      if (!cancelled) raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          void videoRef.current.play();
        }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setCameraError(true));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan to pay</DialogTitle>
          <DialogDescription>Point your camera at an S-PAY receive code (the recipient finds theirs under “Recharge”).</DialogDescription>
        </DialogHeader>
        {cameraError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CameraOff size={40} className="text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Camera unavailable or permission denied. You can paste the recipient's address in <strong>Transfer</strong> instead.
            </p>
          </div>
        ) : (
          <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
            <div className="absolute inset-8 border-2 border-[#4DC9EE] rounded-2xl pointer-events-none" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

