import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { payrollApi, type Batch } from "@/lib/payroll-api";
import { ListChecks, ArrowRight, Terminal } from "lucide-react";

// Read-only list of payroll batches for the owner. Batches are CREATED and
// SUBMITTED server-to-server with an API key (shown in the cURL snippet below) —
// the portal surfaces their status, history and per-payment results.
export default function PayrollBatches() {
  const { data, isLoading } = useQuery({ queryKey: ["payroll", "batches"], queryFn: payrollApi.listBatches, retry: false });
  const batches = data?.batches ?? [];

  return (
    <Layout back title="Payroll batches">
      <div className="space-y-6 mt-4">
        <CurlSnippet />

        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : batches.length === 0 ? (
          <Card className="border border-dashed rounded-2xl">
            <CardContent className="p-10 text-center text-gray-400 space-y-2">
              <ListChecks size={32} className="mx-auto opacity-40" />
              <p>No batches yet. Submit one with your API key — it'll appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {batches.map((b) => (
              <Link key={b.id} href={`/payroll/batches/${b.id}`}>
                <Card className="border-0 shadow-sm rounded-2xl cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{b.reference ?? b.id.slice(0, 8)}</p>
                        <BatchStatus status={b.status} />
                        {b.sandbox && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">test</span>}
                      </div>
                      <p className="text-[11px] text-gray-400">
                        {b.paymentCount} payments · {b.completedCount} paid{b.failedCount > 0 ? ` · ${b.failedCount} failed` : ""} · {new Date(b.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <div>
                        <p className="font-black text-gray-900 dark:text-gray-100">{b.totalAmount.toLocaleString()} {b.currency}</p>
                        <p className="text-[11px] text-gray-400">+{b.feeAmount} fee</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-300" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}

export function BatchStatus({ status }: { status: Batch["status"] }) {
  const map: Record<Batch["status"], string> = {
    draft: "bg-gray-200 text-gray-600",
    processing: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    partially_completed: "bg-amber-100 text-amber-700",
    failed: "bg-red-100 text-red-700",
    cancelled: "bg-gray-200 text-gray-500",
  };
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${map[status]}`}>{status.replace("_", " ")}</span>;
}

function CurlSnippet() {
  const [open, setOpen] = useState(false);
  const base = `${import.meta.env.VITE_API_URL ?? ""}/api`;
  const snippet = `# 1) Create a batch
curl -X POST ${base}/payroll/batches \\
  -H "Authorization: Bearer spk_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "reference": "2026-06-payroll",
    "idempotencyKey": "june-2026-run-1",
    "payments": [
      { "workerIdentifier": "alice@gmail.com", "amount": 500, "reason": "Logo design" },
      { "workerIdentifier": "+254712345678", "amount": 300, "reason": "Code review" }
    ]
  }'

# 2) Submit it (resolves workers + pays)
curl -X POST ${base}/payroll/batches/<batchId>/submit \\
  -H "Authorization: Bearer spk_test_..."`;
  return (
    <Card className="border-0 shadow-md rounded-2xl bg-[#1A2B4A] text-white">
      <CardContent className="p-4">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-2 text-sm font-semibold">
          <Terminal size={16} /> How to send a batch from your backend
        </button>
        {open && <pre className="mt-3 text-[11px] leading-relaxed overflow-x-auto text-green-200 whitespace-pre">{snippet}</pre>}
      </CardContent>
    </Card>
  );
}
