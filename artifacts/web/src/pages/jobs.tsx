import { useState } from "react";
import { Layout } from "@/components/layout";
import { useGetJobs, getGetJobsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, MapPin, DollarSign, Building, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function Jobs() {
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  
  // Simple debounce for search
  useState(() => {
    const timer = setTimeout(() => setDebouncedKeyword(keyword), 500);
    return () => clearTimeout(timer);
  });

  const { data: jobsData, isLoading } = useGetJobs(
    { keyword: debouncedKeyword },
    { query: { queryKey: getGetJobsQueryKey({ keyword: debouncedKeyword }) } }
  );

  return (
    <Layout title="Remote Jobs">
      <div className="space-y-6 mt-4">
        
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="text-gray-400" size={20} />
          </div>
          <Input 
            type="text"
            className="pl-11 h-14 rounded-2xl bg-white border-0 shadow-md text-base"
            placeholder="Search remote jobs, roles, companies..."
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </div>

        {/* Categories (Static for now) */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {["All", "Engineering", "Design", "Marketing", "Product", "Sales"].map((cat) => (
             <Button key={cat} variant={cat === "All" ? "default" : "outline"} className="rounded-full flex-shrink-0" size="sm">
               {cat}
             </Button>
          ))}
        </div>

        {/* Job Listings */}
        <div className="space-y-4">
          {isLoading ? (
             Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="border-0 shadow-sm rounded-xl">
                <CardContent className="p-5 flex gap-4">
                  <Skeleton className="w-12 h-12 rounded-lg" />
                  <div className="flex-1 space-y-3">
                    <Skeleton className="h-5 w-1/2" />
                    <Skeleton className="h-4 w-1/3" />
                    <div className="flex gap-2">
                       <Skeleton className="h-6 w-20 rounded-full" />
                       <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : jobsData?.jobs.length === 0 ? (
             <div className="text-center py-12 bg-white rounded-2xl shadow-sm border border-gray-50">
                <Search size={40} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900">No jobs found</h3>
                <p className="text-gray-500 mt-1">Try adjusting your search criteria</p>
             </div>
          ) : (
            jobsData?.jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="border border-gray-100 shadow-sm rounded-xl hover:shadow-md transition-shadow cursor-pointer bg-white overflow-hidden group">
                  <CardContent className="p-5">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gray-50 border flex items-center justify-center overflow-hidden">
                           {job.companyLogo ? (
                             <img src={job.companyLogo} alt={job.company} className="w-full h-full object-cover" />
                           ) : (
                             <Building size={24} className="text-gray-400" />
                           )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors">{job.title}</h3>
                          <p className="text-sm text-gray-600">{job.company}</p>
                        </div>
                      </div>
                      {job.isNew && (
                        <span className="bg-primary/10 text-primary text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider">
                          New
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap gap-y-2 mt-4 ml-15">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2.5 py-1 rounded-md mr-2 border border-gray-100">
                        <MapPin size={12} /> {job.location}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2.5 py-1 rounded-md mr-2 border border-gray-100">
                        <DollarSign size={12} /> {job.salary}
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 ml-auto pt-1">
                         via {job.source}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))
          )}
        </div>
        
        {/* Affiliate CTA */}
        {jobsData?.remoteCom && (
          <Card className="border border-blue-100 bg-blue-50/50 rounded-xl overflow-hidden mt-8">
             <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
                <h4 className="font-semibold text-gray-900">Looking for international hiring?</h4>
                <p className="text-sm text-gray-600">Hire and pay remote workers globally with full compliance.</p>
                <a href={jobsData.remoteCom.url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="mt-2 bg-white flex items-center gap-2">
                    {jobsData.remoteCom.label} <ExternalLink size={16} />
                  </Button>
                </a>
             </CardContent>
          </Card>
        )}

      </div>
    </Layout>
  );
}