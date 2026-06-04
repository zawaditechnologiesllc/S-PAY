import { useState, useEffect } from "react";
import { Link } from "wouter";
import { useGetJobs, getGetJobsQueryKey } from "@workspace/api-client-react";
import { PublicLayout } from "@/components/public-layout";
import {
  Search, MapPin, DollarSign, Building, RefreshCw, Briefcase,
  ArrowRight, Lock, ChevronRight,
} from "lucide-react";

const CATEGORIES = ["All", "Engineering", "Design", "Marketing", "Product", "Sales", "Finance", "Operations"];

const CATEGORY_MAP: Record<string, string> = {
  Engineering: "software-dev",
  Design: "design",
  Marketing: "marketing",
  Product: "product",
  Sales: "sales",
  Finance: "finance",
  Operations: "all-others",
};

const SOURCE_COLORS: Record<string, string> = {
  Himalayas: "bg-purple-50 text-purple-700 border-purple-100",
  RemoteOK: "bg-green-50 text-green-700 border-green-100",
  Remotive: "bg-blue-50 text-blue-700 border-blue-100",
  Arbeitnow: "bg-orange-50 text-orange-700 border-orange-100",
  "We Work Remotely": "bg-teal-50 text-teal-700 border-teal-100",
  "The Muse": "bg-pink-50 text-pink-700 border-pink-100",
};

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "bg-sky-50 text-sky-700 border-sky-100",
  Design: "bg-violet-50 text-violet-700 border-violet-100",
  Marketing: "bg-rose-50 text-rose-700 border-rose-100",
  Product: "bg-amber-50 text-amber-700 border-amber-100",
  Sales: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Finance: "bg-blue-50 text-blue-700 border-blue-100",
  Operations: "bg-orange-50 text-orange-700 border-orange-100",
};

