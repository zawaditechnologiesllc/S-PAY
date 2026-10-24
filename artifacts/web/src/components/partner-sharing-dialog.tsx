import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMyScore, getGetMyScoreQueryKey, useUpdateScoreSettings, useRecordPartnerPrompt,
  type ScoreView,
} from "@workspace/api-client-react";
import {
  SCORE_PARTNER_SHARING_NOTICE, SCORE_PARTNER_SHARING_TARGET_YEAR, partnerSharingBenefits,
} from "@workspace/score-model";
import { Handshake, Landmark, Building2, TrendingUp, ShieldCheck, Bell, Lock, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { bandVar } from "@/components/score-gauge";

const BENEFIT_ICONS: Record<string, React.ReactNode> = {
  "Credit based on your real record": <Landmark size={16} />,
  "Working capital for your business": <Building2 size={16} />,
  "Better terms as your score grows": <TrendingUp size={16} />,
  "Insurance and more": <ShieldCheck size={16} />,
  "First to hear when offers launch": <Bell size={16} />,
  "You stay in control": <Lock size={16} />,
};

function apiMessage(err: unknown, fallback: string): string {
  return (err as { data?: { message?: string } })?.data?.message ?? fallback;
}

/**
 * Partner-sharing consent dialog: what opting in unlocks, the full notice, and
 * equally weighted "Turn on" / "Not now" choices.
 *
 *  • mode "reminder" — the weekly prompt for members who haven't opted in. Adds
 *    "Don't ask me again"; an opt-in is recorded with source "prompt".
 *  • mode "settings" — opened from the switch in My Score.
 */
export function PartnerSharingDialog({ open, onClose, view, mode }: {
  open: boolean;
  onClose: () => void;
  view: ScoreView;
  mode: "reminder" | "settings";
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const update = useUpdateScoreSettings();
  const prompt = useRecordPartnerPrompt();
  const [showNotice, setShowNotice] = useState(false);
  const business = view.accountType === "business";
  const benefits = partnerSharingBenefits(business ? "business" : "personal");
  const setView = (v: ScoreView) => qc.setQueryData(getGetMyScoreQueryKey(), v);

  const accept = () => update.mutate({ data: { partnerSharing: true, source: mode === "reminder" ? "prompt" : "settings" } }, {
    onSuccess: (v) => {
      setView(v);
      onClose();
      toast({ title: "Partner sharing is on", description: `Nothing is shared until the partner program launches (~${SCORE_PARTNER_SHARING_TARGET_YEAR}). You'll hear first when offers go live.` });
    },
    onError: (err) => toast({ title: "Couldn't turn it on", description: apiMessage(err, "Please try again."), variant: "destructive" }),
  });

  const never = () => prompt.mutate({ data: { action: "never" } }, {
    onSuccess: (v) => {
      setView(v);
      onClose();
      toast({ title: "We won't ask again", description: "You can switch partner sharing on any time in My Score." });
    },
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader className="text-left">
          <div className="w-11 h-11 rounded-2xl bg-[#4DC9EE]/15 text-[#2E8FD6] flex items-center justify-center mb-1">
            <Handshake size={22} />
          </div>
          <DialogTitle className="text-xl">
            {business ? "Unlock business financing with your Business Score" : "Unlock fairer credit with your S-PAY Score"}
          </DialogTitle>
          <DialogDescription className="text-left">
            Switch on partner sharing and, from ~{SCORE_PARTNER_SHARING_TARGET_YEAR}, licensed banks, lenders and insurers can
            make you offers based on your real track record on S-PAY.
          </DialogDescription>
        </DialogHeader>

        {view.score !== null && view.band && (
          <div className="flex items-center justify-between rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3">
            <span className="text-sm text-gray-600 dark:text-gray-300">Your score today</span>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: bandVar(view.band.key) }} />
              {view.score} · {view.band.label}
            </span>
          </div>
        )}

        <ul className="space-y-3">
          {benefits.map((b) => (
            <li key={b.title} className="flex gap-3">
              <span className="w-8 h-8 rounded-lg bg-[#4DC9EE]/10 text-[#2E8FD6] flex items-center justify-center flex-shrink-0">
                {BENEFIT_ICONS[b.title] ?? <ShieldCheck size={16} />}
              </span>
              <span>
                <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">{b.title}</span>
                <span className="block text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{b.description}</span>
              </span>
            </li>
          ))}
        </ul>

        <div className="rounded-xl border border-gray-100 dark:border-gray-800">
          <button
            onClick={() => setShowNotice((s) => !s)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-semibold text-gray-600 dark:text-gray-300"
            aria-expanded={showNotice}
          >
            What you're agreeing to <ChevronDown size={14} className={`transition-transform ${showNotice ? "rotate-180" : ""}`} />
          </button>
          {showNotice && (
            <div className="px-4 pb-3 text-xs text-gray-500 dark:text-gray-400 leading-relaxed space-y-2">
              <p>{SCORE_PARTNER_SHARING_NOTICE}</p>
              <p>
                Score Data Notice version {view.partnerSharing.currentVersion} ·{" "}
                <Link href="/score#partners" className="underline" onClick={onClose}>Full details</Link>
              </p>
            </div>
          )}
        </div>

        {/* Choices stay pinned in view while the benefits scroll (small screens). */}
        <div className="sticky -bottom-6 -mx-6 -mb-6 px-6 pt-3 pb-5 bg-background border-t border-gray-100 dark:border-gray-800 space-y-2">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="rounded-full" onClick={onClose} disabled={update.isPending}>Not now</Button>
            <Button className="rounded-full bg-[#4DC9EE] hover:bg-[#2E8FD6] text-[#0d1f38] font-semibold" onClick={accept} disabled={update.isPending}>
              {update.isPending ? "Turning on…" : "Turn on partner sharing"}
            </Button>
          </div>
          {mode === "reminder" && (
            <div className="text-center">
              <button onClick={never} disabled={prompt.isPending} className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline">
                Don't ask me again
              </button>
              <p className="text-[11px] text-gray-400">We remind you at most once every {view.partnerPrompt.intervalDays} days. Off by default · switch it off any time.</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Weekly reminder for members who haven't opted in to partner sharing. Mounted
 * on the dashboard; opens once the server says it's due and immediately records
 * "shown", so the next one is at least a week away whatever the member does.
 */
export function PartnerSharingReminder() {
  const qc = useQueryClient();
  const { data } = useGetMyScore({ query: { queryKey: getGetMyScoreQueryKey(), staleTime: 5 * 60_000 } });
  const prompt = useRecordPartnerPrompt();
  const [open, setOpen] = useState(false);
  const [snapshot, setSnapshot] = useState<ScoreView | null>(null);
  const latest = useRef(data);
  latest.current = data;
  const due = data?.partnerPrompt?.due === true;

  useEffect(() => {
    if (!due) return;
    // Let the dashboard paint first — a popup over a blank page feels like an ad.
    const t = setTimeout(() => {
      if (!latest.current) return;
      setSnapshot(latest.current);
      setOpen(true);
      prompt.mutate({ data: { action: "shown" } }, { onSuccess: (v) => qc.setQueryData(getGetMyScoreQueryKey(), v) });
    }, 1200);
    return () => clearTimeout(t);
    // Only the due flag drives this: recording "shown" flips it off for 7 days.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due]);

  if (!snapshot) return null;
  return <PartnerSharingDialog open={open} onClose={() => setOpen(false)} view={snapshot} mode="reminder" />;
}
