import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import {
  useGetWalletBalance, getGetWalletBalanceQueryKey, useSendMoney,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, AlertTriangle, CheckCircle2, ExternalLink, ShieldCheck,
} from "lucide-react";

// MiniPay-style guided exchange withdrawal: pick the destination, follow
// exchange-specific steps to find the Celo deposit address, paste it,
// review, confirm. The transfer itself is the on-chain USDC/USDT send.
const EXCHANGES = [
  {
    id: "binance", name: "Binance", emoji: "🟡",
    steps: [
      "Open Binance → tap Deposit",
      "Choose the coin: USDT or USDC",
      "Select network: CELO — this is critical",
      "Copy the deposit address shown and paste it below",
    ],
  },
  {
    id: "bybit", name: "Bybit", emoji: "⚫",
    steps: [
      "Open Bybit → Assets → Deposit",
      "Choose USDT or USDC",
      "Select network: CELO",
      "Copy the deposit address and paste it below",
    ],
  },
  {
    id: "okx", name: "OKX", emoji: "⚪",
    steps: [
      "Open OKX → Assets → Deposit",
      "Choose USDT or USDC",
      "Select network: Celo",
      "Copy the deposit address and paste it below",
    ],
  },
  {
    id: "other", name: "Other wallet / exchange", emoji: "🌐",
    steps: [
      "Open the destination wallet or exchange",
      "Find the deposit address for USDT or USDC",
      "Confirm it supports the CELO network — if Celo isn't listed, STOP",
      "Copy the address and paste it below",
    ],
  },
];

