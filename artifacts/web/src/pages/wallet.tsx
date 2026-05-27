import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetWalletTransactions, getGetWalletTransactionsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, ArrowDownLeft, SlidersHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Wallet() {
  const [filter, setFilter] = useState<string>("all");
  const { data, isLoading } = useGetWalletTransactions(
    {}, 
    { query: { queryKey: getGetWalletTransactionsQueryKey() } }
  );

  const transactions = data?.transactions || [];
  
  const filteredTransactions = filter === "all" 
    ? transactions 
    : transactions.filter(t => t.type === filter);

  return (
    <Layout title="Transaction History">
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden bg-white mt-4">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <SlidersHorizontal size={16} /> Filter
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[180px] bg-white">
              <SelectValue placeholder="All Transactions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              <SelectItem value="receive">Received</SelectItem>
              <SelectItem value="send">Sent</SelectItem>
              <SelectItem value="withdraw">Withdrawn</SelectItem>
              <SelectItem value="recharge">Recharged</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 py-2 border-b last:border-0">
                  <Skeleton className="w-12 h-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : filteredTransactions.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <SlidersHorizontal className="text-gray-400" size={24} />
              </div>
              <h3 className="font-medium text-gray-900 mb-1">No transactions found</h3>
              <p className="text-sm">Try changing your filters.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredTransactions.map((tx) => {
                const isPositive = tx.type === 'receive' || tx.type === 'recharge';
                return (
                  <div key={tx.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white
                        ${isPositive ? 'bg-green-500' : 'bg-orange-500'}`}>
                        {isPositive ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900">{tx.description}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">
                            {new Date(tx.createdAt).toLocaleDateString()}
                          </span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium
                            ${tx.status === 'completed' ? 'bg-green-100 text-green-700' : 
                              tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 
                              'bg-red-100 text-red-700'}`}>
                            {tx.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`font-semibold ${isPositive ? 'text-green-600' : 'text-gray-900'}`}>
                        {isPositive ? '+' : '-'}{tx.currency} {tx.amount.toFixed(2)}
                      </div>
                      {tx.counterparty && (
                        <div className="text-xs text-gray-500 mt-1">{tx.counterparty}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}