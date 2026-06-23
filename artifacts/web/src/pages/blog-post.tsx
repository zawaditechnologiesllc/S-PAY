import { useEffect } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { PublicLayout } from "@/components/public-layout";
import { useGetBlogPost, getGetBlogPostQueryKey } from "@workspace/api-client-react";
import { mdToHtml } from "@/lib/markdown";

const JSONLD_ID = "blog-post-jsonld";

export default function BlogPost() {
  const [, params] = useRoute("/blog/:slug");
  const slug = params?.slug ?? "";
  const { data, isLoading, isError } = useGetBlogPost(slug, {
    query: { queryKey: getGetBlogPostQueryKey(slug), enabled: !!slug, retry: false },
  });
  const post = data?.post;

  // SEO: set the document title + meta description, and inject the Article
  // JSON-LD into <head> (for users/JS crawlers; bots also get the SSR version).
  useEffect(() => {
    if (!post) return;
    const prevTitle = document.title;
    document.title = `${post.title} · S-PAY`;

    const meta = document.querySelector('meta[name="description"]') ?? (() => {
      const m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); return m;
    })();
    const prevDesc = meta.getAttribute("content");
    meta.setAttribute("content", post.metaDescription ?? post.excerpt ?? post.title);

    let script: HTMLScriptElement | null = null;
    if (data?.jsonLd) {
      script = document.getElementById(JSONLD_ID) as HTMLScriptElement | null;
      if (!script) { script = document.createElement("script"); script.id = JSONLD_ID; script.type = "application/ld+json"; document.head.appendChild(script); }
      script.textContent = JSON.stringify(data.jsonLd);
    }
    return () => {
      document.title = prevTitle;
      if (prevDesc != null) meta.setAttribute("content", prevDesc);
      document.getElementById(JSONLD_ID)?.remove();
    };
  }, [post, data?.jsonLd]);

  return (
    <PublicLayout>
      <article className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <Link href="/blog">
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#4DC9EE] hover:underline cursor-pointer mb-6">
            <ArrowLeft size={15} /> All articles
          </span>
        </Link>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-9 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-5/6 bg-gray-100 rounded animate-pulse" />
          </div>
        ) : isError || !post ? (
          <div className="text-center py-16">
            <h1 className="text-2xl font-black text-[#1A2B4A] mb-3">Article not found</h1>
            <p className="text-gray-500 mb-6">This post may have been moved or unpublished.</p>
            <Link href="/blog"><span className="text-[#4DC9EE] font-semibold hover:underline cursor-pointer">Back to the blog</span></Link>
          </div>
        ) : (
          <>
            <h1 className="text-3xl md:text-4xl font-black text-[#1A2B4A] leading-tight mb-3">{post.title}</h1>
            {post.publishedAt && (
              <p className="text-sm text-gray-400 mb-8">{new Date(post.publishedAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
            )}
            <div
              className="prose prose-slate max-w-none prose-headings:text-[#1A2B4A] prose-a:text-[#2E8FD6] prose-h2:mt-8 prose-h2:mb-3 prose-h3:mt-6 prose-li:my-1"
              dangerouslySetInnerHTML={{ __html: mdToHtml(post.bodyMarkdown ?? "") }}
            />
            <div className="mt-12 rounded-2xl bg-gradient-to-br from-[#1A2B4A] to-[#0d1f38] p-6 text-center">
              <p className="text-white font-bold mb-4">Get paid globally. Cash out locally — in minutes.</p>
              <Link href="/register">
                <button className="inline-flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-7 py-3.5 rounded-xl hover:bg-[#2E8FD6] transition-colors">
                  Open a free S-PAY account <ArrowRight size={16} />
                </button>
              </Link>
            </div>
          </>
        )}
      </article>
    </PublicLayout>
  );
}
