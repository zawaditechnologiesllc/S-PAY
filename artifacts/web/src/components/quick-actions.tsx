import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import jsQR from "jsqr";
import { useSendMoney, getGetDashboardSummaryQueryKey, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { QRModal } from "@/components/qr-modal";
import {
  ScanLine, ArrowRightLeft, Plus, Banknote,
  CheckCircle2, Smartphone, Wallet2, Mail, Lock, ShieldAlert, ExternalLink, CameraOff, QrCode,
  Camera, Image as ImageIcon,
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

type SendMode = "phone" | "email" | "spay-id" | "address";

const ADDRESS_RE = /0x[0-9a-fA-F]{40}/;
const SPAYID_RE = /spay_[a-z0-9]+/i;

/**
 * Decide what a scanned/decoded QR contains and how to route it. We accept BOTH
 * kinds of S-PAY receive code and pick the right transfer mode:
 *   • an S-PAY ID (`spay_…`) — what our own "get paid" QR encodes → S-PAY ID mode
 *   • a Celo/EVM address (`0x…`) — external wallets & exchanges → Address mode
 * The string may be the bare value or wrapped (a URI/URL); we extract either.
 * Returns null when it's neither, so the caller can say "that's not an S-PAY code".
 */
function parseScanned(raw: string): { mode: SendMode; value: string } | null {
  if (!raw) return null;
  const text = raw.trim();
  const spay = text.match(SPAYID_RE);
  if (spay) return { mode: "spay-id", value: spay[0] };
  const addr = text.match(ADDRESS_RE);
  if (addr) return { mode: "address", value: addr[0] };
  return null;
}

export function QuickActions() {
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState<null | "scan" | "transfer">(null);
  const [prefill, setPrefill] = useState<{ mode: SendMode; value: string } | null>(null);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100 dark:border-gray-800">
        <QuickAction icon={<ScanLine size={22} />} label="Scan" bgColor="#4DC9EE" onClick={() => setOpen("scan")} />
        <QuickAction icon={<ArrowRightLeft size={22} />} label="Transfer" bgColor="#F59E0B" onClick={() => { setPrefill(null); setOpen("transfer"); }} />
        <QuickAction icon={<Plus size={24} strokeWidth={2.5} />} label="Recharge" bgColor="#22C55E" onClick={() => setLocation("/deposit")} />
        <QuickAction icon={<Banknote size={22} />} label="Withdraw" bgColor="#2E8FD6" onClick={() => setLocation("/banking/withdraw")} />
      </div>

      <ScanDialog
        open={open === "scan"}
        onClose={() => setOpen(null)}
        onResult={(r) => { setPrefill(r); setOpen("transfer"); }}
      />
      <TransferDialog open={open === "transfer"} onClose={() => setOpen(null)} initial={prefill} />
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

function TransferDialog({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: { mode: SendMode; value: string } | null }) {
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
  const [qrOpen, setQrOpen] = useState(false);
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), staleTime: 60_000 } });

  useEffect(() => {
    if (open) {
      setResult(null); setAmount(""); setNote(""); setPin(""); setNeedsPinSetup(false);
      if (initial) { setMode(initial.mode); setRecipient(initial.value); }
      else { setMode("phone"); setRecipient(""); }
    }
  }, [open, initial]);

  const recipientField =
    mode === "phone" ? { recipientPhone: recipient.trim() } :
    mode === "email" ? { recipientEmail: recipient.trim() } :
    mode === "spay-id" ? { recipientSpayId: recipient.trim() } :
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
    { id: "spay-id", icon: <Banknote size={13} />, label: "S-PAY ID", placeholder: "spay_…" },
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
              <DialogDescription>Send by phone, email, S-PAY ID, or to any Celo wallet.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl">
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
                  {mode === "phone" ? "Recipient's phone number" : mode === "email" ? "Recipient's email" : mode === "spay-id" ? "Recipient's S-PAY ID" : "Recipient's Celo address"}
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
              {/* Flip side of sending: let the user show their own S-PAY ID QR so
                  the other party can pay them without typing anything. */}
              <button
                type="button"
                onClick={() => setQrOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-[#4DC9EE] hover:underline pt-1"
              >
                <QrCode size={13} /> Show my QR to get paid instead
              </button>
            </div>
          </>
        )}
      </DialogContent>
      {me?.spayId && (
        <QRModal open={qrOpen} onClose={() => setQrOpen(false)} spayId={me.spayId} userName={me.fullName ?? ""} />
      )}
    </Dialog>
  );
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

function ScanDialog({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (r: { mode: SendMode; value: string }) => void }) {
  const { toast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<"choose" | "camera">("choose");
  const [cameraError, setCameraError] = useState(false);

  // Always reopen on the chooser — never auto-start the camera. Picking "camera"
  // is the explicit user action that triggers the browser permission prompt.
  useEffect(() => {
    if (open) { setView("choose"); setCameraError(false); }
  }, [open]);

  // Parse a decoded QR and, if it's a valid S-PAY ID or wallet address, hand it
  // to Transfer in the matching mode. Returns false when it's neither.
  const handleDecoded = (raw: string): boolean => {
    const r = parseScanned(raw);
    if (!r) return false;
    onResult(r);
    return true;
  };

  // Live camera scanning — only while the user is on the camera view.
  useEffect(() => {
    if (!open || view !== "camera") return;
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
        if (code && handleDecoded(code.data)) return;
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
  }, [open, view]);

  // Decode a QR from a chosen image (downscaled for speed).
  const onPickImage = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const max = 1600;
      const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      URL.revokeObjectURL(url);
      if (!ctx) { toast({ title: "Couldn't read that image", variant: "destructive" }); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h);
      const code = jsQR(data.data, data.width, data.height);
      if (!code || !handleDecoded(code.data)) {
        toast({ title: "No S-PAY code found", description: "That image didn't contain a readable S-PAY ID or wallet QR.", variant: "destructive" });
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast({ title: "Couldn't open that image", variant: "destructive" }); };
    img.src = url;
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Scan to pay</DialogTitle>
          <DialogDescription>
            Scan a friend's <strong>S-PAY ID</strong> code (theirs is under “Recharge”) or any Celo wallet QR — we'll open Transfer with the recipient filled in.
          </DialogDescription>
        </DialogHeader>

        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { onPickImage(e.target.files?.[0]); e.target.value = ""; }} />

        {view === "choose" ? (
          <div className="grid gap-3 py-1">
            <button onClick={() => setView("camera")}
              className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-[#4DC9EE] hover:bg-[#4DC9EE]/5 transition-colors text-left">
              <div className="w-11 h-11 rounded-xl bg-[#4DC9EE]/15 text-[#4DC9EE] flex items-center justify-center flex-shrink-0"><Camera size={22} /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Scan with camera</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">We'll ask for camera permission.</p>
              </div>
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="flex items-center gap-3 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-[#4DC9EE] hover:bg-[#4DC9EE]/5 transition-colors text-left">
              <div className="w-11 h-11 rounded-xl bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center flex-shrink-0"><ImageIcon size={22} /></div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Upload from gallery</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Pick a saved QR screenshot or photo.</p>
              </div>
            </button>
          </div>
        ) : cameraError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <CameraOff size={40} className="text-gray-300" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Camera unavailable or permission denied.</p>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>Upload from gallery instead</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
              <div className="absolute inset-8 border-2 border-[#4DC9EE] rounded-2xl pointer-events-none" />
            </div>
            <button onClick={() => fileRef.current?.click()} className="w-full text-xs font-semibold text-[#4DC9EE] hover:underline">
              Or upload from gallery
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

