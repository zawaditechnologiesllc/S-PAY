import { Link, useRoute } from "wouter";
import { BadgeCheck, ShieldCheck, ShieldX, Building2, User, ChevronRight, Clock } from "lucide-react";
import { useVerifyScoreShare, getVerifyScoreShareQueryKey } from "@workspace/api-client-react";
import { PublicLayout } from "@/components/public-layout";
import { ScoreGauge, bandVar } from "@/components/score-gauge";
import { usePageMeta } from "@/lib/page-meta";

/**
 * Public landing for a member-issued proof-of-score link. Shows only what the
 * member chose to share (band, optionally the exact score). Never indexed.
 */
export default function ScoreVerify() {
  const [, params] = useRoute("/score/verify/:token");
  const token = params?.token ?? "";
  const { data, isLoading, isError } = useVerifyScoreShare(token, {
    query: { queryKey: getVerifyScoreShareQueryKey(token), enabled: !!token, retry: false, staleTime: 0, gcTime: 0 },
  });
  usePageMeta({
    title: "Verified S-PAY Score",
    description: "A member-shared, verified S-PAY Score.",
    noindex: true,
  });

  return (
    <PublicLayout>
      <div className="pt-28 pb-20 px-5 bg-gray-50 min-h-[70vh] score-light">
        <div className="max-w-md mx-auto">
          {isLoading ? (
            <div className="bg-white rounded-3xl shadow-sm p-8 space-y-4">
              <div className="h-32 w-56 mx-auto bg-gray-100 rounded-t-full animate-pulse" />
              <div className="h-4 w-40 mx-auto bg-gray-100 rounded animate-pulse" />
            </div>
          ) : isError || !data?.valid ? (
            <div className="bg-white rounded-3xl shadow-sm p-8 text-center">
              <ShieldX size={40} className="mx-auto text-gray-400 mb-3" />
              <h1 className="text-xl font-black text-[#1A2B4A] mb-1">This link isn't valid</h1>
              <p className="text-sm text-gray-500">It may have expired or been revoked by its owner. Ask them to send a new one.</p>
            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm p-6 md:p-8 text-center">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#2E8FD6] mb-4">
                <ShieldCheck size={14} /> Verified by S-PAY
              </div>
              <h1 className="text-2xl font-black text-[#1A2B4A] mb-1 flex items-center justify-center gap-2">
                {data.accountType === "business" ? <Building2 size={20} className="text-gray-400" /> : <User size={20} className="text-gray-400" />}
                {data.displayName}
              </h1>
              <p className="text-sm text-gray-500 mb-6">{data.accountType === "business" ? "Business Score" : "S-PAY Score"}</p>

              {data.score !== null ? (
                <ScoreGauge score={data.score} size="lg" />
              ) : (
                <div className="py-6">
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Score band</p>
                  <p className="inline-flex items-center gap-2 text-3xl font-black text-[#1A2B4A]">
                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: bandVar(data.band.key) }} />
                    {data.band.label}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">{data.band.min}–{data.band.max} on a 300–850 scale</p>
                </div>
              )}
              <p className="text-sm text-gray-600 mt-4">{data.band.summary}</p>

              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {data.trustedMember && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                    <BadgeCheck size={14} className="text-[#2E8FD6]" /> Trusted member
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  <ShieldCheck size={14} className={data.identityVerified ? "text-[#2E8FD6]" : "text-gray-400"} />
                  {data.identityVerified ? (data.accountType === "business" ? "Business verified" : "Identity verified") : "Not yet verified"}
                </span>
              </div>
              <p className="mt-5 text-xs text-gray-400 inline-flex items-center gap-1.5">
                <Clock size={12} /> Issued {new Date(data.issuedAt).toLocaleDateString()} · valid until {new Date(data.expiresAt).toLocaleDateString()}
              </p>
              <p className="mt-4 text-[11px] text-gray-400 leading-relaxed">
                S-PAY Score is S-PAY's own score of how reliably a member gets paid and pays on S-PAY. It isn't a credit-bureau
                report or an offer of credit. The member chose to share this.
              </p>
            </div>
          )}

          <div className="mt-6 bg-[#1A2B4A] rounded-3xl p-6 text-center text-white">
            <p className="font-bold mb-1">Build your own track record</p>
            <p className="text-sm text-blue-200 mb-4">Free S-PAY Score for every personal and business account.</p>
            <Link href="/score" className="inline-flex items-center gap-1 bg-[#4DC9EE] text-[#0d1f38] font-bold px-5 py-2.5 rounded-full text-sm">
              How S-PAY Score works <ChevronRight size={15} />
            </Link>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
