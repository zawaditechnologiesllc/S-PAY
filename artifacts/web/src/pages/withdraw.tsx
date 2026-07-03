import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import {
  useGetExchangeRates, getGetExchangeRatesQueryKey,
  useInitiateWithdraw,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FlowStepper } from "@/components/flow-stepper";
import { useToast } from "@/hooks/use-toast";
import {
  MoveRight, Landmark, Smartphone, CheckCircle2, ArrowLeft, ArrowRight, Lock, ExternalLink,
} from "lucide-react";
import { Link, useLocation } from "wouter";

/**
 * Withdraw — Payd-style guided flow. A step bar on top always shows where the
 * user is and where they're going: pick the method, fill the details, review
 * everything on one screen, confirm with the PIN, done. Each step is one
 * decision; nothing is submitted until the review step's confirm.
 */

const STEPS = ["Method", "Details", "Review", "Done"] as const;

const MOMO_PROVIDERS = [
  { id: "mpesa", flag: "🇰🇪", label: "M-Pesa", currency: "KES" },
  { id: "mtn_momo", flag: "🇺🇬", label: "MTN MoMo", currency: "UGX" },
  { id: "airtel", flag: "🇳🇬", label: "Airtel / NG Bank", currency: "NGN" },
  { id: "gcash", flag: "🇵🇭", label: "GCash", currency: "PHP" },
  { id: "nequi", flag: "🇨🇴", label: "Nequi", currency: "COP" },
] as const;
const MOMO_IDS: string[] = MOMO_PROVIDERS.map((p) => p.id);

const METHOD_LABELS: Record<string, string> = {
  mpesa: "M-Pesa", mtn_momo: "MTN MoMo", airtel: "Airtel / NG Bank", gcash: "GCash", nequi: "Nequi",
  pix: "PIX (Brazil)", sepa: "SEPA (EUR)", faster_payments: "UK Faster Payments", spei: "SPEI (Mexico)",
  bank_transfer: "US / International bank",
};

const CURRENCY_BY_METHOD: Record<string, string> = {
  mpesa: "KES", mtn_momo: "UGX", airtel: "NGN", gcash: "PHP", gopay: "IDR",
  nequi: "COP", pix: "BRL", spei: "MXN", sepa: "EUR", faster_payments: "GBP", bank_transfer: "USD",
};

