import { Layout } from "@/components/layout";
import {
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetMe, getGetMeQueryKey, useResendVerification, useStartKyc,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft, ChevronRight, ShieldCheck, MailCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { QuickActions } from "@/components/quick-actions";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const resendVerification = useResendVerification();
  const startKyc = useStartKyc();
  const { toast } = useToast();

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
      <Card className="bg-white shadow-lg border-0 rounded-2xl overflow-hidden">
        <CardContent className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-sm font-medium text-gray-500 mb-1">Total Balance</p>
              {isLoading ? (
                <Skeleton className="h-10 w-40" />
              ) : (
                <h2 className="text-4xl font-bold text-gray-900 tracking-tight">
                  {summary?.currency} {(summary?.walletBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
              <h4 className="text-sm font-semibold text-gray-900">Confirm your email</h4>
              <p className="text-xs text-gray-600 truncate">We sent a link to {me.email} — click it to secure your account</p>
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
              <h4 className="text-sm font-semibold text-gray-900">Verify your identity</h4>
              <p className="text-xs text-gray-600">Unlocks your US bank account, EU IBAN &amp; cash-outs</p>
            </div>
          </div>
          <button onClick={verifyIdentity} disabled={startKyc.isPending} className="text-sm font-medium text-primary hover:underline disabled:opacity-50">
            {startKyc.isPending ? "Starting…" : "Verify"}
          </button>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-semibold text-gray-900">Recent Transactions</h3>
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
                    <h4 className="font-medium text-gray-900">{tx.description}</h4>
                    <p className="text-xs text-gray-500">{new Date(tx.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className={`font-semibold ${tx.type === 'receive' || tx.type === 'recharge' ? 'text-green-600' : 'text-gray-900'}`}>
                  {tx.type === 'receive' || tx.type === 'recharge' ? '+' : '-'}{tx.currency} {tx.amount.toFixed(2)}
                </div>
              </div>
            ))
          )}
          
          {!isLoading && summary?.recentTransactions?.length === 0 && (
            <div className="text-center py-8 text-gray-500 text-sm">
              No recent transactions
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

