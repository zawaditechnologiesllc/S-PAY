import { Link } from "wouter";
import {
  useGetPayoutProviders, getGetPayoutProvidersQueryKey,
  useGetAdminPayrollStats, getGetAdminPayrollStatsQueryKey,
  useGetAdminEmployers, getGetAdminEmployersQueryKey, useSetEmployerStatus,
} from "@workspace/api-client-react";
import { AdminLayout } from "./layout";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, XCircle, Building2, TrendingUp, Users, Banknote, ArrowRight, BadgeCheck, Ban, Clock } from "lucide-react";

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

        {/* Employers: the KYB queue — verifying here unlocks live API keys */}
        <EmployersPanel />

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

// The employer KYB queue: registered companies with their verification state,
// balance and batch count. "Verify" is the action that unlocks LIVE API keys;
// "Suspend" instantly blocks every key the employer holds.
function EmployersPanel() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useGetAdminEmployers({ query: { queryKey: getGetAdminEmployersQueryKey() } });
  const setStatus = useSetEmployerStatus();
  const rows = data?.employers ?? [];

  const change = (employerId: string, companyName: string, status: "verified" | "rejected" | "suspended" | "pending") => {
    setStatus.mutate({ employerId, data: { status } }, {
      onSuccess: () => {
        toast({
          title: status === "verified" ? `${companyName} verified ✓` : `${companyName} → ${status}`,
          description: status === "verified" ? "They can now mint live API keys and run real payroll." : undefined,
        });
        refetch();
      },
      onError: (e) => toast({ title: "Could not update employer", description: (e as { data?: { message?: string } })?.data?.message ?? "Try again.", variant: "destructive" }),
    });
  };

  const badge: Record<string, string> = {
    verified: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    rejected: "bg-red-100 text-red-700",
    suspended: "bg-gray-200 text-gray-600",
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
      <div className="p-6 pb-4">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 text-sm uppercase tracking-wider">
          <span className="text-[#4DC9EE]"><Building2 size={16} /></span> Employers (KYB queue)
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Registered payroll companies. <strong>Verify</strong> unlocks live API keys (real money); <strong>Suspend</strong> blocks every key instantly. Sandbox keys work regardless.
        </p>
      </div>
      {isLoading ? (
        <p className="px-6 pb-6 text-sm text-gray-400">Loading employers…</p>
      ) : rows.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-gray-400">No employers registered yet — companies appear here the moment they register in the payroll console.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/60">
                {["Company", "Owner", "Status", "Balance", "Batches", "Registered", "Actions"].map((h) => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 dark:border-gray-800">
                  <td className="px-5 py-3">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{e.companyName}</span>
                    {e.websiteUrl && <span className="text-gray-400 text-xs block truncate max-w-[180px]">{e.websiteUrl}</span>}
                  </td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{e.ownerEmail ?? e.email}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${badge[e.status]}`}>
                      {e.status === "verified" ? <BadgeCheck size={12} /> : e.status === "pending" ? <Clock size={12} /> : <Ban size={12} />} {e.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">{e.balanceUsdc.toLocaleString()} USDC</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400">{e.batches}</td>
                  <td className="px-5 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString()}</td>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex gap-2">
                      {e.status !== "verified" && (
                        <button onClick={() => change(e.id, e.companyName, "verified")} disabled={setStatus.isPending}
                          className="text-xs font-bold text-green-600 hover:underline disabled:opacity-50">Verify</button>
                      )}
                      {e.status === "pending" && (
                        <button onClick={() => change(e.id, e.companyName, "rejected")} disabled={setStatus.isPending}
                          className="text-xs font-bold text-red-500 hover:underline disabled:opacity-50">Reject</button>
                      )}
                      {e.status !== "suspended" ? (
                        <button onClick={() => change(e.id, e.companyName, "suspended")} disabled={setStatus.isPending}
                          className="text-xs font-bold text-gray-400 hover:text-gray-600 hover:underline disabled:opacity-50">Suspend</button>
                      ) : (
                        <button onClick={() => change(e.id, e.companyName, "pending")} disabled={setStatus.isPending}
                          className="text-xs font-bold text-amber-600 hover:underline disabled:opacity-50">Reinstate</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
