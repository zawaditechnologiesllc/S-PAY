import { useState } from "react";
import { AdminLayout } from "./layout";
import { useGetAdminTransactions, getGetAdminTransactionsQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ArrowDownLeft, ArrowUpRight, Search, ArrowLeftRight } from "lucide-react";

const TYPE_COLOR: Record<string, string> = {
  receive: "text-green-600",
  send: "text-red-500",
  recharge: "text-green-600",
  payment: "text-orange-500",
  withdraw: "text-purple-600",
};

export default function AdminTransactions() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const { data, isLoading } = useGetAdminTransactions(
    { type: typeFilter !== "all" ? typeFilter : undefined },
    { query: { queryKey: getGetAdminTransactionsQueryKey() } }
  );

  const txs = (data?.transactions ?? []).filter((t: any) =>
    !search || t.description?.toLowerCase().includes(search.toLowerCase()) || t.counterparty?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="Transactions">
      <div className="space-y-6">

        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowLeftRight size={18} className="text-[#4DC9EE]" />
              <span className="font-bold text-gray-900 dark:text-gray-100">{isLoading ? "…" : `${data?.total ?? 0} transactions`}</span>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-8 h-9 w-56 bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-sm"
                  placeholder="Search…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {["all", "receive", "send", "withdraw", "payment"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setTypeFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                      typeFilter === s ? "bg-white dark:bg-gray-900 text-[#1A2B4A] shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                  {["Type", "Description", "Counterparty", "Amount", "Currency", "Status", "Date"].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 10 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : txs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-gray-400">No transactions found.</td>
                  </tr>
                ) : (
                  txs.map((t: any) => {
                    const isIn = t.type === "receive" || t.type === "recharge";
                    return (
                      <tr key={t.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isIn ? "bg-green-100" : "bg-red-50"}`}>
                            {isIn ? <ArrowDownLeft size={14} className="text-green-600" /> : <ArrowUpRight size={14} className="text-red-500" />}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-gray-100">{t.description}</td>
                        <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{t.counterparty ?? "—"}</td>
                        <td className={`px-5 py-3.5 font-semibold ${TYPE_COLOR[t.type] ?? "text-gray-900 dark:text-gray-100"}`}>
                          {isIn ? "+" : "-"}{Math.abs(t.amount).toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{t.currency}</td>
                        <td className="px-5 py-3.5">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${
                            t.status === "completed" ? "bg-green-100 text-green-700" :
                            t.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>{t.status}</span>
                        </td>
                        <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(t.createdAt).toLocaleDateString()}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
