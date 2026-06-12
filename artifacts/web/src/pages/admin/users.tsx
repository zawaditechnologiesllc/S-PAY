import { useState } from "react";
import { AdminLayout } from "./layout";
import {
  useGetAdminUsers, getGetAdminUsersQueryKey,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, CheckCircle2, XCircle, Clock, Filter, Users } from "lucide-react";

const KYC_BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  rejected: "bg-red-100 text-red-700",
};

const KYC_ICON: Record<string, React.ReactNode> = {
  approved: <CheckCircle2 size={13} />,
  pending: <Clock size={13} />,
  rejected: <XCircle size={13} />,
};

// Acquisition channel badge colors — "jobs" signups are the big growth funnel
const SOURCE_BADGE: Record<string, string> = {
  jobs: "bg-sky-100 text-sky-700",
  landing: "bg-violet-100 text-violet-700",
  google: "bg-amber-100 text-amber-700",
  mobile: "bg-emerald-100 text-emerald-700",
  direct: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
};

export default function AdminUsers() {
  const [search, setSearch] = useState("");
  const [kycFilter, setKycFilter] = useState("all");

  const { data, isLoading } = useGetAdminUsers(
    { kycStatus: kycFilter !== "all" ? kycFilter : undefined },
    { query: { queryKey: getGetAdminUsersQueryKey() } }
  );

  const users = (data?.users ?? []).filter((u: any) =>
    !search || u.fullName?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AdminLayout title="User Management">
      <div className="space-y-6">

        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-[#4DC9EE]" />
              <span className="font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? "…" : `${data?.total ?? 0} users`}
              </span>
            </div>
            <div className="flex gap-3 flex-wrap">
              <div className="relative">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  className="pl-8 h-9 w-56 bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700 text-sm"
                  placeholder="Search users…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {["all", "pending", "approved", "rejected"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setKycFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize ${
                      kycFilter === s ? "bg-white dark:bg-gray-900 text-[#1A2B4A] shadow-sm" : "text-gray-500 dark:text-gray-400 hover:text-gray-700"
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
                  {["User", "Type", "Email", "Country", "KYC Status", "Source", "Balance", "Joined"].map((h) => (
                    <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50 dark:border-gray-800">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <td key={j} className="px-5 py-3.5"><Skeleton className="h-4 w-full" /></td>
                      ))}
                    </tr>
                  ))
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-16 text-gray-400">
                      <Filter size={32} className="mx-auto mb-3 opacity-40" />
                      No users match your filter.
                    </td>
                  </tr>
                ) : (
                  users.map((u: any) => (
                    <tr key={u.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#4DC9EE] to-[#1A2B4A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {u.fullName?.charAt(0) ?? "?"}
                          </div>
                          <span className="font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{u.fullName}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${
                          u.accountType === "business" ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
                        }`}>
                          {u.accountType === "business" ? `Business${u.businessName ? ` · ${u.businessName}` : ""}` : "Personal"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{u.email}</td>
                      <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{u.country ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${KYC_BADGE[u.kycStatus] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
                          {KYC_ICON[u.kycStatus]} {u.kycStatus}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full ${SOURCE_BADGE[(u.signupSource ?? "").split(":")[0]] ?? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"}`}>
                          {u.signupSource ?? "unknown"}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-semibold text-gray-900 dark:text-gray-100">${(u.walletBalance ?? 0).toFixed(2)}</td>
                      <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400 whitespace-nowrap">{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
