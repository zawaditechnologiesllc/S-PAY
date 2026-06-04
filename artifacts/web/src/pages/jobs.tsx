import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { useGetJobs, getGetJobsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, MapPin, DollarSign, Building, ExternalLink, RefreshCw, Briefcase } from "lucide-react";
import { Link } from "wouter";

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

const CATEGORY_COLORS: Record<string, string> = {
  Engineering: "bg-sky-50 text-sky-700 border-sky-100",
  Design: "bg-violet-50 text-violet-700 border-violet-100",
  Marketing: "bg-rose-50 text-rose-700 border-rose-100",
  Product: "bg-amber-50 text-amber-700 border-amber-100",
  Sales: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Finance: "bg-blue-50 text-blue-700 border-blue-100",
  Operations: "bg-orange-50 text-orange-700 border-orange-100",
};

export default function Jobs() {
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 500);
    return () => clearTimeout(timer);
  }, [keyword]);

  const queryParams = {
    keyword: debouncedKeyword || undefined,
    category: selectedCategory !== "All" ? CATEGORY_MAP[selectedCategory] : undefined,
    limit: 200,
  };

  const { data: jobsData, isLoading, isError, refetch } = useGetJobs(
    queryParams,
    { query: { queryKey: getGetJobsQueryKey(queryParams) } }
  );

  const SOURCE_COLORS: Record<string, string> = {
    Himalayas: "bg-purple-50 text-purple-700 border-purple-100",
    RemoteOK: "bg-green-50 text-green-700 border-green-100",
    Remotive: "bg-blue-50 text-blue-700 border-blue-100",
    Arbeitnow: "bg-orange-50 text-orange-700 border-orange-100",
    TheMuse: "bg-pink-50 text-pink-700 border-pink-100",
    WeWorkRemotely: "bg-teal-50 text-teal-700 border-teal-100",
    Jobicy: "bg-indigo-50 text-indigo-700 border-indigo-100",
    WorkingNomads: "bg-cyan-50 text-cyan-700 border-cyan-100",
    Jobspresso: "bg-lime-50 text-lime-700 border-lime-100",
    RemoteCo: "bg-yellow-50 text-yellow-700 border-yellow-100",
    DailyRemote: "bg-red-50 text-red-700 border-red-100",
    Nodesk: "bg-slate-50 text-slate-700 border-slate-100",
    "4DayWeek": "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  return (
    <Layout title="Remote Jobs">
      <div className="space-y-5 mt-4">

        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="text-gray-400" size={20} />
          </div>
          <Input
            type="text"
            className="pl-11 h-14 rounded-2xl bg-white border-0 shadow-md text-base"
            placeholder="Search jobs, roles, companies..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
          {keyword && (
            <button
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600"
              onClick={() => { setKeyword(""); setDebouncedKeyword(""); }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={cat === selectedCategory ? "default" : "outline"}
              className="rounded-full flex-shrink-0"
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
        </div>

        {/* Result count + affiliate banner */}
        {!isLoading && !isError && jobsData && (
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-sm text-gray-500">
              {jobsData.total > 0
                ? `Showing ${jobsData.jobs.length} of ${jobsData.total} remote jobs`
                : "No jobs found"}
              {selectedCategory !== "All" && ` in ${selectedCategory}`}
              {debouncedKeyword && ` for "${debouncedKeyword}"`}
            </p>
            {jobsData.remoteCom && (
              <a href={jobsData.remoteCom.url} target="_blank" rel="noopener noreferrer"
                 className="text-xs text-primary underline flex items-center gap-1 hover:opacity-80">
                {jobsData.remoteCom.label} <ExternalLink size={11} />
              </a>
            )}
          </div>
        )}

        {/* Error State */}
        {isError && (
          <Alert variant="destructive">
            <AlertDescription className="flex items-center justify-between">
              <span>Failed to load jobs. Check your connection and try again.</span>
              <Button size="sm" variant="outline" onClick={() => refetch()} className="ml-4">
                <RefreshCw size={14} className="mr-1" /> Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Job Listings */}
        <div className="space-y-3">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm rounded-xl">
                <CardContent className="p-5 flex gap-4">
                  <Skeleton className="w-12 h-12 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-24 rounded-full" />
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : jobsData?.jobs.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl shadow-sm border border-gray-50">
              <Briefcase size={40} className="mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900">No jobs found</h3>
              <p className="text-gray-500 mt-1 text-sm">
                {debouncedKeyword
                  ? `No results for "${debouncedKeyword}" — try different keywords`
                  : "Try a different category or check back later"}
              </p>
              {(debouncedKeyword || selectedCategory !== "All") && (
                <Button variant="outline" size="sm" className="mt-4"
                  onClick={() => { setKeyword(""); setDebouncedKeyword(""); setSelectedCategory("All"); }}>
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            jobsData?.jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="border border-gray-100 shadow-sm rounded-xl hover:shadow-md transition-all cursor-pointer bg-white overflow-hidden group">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-lg bg-gray-50 border flex items-center justify-center overflow-hidden flex-shrink-0">
                        {job.companyLogo ? (
                          <img
                            src={job.companyLogo}
                            alt={job.company}
                            className="w-full h-full object-contain p-1"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <Building size={20} className="text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors text-sm leading-tight truncate">
                              {job.title}
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">{job.company}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {job.isNew && (
                              <span className="bg-primary/10 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">
                                New
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                            <MapPin size={10} /> {job.location}
                          </span>
                          {job.salary && job.salary !== "Competitive" && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-0.5 rounded border border-gray-100">
                              <DollarSign size={10} /> {job.salary}
                            </span>
                          )}
                          {job.category && (
                            <button
                              className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded border cursor-pointer hover:opacity-80 ${CATEGORY_COLORS[job.category!] ?? "bg-gray-50 text-gray-500 border-gray-100"}`}
                              onClick={(e) => { e.preventDefault(); const cat = job.category; if (cat && cat in CATEGORY_MAP) setSelectedCategory(cat); }}
                            >
                              {job.category}
                            </button>
                          )}
                          <span className={`inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded border ${SOURCE_COLORS[job.source] ?? "bg-gray-50 text-gray-500 border-gray-100"}`}>
                            {job.source}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>

        {/* Bottom affiliate CTA */}
        {jobsData?.remoteCom && jobsData.jobs.length > 0 && (
          <Card className="border border-blue-100 bg-gradient-to-r from-blue-50 to-sky-50 rounded-xl overflow-hidden mt-6">
            <CardContent className="p-5 flex flex-col sm:flex-row items-center gap-4">
              <div className="flex-1 text-center sm:text-left">
                <h4 className="font-semibold text-gray-900 text-sm">Hire globally with compliance</h4>
                <p className="text-xs text-gray-500 mt-0.5">Manage international teams, payroll, and benefits in one place.</p>
              </div>
              <a href={jobsData.remoteCom.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                <Button variant="outline" size="sm" className="bg-white flex items-center gap-2 shadow-sm">
                  Remote.com <ExternalLink size={13} />
                </Button>
              </a>
            </CardContent>
          </Card>
        )}

      </div>
    </Layout>
  );
}
