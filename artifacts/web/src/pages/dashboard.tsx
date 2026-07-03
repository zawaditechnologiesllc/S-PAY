import { Layout } from "@/components/layout";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetMe, getGetMeQueryKey, useResendVerification, useStartKyc,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft, ChevronRight, ShieldCheck, MailCheck, Eye, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { QuickActions } from "@/components/quick-actions";
import { Landmark, Smartphone, Coins, CreditCard, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

const BALANCE_HIDDEN_KEY = "spay:balance-hidden";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  // The verification banners must react to state changes made OUTSIDE this tab
  // (the user clicks the email link in their mail app / finishes hosted KYC).
  // Refetch on focus + zero staleness for this read, so returning to the tab
  // clears "Confirm your email" the moment it's actually confirmed.
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), staleTime: 0, refetchOnWindowFocus: true } });
  const resendVerification = useResendVerification();
  const startKyc = useStartKyc();
  const { toast } = useToast();
  const [momoOpen, setMomoOpen] = useState(false);
  // Privacy shoulder-surf guard: remembered across sessions.
  const [hideBalance, setHideBalance] = useState(() => localStorage.getItem(BALANCE_HIDDEN_KEY) === "1");
  const toggleBalance = () => {
    setHideBalance((h) => {
      localStorage.setItem(BALANCE_HIDDEN_KEY, h ? "0" : "1");
      return !h;
    });
  };

  const resendEmail = () => {
    resendVerification.mutate(undefined, {
      onSuccess: (r) => toast({ title: "Confirmation email", description: (r as { message?: string })?.message ?? "Sent — check your inbox." }),
      onError: () => toast({ title: "Could not send", description: "Please try again.", variant: "destructive" }),
    });
  };

  const verifyIdentity = () => {
    startKyc.mutate(undefined, {
      onSuccess: (r) => {
        const data = r as { verificationUrl?: string; message?: string };
        if (data.verificationUrl) window.location.href = data.verificationUrl;
        else toast({ title: "Identity verification", description: data.message ?? "You're all set." });
      },
      onError: (err) => toast({
        title: "Identity verification",
        description: (err as { data?: { message?: string } })?.data?.message ?? "Verification is activating soon.",
      }),
    });
  };

  return (
    <Layout title="Dashboard">
      {/* Balance Card */}
      <Card className="bg-white dark:bg-gray-900 shadow-lg border-0 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Balance</p>
                <button
                  onClick={toggleBalance}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  aria-label={hideBalance ? "Show balance" : "Hide balance"}
                >
                  {hideBalance ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {isLoading ? (
                <Skeleton className="h-10 w-40" />
              ) : (
                <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
                  {hideBalance
                    ? "••••••"
                    : `${summary?.currency} ${(summary?.walletBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                </h2>
              )}
            </div>
            <div className="px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-semibold">
              USD Equivalent
            </div>
          </div>

          {/* Quick Actions — all four work (Alipay-style) */}
          <QuickActions />
        </CardContent>
      </Card>

      {/* Email confirmation banner — soft verification, disappears once confirmed */}
      {me && me.emailVerified === false && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-center justify-between shadow-sm gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
              <MailCheck size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Confirm your email</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400 truncate">We sent a link to {me.email} — click it to secure your account</p>
            </div>
          </div>
          <button onClick={resendEmail} disabled={resendVerification.isPending} className="text-sm font-medium text-primary hover:underline flex-shrink-0 disabled:opacity-50">
            {resendVerification.isPending ? "Sending…" : "Resend"}
          </button>
        </div>
      )}

      {/* Identity verification banner — hidden once approved */}
      {me?.kycStatus !== "approved" && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-center justify-between shadow-sm gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Verify your identity</h4>
              <p className="text-xs text-gray-600 dark:text-gray-400">Unlocks your US bank account, EU IBAN &amp; cash-outs</p>
            </div>
          </div>
          <button onClick={verifyIdentity} disabled={startKyc.isPending} className="text-sm font-medium text-primary hover:underline disabled:opacity-50">
            {startKyc.isPending ? "Starting…" : "Verify"}
          </button>
        </div>
      )}

      {/* Money services — banks & mobile money front and center, crypto kept simple */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Money</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ServiceTile href="/banking" icon={<Landmark size={20} />} label="Bank account" hint="US ACH · EU IBAN" color="#2E8FD6" />
          <ServiceTile onClick={() => setMomoOpen(true)} icon={<Smartphone size={20} />} label="Mobile money" hint="Top up & withdraw" color="#22C55E" />
          <ServiceTile href="/deposit?m=crypto" icon={<Coins size={20} />} label="Exchange deposit" hint="Binance, Bybit…" color="#F59E0B" />
          <ServiceTile href="/card" icon={<CreditCard size={20} />} label="Virtual card" hint="Spend online" color="#1A2B4A" />
        </div>
      </div>

      {/* Mobile money: both directions from one tile */}
      <MomoDialog open={momoOpen} onClose={() => setMomoOpen(false)} />

      {/* Recent Transactions */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Recent Transactions</h3>
          <Link href="/wallet" className="text-sm text-primary font-medium flex items-center">
            View All <ChevronRight size={16} />
          </Link>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))
          ) : (
            summary?.recentTransactions?.map(tx => (
              <div key={tx.id} className="flex items-center justify-between py-2 group">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white
                    ${tx.type === 'receive' || tx.type === 'recharge' ? 'bg-green-500' : 'bg-orange-500'}`}>
                    {tx.type === 'receive' || tx.type === 'recharge' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">{tx.description}</h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className={`font-semibold ${tx.type === 'receive' || tx.type === 'recharge' ? 'text-green-600' : 'text-gray-900 dark:text-gray-100'}`}>
                  {tx.type === 'receive' || tx.type === 'recharge' ? '+' : '-'}{tx.currency} {tx.amount.toFixed(2)}
                </div>
              </div>
            ))
          )}
          
          {!isLoading && summary?.recentTransactions?.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
              No recent transactions
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}


function ServiceTile({ href, onClick, icon, label, hint, color }: {
  href?: string; onClick?: () => void; icon: React.ReactNode; label: string; hint: string; color: string;
}) {
  const tile = (
      <div className="flex flex-col items-start gap-2 p-3 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-[#4DC9EE]/40 hover:shadow-sm transition-all cursor-pointer h-full">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: color }}>
          {icon}
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">{label}</p>
          <p className="text-[11px] text-gray-400">{hint}</p>
        </div>
      </div>
  );
  if (href) return <Link href={href}>{tile}</Link>;
  return <button onClick={onClick} className="text-left w-full h-full">{tile}</button>;
}

function MomoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLocation] = useLocation();
  const go = (path: string) => { onClose(); setLocation(path); };
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Mobile money</DialogTitle>
          <DialogDescription>M-Pesa, MTN MoMo, Airtel, GCash, Nequi & more.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => go("/deposit?m=momo")} className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-[#22C55E]/50 hover:shadow-sm transition-all">
            <div className="w-11 h-11 rounded-xl bg-[#22C55E] text-white flex items-center justify-center"><ArrowDownToLine size={20} /></div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Top up</span>
            <span className="text-[11px] text-gray-400">Money in</span>
          </button>
          <button onClick={() => go("/banking/withdraw?m=momo")} className="flex flex-col items-center gap-2 p-5 rounded-2xl border border-gray-100 dark:border-gray-800 hover:border-[#2E8FD6]/50 hover:shadow-sm transition-all">
            <div className="w-11 h-11 rounded-xl bg-[#2E8FD6] text-white flex items-center justify-center"><ArrowUpFromLine size={20} /></div>
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Withdraw</span>
            <span className="text-[11px] text-gray-400">Money out</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