export default function PublicJobs() {
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 450);
    return () => clearTimeout(t);
  }, [keyword]);

  const queryParams = {
    keyword: debouncedKeyword || undefined,
    category: selectedCategory !== "All" ? CATEGORY_MAP[selectedCategory] : undefined,
    limit: 50,
  };

  const { data, isLoading, isError, refetch } = useGetJobs(queryParams, {
    query: { queryKey: getGetJobsQueryKey(queryParams) },
  });

  return (
    <PublicLayout active="jobs">

      {/* ── Hero ── */}
      <section className="pt-16 bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38]">
        <div className="max-w-4xl mx-auto px-6 pt-16 pb-14 text-center">
          <div className="inline-flex items-center gap-2 bg-[#4DC9EE]/20 text-[#4DC9EE] text-xs font-bold px-3 py-1.5 rounded-full mb-6 border border-[#4DC9EE]/30">
            <span className="w-1.5 h-1.5 rounded-full bg-[#4DC9EE] animate-pulse" />
            Live · Remote Jobs Board
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white leading-tight mb-4">
            Find your next remote job
          </h1>
          <p className="text-blue-200 text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
            Thousands of fully remote roles updated daily — engineering, design, marketing, finance and more.
            Create a free S-PAY account to apply.
          </p>

          {/* Search bar */}
          <div className="relative max-w-2xl mx-auto">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              className="w-full pl-11 pr-4 py-4 rounded-2xl bg-white text-gray-900 text-base shadow-xl outline-none border-0 placeholder:text-gray-400"
              placeholder="Search jobs, roles, companies…"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            {keyword && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => { setKeyword(""); setDebouncedKeyword(""); }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto justify-center mt-5 pb-1 px-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full text-sm font-semibold flex-shrink-0 transition-all ${
                  selectedCategory === cat
                    ? "bg-[#4DC9EE] text-white shadow-md"
                    : "bg-white/10 text-blue-200 hover:bg-white/20 border border-white/15"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── Conversion banner ── */}
      <div className="bg-[#4DC9EE]/10 border-b border-[#4DC9EE]/20 py-3 px-6">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2 text-[#1A2B4A]">
            <Lock size={14} className="text-[#4DC9EE] flex-shrink-0" />
            <span className="font-medium">Create a free S-PAY account to unlock apply links, get paid for remote work, and access your digital wallet.</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Link href="/login">
              <span className="text-sm font-semibold text-[#1A2B4A] hover:text-[#4DC9EE] transition-colors cursor-pointer">Sign in</span>
            </Link>
            <Link href="/register">
              <span className="inline-flex items-center gap-1.5 bg-[#4DC9EE] text-white text-sm font-bold px-4 py-1.5 rounded-full hover:bg-[#2E8FD6] transition-colors cursor-pointer shadow-sm">
                Get Started Free <ArrowRight size={13} />
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* ── Job listings ── */}
      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Result count */}
        {!isLoading && !isError && data && (
          <p className="text-sm text-gray-500 mb-5">
            {data.total > 0
              ? `Showing ${data.jobs.length} of ${data.total} remote jobs`
              : "No jobs found"}
            {selectedCategory !== "All" && ` in ${selectedCategory}`}
            {debouncedKeyword && ` for "${debouncedKeyword}"`}
          </p>
        )}

        {/* Error */}
        {isError && (
          <div className="flex items-center justify-between bg-red-50 border border-red-100 rounded-xl p-4 mb-5">
            <span className="text-sm text-red-700">Failed to load jobs. Check your connection.</span>
            <button
              onClick={() => refetch()}
              className="flex items-center gap-1.5 text-sm font-semibold text-red-700 hover:text-red-900 ml-4"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex gap-4 animate-pulse">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0" />
                <div className="flex-1 space-y-2.5">
                  <div className="h-4 bg-gray-100 rounded w-1/2" />
                  <div className="h-3 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
                <div className="w-32 h-9 bg-gray-100 rounded-full self-center flex-shrink-0" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data?.jobs.length === 0 && (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Briefcase size={40} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No jobs found</h3>
            <p className="text-gray-500 text-sm">
              {debouncedKeyword
                ? `No results for "${debouncedKeyword}" — try different keywords`
                : "Try a different category or check back later"}
            </p>
            {(debouncedKeyword || selectedCategory !== "All") && (
              <button
                className="mt-4 text-sm font-semibold text-[#4DC9EE] hover:underline"
                onClick={() => { setKeyword(""); setDebouncedKeyword(""); setSelectedCategory("All"); }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* Job cards */}
        {!isLoading && data?.jobs && data.jobs.length > 0 && (
          <div className="space-y-3">
            {data.jobs.map((job) => (
              <div
                key={job.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 overflow-hidden group"
              >
                <div className="p-4 flex items-center gap-4">
                  {/* Logo */}
                  <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {job.companyLogo ? (
                      <img
                        src={job.companyLogo}
                        alt={job.company}
                        className="w-full h-full object-contain p-1"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <Building size={20} className="text-gray-300" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <h3 className="font-semibold text-gray-900 text-sm group-hover:text-[#4DC9EE] transition-colors truncate">
                        {job.title}
                      </h3>
                      {job.isNew && (
                        <span className="text-[10px] bg-[#4DC9EE]/10 text-[#4DC9EE] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider flex-shrink-0">
                          New
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{job.company}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                        <MapPin size={9} /> {job.location}
                      </span>
                      {job.salary && job.salary !== "Competitive" && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                          <DollarSign size={9} /> {job.salary}
                        </span>
                      )}
                      {job.category && (
                        <button
                          className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-80 ${CATEGORY_COLORS[job.category] ?? "bg-gray-50 text-gray-500 border-gray-100"}`}
                          onClick={() => { if (job.category in CATEGORY_MAP) setSelectedCategory(job.category); }}
                        >
                          {job.category}
                        </button>
                      )}
                      <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${SOURCE_COLORS[job.source] ?? "bg-gray-50 text-gray-500 border-gray-100"}`}>
                        {job.source}
                      </span>
                    </div>
                  </div>

                  {/* CTA */}
                  <div className="flex-shrink-0 hidden sm:block">
                    <Link href={`/register?from=jobs&jobId=${job.id}`}>
                      <span className="inline-flex items-center gap-1.5 bg-[#1A2B4A] text-white text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[#4DC9EE] transition-colors cursor-pointer whitespace-nowrap">
                        Sign Up to Apply <ChevronRight size={13} />
                      </span>
                    </Link>
                  </div>
                </div>

                {/* Mobile CTA */}
                <div className="sm:hidden px-4 pb-4">
                  <Link href={`/register?from=jobs&jobId=${job.id}`}>
                    <span className="flex items-center justify-center gap-1.5 bg-[#1A2B4A] text-white text-xs font-bold px-4 py-2.5 rounded-full hover:bg-[#4DC9EE] transition-colors cursor-pointer w-full">
                      Sign Up to Apply <ChevronRight size={13} />
                    </span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        {!isLoading && data && data.jobs.length > 0 && (
          <div className="mt-10 bg-gradient-to-br from-[#1A2B4A] to-[#0d1f38] rounded-2xl p-8 text-center">
            <h3 className="text-xl font-black text-white mb-3">Ready to apply?</h3>
            <p className="text-blue-300 text-sm mb-6 max-w-md mx-auto">
              Create a free S-PAY account to unlock apply links, get paid in Digital Dollars, and withdraw to your local payment method in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/register">
                <span className="inline-flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-7 py-3.5 rounded-2xl hover:bg-[#2E8FD6] transition-colors cursor-pointer shadow-lg">
                  Create Free Account <ArrowRight size={16} />
                </span>
              </Link>
              <Link href="/login">
                <span className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-7 py-3.5 rounded-2xl hover:bg-white/20 transition-colors cursor-pointer border border-white/20">
                  Already have an account? Sign in
                </span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
