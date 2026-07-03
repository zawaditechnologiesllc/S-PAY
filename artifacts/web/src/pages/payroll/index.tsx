import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { FlowStepper } from "@/components/flow-stepper";
import { useToast } from "@/hooks/use-toast";
import { payrollApi, PayrollApiError } from "@/lib/payroll-api";
import {
  Building2, KeyRound, ListChecks, Wallet, Users, CheckCircle2,
  AlertCircle, ArrowRight, BadgeCheck, Banknote, Copy,
} from "lucide-react";

// Employer payroll console — overview + onboarding. Companies (Upwork, Fiverr,
// Studypool…) register here, then mint API keys to pay workers through S-PAY.
export default function PayrollOverview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: me, isLoading: meLoading } = useGetMe({ query: { queryKey: getGetMeQueryKey() } });
  const isBusiness = me?.accountType === "business";
  const { data, isLoading, error } = useQuery({
    queryKey: ["payroll", "employer"],
    queryFn: payrollApi.getEmployer,
    retry: false,
    enabled: isBusiness, // don't hit the employer endpoint for personal accounts
  });

  const notRegistered = error instanceof PayrollApiError && error.status === 404;

  if (meLoading || (isBusiness && isLoading)) {
    return (
      <Layout back title="Payroll">
        <div className="space-y-4 mt-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </Layout>
    );
  }

  // Payroll is business-only — personal accounts see an upgrade prompt.
  if (!isBusiness) return <BusinessOnly />;

  if (notRegistered) return <RegisterEmployer onDone={() => queryClient.invalidateQueries({ queryKey: ["payroll"] })} />;

  const employer = data?.employer;
  return (
    <Layout back title="Payroll">
      <div className="space-y-6 mt-4">
        {/* Guided setup — the same step bar as the money flows, tracking the
            employer from registration to their first paid batch. */}
        <SetupGuide />

        <SummaryCards />

        {/* Employer profile + verification */}
        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 size={18} className="text-[#4DC9EE]" /> {employer?.companyName}
            </CardTitle>
            <StatusBadge status={employer?.status ?? "pending"} />
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
            <p>{employer?.email}{employer?.websiteUrl ? ` · ${employer.websiteUrl}` : ""}</p>
            {employer?.status === "pending" && (
              <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 rounded-xl p-3">
                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                <p>Business verification (KYB) is pending. You can build and test with <strong>sandbox keys</strong> now — live payroll unlocks once verified.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Fund the payroll balance — the step between registering and paying */}
        <FundingCard />

        {/* Quick links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NavCard href="/payroll/keys" icon={<KeyRound size={20} />} title="API keys" desc="Create and manage the keys your backend uses." />
          <NavCard href="/payroll/batches" icon={<ListChecks size={20} />} title="Payroll batches" desc="Create a batch and pay your workers." />
        </div>

        <button
          onClick={() => {
            navigator.clipboard.writeText(`${import.meta.env.VITE_API_URL ?? ""}/api`);
            toast({ title: "API base URL copied" });
          }}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          API base: {import.meta.env.VITE_API_URL ?? ""}/api · click to copy
        </button>
      </div>
    </Layout>
  );
}

// Register → API key → Fund → First batch: computed from live data, gone once
// the employer has fully launched. Each pending step says exactly what to do.
function SetupGuide() {
  // staleTime 0: the guide must reflect what the user JUST did (minted a key,
  // funded, ran a batch) — never a persisted cache from the last visit.
  const { data: keys } = useQuery({ queryKey: ["payroll", "keys"], queryFn: payrollApi.listKeys, retry: false, staleTime: 0, refetchOnMount: "always" });
  const { data: summary } = useQuery({ queryKey: ["payroll", "summary"], queryFn: payrollApi.getSummary, retry: false, staleTime: 0, refetchOnMount: "always" });
  if (!keys || !summary) return null;

  const hasKey = keys.apiKeys.some((k) => !k.revokedAt);
  const funded = summary.balanceUsdc > 0;
  const ranBatch = summary.totalBatches > 0;
  if (hasKey && funded && ranBatch) return null; // fully launched — guide retires

  const current = !hasKey ? 1 : !funded ? 2 : 3;
  const hint = !hasKey
    ? { text: "Create an API key — your backend authenticates with it.", href: "/payroll/keys", cta: "Create a key" }
    : !funded
      ? { text: "Fund your payroll balance (sandbox: POST /payroll/sandbox/fund with a test key).", href: null, cta: null }
      : { text: "Send your first batch — two API calls pays your whole team.", href: "/payroll/batches", cta: "See how" };

  return (
    <Card className="border-0 shadow-md rounded-2xl">
      <CardContent className="p-5 space-y-3">
        <FlowStepper steps={["Register", "API key", "Fund", "First batch"]} current={current} />
        <div className="flex items-center justify-between gap-3 bg-blue-50 dark:bg-blue-950/40 rounded-xl p-3">
          <p className="text-xs text-blue-700 dark:text-blue-300">{hint.text}</p>
          {hint.href && (
            <Link href={hint.href}>
              <Button size="sm" variant="outline" className="rounded-full flex-shrink-0 text-xs">{hint.cta} <ArrowRight size={13} className="ml-1" /></Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryCards() {
  const { data, isLoading } = useQuery({ queryKey: ["payroll", "summary"], queryFn: payrollApi.getSummary, retry: false });
  if (isLoading) return <Skeleton className="h-28 w-full rounded-2xl" />;
  const s = data;
  const cards = [
    { label: "Balance", value: `${(s?.balanceUsdc ?? 0).toLocaleString()} USDC`, icon: <Wallet size={18} /> },
    { label: "Disbursed", value: `${(s?.totalDisbursed ?? 0).toLocaleString()} USDC`, icon: <CheckCircle2 size={18} /> },
    { label: "Payments", value: `${s?.completedPayments ?? 0}/${s?.totalPayments ?? 0}`, icon: <ListChecks size={18} /> },
    { label: "Workers onboarded", value: String(s?.workersOnboarded ?? 0), icon: <Users size={18} /> },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {cards.map((c) => (
        <Card key={c.label} className="border-0 shadow-md rounded-2xl">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[#4DC9EE] mb-1">{c.icon}</div>
            <p className="text-lg font-black text-gray-900 dark:text-gray-100 leading-tight">{c.value}</p>
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">{c.label}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Guided funding: live payroll draws from a prepaid USDC balance. This card
// walks the employer through topping it up — request the funding address once,
// then send USDC on Celo to it (sandbox integrators use the test top-up API).
function FundingCard() {
  const { toast } = useToast();
  const funding = useMutation({ mutationFn: payrollApi.getFundingAddress });

  const copy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    toast({ title: "Funding address copied", description: "Send USDC on the Celo network to it — the balance credits automatically." });
  };

  return (
    <Card className="border-0 shadow-md rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote size={18} className="text-[#4DC9EE]" /> Fund your payroll balance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Live batches are paid from your prepaid USDC balance. Top it up by sending <strong>USDC on the Celo
          network</strong> to your funding address — from an exchange (Binance, Coinbase…) or any Celo wallet.
        </p>
        {funding.data ? (
          <div className="space-y-2">
            <button
              onClick={() => copy(funding.data.fundingAddress)}
              className="w-full bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3 flex items-center gap-2 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="Tap to copy"
            >
              <code className="text-[11px] text-gray-700 dark:text-gray-300 break-all flex-1">{funding.data.fundingAddress}</code>
              <Copy size={15} className="text-gray-400 flex-shrink-0" />
            </button>
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-3 text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
              ⚠ The network must be <strong>Celo</strong> and the token <strong>USDC</strong>. Deposits credit your payroll balance automatically.
            </div>
          </div>
        ) : (
          <Button
            onClick={() => funding.mutate(undefined, {
              onError: (e) => toast({
                title: "Funding address not ready",
                description: e instanceof Error ? e.message : "Try again shortly.",
                variant: "destructive",
              }),
            })}
            disabled={funding.isPending}
            variant="outline"
            className="rounded-full"
          >
            {funding.isPending ? "Preparing…" : "Show my funding address"}
          </Button>
        )}
        <p className="text-[11px] text-gray-400">
          Testing? Use a <strong>sandbox key</strong> with <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">POST /payroll/sandbox/fund</code> — it mints test balance without real money.
        </p>
      </CardContent>
    </Card>
  );
}

function NavCard({ href, icon, title, desc }: { href: string; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Link href={href}>
      <Card className="border-0 shadow-md rounded-2xl cursor-pointer hover:shadow-lg transition-shadow">
        <CardContent className="p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#4DC9EE]/10 text-[#4DC9EE] flex items-center justify-center flex-shrink-0">{icon}</div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{title}</p>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
          <ArrowRight size={18} className="text-gray-300" />
        </CardContent>
      </Card>
    </Link>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    verified: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    rejected: "bg-red-100 text-red-700",
    suspended: "bg-gray-200 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase px-2.5 py-1 rounded-full ${map[status] ?? map.pending}`}>
      {status === "verified" && <BadgeCheck size={12} />} {status}
    </span>
  );
}

// Shown to personal accounts — payroll requires a business account.
function BusinessOnly() {
  return (
    <Layout back title="Payroll">
      <div className="max-w-lg mx-auto mt-6">
        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 size={20} className="text-[#4DC9EE]" /> Payroll is for business accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Paying a team is a business function — live payroll requires business verification (KYB). Upgrade to a
              business account to register as an employer, mint API keys, and pay workers across 100+ countries.
            </p>
            <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
              {[
                "Business virtual accounts (US ACH + EU IBAN) in your company name",
                "Batch payroll API with worker auto-onboarding",
                "Global payouts — M-Pesa, PIX, SEPA, ACH and 50+ local methods",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2"><CheckCircle2 size={16} className="text-[#22C55E] mt-0.5 flex-shrink-0" />{t}</li>
              ))}
            </ul>
            <Link href="/register?type=business">
              <Button className="w-full rounded-full">Open a business account <ArrowRight size={15} className="ml-1.5" /></Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

// Onboarding form shown when the user has no employer account yet.
function RegisterEmployer({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ companyName: "", email: "", websiteUrl: "", country: "" });
  const mutation = useMutation({
    mutationFn: () => payrollApi.register(form),
    onSuccess: () => { toast({ title: "Employer registered 🎉", description: "Create a sandbox key to start integrating." }); onDone(); },
    onError: (e) => toast({ title: "Could not register", description: e instanceof Error ? e.message : "", variant: "destructive" }),
  });

  return (
    <Layout back title="Payroll">
      <div className="max-w-lg mx-auto mt-6">
        <Card className="border-0 shadow-md rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Building2 size={20} className="text-[#4DC9EE]" /> Pay your workers through S-PAY</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-gray-500">
              Register your company once. Then mint API keys and send payroll batches — we resolve each worker by email or phone, onboard new ones automatically, and pay them out across 100+ countries.
            </p>
            <form
              onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
              className="space-y-3"
            >
              <Input required placeholder="Company name *" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
              <Input type="email" placeholder="Billing email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Website (optional)" value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
              <Input placeholder="Country (optional)" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
              <Button type="submit" disabled={mutation.isPending || !form.companyName.trim()} className="w-full rounded-full">
                {mutation.isPending ? "Registering…" : "Register employer"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
