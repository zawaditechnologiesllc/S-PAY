import { useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  BookOpen, KeyRound, Banknote, ListChecks, Webhook, Users, ShieldCheck,
  Copy, ChevronDown, ChevronUp, TestTubes,
} from "lucide-react";

/**
 * In-app payroll integration guide — the complete developer walkthrough,
 * available right where the keys are minted so an integrating engineer never
 * has to leave the product. Mirrors docs/PAYROLL.md in the repo.
 */

const BASE = `${import.meta.env.VITE_API_URL ?? ""}/api`;

export default function PayrollDocs() {
  return (
    <Layout back title="Integration guide">
      <div className="space-y-5 mt-4 max-w-3xl">

        <Card className="border-0 shadow-md rounded-2xl bg-gradient-to-r from-[#1A2B4A] to-[#2E8FD6] text-white">
          <CardContent className="p-6 space-y-2">
            <h2 className="text-lg font-bold flex items-center gap-2"><BookOpen size={20} /> Pay your whole team with two API calls</h2>
            <p className="text-sm text-blue-100 leading-relaxed">
              Identify workers by <strong>email, phone, S-PAY ID, or wallet address</strong> — S-PAY resolves them,
              auto-onboards anyone new, settles real USDC to their wallet, and reports every outcome on signed
              webhooks. Build against a <strong>sandbox key</strong> today; live keys unlock after business verification (KYB).
            </p>
            <p className="text-xs text-blue-200 font-mono">API base: {BASE}</p>
          </CardContent>
        </Card>

        <Section icon={<KeyRound size={16} />} title="1 · Authentication" defaultOpen>
          <p>
            Every payroll call authenticates with an API key from{" "}
            <Link href="/payroll/keys"><span className="text-[#2E8FD6] font-semibold underline cursor-pointer">Payroll → API keys</span></Link>,
            sent as <code>Authorization: Bearer spk_…</code> (or <code>X-API-Key</code>).
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code>spk_test_…</code> — sandbox: full API incl. webhooks, test balance only, no real money. Always start here.</li>
            <li><code>spk_live_…</code> — real funds; requires KYB verification.</li>
            <li>Keys are shown once, stored hashed, revocable, and scoped (<code>payroll:read</code> / <code>payroll:write</code>).</li>
          </ul>
        </Section>

        <Section icon={<Banknote size={16} />} title="2 · Fund your balance">
          <p>Payroll draws from a <strong>prepaid USDC balance</strong> — batches are reserved against it, so you can never overdraw.</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Sandbox:</strong> mint test balance freely:</li>
          </ul>
          <Snippet code={`curl -X POST ${BASE}/payroll/sandbox/fund \\
  -H "Authorization: Bearer spk_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{ "amount": 1000 }'`} />
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Live:</strong> send USDC on the Celo network to your funding address (Payroll → Fund your payroll balance). Deposits credit automatically.</li>
          </ul>
        </Section>

        <Section icon={<ListChecks size={16} />} title="3 · Create & submit a batch">
          <p><strong>Create</strong> a draft — every line is validated, nothing is charged:</p>
          <Snippet code={`curl -X POST ${BASE}/payroll/batches \\
  -H "Authorization: Bearer spk_test_..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "reference": "2026-07-week2",
    "idempotencyKey": "run-2026-07-w2",
    "webhookUrl": "https://your.app/webhooks/spay",
    "payments": [
      { "workerIdentifier": "annotator@gmail.com", "amount": 184.50, "reason": "Week 2 tasks" },
      { "workerIdentifier": "+254712345678",       "amount": 92.00,  "reason": "Week 2 tasks" }
    ]
  }'`} />
          <p><strong>Submit</strong> — resolves workers, reserves funds, settles on-chain:</p>
          <Snippet code={`curl -X POST ${BASE}/payroll/batches/{batchId}/submit \\
  -H "Authorization: Bearer spk_test_..."`} />
          <ul className="list-disc pl-5 space-y-1">
            <li>Up to <strong>10,000 payments per batch</strong>. Batches of ≤25 settle inline; larger ones return <code>202</code> immediately and settle in the background — track via <code>GET /payroll/batches/{"{id}"}</code> or webhooks.</li>
            <li><strong>Idempotent everywhere:</strong> the same <code>idempotencyKey</code> returns the original batch; re-submitting never double-pays (terminal payments are skipped).</li>
            <li>Insufficient balance → <code>402</code> with the exact shortfall; nothing moves.</li>
            <li>Per-payment results: <code>GET /payroll/batches/{"{id}"}/payments</code> — status, on-chain settlement, or an honest failure reason.</li>
          </ul>
        </Section>

        <Section icon={<Users size={16} />} title="4 · Worker resolution & auto-onboarding">
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>email / phone</strong> — matched to the S-PAY member; unknown workers are <strong>auto-created and invited</strong> to claim their money (toggle: <code>autoCreateWorkers</code>).</li>
            <li><strong>spay_id</strong> — exact member match (workers find theirs in their profile).</li>
            <li><strong>celo_address</strong> — direct on-chain payout to any wallet.</li>
            <li>Identifier type is auto-inferred; pass <code>identifierType</code> to be explicit.</li>
          </ul>
          <p>Workers receive real USDC in their own wallet, then keep it, send it, spend it on their card, or cash out to M-Pesa / MoMo / PIX / SEPA / bank — guided, PIN-protected flows.</p>
        </Section>

        <Section icon={<Webhook size={16} />} title="5 · Webhooks">
          <p>Set a <code>webhookUrl</code> on your employer profile (or per batch). Events: <code>batch.processing</code>, <code>payment.completed</code>, <code>payment.failed</code>, <code>batch.completed</code>, <code>batch.partially_completed</code>, <code>batch.failed</code>, <code>webhook.test</code>.</p>
          <p>Every delivery is signed — verify <code>X-SPAY-Signature</code> (HMAC-SHA256 of the raw body with your <code>webhookSecret</code>, shown once at registration):</p>
          <Snippet code={`const expected = crypto
  .createHmac("sha256", WEBHOOK_SECRET)
  .update(rawBody)
  .digest("hex");
if (signature !== expected) return res.status(401).end();`} />
          <p>Fire a test event any time: <code>POST /payroll/webhooks/test</code> · audit deliveries: <code>GET /payroll/webhooks/deliveries</code>.</p>
        </Section>

        <Section icon={<TestTubes size={16} />} title="6 · Sandbox → live checklist">
          <ol className="list-decimal pl-5 space-y-1">
            <li>Register your company (done — you're here) and mint a <strong>sandbox key</strong>.</li>
            <li>Fund test balance → run a batch with 2–3 of your own emails → verify webhooks.</li>
            <li>Complete <strong>business verification (KYB)</strong> — unlocks live keys.</li>
            <li>Mint a <strong>live key</strong>, fund the real balance with USDC on Celo.</li>
            <li>Point your backend at the live key. Same API, same shapes — nothing else changes.</li>
          </ol>
        </Section>

        <Section icon={<ShieldCheck size={16} />} title="Errors & guarantees">
          <ul className="list-disc pl-5 space-y-1">
            <li><code>400</code> validation (per-line errors listed) · <code>401</code> bad key · <code>402</code> insufficient balance · <code>403</code> scope/KYB · <code>404</code> not found · <code>409</code> idempotency conflict.</li>
            <li><strong>Prepaid ledger with guarded debits:</strong> funds are reserved per payment; a failed settlement is refunded automatically.</li>
            <li><strong>On-chain receipts:</strong> completed live payments carry the Celo transaction hash — every cent is publicly traceable.</li>
            <li><strong>Fees:</strong> platform fee per payment (see your batch's <code>feeAmount</code> / <code>totalCost</code> before you submit).</li>
          </ul>
          <p className="pt-1">
            Full REST reference lives in the repo: <code>docs/PAYROLL.md</code> · decision guide: <code>docs/MARKETPLACE-INTEGRATION.md</code>.
          </p>
        </Section>
      </div>
    </Layout>
  );
}

function Section({ icon, title, children, defaultOpen = false }: {
  icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="border-0 shadow-md rounded-2xl overflow-hidden">
      <CardHeader className="cursor-pointer bg-gray-50 dark:bg-gray-800/60 py-4" onClick={() => setOpen(!open)}>
        <CardTitle className="text-sm flex items-center justify-between text-gray-800 dark:text-gray-200">
          <span className="flex items-center gap-2"><span className="text-[#4DC9EE]">{icon}</span> {title}</span>
          {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </CardTitle>
      </CardHeader>
      {open && (
        <CardContent className="p-5 text-sm text-gray-600 dark:text-gray-300 space-y-3 leading-relaxed">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

function Snippet({ code }: { code: string }) {
  const { toast } = useToast();
  return (
    <div className="relative group">
      <pre className="bg-[#1A2B4A] text-green-200 text-[11px] leading-relaxed rounded-xl p-4 overflow-x-auto whitespace-pre">{code}</pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); toast({ title: "Copied" }); }}
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 text-white/70 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy snippet"
      >
        <Copy size={13} />
      </button>
    </div>
  );
}
