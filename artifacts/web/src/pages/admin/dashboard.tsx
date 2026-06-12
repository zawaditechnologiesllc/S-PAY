import { AdminLayout } from "./layout";
import { useGetAdminStats, useGetAdminUsers, getGetAdminStatsQueryKey, getGetAdminUsersQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, ArrowLeftRight, DollarSign, Clock,
  ShieldCheck, TrendingUp, AlertCircle, CheckCircle2, Megaphone,
} from "lucide-react";

// Acquisition channel colors — jobs board is the primary signup funnel
const SOURCE_COLORS: Record<string, string> = {
  jobs: "#4DC9EE",
  landing: "#8B5CF6",
  google: "#F59E0B",
  mobile: "#22C55E",
  direct: "#94A3B8",
  unknown: "#CBD5E1",
};

function StatCard({
  icon, label, value, sub, color, loading,
}: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color: string; loading?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: color }}>
          {icon}
        </div>
        {sub && <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-1 rounded-full">{sub}</span>}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-24 mb-1" />
      ) : (
        <div className="text-3xl font-black text-gray-900 dark:text-gray-100 mb-1">{value}</div>
      )}
      <div className="text-sm text-gray-500 dark:text-gray-400">{label}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetAdminStats({ query: { queryKey: getGetAdminStatsQueryKey() } });
  const { data: usersData, isLoading: usersLoading } = useGetAdminUsers({}, { query: { queryKey: getGetAdminUsersQueryKey() } });

  const recentUsers = usersData?.users?.slice(0, 5) ?? [];

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-8">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={<Users size={22} />} label="Total Users" value={stats?.totalUsers?.toLocaleString() ?? "—"} sub={stats ? `${(stats.businessUsers ?? 0).toLocaleString()} business · ${(stats.activeUsers ?? 0).toLocaleString()} in 30d` : undefined} color="#1677FF" loading={statsLoading} />
          <StatCard icon={<DollarSign size={22} />} label="Total Volume" value={`$${(stats?.totalTransactionVolume ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`} sub="USDC" color="#00B578" loading={statsLoading} />
          <StatCard icon={<ArrowLeftRight size={22} />} label="Transactions Today" value={stats?.transactionsToday ?? "—"} color="#FF6900" loading={statsLoading} />
          <StatCard icon={<Clock size={22} />} label="Pending KYC" value={stats?.pendingKyc ?? "—"} color="#FF4D4F" loading={statsLoading} />
        </div>

        {/* Signups by source — shows how well the free jobs board converts */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
            <Megaphone size={18} className="text-[#4DC9EE]" /> Signups by Source
          </h3>
          <p className="text-xs text-gray-400 mb-5">Where new accounts come from — the jobs board is the free acquisition funnel.</p>
          {statsLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            (() => {
              const entries = Object.entries(stats?.signupsBySource ?? {}).sort((a, b) => b[1] - a[1]);
              const total = entries.reduce((sum, [, n]) => sum + n, 0);
              if (total === 0) return <p className="text-sm text-gray-400">No signups yet.</p>;
              return (
                <div className="space-y-3">
                  <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {entries.map(([source, n]) => (
                      <div key={source} title={`${source}: ${n}`} style={{ width: `${(n / total) * 100}%`, backgroundColor: SOURCE_COLORS[source] ?? "#CBD5E1" }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    {entries.map(([source, n]) => (
                      <div key={source} className="flex items-center gap-2 text-sm">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source] ?? "#CBD5E1" }} />
                        <span className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{source}</span>
                        <span className="text-gray-500 dark:text-gray-400">{n.toLocaleString()} ({Math.round((n / total) * 100)}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* KYC Summary */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2"><ShieldCheck size={18} className="text-[#4DC9EE]" /> KYC Overview</h3>
            <div className="space-y-4">
              {[
                { label: "Approved", value: stats?.approvedKyc ?? 0, total: stats?.totalUsers ?? 1, color: "#00B578", icon: <CheckCircle2 size={16} /> },
                { label: "Pending", value: stats?.pendingKyc ?? 0, total: stats?.totalUsers ?? 1, color: "#FF6900", icon: <Clock size={16} /> },
                { label: "Rejected", value: stats?.rejectedKyc ?? 0, total: stats?.totalUsers ?? 1, color: "#FF4D4F", icon: <AlertCircle size={16} /> },
              ].map((k) => (
                <div key={k.label}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-sm font-medium" style={{ color: k.color }}>{k.icon} {k.label}</div>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{statsLoading ? "…" : k.value.toLocaleString()}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.round((k.value / Math.max(k.total, 1)) * 100)}%`, backgroundColor: k.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Users */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Users size={18} className="text-[#4DC9EE]" /> Recent Users</h3>
              <a href="/admin/users" className="text-sm text-[#4DC9EE] font-medium hover:underline">View all →</a>
            </div>
            {usersLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
            ) : (
              <div className="space-y-2">
                {recentUsers.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4DC9EE] to-[#1A2B4A] flex items-center justify-center text-white text-sm font-bold">
                        {u.fullName?.charAt(0) ?? "?"}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">{u.fullName}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{u.email}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{u.country ?? "—"}</span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        u.kycStatus === "approved" ? "bg-green-100 text-green-700" :
                        u.kycStatus === "pending" ? "bg-yellow-100 text-yellow-700" :
                        "bg-red-100 text-red-700"
                      }`}>{u.kycStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Volume trend placeholder */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-[#4DC9EE]" /> Monthly Volume (USDC)</h3>
          <div className="flex items-end gap-2 h-32">
            {[40, 65, 50, 80, 60, 95, 75, 110, 90, 130, 115, 150].map((h, i) => (
              <div key={i} className="flex-1 rounded-t-lg transition-all hover:opacity-80 cursor-default" style={{ height: `${(h / 150) * 100}%`, backgroundColor: i === 11 ? "#4DC9EE" : "#E8F7FC" }} />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            {["Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May"].map((m) => (
              <span key={m}>{m}</span>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
