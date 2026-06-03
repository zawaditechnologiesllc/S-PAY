import { Link, useParams } from "wouter";
import { useGetJobById, getGetJobByIdQueryKey } from "@workspace/api-client-react";
import { PublicLayout } from "@/components/public-layout";
import {
  ArrowLeft, MapPin, DollarSign, Building, Clock, Briefcase,
  Lock, ArrowRight, ChevronRight,
} from "lucide-react";

function sanitizeDescription(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, "")
    .replace(/javascript\s*:/gi, "");
}

export default function PublicJobDetail() {
  const params = useParams<{ jobId: string }>();
  const jobId = params.jobId || "";

  const { data: job, isLoading } = useGetJobById(jobId, {
    query: { queryKey: getGetJobByIdQueryKey(jobId), enabled: !!jobId },
  });

  return (
    <PublicLayout active="jobs">

      {/* ── Header ── */}
      <div className="pt-16 bg-gradient-to-br from-[#1A2B4A] to-[#0d1f38]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <Link href="/jobs">
            <span className="inline-flex items-center gap-1.5 text-blue-300 hover:text-[#4DC9EE] text-sm font-medium transition-colors cursor-pointer">
              <ArrowLeft size={15} /> Back to Jobs
            </span>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">

        {/* Loading */}
        {isLoading && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 animate-pulse space-y-5">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gray-100 rounded-xl" />
              <div className="space-y-2 flex-1">
                <div className="h-7 bg-gray-100 rounded w-2/3" />
                <div className="h-4 bg-gray-100 rounded w-1/3" />
              </div>
            </div>
            <div className="flex gap-3">
              <div className="h-8 w-28 bg-gray-100 rounded-lg" />
              <div className="h-8 w-24 bg-gray-100 rounded-lg" />
            </div>
            <div className="space-y-3 pt-6 border-t">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-4 bg-gray-100 rounded w-full" />
              ))}
            </div>
          </div>
        )}

        {/* Not found */}
        {!isLoading && !job && (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <Briefcase size={40} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Job not found</h3>
            <p className="text-gray-500 text-sm mb-6">This job may have expired or been removed.</p>
            <Link href="/jobs">
              <span className="inline-flex items-center gap-1.5 bg-[#4DC9EE] text-white font-semibold px-5 py-2.5 rounded-full cursor-pointer hover:bg-[#2E8FD6] transition-colors text-sm">
                Browse All Jobs <ArrowRight size={14} />
              </span>
            </Link>
          </div>
        )}

        {/* Job detail */}
        {!isLoading && job && (
          <div className="space-y-5">

            {/* Main card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

              {/* Header */}
              <div className="p-6 md:p-8 border-b border-gray-100">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {job.companyLogo ? (
                        <img src={job.companyLogo} alt={job.company} className="w-full h-full object-contain p-1" />
                      ) : (
                        <Building size={28} className="text-gray-300" />
                      )}
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-gray-900 mb-1">{job.title}</h1>
                      <p className="text-gray-600 font-medium text-lg mb-4">{job.company}</p>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                          <MapPin size={13} className="text-gray-400" /> {job.location}
                        </span>
                        {job.salary && job.salary !== "Competitive" && (
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <DollarSign size={13} className="text-gray-400" /> {job.salary}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1.5 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 capitalize">
                          <Briefcase size={13} className="text-gray-400" /> {job.jobType?.replace("_", " ")}
                        </span>
                        {job.postedAt && (
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
                            <Clock size={13} className="text-gray-400" /> Posted {new Date(job.postedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Apply CTA (auth gate) */}
                  <div className="flex-shrink-0 w-full md:w-auto">
                    <Link href={`/register?from=jobs&jobId=${jobId}`}>
                      <span className="flex items-center justify-center gap-2 bg-[#1A2B4A] text-white font-bold px-7 py-3.5 rounded-2xl hover:bg-[#4DC9EE] transition-colors cursor-pointer w-full md:w-auto text-sm shadow-md">
                        <Lock size={14} /> Sign Up to Apply
                      </span>
                    </Link>
                    <p className="text-xs text-gray-400 text-center mt-2">Free account · No credit card</p>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="p-6 md:p-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">About the Role</h3>
                <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed">
                  {job.description ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: sanitizeDescription(job.description),
                      }}
                    />
                  ) : (
                    <p className="text-gray-500">No detailed description provided. Create an account to view the full posting.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Auth gate banner */}
            <div className="bg-gradient-to-br from-[#1A2B4A] to-[#0d1f38] rounded-2xl p-8 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#4DC9EE]/20 flex items-center justify-center mx-auto mb-5">
                <Lock size={22} className="text-[#4DC9EE]" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">Ready to apply for this role?</h3>
              <p className="text-blue-300 text-sm mb-6 max-w-md mx-auto leading-relaxed">
                Create a free S-PAY account to access the apply link. You'll also get a real US bank account number and instant local payouts when you land the job.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href={`/register?from=jobs&jobId=${jobId}`}>
                  <span className="inline-flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-7 py-3.5 rounded-2xl hover:bg-[#2E8FD6] transition-colors cursor-pointer shadow-lg">
                    Create Free Account <ArrowRight size={16} />
                  </span>
                </Link>
                <Link href={`/login?from=jobs&jobId=${jobId}`}>
                  <span className="inline-flex items-center gap-2 bg-white/10 text-white font-semibold px-7 py-3.5 rounded-2xl hover:bg-white/20 transition-colors cursor-pointer border border-white/20">
                    Sign in <ChevronRight size={15} />
                  </span>
                </Link>
              </div>
            </div>

          </div>
        )}
      </div>
    </PublicLayout>
  );
}