export default function ExchangeWithdraw() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: balance, refetch: refetchBalance } = useGetWalletBalance({ query: { queryKey: getGetWalletBalanceQueryKey() } });
  const sendMoney = useSendMoney();

  const [exchange, setExchange] = useState<typeof EXCHANGES[number] | null>(null);
  const [token, setToken] = useState<"USDC" | "USDT">("USDC");
  const [address, setAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmedNetwork, setConfirmedNetwork] = useState(false);
  const [result, setResult] = useState<{ txHash?: string } | null>(null);

  const available = token === "USDT" ? balance?.usdtBalance ?? 0 : balance?.usdcBalance ?? 0;
  const parsedAmount = parseFloat(amount);
  const addressValid = /^0x[0-9a-fA-F]{40}$/.test(address.trim());
  const isOwnAddress = !!balance?.celoAddress && address.trim().toLowerCase() === balance.celoAddress.toLowerCase();
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= available;
  const canSubmit = addressValid && !isOwnAddress && amountValid && confirmedNetwork && !sendMoney.isPending;

  const handleConfirm = () => {
    sendMoney.mutate(
      {
        data: {
          amount: parsedAmount,
          currency: token,
          recipientAddress: address.trim(),
          note: `Withdrawal to ${exchange?.name ?? "exchange"}`,
        },
      },
      {
        onSuccess: (tx: any) => {
          setResult({ txHash: tx?.txHash });
          refetchBalance();
        },
        onError: (e: any) => {
          toast({
            title: "Withdrawal not sent",
            description: e?.message ?? "Your funds were not moved. Please try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  return (
    <Layout title="Withdraw to Exchange">
      <div className="space-y-5 mt-4 max-w-xl mx-auto">

        <Link href="/banking/withdraw">
          <span className="inline-flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium cursor-pointer">
            <ArrowLeft size={15} /> Other withdrawal methods
          </span>
        </Link>

        {/* ── Success state ── */}
        {result ? (
          <Card className="border-0 shadow-lg rounded-2xl overflow-hidden bg-white dark:bg-gray-900 text-center">
            <CardContent className="p-8 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Withdrawal sent</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {amount} {token} is on its way to {exchange?.name}. Celo transfers settle in ~5 seconds;
                the exchange may take a few minutes to credit your account.
              </p>
              {result.txHash && (
                <a
                  href={`https://celoscan.io/tx/${result.txHash}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#4DC9EE] font-semibold hover:underline"
                >
                  View on CeloScan <ExternalLink size={13} />
                </a>
              )}
              <div className="pt-2">
                <Button className="rounded-xl" onClick={() => setLocation("/wallet")}>Back to Wallet</Button>
              </div>
            </CardContent>
          </Card>
        ) : !exchange ? (
          /* ── Step 1: pick destination ── */
          <>
            <Card className="border-0 shadow-md rounded-2xl bg-white dark:bg-gray-900">
              <CardContent className="p-5">
                <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Where are you withdrawing to?</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                  Your USDC/USDT moves on the Celo network — fast (~5s) and nearly free.
                </p>
                <div className="space-y-2">
                  {EXCHANGES.map((ex) => (
                    <button
                      key={ex.id}
                      onClick={() => setExchange(ex)}
                      className="w-full flex items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-[#4DC9EE] hover:bg-[#4DC9EE]/5 transition-all text-left"
                    >
                      <span className="flex items-center gap-3 font-semibold text-gray-900 dark:text-gray-100 text-sm">
                        <span className="text-xl">{ex.emoji}</span> {ex.name}
                      </span>
                      <span className="text-gray-400 text-sm">→</span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
            <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-4">
              <ShieldCheck size={16} className="text-[#2E8FD6] flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">
                Bank or mobile-money cash-out instead? Use{" "}
                <Link href="/banking/withdraw"><span className="font-semibold underline cursor-pointer">M-Pesa, MoMo, PIX &amp; bank withdrawals</span></Link>.
              </p>
            </div>
          </>
        ) : (
          /* ── Step 2: guided send ── */
          <Card className="border-0 shadow-md rounded-2xl bg-white dark:bg-gray-900">
            <CardContent className="p-5 space-y-5">
              <button onClick={() => { setExchange(null); setConfirmedNetwork(false); }} className="text-xs text-gray-400 hover:text-gray-600">
                ← Choose a different destination
              </button>

              <div className="flex items-center gap-3">
                <span className="text-2xl">{exchange.emoji}</span>
                <div>
                  <h2 className="font-bold text-gray-900 dark:text-gray-100">Withdraw to {exchange.name}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Follow the steps exactly — this keeps your funds safe.</p>
                </div>
              </div>

              {/* Exchange-specific steps */}
              <ol className="space-y-2">
                {exchange.steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-300">
                    <span className="w-5 h-5 rounded-full bg-[#4DC9EE]/10 text-[#4DC9EE] text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                    {step}
                  </li>
                ))}
              </ol>

              {/* Network warning — the single most important safety check */}
              <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Network must be CELO.</strong> Sending to an address on a different network
                  (Ethereum/ERC-20, Tron/TRC-20, BNB…) will permanently lose your funds.
                </p>
              </div>

              {/* Token */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 dark:text-gray-300">Token</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["USDC", "USDT"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setToken(t)}
                      className={`rounded-xl border p-3 text-sm font-bold transition-all ${
                        token === t ? "border-[#4DC9EE] bg-[#4DC9EE]/5 text-[#1A2B4A]" : "border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 hover:border-gray-300"
                      }`}
                    >
                      {t}
                      <span className="block text-[11px] font-medium text-gray-400 mt-0.5">
                        Balance: {(t === "USDT" ? balance?.usdtBalance ?? 0 : balance?.usdcBalance ?? 0).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <Label htmlFor="exAddress" className="text-sm font-medium text-gray-700 dark:text-gray-300">{exchange.name} deposit address (Celo)</Label>
                <Input
                  id="exAddress"
                  placeholder="0x…"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`rounded-xl h-11 font-mono text-sm ${
                    address && !addressValid ? "border-red-300" : "border-gray-200 dark:border-gray-700 focus:border-[#4DC9EE]"
                  }`}
                />
                {address && !addressValid && (
                  <p className="text-[11px] text-red-500 font-medium">That doesn't look like a valid Celo (0x…) address.</p>
                )}
                {isOwnAddress && (
                  <p className="text-[11px] text-red-500 font-medium">That's your own S-PAY address — paste the exchange's deposit address instead.</p>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="exAmount" className="text-sm font-medium text-gray-700 dark:text-gray-300">Amount ({token})</Label>
                  <button onClick={() => setAmount(String(available))} className="text-[11px] font-bold text-[#4DC9EE] hover:underline">
                    Max {available.toFixed(2)}
                  </button>
                </div>
                <Input
                  id="exAmount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="rounded-xl h-11 border-gray-200 dark:border-gray-700 focus:border-[#4DC9EE]"
                />
                {amount && !amountValid && (
                  <p className="text-[11px] text-red-500 font-medium">Enter an amount up to your {token} balance.</p>
                )}
              </div>

              {/* Safety confirmation */}
              <label className="flex items-start gap-3 cursor-pointer bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3.5 border border-gray-100 dark:border-gray-800">
                <input
                  type="checkbox"
                  checked={confirmedNetwork}
                  onChange={(e) => setConfirmedNetwork(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#4DC9EE] flex-shrink-0"
                />
                <span className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                  I selected the <strong>CELO network</strong> on {exchange.name} and this address is the
                  Celo deposit address for {token}.
                </span>
              </label>

              <Button
                onClick={handleConfirm}
                disabled={!canSubmit}
                className="w-full h-12 rounded-xl bg-[#4DC9EE] hover:bg-[#1A2B4A] text-white font-bold"
              >
                {sendMoney.isPending
                  ? "Sending…"
                  : amountValid
                    ? `Withdraw ${parsedAmount.toFixed(2)} ${token} to ${exchange.name}`
                    : "Withdraw"}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
