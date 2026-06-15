import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { 
  useGetExchangeRates, getGetExchangeRatesQueryKey,
  useInitiateWithdraw
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { MoveRight, Landmark, Smartphone, BadgeCheck, CheckCircle2 } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function Withdraw() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [amount, setAmount] = useState<string>("100");
  const MOMO_PROVIDERS = [
    { id: "mpesa", flag: "🇰🇪", label: "M-Pesa", currency: "KES" },
    { id: "mtn_momo", flag: "🇺🇬", label: "MTN MoMo", currency: "UGX" },
    { id: "airtel", flag: "🇳🇬", label: "Airtel / NG Bank", currency: "NGN" },
    { id: "gcash", flag: "🇵🇭", label: "GCash", currency: "PHP" },
    { id: "nequi", flag: "🇨🇴", label: "Nequi", currency: "COP" },
  ] as const;
  const MOMO_IDS = MOMO_PROVIDERS.map((p) => p.id as string);
  // /banking/withdraw?m=momo (dashboard tile) lands with mobile money open
  const [method, setMethod] = useState<string>("mpesa");
  const [momoExpanded, setMomoExpanded] = useState(true);
  const [targetCurrency, setTargetCurrency] = useState("KES");
  const [recipient, setRecipient] = useState("");
  const [pin, setPin] = useState("");

  const numAmount = parseFloat(amount) || 0;

  // Auto-select currency based on method
  useEffect(() => {
    const currency: Record<string, string> = {
      mpesa: "KES", mtn_momo: "UGX", airtel: "NGN", gcash: "PHP", gopay: "IDR",
      nequi: "COP", pix: "BRL", spei: "MXN", sepa: "EUR", faster_payments: "GBP", bank_transfer: "USD",
    };
    setTargetCurrency(currency[method] ?? "USD");
  }, [method]);

  const { data: fxData } = useGetExchangeRates(
    { source: "USDC", target: targetCurrency },
    { query: { queryKey: getGetExchangeRatesQueryKey({ source: "USDC", target: targetCurrency }) } }
  );

  const withdrawMutation = useInitiateWithdraw();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (numAmount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    if (!recipient) {
      toast({ title: "Recipient details required", variant: "destructive" });
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      toast({ title: "Enter your PIN", description: "Your 4–6 digit transaction PIN authorizes the cash-out.", variant: "destructive" });
      return;
    }

    const payload: any = {
      amount: numAmount,
      sourceCurrency: "USDC",
      targetCurrency,
      method,
      pin,
    };

    const phoneMethods = ["mpesa", "mtn_momo", "airtel", "gcash", "nequi"];
    if (phoneMethods.includes(method)) payload.recipientPhone = recipient;
    else if (method === "sepa") payload.recipientIban = recipient;
    else if (method === "pix") payload.recipientTaxId = recipient;
    else payload.recipientAccount = recipient; // bank account / CLABE / sort code

    withdrawMutation.mutate({ data: payload }, {
      onSuccess: () => {
        toast({
          title: "Withdrawal Initiated",
          description: "Your funds are on the way.",
        });
        setLocation("/wallet");
      },
      onError: (err) => {
        const data = (err as { data?: { error?: string; message?: string } })?.data;
        setPin("");
        if (data?.error === "pin_not_set") {
          toast({ title: "Set up your PIN", description: "Cashing out needs a transaction PIN. Set it in Security." });
          setLocation("/security");
          return;
        }
        toast({
          title: "Error",
          description: data?.message || (err as Error).message || "Failed to initiate withdrawal",
          variant: "destructive",
        });
      }
    });
  };

  const fastMethods = ["mpesa", "mtn_momo", "airtel", "gcash", "pix", "nequi"];
  const estimatedArrival = fastMethods.includes(method) ? "Within minutes" : method === "spei" ? "Same day" : "1-2 Business Days";

  return (
    <Layout back title="Withdraw Funds">
      {/* Crypto exchange route — MiniPay-style guided flow */}
      <Link href="/wallet/exchange">
        <div className="max-w-xl mx-auto mt-4 bg-gradient-to-r from-[#1A2B4A] to-[#2E8FD6] rounded-2xl p-4 flex items-center justify-between cursor-pointer hover:opacity-95 transition-opacity shadow-lg">
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

      <Card className="max-w-xl mx-auto border-0 shadow-lg rounded-2xl bg-white dark:bg-gray-900 mt-4 overflow-hidden">
        <CardHeader className="bg-gray-50 dark:bg-gray-800/60 border-b pb-4">
          <CardTitle className="text-lg text-gray-800 dark:text-gray-200">Send to Local Bank</CardTitle>
        </CardHeader>
        
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {/* Method Selection */}
            <div className="space-y-3">
              <Label>Withdrawal Method</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <MethodOption id="momo" icon={<Smartphone />} label="Mobile money" selected={MOMO_IDS.includes(method)} onClick={() => { setMethod("mpesa"); setMomoExpanded(true); }} />
                <MethodOption id="pix" icon={<MoveRight />} label="PIX (Brazil)" selected={method === "pix"} onClick={() => setMethod("pix")} />
                <MethodOption id="sepa" icon={<Landmark />} label="SEPA (EUR)" selected={method === "sepa"} onClick={() => setMethod("sepa")} />
                <MethodOption id="faster_payments" icon={<Landmark />} label="UK Faster Pay" selected={method === "faster_payments"} onClick={() => setMethod("faster_payments")} />
                <MethodOption id="spei" icon={<Landmark />} label="SPEI (MX)" selected={method === "spei"} onClick={() => setMethod("spei")} />
                <MethodOption id="bank_transfer" icon={<Landmark />} label="US / Intl Bank" selected={method === "bank_transfer"} onClick={() => setMethod("bank_transfer")} />
              </div>

              {/* Mobile money expands into its providers — MiniPay-style */}
              {MOMO_IDS.includes(method) && momoExpanded && (
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
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label>Amount (USDC)</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none font-medium text-gray-500 dark:text-gray-400">
                  $
                </div>
                <Input 
                  type="number" 
                  min="0" step="0.01"
                  className="pl-8 text-lg font-medium h-14"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Recipient Details based on method */}
            <div className="space-y-2">
              <Label>
                {method === "mpesa" ? "Phone Number" : 
                 method === "sepa" ? "IBAN" : 
                 method === "pix" ? "CPF/CNPJ (Tax ID)" : "Account Number"}
              </Label>
              <Input 
                type="text" 
                className="h-12"
                placeholder={method === "mpesa" ? "+254..." : ""}
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                required
              />
            </div>

            {/* Transaction PIN — same second factor as transfers */}
            <div className="space-y-2">
              <Label>Transaction PIN</Label>
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
            </div>

            {/* Rate Preview */}
            <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-4 border border-gray-100 dark:border-gray-800 space-y-3">
               <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                 Conversion Preview
               </h4>
               
               <div className="flex justify-between text-sm">
                 <span className="text-gray-500 dark:text-gray-400">Exchange Rate</span>
                 <span className="font-medium text-gray-900 dark:text-gray-100">
                   {fxData ? `1 USDC = ${fxData.rate} ${targetCurrency}` : "Loading..."}
                 </span>
               </div>
               
               <div className="flex justify-between text-sm">
                 <span className="text-gray-500 dark:text-gray-400">Network Fee</span>
                 <span className="font-medium text-gray-900 dark:text-gray-100">
                   {fxData ? `${fxData.fee} USDC` : "-"}
                 </span>
               </div>

               <div className="flex justify-between text-sm">
                 <span className="text-gray-500 dark:text-gray-400">Estimated Arrival</span>
                 <span className="font-medium text-gray-900 dark:text-gray-100 text-right">{estimatedArrival}</span>
               </div>

               <div className="pt-3 border-t border-gray-200 dark:border-gray-700 flex justify-between items-center">
                 <span className="font-semibold text-gray-900 dark:text-gray-100">You Receive</span>
                 <span className="text-lg font-bold text-green-600">
                   {fxData && numAmount > 0 
                     ? `${(numAmount * fxData.rate).toFixed(2)} ${targetCurrency}` 
                     : `0.00 ${targetCurrency}`}
                 </span>
               </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-14 rounded-xl text-lg font-semibold"
              disabled={withdrawMutation.isPending || !fxData || numAmount <= 0}
            >
              {withdrawMutation.isPending ? "Processing..." : "Confirm Withdrawal"}
            </Button>

          </form>
        </CardContent>
      </Card>
    </Layout>
  );
}

function MethodOption({ id, icon, label, selected, onClick }: any) {
  return (
    <div 
      onClick={onClick}
      className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
        selected ? 'border-primary bg-primary/5 text-primary' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-gray-200 text-gray-500 dark:text-gray-400'
      }`}
    >
      <div className="mb-2">{icon}</div>
      <span className="text-xs font-medium text-center">{label}</span>
      {selected && <CheckCircle2 size={14} className="absolute top-2 right-2 text-primary" />}
    </div>
  );
}