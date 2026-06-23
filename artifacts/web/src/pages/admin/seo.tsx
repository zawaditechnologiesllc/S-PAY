import { useEffect, useState } from "react";
import { AdminLayout } from "./layout";
import {
  useGetSeoStatus, getGetSeoStatusQueryKey,
  useGetSeoOpportunities, getGetSeoOpportunitiesQueryKey,
  useGetSeoAnalytics, getGetSeoAnalyticsQueryKey,
  useGetSeoRedditTopics, getGetSeoRedditTopicsQueryKey,
  useGetSeoPosts, getGetSeoPostsQueryKey,
  useGetSeoPost, getGetSeoPostQueryKey,
  useCreateSeoDraft, useAutoDraftSeo, useUpdateSeoPost, usePublishSeoPost, useUnpublishSeoPost,
} from "@workspace/api-client-react";
import { CheckCircle2, XCircle, Send, RefreshCw, Archive, ExternalLink, TrendingUp, MessageSquare, Wand2, BarChart3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatusPill({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${ok ? "text-green-700 bg-green-50" : "text-gray-500 bg-gray-100"}`}>
      {ok ? <CheckCircle2 size={11} /> : <XCircle size={11} />} {label}
    </span>
  );
}

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  approved: "bg-blue-50 text-blue-700",
  published: "bg-green-50 text-green-700",
  archived: "bg-amber-50 text-amber-700",
};

export default function AdminSeo() {
  const { toast } = useToast();
  const { data: status } = useGetSeoStatus({ query: { queryKey: getGetSeoStatusQueryKey() } });
  const { data: opps } = useGetSeoOpportunities({ query: { queryKey: getGetSeoOpportunitiesQueryKey() } });
  const { data: analytics } = useGetSeoAnalytics({ query: { queryKey: getGetSeoAnalyticsQueryKey() } });
  const { data: posts, refetch: refetchPosts } = useGetSeoPosts(undefined, { query: { queryKey: getGetSeoPostsQueryKey() } });

  const [showReddit, setShowReddit] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: reddit, refetch: refetchReddit, isFetching: redditFetching } =
    useGetSeoRedditTopics(undefined, { query: { queryKey: getGetSeoRedditTopicsQueryKey(), enabled: showReddit } });

  const createDraft = useCreateSeoDraft();
  const autoDraft = useAutoDraftSeo();
  const busy = createDraft.isPending || autoDraft.isPending;

  const onDraftError = (e: unknown) => {
    const s = (e as { status?: number })?.status;
    toast({
      title: "Couldn't draft",
      description: s === 503 ? "AI drafting isn't switched on yet (set GEMINI_API_KEY)."
        : s === 422 ? "No research available yet — connect Search Console or load Reddit topics."
        : "Please try again.",
      variant: "destructive",
    });
  };

  // Draft straight from a researched item — the keyword comes from research and
  // the audience is derived server-side. The admin never types either.
  const draftFrom = (keyword: string, source: "gsc" | "reddit", subreddit?: string) => {
    createDraft.mutate(
      { data: { keyword, source, ...(subreddit ? { subreddit } : {}) } },
      {
        onSuccess: (res) => { toast({ title: "Draft generated", description: `For “${res.post.keyword ?? keyword}”. Review and publish below.` }); setSelectedId(res.post.id); refetchPosts(); },
        onError: onDraftError,
      },
    );
  };

  const runAutoDraft = () => {
    autoDraft.mutate(undefined, {
      onSuccess: (res) => { toast({ title: "Auto-drafted", description: `Research picked “${res.pickedKeyword}”. Review and publish below.` }); setSelectedId(res.post.id); refetchPosts(); },
      onError: onDraftError,
    });
  };

  return (
    <AdminLayout title="SEO & Blog">
      <div className="space-y-6 max-w-5xl">
        {/* Status */}
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label="Search Console" ok={!!status?.gscConfigured} />
          <StatusPill label="Analytics (GA4)" ok={!!status?.ga4Configured} />
          <StatusPill label="AI drafting (Gemini)" ok={!!status?.draftConfigured} />
          <StatusPill label="Reddit topics" ok={!!status?.redditEnabled} />
          <p className="text-xs text-gray-400 ml-1">Research picks the keyword + audience. Drafts are AI-written, grounded in product facts. Nothing publishes until you approve it.</p>
        </div>

        {/* Auto-draft — research chooses everything */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Wand2 size={16} className="text-[#4DC9EE]" /> Auto-draft from research</h2>
            <p className="text-xs text-gray-400 mt-0.5">Picks the single best keyword (top Search Console opportunity, else top Reddit topic), derives the audience, and writes a draft — no input needed.</p>
          </div>
          <button onClick={runAutoDraft} disabled={busy}
            className="px-4 py-2.5 rounded-lg bg-[#4DC9EE] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1.5 flex-shrink-0">
            <Wand2 size={15} /> {autoDraft.isPending ? "Researching…" : "Auto-draft"}
          </button>
        </div>

        {/* Opportunities + Reddit — each is one-click "Draft" */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2"><TrendingUp size={16} className="text-[#4DC9EE]" /> Search Console opportunities</h2>
            {!opps?.configured ? (
              <p className="text-xs text-gray-400">{opps?.message ?? "Connect Search Console to surface winnable keywords."}</p>
            ) : (opps.opportunities ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">No opportunities yet.</p>
            ) : (
              <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                {opps.opportunities.map((o) => (
                  <li key={o.query} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{o.query}</p>
                      <p className="text-[11px] text-gray-400 truncate">{o.reason}</p>
                    </div>
                    <button onClick={() => draftFrom(o.query, "gsc")} disabled={busy}
                      className="flex-shrink-0 text-xs font-semibold text-[#4DC9EE] hover:underline disabled:opacity-40">Draft</button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2"><MessageSquare size={16} className="text-[#4DC9EE]" /> Reddit topic ideas</h2>
              <button onClick={() => { setShowReddit(true); refetchReddit(); }} disabled={redditFetching}
                className="text-xs font-semibold text-[#4DC9EE] hover:underline disabled:opacity-50 flex items-center gap-1">
                <RefreshCw size={12} className={redditFetching ? "animate-spin" : ""} /> {redditFetching ? "Loading…" : "Load"}
              </button>
            </div>
            {!showReddit ? (
              <p className="text-xs text-gray-400">Mines ~50 project subreddits via public old.reddit JSON. Click Load.</p>
            ) : (reddit?.topics ?? []).length === 0 ? (
              <p className="text-xs text-gray-400">{redditFetching ? "Fetching…" : "No topics returned."}</p>
            ) : (
              <ul className="space-y-1.5 max-h-72 overflow-y-auto">
                {reddit!.topics.map((t, i) => (
                  <li key={i} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2">{t.title}</p>
                      <p className="text-[11px] text-gray-400">r/{t.subreddit} · {t.score} pts · {t.numComments} comments</p>
                    </div>
                    <button onClick={() => draftFrom(t.title, "reddit", t.subreddit)} disabled={busy}
                      className="flex-shrink-0 text-xs font-semibold text-[#4DC9EE] hover:underline disabled:opacity-40">Draft</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Analytics — which content actually performs (GA4 feedback loop) */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
          <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 mb-2"><BarChart3 size={16} className="text-[#4DC9EE]" /> Top content (Google Analytics)</h2>
          {!analytics?.configured ? (
            <p className="text-xs text-gray-400">{analytics?.message ?? "Connect Google Analytics to see which content performs."}</p>
          ) : (analytics.pages ?? []).length === 0 ? (
            <p className="text-xs text-gray-400">No analytics data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-gray-400 text-left">
                  <tr><th className="font-medium pb-1.5">Page</th><th className="font-medium pb-1.5 text-right">Sessions</th><th className="font-medium pb-1.5 text-right">Engagement</th><th className="font-medium pb-1.5 text-right">Conversions</th></tr>
                </thead>
                <tbody>
                  {analytics.pages.map((p) => (
                    <tr key={p.page} className="border-t border-gray-50 dark:border-gray-800">
                      <td className="py-1.5 pr-2 text-gray-800 dark:text-gray-200 truncate max-w-xs">{p.page}</td>
                      <td className="py-1.5 text-right text-gray-600 dark:text-gray-300">{p.sessions.toLocaleString()}</td>
                      <td className="py-1.5 text-right text-gray-600 dark:text-gray-300">{Math.round(p.engagementRate * 100)}%</td>
                      <td className="py-1.5 text-right text-gray-600 dark:text-gray-300">{p.conversions.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Review queue + editor */}
        <div className="grid md:grid-cols-[300px_1fr] gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">Posts</h2>
            <div className="space-y-1 max-h-[28rem] overflow-y-auto">
              {(posts?.posts ?? []).length === 0 && <p className="text-xs text-gray-400">No posts yet — use Auto-draft or click Draft on a researched item.</p>}
              {(posts?.posts ?? []).map((p) => (
                <button key={p.id} onClick={() => setSelectedId(p.id)}
                  className={`w-full text-left p-2.5 rounded-lg transition-colors ${selectedId === p.id ? "bg-[#4DC9EE]/10" : "hover:bg-gray-50 dark:hover:bg-gray-800"}`}>
                  <p className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{p.title}</p>
                  <span className={`inline-block mt-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${STATUS_BADGE[p.status] ?? "bg-gray-100 text-gray-600"}`}>{p.status}</span>
                </button>
              ))}
            </div>
          </div>

          <PostEditor key={selectedId ?? "none"} postId={selectedId} onChanged={() => refetchPosts()} />
        </div>
      </div>
    </AdminLayout>
  );
}

function PostEditor({ postId, onChanged }: { postId: string | null; onChanged: () => void }) {
  const { toast } = useToast();
  const { data, refetch } = useGetSeoPost(postId ?? "", { query: { queryKey: getGetSeoPostQueryKey(postId ?? ""), enabled: !!postId } });
  const post = data?.post;

  const update = useUpdateSeoPost();
  const publish = usePublishSeoPost();
  const unpublish = useUnpublishSeoPost();

  const [form, setForm] = useState({ title: "", metaDescription: "", excerpt: "", slug: "", bodyMarkdown: "" });
  useEffect(() => {
    if (post) setForm({
      title: post.title ?? "", metaDescription: post.metaDescription ?? "", excerpt: post.excerpt ?? "",
      slug: post.slug ?? "", bodyMarkdown: post.bodyMarkdown ?? "",
    });
  }, [post]);

  if (!postId) {
    return <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 shadow-sm flex items-center justify-center text-sm text-gray-400">Select a post to review and publish.</div>;
  }

  const save = () => update.mutate({ id: postId, data: form }, {
    onSuccess: () => { toast({ title: "Saved" }); refetch(); onChanged(); },
    onError: () => toast({ title: "Could not save", variant: "destructive" }),
  });
  const doPublish = () => publish.mutate({ id: postId }, {
    onSuccess: () => { toast({ title: "Published ✅", description: "It's live on the blog." }); refetch(); onChanged(); },
    onError: () => toast({ title: "Could not publish", variant: "destructive" }),
  });
  const doUnpublish = () => unpublish.mutate({ id: postId }, {
    onSuccess: () => { toast({ title: "Unpublished", description: "Archived and removed from the blog." }); refetch(); onChanged(); },
    onError: () => toast({ title: "Could not unpublish", variant: "destructive" }),
  });

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${STATUS_BADGE[post?.status ?? "draft"] ?? "bg-gray-100"}`}>{post?.status ?? "…"}</span>
        <div className="flex items-center gap-2">
          {post?.status === "published" && (
            <a href={`/blog/${post.slug}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-[#4DC9EE] hover:underline flex items-center gap-1"><ExternalLink size={12} /> View</a>
          )}
          <button onClick={save} disabled={update.isPending} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50">Save</button>
          {post?.status === "published" ? (
            <button onClick={doUnpublish} disabled={unpublish.isPending} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1"><Archive size={12} /> Unpublish</button>
          ) : (
            <button onClick={doPublish} disabled={publish.isPending} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-600 text-white hover:opacity-90 disabled:opacity-50 flex items-center gap-1"><Send size={12} /> Approve &amp; Publish</button>
          )}
        </div>
      </div>

      <Field label="Title"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} /></Field>
      <Field label="Slug"><input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={inputCls} /></Field>
      <Field label="Meta description"><input value={form.metaDescription} onChange={(e) => setForm({ ...form, metaDescription: e.target.value })} className={inputCls} /></Field>
      <Field label="Excerpt"><input value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} className={inputCls} /></Field>
      <Field label="Body (Markdown)"><textarea value={form.bodyMarkdown} onChange={(e) => setForm({ ...form, bodyMarkdown: e.target.value })} rows={16} className={`${inputCls} font-mono text-xs leading-relaxed`} /></Field>
      {post?.keyword && <p className="text-[11px] text-gray-400">Target keyword: <span className="font-medium">{post.keyword}</span> · drafted by {post.model ?? "—"}</p>}
    </div>
  );
}

const inputCls = "w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-white dark:bg-gray-900";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 dark:text-gray-300 block mb-1">{label}</label>
      {children}
    </div>
  );
}
