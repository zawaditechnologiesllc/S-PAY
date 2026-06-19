import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { payrollApi } from "@/lib/payroll-api";
import { KeyRound, Copy, Trash2, Plus, ShieldCheck, FlaskConical } from "lucide-react";

export default function PayrollKeys() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [sandbox, setSandbox] = useState(true);
  const [freshKey, setFreshKey] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["payroll", "keys"], queryFn: payrollApi.listKeys, retry: false });

  const create = useMutation({
    mutationFn: () => payrollApi.createKey({ name: name.trim() || undefined, sandbox }),
    onSuccess: (res) => {
      setFreshKey(res.apiKey);
      setName("");
      queryClient.invalidateQueries({ queryKey: ["payroll", "keys"] });
    },
    onError: (e) => toast({ title: "Could not create key", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => payrollApi.revokeKey(id),
    onSuccess: () => { toast({ title: "Key revoked" }); queryClient.invalidateQueries({ queryKey: ["payroll", "keys"] }); },
  });

  const keys = data?.apiKeys ?? [];

  return (
    <Layout back title="API keys">
      <div className="space-y-6 mt-4">
        {/* One-time reveal of a freshly created key */}
        {freshKey && (
          <Card className="border-2 border-[#4DC9EE] shadow-md rounded-2xl">
            <CardContent className="p-5 space-y-2">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Your new API key — copy it now, it won't be shown again.</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-gray-900 text-green-300 text-xs p-3 rounded-lg break-all">{freshKey}</code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(freshKey); toast({ title: "Copied" }); }}>
                  <Copy size={14} />
                </Button>
              </div>
              <button className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setFreshKey(null)}>Dismiss</button>
            </CardContent>
          </Card>
        )}

        {/* Create */}
        <Card className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-5 space-y-3">
            <p className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Plus size={16} /> Create a key</p>
            <Input placeholder="Label (e.g. Production)" value={name} onChange={(e) => setName(e.target.value)} />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSandbox(true)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl py-2.5 border ${sandbox ? "border-[#4DC9EE] bg-[#4DC9EE]/10 text-[#2E8FD6]" : "border-gray-200 text-gray-500"}`}
              >
                <FlaskConical size={15} /> Sandbox (test)
              </button>
              <button
                type="button"
                onClick={() => setSandbox(false)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium rounded-xl py-2.5 border ${!sandbox ? "border-[#4DC9EE] bg-[#4DC9EE]/10 text-[#2E8FD6]" : "border-gray-200 text-gray-500"}`}
              >
                <ShieldCheck size={15} /> Live
              </button>
            </div>
            <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full rounded-full">
              {create.isPending ? "Creating…" : `Create ${sandbox ? "sandbox" : "live"} key`}
            </Button>
            {!sandbox && <p className="text-[11px] text-amber-600">Live keys require business verification.</p>}
          </CardContent>
        </Card>

        {/* List */}
        <div className="space-y-3">
          {isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : keys.length === 0 ? (
            <p className="text-center text-gray-400 py-10">No API keys yet.</p>
          ) : (
            keys.map((k) => (
              <Card key={k.id} className={`border-0 shadow-sm rounded-2xl ${k.revokedAt ? "opacity-50" : ""}`}>
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <KeyRound size={15} className="text-[#4DC9EE]" />
                      <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{k.name ?? "Key"}</p>
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${k.sandbox ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                        {k.sandbox ? "test" : "live"}
                      </span>
                      {k.revokedAt && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-100 text-red-700">revoked</span>}
                    </div>
                    <code className="text-xs text-gray-400">{k.prefix}…</code>
                    <p className="text-[11px] text-gray-400">
                      {k.lastUsedAt ? `Last used ${new Date(k.lastUsedAt).toLocaleDateString()}` : "Never used"} · created {new Date(k.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  {!k.revokedAt && (
                    <Button size="sm" variant="ghost" className="text-red-500 hover:text-red-600" onClick={() => revoke.mutate(k.id)} disabled={revoke.isPending}>
                      <Trash2 size={15} />
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
