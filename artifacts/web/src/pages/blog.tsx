import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "wouter";
import { useEffect } from "react";
import { PublicLayout } from "@/components/public-layout";
import { useGetBlogPosts, getGetBlogPostsQueryKey } from "@workspace/api-client-react";

export default function Blog() {
  const { data, isLoading } = useGetBlogPosts(undefined, { query: { queryKey: getGetBlogPostsQueryKey() } });
  const posts = data?.posts ?? [];

  useEffect(() => {
    document.title = "S-PAY Blog — money tips for global remote workers";
  }, []);

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="pt-16 bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
            <BookOpen size={12} /> S-PAY Blog
          </div>
          <h1 className="text-5xl font-black text-white mb-5 leading-tight">
            Insights for remote workers<br />
            <span className="text-[#4DC9EE]">on the move.</span>
          </h1>
          <p className="text-xl text-blue-200 max-w-xl mx-auto leading-relaxed">
            Getting paid globally, cashing out locally, and making the most of the remote economy.
          </p>
        </div>
      </section>

      {/* Posts */}
      <section className="py-16 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          {isLoading ? (
            <div className="grid md:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-gray-50 rounded-3xl border border-gray-100 p-6 animate-pulse h-44" />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-[#4DC9EE]/10 text-[#4DC9EE] flex items-center justify-center mx-auto mb-5">
                <BookOpen size={26} />
              </div>
              <h2 className="text-2xl font-black text-[#1A2B4A] mb-3">New articles are on the way.</h2>
              <p className="text-gray-500 max-w-md mx-auto">
                We're publishing guides on receiving money worldwide and cashing out locally. Check back soon.
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {posts.map((p) => (
                <Link key={p.id} href={`/blog/${p.slug}`}>
                  <article className="bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full flex flex-col">
                    <div className="h-32 flex items-center justify-center bg-[#4DC9EE]/10">
                      <BookOpen size={34} className="text-[#4DC9EE] opacity-70" />
                    </div>
                    <div className="p-6 flex-1 flex flex-col">
                      <h2 className="font-bold text-[#1A2B4A] text-base leading-snug mb-2 line-clamp-3">{p.title}</h2>
                      {(p.metaDescription || p.excerpt) && (
                        <p className="text-sm text-gray-500 line-clamp-3 flex-1">{p.metaDescription || p.excerpt}</p>
                      )}
                      <span className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-[#4DC9EE]">
                        Read more <ArrowRight size={13} />
                      </span>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-[#1A2B4A]">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-blue-300 text-sm mb-4">Ready to get paid like a local, anywhere?</p>
          <Link href="/register">
            <button className="inline-flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-8 py-4 rounded-2xl hover:bg-[#2E8FD6] transition-colors shadow-lg">
              Open Free Account <ArrowRight size={18} />
            </button>
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
}
