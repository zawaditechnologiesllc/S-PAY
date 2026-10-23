import { Link } from "wouter";
import { ChevronRight, Gauge, Info, Sparkles } from "lucide-react";
import { useGetMyScore, getGetMyScoreQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreGauge } from "@/components/score-gauge";
import { useScoreAction } from "@/lib/use-score-action";

/**
 * Compact S-PAY Score card for the dashboard (personal + business). Shows the
 * gauge, the distance to the next band and the single highest-value action —
 * everything else lives on /my-score.
 */
export function ScoreCard() {
  const { data, isLoading, isError } = useGetMyScore({ query: { queryKey: getGetMyScoreQueryKey(), staleTime: 5 * 60_000 } });
  const { run, pending } = useScoreAction();
  const title = data?.accountType === "business" ? "Business Score" : "S-PAY Score";

  if (isError || (data && !data.programEnabled)) return null;

  if (isLoading || !data) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800 grid grid-cols-[120px_1fr] sm:grid-cols-[150px_1fr] gap-4 items-center">
        <Skeleton className="h-20 w-full rounded-t-full" />
        <div className="space-y-2"><Skeleton className="h-4 w-28" /><Skeleton className="h-3 w-full" /><Skeleton className="h-3 w-2/3" /></div>
      </div>
    );
  }

  if (!data.enabled) {
    return (
      <Link href="/my-score">
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3 cursor-pointer hover:border-[#4DC9EE]/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500"><Gauge size={20} /></div>
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your {title} is off</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Turn it on any time to start building your track record</p>
            </div>
          </div>
          <ChevronRight size={18} className="text-gray-400 flex-shrink-0" />
        </div>
      </Link>
    );
  }

  const top = data.improvements[0];
  const next = data.nextBand;
  const bandSpan = data.band ? data.band.max - data.band.min + 1 : 1;
  const intoBand = data.band && data.score !== null ? data.score - data.band.min : 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Gauge size={18} className="text-[#4DC9EE]" /> {title}
        </h3>
        <Link href="/score" className="text-gray-400 hover:text-[#2E8FD6]" aria-label="How the S-PAY Score works">
          <Info size={16} />
        </Link>
      </div>
      <div className="grid grid-cols-[120px_1fr] sm:grid-cols-[150px_1fr] gap-4 items-center">
        <ScoreGauge score={data.score} size="sm" />
        <div className="min-w-0 space-y-2.5">
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-snug">{data.band?.summary}</p>
          {next ? (
            <div>
              <div className="flex justify-between text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">
                <span>{next.pointsNeeded} pts to {next.label}</span>
                <span>{next.min}</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--score-track)" }}>
                <div className="h-full rounded-full" style={{ width: `${Math.round((intoBand / bandSpan) * 100)}%`, backgroundColor: "var(--score-mark)" }} />
              </div>
            </div>
          ) : (
            <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">Top band — keep it up.</p>
          )}
          {top && (
            <button
              onClick={() => run(top.action ?? null)}
              disabled={pending || !top.action}
              className="w-full text-left flex items-center gap-2 rounded-xl bg-[#4DC9EE]/10 hover:bg-[#4DC9EE]/20 transition-colors px-3 py-2 disabled:cursor-default"
            >
              <Sparkles size={14} className="text-[#2E8FD6] flex-shrink-0" />
              <span className="text-xs font-semibold text-gray-800 dark:text-gray-200 line-clamp-2">{top.title}</span>
              {top.estimatedPoints !== null && (
                <span className="ml-auto text-[11px] font-bold text-[#2E8FD6] flex-shrink-0">+{top.estimatedPoints}</span>
              )}
            </button>
          )}
        </div>
      </div>
      <Link href="/my-score" className="mt-3 text-sm text-primary font-medium flex items-center justify-end">
        View my score <ChevronRight size={16} />
      </Link>
    </div>
  );
}
