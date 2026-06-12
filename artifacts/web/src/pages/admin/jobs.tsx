import { useState } from "react";
import { AdminLayout } from "./layout";
import {
  useGetCustomJobs, getGetCustomJobsQueryKey,
  useCreateCustomJob, useDeleteCustomJob,
} from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, Plus, Trash2, ExternalLink, Megaphone } from "lucide-react";

const CATEGORIES = ["Engineering", "Design", "Marketing", "Product", "Sales", "Finance", "Operations"];

const EMPTY_FORM = { title: "", company: "S-PAY", applyUrl: "", category: "Engineering", location: "Worldwide", salary: "", description: "" };

export default function AdminJobs() {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useGetCustomJobs({ query: { queryKey: getGetCustomJobsQueryKey() } });
  const createJob = useCreateCustomJob();
  const deleteJob = useDeleteCustomJob();
  const [form, setForm] = useState(EMPTY_FORM);

  const set = (k: keyof typeof EMPTY_FORM) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createJob.mutate(
      { data: { ...form, salary: form.salary || undefined, description: form.description || undefined, category: form.category as any } },
      {
        onSuccess: () => {
          toast({ title: "Listing published", description: "It's pinned to the top of the jobs feed and in the SEO sitemap." });
          setForm(EMPTY_FORM);
          refetch();
        },
        onError: (err: any) => toast({ title: "Could not publish", description: err?.message ?? "Check the fields and try again.", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (jobId: string, title: string) => {
    if (!window.confirm(`Remove "${title}" from the jobs feed?`)) return;
    deleteJob.mutate(
      { jobId },
      {
        onSuccess: () => { toast({ title: "Listing removed" }); refetch(); },
        onError: () => toast({ title: "Could not remove", variant: "destructive" }),
      },
    );
  };

  return (
    <AdminLayout title="S-PAY Job Listings">
      <div className="space-y-6 max-w-4xl">

        <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-4">
          <Megaphone size={16} className="text-[#2E8FD6] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-800 leading-relaxed">
            Listings you publish here are <strong>pinned to the top</strong> of the jobs feed (source badge: SPAY),
            included in the <strong>SEO sitemap</strong> and Google for Jobs structured data, and live within 30 seconds.
            Use them for S-PAY roles, partner companies, or sponsored placements.
          </p>
        </div>

        {/* Add listing */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Plus size={18} className="text-[#4DC9EE]" /> Publish a listing
          </h3>
          <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Job title *</label>
              <Input required value={form.title} onChange={(e) => set("title")(e.target.value)} placeholder="Senior Backend Engineer" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Company *</label>
              <Input required value={form.company} onChange={(e) => set("company")(e.target.value)} placeholder="S-PAY" className="rounded-xl" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Apply URL *</label>
              <Input required type="url" value={form.applyUrl} onChange={(e) => set("applyUrl")(e.target.value)} placeholder="https://spayewallet.com/careers" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Category</label>
              <select
                value={form.category}
                onChange={(e) => set("category")(e.target.value)}
                className="w-full h-10 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 text-sm focus:outline-none focus:border-[#4DC9EE]"
              >
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Location</label>
              <Input value={form.location} onChange={(e) => set("location")(e.target.value)} placeholder="Worldwide" className="rounded-xl" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Salary (optional)</label>
              <Input value={form.salary} onChange={(e) => set("salary")(e.target.value)} placeholder="$60k–$90k" className="rounded-xl" />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Description (optional, HTML allowed)</label>
              <textarea
                value={form.description}
                onChange={(e) => set("description")(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm focus:outline-none focus:border-[#4DC9EE]"
                placeholder="What the role involves, requirements, how to apply…"
              />
            </div>
            <div className="md:col-span-2">
              <Button type="submit" disabled={createJob.isPending} className="rounded-xl bg-[#4DC9EE] hover:bg-[#2E8FD6] font-bold">
                {createJob.isPending ? "Publishing…" : "Publish to Jobs Feed"}
              </Button>
            </div>
          </form>
        </div>

        {/* Active listings */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2">
            <Briefcase size={18} className="text-[#4DC9EE]" /> Active S-PAY listings
          </h3>
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}</div>
          ) : !data?.jobs || data.jobs.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No custom listings yet — publish your first one above.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.jobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{j.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {j.company} · {j.category ?? "Engineering"} · {j.location ?? "Worldwide"} · added {new Date(j.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" className="p-2 text-gray-400 hover:text-[#4DC9EE]" aria-label="Open apply URL">
                      <ExternalLink size={15} />
                    </a>
                    <button
                      onClick={() => handleDelete(j.id, j.title)}
                      disabled={deleteJob.isPending}
                      className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-50"
                      aria-label="Remove listing"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