export default function Withdraw() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [method, setMethod] = useState<string>("mpesa");
  const [amount, setAmount] = useState<string>("100");
  const [recipient, setRecipient] = useState("");
  const [routing, setRouting] = useState("");       // US routing number / UK sort code
  const [holderName, setHolderName] = useState(""); // account holder, for bank rails
  const [pin, setPin] = useState("");
  const [targetCurrency, setTargetCurrency] = useState("KES");
  const [result, setResult] = useState<{ withdrawalId?: string; localAmount?: number; estimatedArrival?: string } | null>(null);

  const numAmount = parseFloat(amount) || 0;

  useEffect(() => {
    setTargetCurrency(CURRENCY_BY_METHOD[method] ?? "USD");
    // Different rails need different details — clear stale ones on method change
    setRecipient(""); setRouting(""); setHolderName("");
  }, [method]);

  const { data: fxData } = useGetExchangeRates(
    { source: "USDC", target: targetCurrency },
    { query: { queryKey: getGetExchangeRatesQueryKey({ source: "USDC", target: targetCurrency }) } }
  );

  const withdrawMutation = useInitiateWithdraw();

  // What each rail actually needs (MiniPay/Payd pattern): mobile money is just a
  // phone number; PIX keys off the tax ID; SEPA takes an IBAN + name; US ACH
  // wants routing + account + name; UK Faster Payments sort code + account.
  const FIELDS: Record<string, { main: string; placeholder: string; routing?: string; routingPlaceholder?: string; name?: boolean }> = {
    momo: { main: "Phone number", placeholder: "+254712345678" },
    pix: { main: "CPF/CNPJ (Tax ID)", placeholder: "123.456.789-09" },
    sepa: { main: "IBAN", placeholder: "DE89 3704 0044 0532 0130 00", name: true },
    faster_payments: { main: "Account number", placeholder: "12345678", routing: "Sort code", routingPlaceholder: "12-34-56", name: true },
    spei: { main: "CLABE (18 digits)", placeholder: "002010077777777771" },
    bank_transfer: { main: "Account number", placeholder: "000123456789", routing: "Routing number (ABA)", routingPlaceholder: "026009593", name: true },
  };
  const fieldSpec = MOMO_IDS.includes(method) ? FIELDS.momo : FIELDS[method] ?? FIELDS.bank_transfer;
  const recipientLabel = fieldSpec.main;

  const detailsValid =
    numAmount > 0 &&
    recipient.trim().length > 0 &&
    (!fieldSpec.routing || routing.trim().length > 0) &&
    (!fieldSpec.name || holderName.trim().length > 0) &&
    /^\d{4,6}$/.test(pin);

  const goToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) { toast({ title: "Enter a valid amount", variant: "destructive" }); return; }
    if (!recipient.trim()) { toast({ title: `${recipientLabel} is required`, variant: "destructive" }); return; }
    if (fieldSpec.routing && !routing.trim()) { toast({ title: `${fieldSpec.routing} is required`, variant: "destructive" }); return; }
    if (fieldSpec.name && !holderName.trim()) { toast({ title: "Account holder's name is required", variant: "destructive" }); return; }
    if (!/^\d{4,6}$/.test(pin)) {
      toast({ title: "Enter your PIN", description: "Your 4–6 digit transaction PIN authorizes the cash-out.", variant: "destructive" });
      return;
    }
    setStep(2);
  };

  const confirm = () => {
    const payload: Record<string, unknown> = {
      amount: numAmount,
      sourceCurrency: "USDC",
      targetCurrency,
      method,
      pin,
    };
    const phoneMethods = ["mpesa", "mtn_momo", "airtel", "gcash", "nequi"];
    if (phoneMethods.includes(method)) payload.recipientPhone = recipient.trim();
    else if (method === "sepa") payload.recipientIban = recipient.trim();
    else if (method === "pix") payload.recipientTaxId = recipient.trim();
    else payload.recipientAccount = recipient.trim(); // bank account / CLABE
    if (fieldSpec.routing && routing.trim()) payload.recipientRouting = routing.trim();
    if (fieldSpec.name && holderName.trim()) payload.recipientName = holderName.trim();

    withdrawMutation.mutate({ data: payload as never }, {
      onSuccess: (r) => {
        const d = r as { withdrawalId?: string; localAmount?: number; estimatedArrival?: string };
        setResult(d);
        setPin("");
        setStep(3);
      },
      onError: (err) => {
        const data = (err as { data?: { error?: string; message?: string } })?.data;
        setPin("");
        if (data?.error === "pin_not_set") {
          toast({ title: "Set up your PIN", description: "Cashing out needs a transaction PIN. Set it in Security." });
          setLocation("/security");
          return;
        }
        setStep(1); // let the user fix the details and try again
        toast({
          title: "Withdrawal not completed",
          description: data?.message || (err as Error).message || "Failed to initiate withdrawal",
          variant: "destructive",
        });
      },
    });
  };

  const fastMethods = ["mpesa", "mtn_momo", "airtel", "gcash", "pix", "nequi"];
  const estimatedArrival = fastMethods.includes(method) ? "Within minutes" : method === "spei" ? "Same day" : "1–2 business days";
  const fee = fxData && numAmount > 0 ? Math.max(numAmount * fxData.fee!, 0) : 0;
  const youReceive = fxData && numAmount > 0 ? Math.max(numAmount - fee, 0) * fxData.rate : 0;

  return (
    <Layout back title="Withdraw Funds">
      <div className="max-w-xl mx-auto mt-4 space-y-4">
        {/* The Payd-style guide bar — always visible so the user knows the step
            they're in and the one they're going to. */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-md px-5 pt-4 pb-3">
          <FlowStepper steps={STEPS} current={step} />
        </div>

        {/* ── Step 1 · Method ── */}
        {step === 0 && (
          <>
            <Link href="/wallet/exchange">
              <div className="bg-gradient-to-r from-[#1A2B4A] to-[#2E8FD6] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:opacity-95 transition-opacity shadow-lg">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🟡</span>
                  <div>
                    <p className="text-white font-bold text-sm">Withdraw to Binance or another exchange</p>
                    <p className="text-blue-200 text-xs">USDC/USDT on Celo · settles in ~5 seconds</p>
                  </div>
                </div>
                <span className="text-white text-lg">→</span>
              </div>
            </Link>

            <Card className="border-0 shadow-lg rounded-2xl bg-white dark:bg-gray-900 overflow-hidden">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100">Where should the money go?</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Pick the cash-out method — the details come next.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <MethodOption icon={<Smartphone />} label="Mobile money" selected={MOMO_IDS.includes(method)} onClick={() => setMethod("mpesa")} />
                  <MethodOption icon={<MoveRight />} label="PIX (Brazil)" selected={method === "pix"} onClick={() => setMethod("pix")} />
                  <MethodOption icon={<Landmark />} label="SEPA (EUR)" selected={method === "sepa"} onClick={() => setMethod("sepa")} />
                  <MethodOption icon={<Landmark />} label="UK Faster Pay" selected={method === "faster_payments"} onClick={() => setMethod("faster_payments")} />
                  <MethodOption icon={<Landmark />} label="SPEI (MX)" selected={method === "spei"} onClick={() => setMethod("spei")} />
                  <MethodOption icon={<Landmark />} label="US / Intl Bank" selected={method === "bank_transfer"} onClick={() => setMethod("bank_transfer")} />
                </div>

                {/* Mobile money expands into its providers — MiniPay-style */}
                {MOMO_IDS.includes(method) && (
                  <div className="flex flex-wrap gap-2 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl">
                    {MOMO_PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setMethod(p.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold border transition-colors ${
                          method === p.id
                            ? "bg-[#4DC9EE] text-white border-[#4DC9EE]"
                            : "bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-[#4DC9EE]/60"
                        }`}
                      >
                        <span>{p.flag}</span> {p.label} <span className="opacity-70">({p.currency})</span>
                      </button>
                    ))}
                  </div>
                )}

                <Button onClick={() => setStep(1)} className="w-full h-12 rounded-xl font-bold bg-[#4DC9EE] hover:bg-[#2E8FD6]">
                  Continue with {METHOD_LABELS[method] ?? method} <ArrowRight size={16} className="ml-1.5" />
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {/* ── Step 2 · Details ── */}
        {step === 1 && (
          <Card className="border-0 shadow-lg rounded-2xl bg-white dark:bg-gray-900 overflow-hidden">
            <CardContent className="p-5">
              <form onSubmit={goToReview} className="space-y-5">
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setStep(0)} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 flex items-center justify-center text-gray-600 dark:text-gray-400 transition-colors" aria-label="Back to methods">
                    <ArrowLeft size={17} />
                  </button>
                  <div>
                    <h2 className="font-bold text-gray-900 dark:text-gray-100">{METHOD_LABELS[method] ?? method}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Enter the amount and where it's going.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Amount (USDC)</Label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none font-medium text-gray-500 dark:text-gray-400">$</div>
                    <Input
                      type="number" min="0" step="0.01"
                      className="pl-8 text-lg font-medium h-14"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {fieldSpec.name && (
                  <div className="space-y-2">
                    <Label>Account holder's name</Label>
                    <Input
                      type="text"
                      className="h-12"
                      placeholder="Name exactly as on the bank account"
                      value={holderName}
                      onChange={(e) => setHolderName(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>{recipientLabel}</Label>
                  <Input
                    type="text"
                    className="h-12"
                    placeholder={fieldSpec.placeholder}
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                    required
                  />
                </div>

                {fieldSpec.routing && (
                  <div className="space-y-2">
                    <Label>{fieldSpec.routing}</Label>
                    <Input
                      type="text"
                      className="h-12"
                      placeholder={fieldSpec.routingPlaceholder}
                      value={routing}
                      onChange={(e) => setRouting(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Lock size={13} /> Transaction PIN</Label>
                  <Input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={6}
                    className="h-12"
                    placeholder="••••"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  />
                  <p className="text-[11px] text-gray-400">Your 4–6 digit PIN authorizes the cash-out on the next step.</p>
                </div>

                {/* Live conversion preview */}
                <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100 dark:border-gray-800 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Exchange rate</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {fxData ? `1 USDC = ${fxData.rate} ${targetCurrency}` : "Loading…"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500 dark:text-gray-400">You receive (est.)</span>
                    <span className="font-bold text-green-600">
                      {fxData && numAmount > 0 ? `≈ ${youReceive.toFixed(2)} ${targetCurrency}` : `0.00 ${targetCurrency}`}
                    </span>
                  </div>
                </div>

                <Button type="submit" disabled={!fxData || !detailsValid} className="w-full h-12 rounded-xl font-bold bg-[#4DC9EE] hover:bg-[#2E8FD6]">
                  Review withdrawal <ArrowRight size={16} className="ml-1.5" />
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* ── Step 3 · Review & confirm ── */}
        {step === 2 && (
          <Card className="border-0 shadow-lg rounded-2xl bg-white dark:bg-gray-900 overflow-hidden">
            <CardContent className="p-5 space-y-5">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setStep(1)} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 flex items-center justify-center text-gray-600 dark:text-gray-400 transition-colors" aria-label="Back to details">
                  <ArrowLeft size={17} />
                </button>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100">Confirm your withdrawal</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Check everything — nothing moves until you confirm.</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                <ReviewRow label="Method" value={METHOD_LABELS[method] ?? method} />
                {fieldSpec.name && holderName.trim() && <ReviewRow label="Account holder" value={holderName.trim()} />}
                <ReviewRow label={recipientLabel} value={recipient} mono />
                {fieldSpec.routing && routing.trim() && <ReviewRow label={fieldSpec.routing} value={routing.trim()} mono />}
                <ReviewRow label="Amount" value={`${numAmount.toFixed(2)} USDC`} />
                <ReviewRow label="Fee" value={fxData ? `${fee.toFixed(2)} USDC` : "—"} />
                <ReviewRow label="Exchange rate" value={fxData ? `1 USDC = ${fxData.rate} ${targetCurrency}` : "—"} />
                <ReviewRow label="Estimated arrival" value={estimatedArrival} />
                <div className="flex justify-between items-center p-3.5 bg-gray-50 dark:bg-gray-800/60">
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm">You receive</span>
                  <span className="text-lg font-black text-green-600">≈ {youReceive.toFixed(2)} {targetCurrency}</span>
                </div>
              </div>

              <Button
                onClick={confirm}
                disabled={withdrawMutation.isPending}
                className="w-full h-14 rounded-xl text-lg font-bold bg-[#4DC9EE] hover:bg-[#2E8FD6]"
              >
                {withdrawMutation.isPending ? "Processing…" : `Confirm — send ${numAmount.toFixed(2)} USDC`}
              </Button>
              <p className="text-[11px] text-gray-400 text-center">Authorized with your transaction PIN · funds never move without it</p>
            </CardContent>
          </Card>
        )}

        {/* ── Step 4 · Done ── */}
        {step === 3 && (
          <Card className="border-0 shadow-lg rounded-2xl bg-white dark:bg-gray-900 text-center overflow-hidden">
            <CardContent className="p-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Withdrawal on its way 🎉</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {numAmount.toFixed(2)} USDC is being paid out to <strong>{recipient}</strong> via {METHOD_LABELS[method] ?? method}.
                {result?.localAmount ? ` They'll receive ≈ ${result.localAmount.toFixed(2)} ${targetCurrency}.` : ""}
                {" "}{result?.estimatedArrival ?? estimatedArrival}.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                <Button className="rounded-xl bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold" onClick={() => setLocation("/wallet")}>
                  View in transactions <ExternalLink size={14} className="ml-1.5" />
                </Button>
                <Button variant="outline" className="rounded-xl" onClick={() => { setStep(0); setResult(null); setAmount("100"); setRecipient(""); }}>
                  Make another withdrawal
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}

function ReviewRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between items-center gap-3 p-3.5">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-medium text-gray-900 dark:text-gray-100 text-right break-all ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

function MethodOption({ icon, label, selected, onClick }: {
  icon: React.ReactNode; label: string; selected: boolean; onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
        selected ? "border-[#4DC9EE] bg-[#4DC9EE]/5 text-[#1A2B4A] dark:text-gray-100" : "border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 text-gray-500 dark:text-gray-400"
      }`}
    >
      <div className="mb-2">{icon}</div>
      <span className="text-xs font-medium text-center">{label}</span>
      {selected && <CheckCircle2 size={14} className="absolute top-2 right-2 text-[#4DC9EE]" />}
    </button>
  );
}
