import { Layout } from "@/components/layout";
import { useGetDashboardSummary, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownLeft, ScanLine, Send, ArrowDownToLine, ArrowUpFromLine, ChevronRight, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading } = useGetDashboardSummary({ query: { queryKey: getGetDashboardSummaryQueryKey() } });

  return (
    <Layout title="Wallet">
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

          {/* Quick Actions */}
          <div className="grid grid-cols-4 gap-4 mt-8 pt-6 border-t border-gray-100">
            <QuickAction icon={<ScanLine size={22} />} label="Scan" bgColor="#1677FF" />
            <QuickAction icon={<Send size={22} />} label="Transfer" bgColor="#FF6900" />
            <QuickAction icon={<ArrowDownToLine size={22} />} label="Recharge" bgColor="#00B578" />
            <QuickAction icon={<ArrowUpFromLine size={22} />} label="Withdraw" bgColor="#7B61FF" />
          </div>
        </CardContent>
      </Card>

      {/* Security Banner */}
      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Verify your identity</h4>
            <p className="text-xs text-gray-600">Complete KYC to unlock full limits</p>
          </div>
        </div>
        <Link href="/profile" className="text-sm font-medium text-primary hover:underline">Verify</Link>
      </div>

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

function QuickAction({ icon, label, bgColor }: { icon: React.ReactNode, label: string, bgColor: string }) {
  return (
    <div className="flex flex-col items-center gap-2 cursor-pointer group">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform duration-150"
        style={{ backgroundColor: bgColor }}
      >
        {icon}
      </div>
      <span className="text-xs font-medium text-gray-700">{label}</span>
    </div>
  );
}