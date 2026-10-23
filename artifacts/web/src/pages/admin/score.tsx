import { useState } from "react";
import { Link } from "wouter";
import { useGetAdminScoreStats, getGetAdminScoreStatsQueryKey, type AdminScoreBandCount } from "@workspace/api-client-react";
import { Gauge, Users, Handshake, Database, ShieldCheck, PauseCircle, History } from "lucide-react";
import { AdminLayout } from "./layout";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPeriod } from "@/components/score-history-chart";
import { bandVar } from "@/components/score-gauge";

const ACTION_LABEL: Record<string, string> = {
  score_enabled: "Turned score on",
  score_disabled: "Turned score off",
  sharing_granted: "Opted in to partner sharing",
  sharing_revoked: "Opted out of partner sharing",
  history_deleted: "Deleted score history",
  shares_revoked: "Revoked share links",
};

const card = "bg-white dark:bg-gray-900 rounded-2xl p-6 border border-gray-100 dark:border-gray-800 shadow-sm";

function Tile({ label, value, sub, loading }: { label: string; value: string; sub?: string; loading?: boolean }) {
  return (
    <div className={card}>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{label}</p>
      {loading ? <Skeleton className="h-8 w-20" /> : <p className="text-3xl font-black text-gray-900 dark:text-gray-100">{value}</p>}
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

/** Members per band — one series (total) as horizontal bars; the split is in the hover and the table. */
function Distribution({ rows }: { rows: AdminScoreBandCount[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(1, ...rows.map((r) => r.personal + r.business));
  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const total = r.personal + r.business;
        return (
          <div
            key={r.band}
            className="grid grid-cols-[88px_1fr] items-center gap-3 relative"
            onPointerEnter={() => setHover(r.band)}
            onPointerLeave={() => setHover(null)}
            onFocus={() => setHover(r.band)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            aria-label={`${r.label}: ${total} members (${r.personal} personal, ${r.business} business)`}
          >
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300 inline-flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bandVar(r.band) }} />{r.label}
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-5 rounded-r-[4px] transition-opacity" style={{ width: `${Math.max(total ? 2 : 0, (total / max) * 85)}%`, backgroundColor: bandVar(r.band), opacity: hover && hover !== r.band ? 0.55 : 1 }} />
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100" style={{ fontVariantNumeric: "tabular-nums" }}>{total.toLocaleString()}</span>
            </div>
            {hover === r.band && (
              <div className="absolute right-0 -top-9 z-10 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 shadow-md px-3 py-1.5 text-xs whitespace-nowrap">
                <strong className="text-gray-900 dark:text-gray-50">{r.personal.toLocaleString()}</strong> <span className="text-gray-500">personal</span> · <strong className="text-gray-900 dark:text-gray-50">{r.business.toLocaleString()}</strong> <span className="text-gray-500">business</span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function AdminScore() {
  const { data, isLoading } = useGetAdminScoreStats({ query: { queryKey: getGetAdminScoreStatsQueryKey() } });
  const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : v.toLocaleString());

  return (
    <AdminLayout title="S-PAY Score">
      <div className="space-y-6">
        {data && !data.programEnabled && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3 text-sm text-amber-800">
            <PauseCircle size={18} /> The S-PAY Score program is paused — no new scores or snapshots.
            <Link href="/admin/settings" className="ml-auto font-semibold underline">Settings</Link>
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile label="Scored members" value={n(data?.scoredMembers)} sub={data ? `${data.coveragePct}% of ${data.totalUsers.toLocaleString()} users` : undefined} loading={isLoading} />
          <Tile label="Average score" value={n(data?.averageScore)} sub={data ? `Personal ${n(data.averagePersonal)} · Business ${n(data.averageBusiness)}` : undefined} loading={isLoading} />
          <Tile label="Trusted members (550+)" value={n(data?.trustedMembers)} loading={isLoading} />
          <Tile label="Score turned off" value={n(data?.disabledProfiles)} sub="Members who opted out of scoring" loading={isLoading} />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className={card}>
            <h2 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1"><Gauge size={18} className="text-[#4DC9EE]" /> Members by band</h2>
            <p className="text-xs text-gray-400 mb-5">Latest score of every member with the score on.</p>
            {isLoading || !data ? <Skeleton className="h-36 w-full" /> : <Distribution rows={data.distribution} />}
            {data && (
              <table className="mt-5 w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400"><th className="font-medium py-1">Band</th><th className="font-medium py-1 text-right">Personal</th><th className="font-medium py-1 text-right">Business</th></tr></thead>
                <tbody>
                  {data.distribution.map((r) => (
                    <tr key={r.band} className="border-t border-gray-100 dark:border-gray-800" style={{ fontVariantNumeric: "tabular-nums" }}>
                      <td className="py-1.5 text-gray-700 dark:text-gray-300">{r.label}</td>
                      <td className="py-1.5 text-right text-gray-900 dark:text-gray-100">{r.personal.toLocaleString()}</td>
                      <td className="py-1.5 text-right text-gray-900 dark:text-gray-100">{r.business.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="space-y-6">
            <div className={card}>
              <h2 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1"><Handshake size={18} className="text-[#4DC9EE]" /> Partner-sharing readiness (~{data?.partnerTargetYear ?? 2031})</h2>
              <p className="text-xs text-gray-400 mb-4">Opt-in only. Nothing is shared with any partner until the program launches.</p>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-2xl font-black text-gray-900 dark:text-gray-100">{n(data?.partnerSharing.consented)}</p><p className="text-xs text-gray-500">opted in</p></div>
                <div><p className="text-2xl font-black text-gray-900 dark:text-gray-100">{data ? `${data.partnerSharing.ratePct}%` : "—"}</p><p className="text-xs text-gray-500">opt-in rate</p></div>
                <div><p className="text-2xl font-black text-gray-900 dark:text-gray-100">{n(data?.partnerSharing.partnerReady)}</p><p className="text-xs text-gray-500">opted in + 12 months of history</p></div>
              </div>
            </div>
            <div className={card}>
              <h2 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1"><Database size={18} className="text-[#4DC9EE]" /> Data collected</h2>
              <p className="text-xs text-gray-400 mb-4">Monthly aggregate snapshots — never individual transactions.</p>
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-2xl font-black text-gray-900 dark:text-gray-100">{n(data?.snapshots.total)}</p><p className="text-xs text-gray-500">snapshots</p></div>
                <div><p className="text-2xl font-black text-gray-900 dark:text-gray-100">{n(data?.snapshots.thisMonth)}</p><p className="text-xs text-gray-500">this month</p></div>
                <div><p className="text-2xl font-black text-gray-900 dark:text-gray-100">{data?.snapshots.firstPeriod ? formatPeriod(data.snapshots.firstPeriod, true) : "—"}</p><p className="text-xs text-gray-500">collecting since</p></div>
              </div>
              <p className="text-[11px] text-gray-400 mt-4 flex items-center gap-1.5"><ShieldCheck size={12} /> Model {data?.modelVersion ?? "—"} · Score Data Notice {data?.consentVersion ?? "—"}</p>
            </div>
          </div>
        </div>

        <div className={card}>
          <h2 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-4"><History size={18} className="text-[#4DC9EE]" /> Recent consent & control changes</h2>
          {isLoading || !data ? <Skeleton className="h-24 w-full" /> : data.recentConsent.length === 0 ? (
            <p className="text-sm text-gray-400">No changes yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-400"><th className="font-medium py-1.5">Member</th><th className="font-medium py-1.5">Change</th><th className="font-medium py-1.5">Notice</th><th className="font-medium py-1.5 text-right">When</th></tr></thead>
                <tbody>
                  {data.recentConsent.map((c, i) => (
                    <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                      <td className="py-2 pr-3"><span className="font-medium text-gray-900 dark:text-gray-100">{c.fullName ?? "—"}</span> <span className="text-xs text-gray-400">{c.email}</span></td>
                      <td className="py-2 pr-3 text-gray-700 dark:text-gray-300">{ACTION_LABEL[c.action] ?? c.action}</td>
                      <td className="py-2 pr-3 text-gray-500">{c.consentVersion}</td>
                      <td className="py-2 text-right text-gray-500 whitespace-nowrap">{new Date(c.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 flex items-center gap-1.5"><Users size={12} /><span>Each member's cached score also appears in <Link href="/admin/users" className="underline">Users &amp; KYC</Link>.</span></p>
      </div>
    </AdminLayout>
  );
}
