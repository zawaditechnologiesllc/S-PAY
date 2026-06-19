import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { payrollApi, type Payment } from "@/lib/payroll-api";
import { BatchStatus } from "./batches";
import { CheckCircle2, XCircle, Clock, UserPlus } from "lucide-react";

export default function PayrollBatchDetail() {
  const [, params] = useRoute("/payroll/batches/:batchId");
  const batchId = params?.batchId ?? "";
  const { data, isLoading } = useQuery({
    queryKey: ["payroll", "batch", batchId],
    queryFn: () => payrollApi.getBatch(batchId),
    enabled: Boolean(batchId),
    retry: false,
    // Poll while a batch is still processing so the UI reflects completion.
    refetchInterval: (q) => (q.state.data?.batch.status === "processing" ? 2000 : false),
  });

  if (isLoading) {
    return <Layout back title="Batch"><Skeleton className="h-40 w-full rounded-2xl mt-4" /></Layout>;
  }
  if (!data) {
    return <Layout back title="Batch"><p className="text-center text-gray-400 py-10">Batch not found.</p></Layout>;
  }

  const { batch, payments } = data;
  return (
    <Layout back title={batch.reference ?? "Batch"}>
      <div className="space-y-6 mt-4">
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BatchStatus status={batch.status} />
                {batch.sandbox && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">test</span>}
              </div>
              <p className="font-black text-xl text-gray-900 dark:text-gray-100">{batch.totalAmount.toLocaleString()} {batch.currency}</p>
            </div>
            {batch.description && <p className="text-sm text-gray-500">{batch.description}</p>}
            <div className="grid grid-cols-3 gap-3 text-center pt-2">
              <Stat label="Payments" value={batch.paymentCount} />
              <Stat label="Paid" value={batch.completedCount} good />
              <Stat label="Failed" value={batch.failedCount} bad={batch.failedCount > 0} />
            </div>
            <p className="text-[11px] text-gray-400 text-center">Fee {batch.feeAmount} {batch.currency} · total cost {batch.totalCost} {batch.currency}</p>
          </CardContent>
        </Card>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 px-1">Payments</p>
          {payments.map((p) => <PaymentRow key={p.id} p={p} />)}
        </div>
      </div>
    </Layout>
  );
}

function Stat({ label, value, good, bad }: { label: string; value: number; good?: boolean; bad?: boolean }) {
  return (
    <div>
      <p className={`text-lg font-black ${good ? "text-green-600" : bad ? "text-red-600" : "text-gray-900 dark:text-gray-100"}`}>{value}</p>
      <p className="text-[11px] text-gray-400 uppercase tracking-wide">{label}</p>
    </div>
  );
}

function PaymentRow({ p }: { p: Payment }) {
  const icon = p.status === "completed" ? <CheckCircle2 size={16} className="text-green-500" />
    : p.status === "failed" ? <XCircle size={16} className="text-red-500" />
    : <Clock size={16} className="text-gray-400" />;
  return (
    <Card className="border-0 shadow-sm rounded-xl">
      <CardContent className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {icon}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{p.workerIdentifier}</p>
              {p.workerCreated && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">
                  <UserPlus size={9} /> new
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-400">{p.reason ?? p.identifierType}{p.errorMessage ? ` · ${p.errorMessage}` : ""}</p>
          </div>
        </div>
        <p className="font-bold text-sm text-gray-900 dark:text-gray-100 flex-shrink-0">{p.amount} {p.currency}</p>
      </CardContent>
    </Card>
  );
}
