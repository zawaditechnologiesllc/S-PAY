import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyScore, getGetMyScoreQueryKey, useUpdateScoreSettings, useDeleteScoreHistory,
  useCreateScoreShare, useRevokeScoreShares, exportScoreData,
  type ScoreView, type ScoreShare, type ScoreFactor,
} from "@workspace/api-client-react";
import {
  SCORE_BAND_PERKS, SCORE_PARTNER_SHARING_TARGET_YEAR, SCORE_BANDS,
  type ScoreBandKey,
} from "@workspace/score-model";
import {
  Gauge, Sparkles, Share2, Download, Trash2, Copy, Check, ChevronRight,
  CheckCircle2, CircleDashed, AlertTriangle, MinusCircle, Clock, Lock, BadgeCheck, PauseCircle, Info,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { ScoreGauge, bandVar } from "@/components/score-gauge";
import { ScoreHistoryChart } from "@/components/score-history-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useScoreAction } from "@/lib/use-score-action";
import { PartnerSharingDialog } from "@/components/partner-sharing-dialog";

function apiMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? fallback;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "just now";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

const card = "bg-white dark:bg-gray-900 rounded-2xl p-5 md:p-6 shadow-sm border border-gray-100 dark:border-gray-800";

export default function MyScore() {
  const qc = useQueryClient();
  const { data, isLoading } = useGetMyScore({ query: { queryKey: getGetMyScoreQueryKey(), staleTime: 60_000, refetchOnWindowFocus: true } });
  const updateSettings = useUpdateScoreSettings();
  const { toast } = useToast();
  const title = data?.accountType === "business" ? "Business Score" : "S-PAY Score";

  const setView = (v: ScoreView) => qc.setQueryData(getGetMyScoreQueryKey(), v);
  const changeSettings = (body: { enabled?: boolean; partnerSharing?: boolean }, done: string) =>
    updateSettings.mutate({ data: body }, {
      onSuccess: (v) => { setView(v); toast({ title: done }); },
      onError: (err) => toast({ title: "Couldn't update", description: apiMessage(err, "Please try again."), variant: "destructive" }),
    });

  if (isLoading || !data) {
    return (
      <Layout back title="S-PAY Score">
        <div className={`${card} space-y-4`}>
          <Skeleton className="h-32 w-64 mx-auto rounded-t-full" />
          <Skeleton className="h-4 w-48 mx-auto" />
        </div>
        <div className={`${card} space-y-3`}>{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
      </Layout>
    );
  }

  if (!data.programEnabled) {
    return (
      <Layout back title={title}>
        <div className={`${card} text-center py-10`}>
          <PauseCircle size={36} className="mx-auto text-gray-400 mb-3" />
          <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-1">S-PAY Score is paused</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            We've temporarily paused score updates for everyone. Your history and choices are kept exactly as they are.
          </p>
          <Link href="/score" className="inline-flex items-center gap-1 mt-4 text-sm font-medium text-primary">How S-PAY Score works <ChevronRight size={15} /></Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout back title={title}>
      {data.enabled ? <ScoreHero data={data} /> : <ScoreOff data={data} onEnable={() => changeSettings({ enabled: true }, "S-PAY Score is on")} pending={updateSettings.isPending} />}

      {data.enabled && data.score !== null && (
        <>
          <ImprovementPlan data={data} />
          <FactorBreakdown factors={data.factors} accountType={data.accountType} />
          <div className={card}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Score history</h3>
              <span className="text-xs text-gray-400">Monthly · last 12 months</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
              One snapshot is kept per month. {data.history.length < 2 ? "Your trend line appears after your second month." : ""}
            </p>
            <ScoreHistoryChart points={data.history} />
          </div>
          <BandBenefits current={data.band!.key as ScoreBandKey} />
          <SharePanel data={data} />
        </>
      )}

      <Controls data={data} changeSettings={changeSettings} pending={updateSettings.isPending} />

      <p className="text-[11px] text-gray-400 leading-relaxed px-1 pb-4">
        {title} is S-PAY's own score, built only from your activity on S-PAY. It isn't a credit-bureau report, it isn't
        shared with any lender today, and it's never used to freeze or hold your money. Model {data.modelVersion}.{" "}
        <Link href="/score" className="underline">How it works</Link> · <Link href="/privacy" className="underline">Privacy</Link>
      </p>
    </Layout>
  );
}

function ScoreHero({ data }: { data: ScoreView }) {
  const next = data.nextBand;
  const band = data.band;
  const intoBand = band && data.score !== null ? data.score - band.min : 0;
  const span = band ? band.max - band.min + 1 : 1;
  return (
    <div className={`${card} text-center`}>
      <ScoreGauge score={data.score} size="lg" />
      {band && <p className="mt-4 text-sm text-gray-600 dark:text-gray-300 max-w-md mx-auto">{band.summary}</p>}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {data.score !== null && data.score >= data.trustedThreshold && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
            <BadgeCheck size={14} className="text-[#2E8FD6]" /> Trusted member
          </span>
        )}
        {data.percentile !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-semibold text-gray-700 dark:text-gray-200">
            Higher than {data.percentile}% of members
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
          <Clock size={12} /> Updated {timeAgo(data.computedAt)}
        </span>
      </div>
      {next && (
        <div className="mt-5 max-w-sm mx-auto text-left">
          <div className="flex justify-between text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: bandVar(band!.key) }} />{band!.label}
            </span>
            <span><strong className="text-gray-900 dark:text-gray-100">{next.pointsNeeded} pts</strong> to {next.label} ({next.min})</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--score-track)" }}>
            <div className="h-full rounded-full" style={{ width: `${Math.round((intoBand / span) * 100)}%`, backgroundColor: "var(--score-mark)" }} />
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreOff({ data, onEnable, pending }: { data: ScoreView; onEnable: () => void; pending: boolean }) {
  return (
    <div className={`${card} text-center py-8`}>
      <Gauge size={36} className="mx-auto text-gray-400 mb-3" />
      <h2 className="font-bold text-gray-900 dark:text-gray-100 mb-1">Your score is off</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-4">
        We're not calculating or collecting anything for your S-PAY Score. Turn it on to see your score, get a plan to
        raise it and start building a track record.{data.history.length ? ` ${data.history.length} stored monthly snapshot${data.history.length === 1 ? " is" : "s are"} kept until you delete ${data.history.length === 1 ? "it" : "them"} below.` : ""}
      </p>
      <Button onClick={onEnable} disabled={pending} className="rounded-full">Turn on my score</Button>
    </div>
  );
}

function ImprovementPlan({ data }: { data: ScoreView }) {
  const { run, pending } = useScoreAction();
  if (data.improvements.length === 0) return null;
  const label = (kind?: string) => (kind === "kyc" ? "Verify" : kind === "email" ? "Resend link" : "Open");
  return (
    <div className={card}>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1">
        <Sparkles size={18} className="text-[#4DC9EE]" /> Raise your score
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Ranked by impact. Point estimates are simulated by the same model that scores you.</p>
      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {data.improvements.map((i) => (
          <li key={i.key} className="py-3 flex items-start gap-3">
            <div className="min-w-[56px] text-center">
              {i.estimatedPoints !== null ? (
                <span className="inline-block rounded-lg bg-[#4DC9EE]/15 text-[#1A2B4A] dark:text-[#A8DEFF] text-sm font-bold px-2 py-1">+{i.estimatedPoints}</span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-400 pt-1"><Clock size={12} /> Time</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{i.title}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{i.description}</p>
            </div>
            {i.action && (
              <Button size="sm" variant="outline" className="rounded-full flex-shrink-0" disabled={pending} onClick={() => run(i.action)}>
                {label(i.action.kind)}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const STATUS: Record<ScoreFactor["status"], { label: string; icon: React.ReactNode }> = {
  strong: { label: "Strong", icon: <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" /> },
  fair: { label: "Fair", icon: <MinusCircle size={13} className="text-amber-600 dark:text-amber-400" /> },
  weak: { label: "Needs work", icon: <AlertTriangle size={13} className="text-orange-600 dark:text-orange-400" /> },
  no_data: { label: "Not enough data yet", icon: <CircleDashed size={13} className="text-gray-400" /> },
};

function FactorBreakdown({ factors, accountType }: { factors: ScoreFactor[]; accountType: string }) {
  return (
    <div className={card}>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">What's behind your score</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Five factors{accountType === "business" ? ", weighted for businesses" : ""}. Each adds up to its share of the 550 points above the 300 floor.
      </p>
      <div className="space-y-5">
        {factors.map((f) => (
          <div key={f.key}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{f.label}</p>
                <p className="text-[11px] text-gray-400">{Math.round(f.weight * 100)}% of score</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100" style={{ fontVariantNumeric: "tabular-nums" }}>{f.points}<span className="text-gray-400 font-medium">/{f.maxPoints}</span></p>
                <p className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                  {/* account age only grows with time — don't call it "needs work" */}
                  {f.key === "history" && f.status !== "strong"
                    ? <><Clock size={13} className="text-gray-400" />Builds with time</>
                    : <>{STATUS[f.status].icon}{STATUS[f.status].label}</>}
                </p>
              </div>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--score-track)" }} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={f.value} aria-label={`${f.label} ${f.value} out of 100`}>
              <div className="h-full rounded-full" style={{ width: `${f.value}%`, backgroundColor: "var(--score-mark)" }} />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">{f.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BandBenefits({ current }: { current: ScoreBandKey }) {
  return (
    <div className={card}>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Benefits by band</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        <span className="font-semibold text-gray-700 dark:text-gray-300">Live</span> benefits work today. <span className="font-semibold text-gray-700 dark:text-gray-300">Planned</span> ones are on the S-PAY roadmap and may change.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        {SCORE_BANDS.map((b) => {
          const perks = SCORE_BAND_PERKS[b.key];
          const here = b.key === current;
          return (
            <div key={b.key} className={`rounded-xl border p-4 ${here ? "border-[#4DC9EE] bg-[#4DC9EE]/5" : "border-gray-100 dark:border-gray-800"}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bandVar(b.key) }} />{b.label}
                </span>
                <span className="text-[11px] text-gray-400">{b.min}–{b.max}{here ? " · You" : ""}</span>
              </div>
              <ul className="space-y-1">
                {perks.live.map((p) => <li key={p} className="text-xs text-gray-600 dark:text-gray-300 flex gap-1.5"><CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-px" />{p}</li>)}
                {perks.planned.map((p) => <li key={p} className="text-xs text-gray-500 dark:text-gray-400 flex gap-1.5"><Clock size={13} className="text-gray-400 flex-shrink-0 mt-px" />{p} <span className="text-[10px] uppercase font-bold tracking-wide text-gray-400">Planned</span></li>)}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SharePanel({ data }: { data: ScoreView }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateScoreShare();
  const revoke = useRevokeScoreShares();
  const [open, setOpen] = useState(false);
  const [exact, setExact] = useState(false);
  const [days, setDays] = useState<1 | 7 | 30>(7);
  const [share, setShare] = useState<ScoreShare | null>(null);
  const [copied, setCopied] = useState(false);

  // Build the link on THIS origin so it always opens where the member is.
  const link = share ? `${window.location.origin}/score/verify/${share.token}` : "";

  const submit = () => create.mutate({ data: { showExactScore: exact, days } }, {
    onSuccess: (s) => { setShare(s); qc.invalidateQueries({ queryKey: getGetMyScoreQueryKey() }); },
    onError: (err) => toast({ title: "Couldn't create link", description: apiMessage(err, "Please try again."), variant: "destructive" }),
  });
  const revokeAll = () => revoke.mutate(undefined, {
    onSuccess: (r) => { toast({ title: "Links revoked", description: r.message }); qc.invalidateQueries({ queryKey: getGetMyScoreQueryKey() }); },
  });
  const copy = () => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className={card}>
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1"><Share2 size={18} className="text-[#4DC9EE]" /> Share proof of your score</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Send a verified, expiring link to an employer, client, landlord or supplier. They see your first name, band and — only if you choose — your exact score. Nothing else.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button className="rounded-full" onClick={() => { setShare(null); setOpen(true); }}>Create a link</Button>
        {data.activeShares > 0 && (
          <Button variant="outline" className="rounded-full" onClick={revokeAll} disabled={revoke.isPending}>
            Revoke {data.activeShares} active link{data.activeShares === 1 ? "" : "s"}
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Share proof of your score</DialogTitle>
            <DialogDescription>Anyone with the link can view it until it expires or you revoke it.</DialogDescription>
          </DialogHeader>
          {!share ? (
            <div className="space-y-4">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                <span>
                  <span className="block text-sm font-semibold">Show my exact score</span>
                  <span className="block text-xs text-gray-500">Off shares your band only ({data.band?.label})</span>
                </span>
                <Switch checked={exact} onCheckedChange={setExact} />
              </label>
              <div>
                <p className="text-sm font-semibold mb-2">Link expires after</p>
                <div className="grid grid-cols-3 gap-2">
                  {([1, 7, 30] as const).map((d) => (
                    <button key={d} onClick={() => setDays(d)} className={`rounded-xl border py-2 text-sm font-medium ${days === d ? "border-[#4DC9EE] bg-[#4DC9EE]/10 text-[#1A2B4A] dark:text-white" : "border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300"}`}>
                      {d === 1 ? "1 day" : `${d} days`}
                    </button>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button className="w-full rounded-full" onClick={submit} disabled={create.isPending}>{create.isPending ? "Creating…" : "Create link"}</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
                <code className="text-xs break-all flex-1">{link}</code>
                <button onClick={copy} className="text-gray-500 hover:text-gray-900 dark:hover:text-white" aria-label="Copy link">{copied ? <Check size={16} /> : <Copy size={16} />}</button>
              </div>
              <p className="text-xs text-gray-500">
                Shows {share.showExactScore ? `your score (${share.score})` : `your band (${share.band.label})`} · expires {new Date(share.expiresAt).toLocaleDateString()}.
                This link is shown once — copy it now.
              </p>
              {"share" in navigator && (
                <Button variant="outline" className="w-full rounded-full" onClick={() => navigator.share({ title: "My S-PAY Score", url: link }).catch(() => {})}>Share…</Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Controls({ data, changeSettings, pending }: {
  data: ScoreView;
  changeSettings: (body: { enabled?: boolean; partnerSharing?: boolean }, done: string) => void;
  pending: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const del = useDeleteScoreHistory();
  const [consentOpen, setConsentOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [offOpen, setOffOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const ps = data.partnerSharing;

  const download = async () => {
    setExporting(true);
    try {
      const json = await exportScoreData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `spay-score-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({ title: "Download failed", description: apiMessage(err, "Please try again."), variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const confirmDelete = () => del.mutate(undefined, {
    onSuccess: (r) => {
      toast({ title: "Score history deleted", description: data.enabled ? `${r.message} Your score keeps running from today unless you turn it off.` : r.message });
      qc.invalidateQueries({ queryKey: getGetMyScoreQueryKey() });
    },
    onError: (err) => toast({ title: "Couldn't delete", description: apiMessage(err, "Please try again."), variant: "destructive" }),
  });

  return (
    <div className={card} id="controls">
      <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-1"><Lock size={18} className="text-[#4DC9EE]" /> Your data &amp; controls</h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        You decide. Every change is recorded with a timestamp. <Link href="/score#your-data" className="underline">What we use and why</Link>
      </p>

      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        <Row
          title="S-PAY Score"
          subtitle={data.enabled ? "On — calculated from your S-PAY activity, one snapshot a month" : "Off — nothing is calculated or collected"}
          control={<Switch checked={data.enabled} disabled={pending || !data.programEnabled} onCheckedChange={(on) => (on ? changeSettings({ enabled: true }, "S-PAY Score is on") : setOffOpen(true))} aria-label="S-PAY Score on or off" />}
        />
        <Row
          title={`Partner sharing (from ~${SCORE_PARTNER_SHARING_TARGET_YEAR})`}
          subtitle={ps.consented
            ? `On since ${ps.consentedAt ? new Date(ps.consentedAt).toLocaleDateString() : "today"} (notice ${ps.consentVersion}). Nothing is shared today.`
            : "Off (default). Licensed lenders and insurers may use your score only if you turn this on."}
          control={<Switch checked={ps.consented} disabled={pending || !data.enabled} onCheckedChange={(on) => (on ? setConsentOpen(true) : changeSettings({ partnerSharing: false }, "Partner sharing turned off"))} aria-label="Partner sharing" />}
        />
        <Row
          title="Download my score data"
          subtitle="Your score, monthly snapshots and consent record as a JSON file"
          control={<Button size="sm" variant="outline" className="rounded-full" onClick={download} disabled={exporting}><Download size={14} className="mr-1" />{exporting ? "Preparing…" : "Download"}</Button>}
        />
        <Row
          title="Delete my score history"
          subtitle={`${data.history.length} monthly snapshot${data.history.length === 1 ? "" : "s"} stored`}
          control={<Button size="sm" variant="outline" className="rounded-full text-red-600 hover:text-red-700" onClick={() => setDeleteOpen(true)} disabled={del.isPending || data.history.length === 0}><Trash2 size={14} className="mr-1" />Delete</Button>}
        />
      </div>
      <p className="text-[11px] text-gray-400 mt-3 flex gap-1.5"><Info size={13} className="flex-shrink-0 mt-px" /><span>Spotted something wrong? Email <a href="mailto:privacy@spayewallet.com" className="underline">privacy@spayewallet.com</a> — a person reviews every dispute within 30 days.</span></p>

      {/* Partner-sharing consent: what it unlocks + the full notice; explicit, versioned, revocable */}
      <PartnerSharingDialog open={consentOpen} onClose={() => setConsentOpen(false)} view={data} mode="settings" />

      <AlertDialog open={offOpen} onOpenChange={setOffOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Turn off your S-PAY Score?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              We'll stop calculating and collecting anything for your score straight away, and partner sharing switches off too.
              Months while it's off won't count toward your history. Your stored snapshots stay until you delete them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it on</AlertDialogCancel>
            <AlertDialogAction onClick={() => changeSettings({ enabled: false }, "S-PAY Score is off")}>Turn off</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your score history?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              This permanently erases {data.history.length} monthly snapshot{data.history.length === 1 ? "" : "s"}. It can't be undone, and a
              longer history is what earns the best bands and future partner offers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={confirmDelete}>Delete history</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Row({ title, subtitle, control }: { title: string; subtitle: string; control: React.ReactNode }) {
  return (
    <div className="py-3 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      </div>
      <div className="flex-shrink-0">{control}</div>
    </div>
  );
}
