import { Layout } from "@/components/layout";
import { useGetJobById, getGetJobByIdQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, DollarSign, Building, Clock, Briefcase, ExternalLink } from "lucide-react";

export default function JobDetail() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId || "";

  const { data: job, isLoading } = useGetJobById(
    jobId,
    { query: { queryKey: getGetJobByIdQueryKey(jobId), enabled: !!jobId } }
  );

  return (
    <Layout title="Job Details">
      <div className="mb-6">
        <Link href="/jobs" className="inline-flex items-center text-sm font-medium text-white/80 hover:text-white">
          <ArrowLeft size={16} className="mr-1" /> Back to Jobs
        </Link>
      </div>

      <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        {isLoading ? (
          <div className="p-8 space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-xl" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-8 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            </div>
            <div className="flex gap-4">
              <Skeleton className="h-8 w-24 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
            <div className="space-y-3 pt-6 border-t">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>
        ) : !job ? (
          <div className="p-12 text-center text-gray-500">
            Job not found.
          </div>
        ) : (
          <>
            <div className="p-6 md:p-8 border-b">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl bg-gray-50 border flex items-center justify-center overflow-hidden flex-shrink-0">
                    {job.companyLogo ? (
                      <img src={job.companyLogo} alt={job.company} className="w-full h-full object-cover" />
                    ) : (
                      <Building size={28} className="text-gray-400" />
                    )}
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">{job.title}</h1>
                    <p className="text-lg text-gray-600 font-medium">{job.company}</p>
                    
                    <div className="flex flex-wrap gap-3 mt-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border">
                        <MapPin size={14} className="text-gray-400" /> {job.location}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border">
                        <DollarSign size={14} className="text-gray-400" /> {job.salary}
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border capitalize">
                        <Briefcase size={14} className="text-gray-400" /> {job.jobType.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex-shrink-0 w-full md:w-auto">
                   <a href={job.applyUrl || job.sourceUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                     <Button className="w-full md:w-auto h-12 px-8 text-base shadow-md">Apply Now</Button>
                   </a>
                   {job.postedAt && (
                     <p className="text-xs text-gray-500 text-center mt-3 flex items-center justify-center gap-1">
                       <Clock size={12} /> Posted {new Date(job.postedAt).toLocaleDateString()}
                     </p>
                   )}
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">About the Role</h3>
              <div className="prose prose-blue max-w-none text-gray-600">
                {job.description ? (
                  <div dangerouslySetInnerHTML={{ __html: job.description }} />
                ) : (
                  <p>No detailed description provided. Please view the original posting for more details.</p>
                )}
              </div>
              
              <div className="mt-8 pt-8 border-t flex flex-col items-center justify-center text-center">
                 <p className="text-sm text-gray-500 mb-4">
                   This job is sourced from <span className="font-semibold text-gray-700">{job.source}</span>
                 </p>
                 <a href={job.sourceUrl} target="_blank" rel="noopener noreferrer">
                   <Button variant="outline" className="text-gray-600 bg-gray-50">
                     View Original Posting <ExternalLink size={16} className="ml-2" />
                   </Button>
                 </a>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}