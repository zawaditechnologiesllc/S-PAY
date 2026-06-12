import { AdminLayout } from "./layout";
import {
  useGetAdminEnquiries, getGetAdminEnquiriesQueryKey, useUpdateEnquiry,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Mail, CheckCircle2, RotateCcw, Inbox } from "lucide-react";

/** Every enquiry from the landing page, contact page, and signed-in users. */
export default function AdminEnquiries() {
  const { data, isLoading } = useGetAdminEnquiries({ query: { queryKey: getGetAdminEnquiriesQueryKey(), refetchInterval: 60_000 } });
  const update = useUpdateEnquiry();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const setStatus = (enquiryId: string, status: "new" | "resolved") => {
    update.mutate(
      { enquiryId, data: { status } },
      {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAdminEnquiriesQueryKey() }),
        onError: () => toast({ title: "Could not update", variant: "destructive" }),
      },
    );
  };

  const rows = data?.enquiries ?? [];
  const open = rows.filter((e) => e.status !== "resolved").length;

  return (
    <AdminLayout title="Enquiries">
      <div className="space-y-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          One funnel for every message — landing page, contact page, and in-app. <strong>{open}</strong> open of {data?.total ?? 0} total. Reply by email, then mark resolved.
        </p>
        {isLoading ? (
          <div className="text-center py-20 text-gray-400">Loading enquiries…</div>
        ) : rows.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-16 text-center text-gray-400">
            <Inbox size={40} className="mx-auto mb-3 opacity-40" />
            No enquiries yet — messages from the contact form land here.
          </div>
        ) : (
          <div className="space-y-3">
            {rows.map((e) => (
              <div key={e.id} className={`bg-white dark:bg-gray-900 rounded-2xl border p-5 shadow-sm ${e.status === "resolved" ? "border-gray-100 dark:border-gray-800 opacity-60" : "border-[#4DC9EE]/30"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Mail size={15} className="text-[#4DC9EE] flex-shrink-0" />
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm truncate">{e.subject || "(no subject)"}</p>
                    {e.source && <span className="text-[10px] font-bold uppercase bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2 py-0.5 rounded-full">{e.source}</span>}
                    {e.userId && <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">member</span>}
                  </div>
                  <span className="text-[11px] text-gray-400">{new Date(e.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap mb-3">{e.message}</p>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <a href={`mailto:${e.email}?subject=Re: ${encodeURIComponent(e.subject || "Your S-PAY enquiry")}`} className="text-xs font-semibold text-[#2E8FD6] hover:underline">
                    Reply to {e.name ? `${e.name} <${e.email}>` : e.email}
                  </a>
                  {e.status === "resolved" ? (
                    <button onClick={() => setStatus(e.id, "new")} className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700">
                      <RotateCcw size={12} /> Reopen
                    </button>
                  ) : (
                    <button onClick={() => setStatus(e.id, "resolved")} className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 hover:text-green-700">
                      <CheckCircle2 size={13} /> Mark resolved
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
