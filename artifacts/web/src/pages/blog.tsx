import { ArrowRight, BookOpen, Bell } from "lucide-react";
import { Link } from "wouter";
import { PublicLayout } from "@/components/public-layout";

const COMING_TOPICS = [
  { color: "#4DC9EE", tag: "Finance Tips", title: "5 ways remote workers lose money on international transfers — and how to avoid them" },
  { color: "#22C55E", tag: "Product", title: "Introducing instant M-Pesa withdrawals: how we built it and what it means for you" },
  { color: "#F59E0B", tag: "Market Insights", title: "The remote work economy in Africa: $12B in freelance earnings and the infrastructure gap" },
];

export default function Blog() {
  return (
    <PublicLayout>

      {/* Hero */}
      <section className="pt-16 bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 text-[#A8DEFF] text-xs font-semibold px-4 py-1.5 rounded-full mb-6 border border-white/20">
            <BookOpen size={12} /> S-PAY Blog
          </div>
          <h1 className="text-5xl font-black text-white mb-5 leading-tight">
            Insights for remote workers<br />
            <span className="text-[#4DC9EE]">on the move.</span>
          </h1>
          <p className="text-xl text-blue-200 max-w-xl mx-auto leading-relaxed">
            Finance tips, product updates, and market insights for the global remote worker community.
          </p>
        </div>
      </section>

      {/* Coming soon notice */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <div className="inline-flex items-center gap-2 bg-[#4DC9EE]/10 text-[#4DC9EE] text-sm font-semibold px-4 py-2 rounded-full mb-5">
              <span className="w-2 h-2 rounded-full bg-[#4DC9EE] animate-pulse" />
              Coming soon
            </div>
            <h2 className="text-3xl font-black text-[#1A2B4A] mb-4">We're working on it.</h2>
            <p className="text-gray-500 max-w-lg mx-auto">
              Our blog launches soon with guides, product deep-dives, and research on the global remote work economy. Here's a preview of what's coming.
            </p>
          </div>

          {/* Preview cards */}
          <div className="grid md:grid-cols-3 gap-6">
            {COMING_TOPICS.map((post) => (
              <div key={post.title} className="bg-gray-50 rounded-3xl overflow-hidden border border-gray-100 hover:shadow-md transition-shadow">
                <div className="h-36 flex items-center justify-center" style={{ backgroundColor: post.color + "18" }}>
                  <BookOpen size={36} style={{ color: post.color }} className="opacity-60" />
                </div>
                <div className="p-6">
                  <span
                    className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full text-white inline-block mb-3"
                    style={{ backgroundColor: post.color }}
                  >
                    {post.tag}
                  </span>
                  <p className="font-semibold text-[#1A2B4A] text-sm leading-snug">{post.title}</p>
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#4DC9EE]" />
                    Coming soon
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Email notify */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-xl mx-auto text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#4DC9EE]/10 flex items-center justify-center mx-auto mb-5">
            <Bell size={24} className="text-[#4DC9EE]" />
          </div>
          <h2 className="text-3xl font-black text-[#1A2B4A] mb-4">Get notified when we publish</h2>
          <p className="text-gray-500 mb-8">Be the first to read our guides and product updates. No spam — max one email per week.</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
            <input
              type="email"
              placeholder="your@email.com"
              className="flex-1 px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20"
            />
            <button className="flex items-center justify-center gap-2 bg-[#4DC9EE] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#2E8FD6] transition-colors text-sm whitespace-nowrap">
              Notify Me <ArrowRight size={15} />
            </button>
          </div>
          <p className="text-gray-400 text-xs mt-3">We'll only email you about the blog. Unsubscribe anytime.</p>
        </div>
      </section>

      {/* Redirect to main app CTA */}
      <section className="py-16 px-6 bg-[#1A2B4A]">
        <div className="max-w-2xl mx-auto text-center">
          <p className="text-blue-300 text-sm mb-4">Ready to get started with S-PAY?</p>
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
