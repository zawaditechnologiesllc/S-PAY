import { Link } from "wouter";
import {
  useGetPayoutProviders, getGetPayoutProvidersQueryKey,
  useGetAdminPayrollStats, getGetAdminPayrollStatsQueryKey,
} from "@workspace/api-client-react";
import { AdminLayout } from "./layout";
import { CheckCircle2, XCircle, Building2, TrendingUp, Users, Banknote, ArrowRight } from "lucide-react";

const PROVIDER_CORRIDORS: Record<string, string> = {
  noah: "100+ countries",
  bridge: "USD/EUR",
  conduit: "LatAm / Africa / Asia",
  yellowcard: "Africa + mobile money",
  thunes: "140+ countries",
};

export default function AdminPayroll() {
  const { data: payout } = useGetPayoutProviders({ query: { queryKey: getGetPayoutProvidersQueryKey() } });
  const { data: stats } = useGetAdminPayrollStats({ query: { queryKey: getGetAdminPayrollStatsQueryKey() } });
  return (
    <AdminLayout title="Payroll Management">
      <div className="space-y-6 max-w-4xl">

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Payroll system status, configured employers, and batch processing metrics.
        </p>

        {/* Stats grid — live from /admin/payroll/stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Employers</p>
                <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">{stats?.totalEmployers ?? "…"}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Building2 size={20} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">{stats?.verifiedEmployers ?? 0} KYB verified</p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payroll Batches (30d)</p>
                <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">{stats?.batches30d ?? "…"}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-600">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {stats ? `${stats.totalBatches} all-time · ${stats.totalDisbursed.toLocaleString()} USDC disbursed` : "Submitted & completed"}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Workers Paid (30d)</p>
                <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">{stats?.workersPaid30d ?? "…"}</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600">
                <Users size={20} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {stats ? `${stats.workersOnboarded} auto-onboarded · ${stats.failedPayments} failed payments` : "Auto-onboarded + existing"}
            </p>
          </div>
        </div>

        {/* System Configuration */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="text-[#4DC9EE]"><Banknote size={16} /></span> Payout Provider Configuration
          </h3>

          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Configure preferred providers in Settings → Payout Providers. Each is live-switchable with no downtime.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(payout?.providers ?? []).map((p) => {
                const isPreferred = payout?.preferredProvider === p.key;
                return (
                  <div key={p.key} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.label}</p>
                        {isPreferred && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#4DC9EE] px-2 py-0.5 rounded-full">Preferred</span>
                        )}
                        {p.configured && p.enabled ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                            <CheckCircle2 size={10} /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                            <XCircle size={10} /> {p.configured ? "Disabled" : "Not configured"}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{PROVIDER_CORRIDORS[p.key] ?? ""}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{p.pricingNote}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed">
              <strong>Next steps:</strong> Go to <strong>Settings → Payout Providers</strong> and set environment variables on Render for each provider you want to use. Start with one (e.g., Noah or Bridge) and expand to others for corridor coverage.
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 text-sm uppercase tracking-wider">
            Quick Links
          </h3>
          <div className="space-y-2">
            <Link href="/admin/settings" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Configure Payout Providers</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Set env keys, choose the preferred provider, toggle rails on/off</p>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </Link>

            <Link href="/admin/settings" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Set Payroll Fees</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Flat + percent for batch payroll commissions</p>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </Link>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
