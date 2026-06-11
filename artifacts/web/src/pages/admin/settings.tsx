import { useEffect, useState } from "react";
import { AdminLayout } from "./layout";
import {
  useGetAdminSettings, getGetAdminSettingsQueryKey,
  useGetFeatureFlags, getGetFeatureFlagsQueryKey, useUpdateFeatureFlags,
  useGetFeeSchedule, getGetFeeScheduleQueryKey, useUpdateFeeSchedule,
} from "@workspace/api-client-react";
import { CheckCircle2, XCircle, Shield, CreditCard, Landmark, Database, Key, Users, Percent } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatusRow({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {note && <p className="text-xs text-gray-400 mt-0.5">{note}</p>}
      </div>
      {ok ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
          <CheckCircle2 size={12} /> Configured
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
          <XCircle size={12} /> Not set
        </span>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-[#1A2B4A]">
        <span className="text-[#4DC9EE]">{icon}</span> {title}
      </h3>
      {children}
    </div>
  );
}

// Provider cost references so the admin can see the margin while setting prices
const PROVIDER_COSTS = {
  cardIssuance: 0.10,        // Stripe Issuing: ~$0.10 per virtual card
  withdrawalPercentNoah: 0.5, // Noah payout rails: typically ~0.3–0.7% depending on corridor
};

function FeeInput({ label, hint, value, onChange, prefix, suffix }: {
  label: string; hint: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {prefix && <span className="text-sm text-gray-500">{prefix}</span>}
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 h-9 rounded-lg border border-gray-200 px-2.5 text-sm text-right focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20"
        />
        {suffix && <span className="text-sm text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const { data, isLoading } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const { data: flags, refetch: refetchFlags } = useGetFeatureFlags({ query: { queryKey: getGetFeatureFlagsQueryKey() } });
  const { data: fees, refetch: refetchFees } = useGetFeeSchedule({ query: { queryKey: getGetFeeScheduleQueryKey() } });
  const updateFlags = useUpdateFeatureFlags();
  const updateFees = useUpdateFeeSchedule();
  const { toast } = useToast();

  const [feeForm, setFeeForm] = useState({ withdrawalFeePercent: "", withdrawalFeeMin: "", cardIssuanceFee: "", p2pFeePercent: "" });
  useEffect(() => {
    if (fees) {
      setFeeForm({
        withdrawalFeePercent: String(fees.withdrawalFeePercent),
        withdrawalFeeMin: String(fees.withdrawalFeeMin),
        cardIssuanceFee: String(fees.cardIssuanceFee),
        p2pFeePercent: String(fees.p2pFeePercent),
      });
    }
  }, [fees]);

  const saveFees = () => {
    const parsed = {
      withdrawalFeePercent: parseFloat(feeForm.withdrawalFeePercent),
      withdrawalFeeMin: parseFloat(feeForm.withdrawalFeeMin),
      cardIssuanceFee: parseFloat(feeForm.cardIssuanceFee),
      p2pFeePercent: parseFloat(feeForm.p2pFeePercent),
    };
    if (Object.values(parsed).some((v) => !Number.isFinite(v) || v < 0)) {
      toast({ title: "Invalid fees", description: "All fees must be zero or positive numbers.", variant: "destructive" });
      return;
    }
    updateFees.mutate(
      { data: parsed },
      {
        onSuccess: () => {
          toast({ title: "Fee schedule saved", description: "New quotes use these prices immediately." });
          refetchFees();
        },
        onError: () => toast({ title: "Could not save fees", description: "Please try again.", variant: "destructive" }),
      },
    );
  };

  const toggleCardProgram = () => {
    const next = !flags?.cardProgramEnabled;
    updateFlags.mutate(
      { data: { cardProgramEnabled: next } },
      {
        onSuccess: () => {
          toast({
            title: next ? "Card program switched ON" : "Card program switched OFF",
            description: next
              ? "Users now see “Create My Virtual Card” instead of the waitlist."
              : "Users see the waitlist again.",
          });
          refetchFlags();
        },
        onError: () => toast({ title: "Could not update", description: "Please try again.", variant: "destructive" }),
      },
    );
  };

  if (isLoading) {
    return (
      <AdminLayout title="Settings">
        <div className="text-center py-20 text-gray-400">Loading system status…</div>
      </AdminLayout>
    );
  }

  const s = data as any;

  return (
    <AdminLayout title="Settings & System Status">
      <div className="space-y-6 max-w-3xl">

        <p className="text-sm text-gray-500">
          This page shows which integrations are configured. Set environment variables on Render to enable each service.
        </p>

        <Section icon={<Database size={16} />} title="Infrastructure">
          <StatusRow label="PostgreSQL Database" ok={s?.database?.configured} note="DATABASE_URL" />
          <StatusRow label="JWT Secret" ok={s?.auth?.jwtConfigured} note="JWT_SECRET — run: openssl rand -hex 32" />
          <StatusRow label="CORS Origin" ok={!!s?.cors?.origin && s?.cors?.origin !== "(not set)"} note={`CORS_ORIGIN = ${s?.cors?.origin}`} />
        </Section>

        <Section icon={<Key size={16} />} title="Authentication">
          <StatusRow label="Google Sign-In" ok={s?.auth?.googleConfigured} note="GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET" />
          <div className="mt-3 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed">
            <strong>To enable Google:</strong> Create OAuth 2.0 credentials at console.cloud.google.com, then set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, FRONTEND_URL, and API_BASE_URL on Render.
          </div>
        </Section>

        <Section icon={<CreditCard size={16} />} title="Virtual Card Program">
          {/* The master switch — flips users between waitlist and live card creation */}
          <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">Card Program Master Switch</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {flags?.cardProgramEnabled
                  ? "LIVE — users can create their virtual card"
                  : "OFF — users see the waitlist (“coming soon”)"}
              </p>
            </div>
            <button
              onClick={toggleCardProgram}
              disabled={updateFlags.isPending}
              aria-label="Toggle card program"
              className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
                flags?.cardProgramEnabled ? "bg-green-500" : "bg-gray-300"
              }`}
            >
              <span
                className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow transition-all ${
                  flags?.cardProgramEnabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-50">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[#4DC9EE]" />
              <p className="text-sm font-medium text-gray-900">Card Waitlist</p>
            </div>
            <span className="text-sm font-bold text-gray-900">{(flags?.cardWaitlistCount ?? 0).toLocaleString()} waiting</span>
          </div>
          <StatusRow label="Stripe API Key" ok={s?.stripe?.configured} note="STRIPE_SECRET_KEY — for virtual card issuance" />
          <StatusRow label="Stripe Webhook" ok={s?.stripe?.webhookConfigured} note="STRIPE_WEBHOOK_SECRET — for card authorization events" />
          <div className="mt-3 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 leading-relaxed">
            <strong>Launch checklist:</strong> ① stripe.com → Developers → API keys → set STRIPE_SECRET_KEY on Render (enable Stripe Issuing on the account). ② Add the webhook endpoint (<code className="bg-amber-100 px-1 rounded">/webhooks/stripe</code>) and set STRIPE_WEBHOOK_SECRET. ③ Flip the master switch above — the waitlist instantly becomes “Create My Virtual Card” for KYC-approved users.
          </div>
        </Section>

        <Section icon={<Percent size={16} />} title="Fees & Revenue">
          <p className="text-xs text-gray-500 mb-2">
            User price = provider cost + your margin. Providers bill S-PAY separately (Stripe nets fees from your Stripe balance,
            Noah nets from settlements, Celo gas is &lt;$0.01) — the spread below is S-PAY revenue. Changes apply to new quotes instantly.
          </p>
          <FeeInput
            label="Withdrawal fee"
            hint={`Noah's cost is ~${PROVIDER_COSTS.withdrawalPercentNoah}% per corridor — anything above is your cut`}
            value={feeForm.withdrawalFeePercent}
            onChange={(v) => setFeeForm((f) => ({ ...f, withdrawalFeePercent: v }))}
            suffix="%"
          />
          <FeeInput
            label="Minimum withdrawal fee"
            hint="Floor per withdrawal so tiny cash-outs stay profitable"
            value={feeForm.withdrawalFeeMin}
            onChange={(v) => setFeeForm((f) => ({ ...f, withdrawalFeeMin: v }))}
            prefix="$"
          />
          <FeeInput
            label="Card creation fee"
            hint={`Stripe charges ~$${PROVIDER_COSTS.cardIssuance.toFixed(2)} per virtual card — anything above is your cut`}
            value={feeForm.cardIssuanceFee}
            onChange={(v) => setFeeForm((f) => ({ ...f, cardIssuanceFee: v }))}
            prefix="$"
          />
          <FeeInput
            label="S-PAY → S-PAY transfer fee"
            hint="Internal P2P transfers — keeping this 0% drives signups, like MiniPay"
            value={feeForm.p2pFeePercent}
            onChange={(v) => setFeeForm((f) => ({ ...f, p2pFeePercent: v }))}
            suffix="%"
          />
          <div className="pt-4">
            <button
              onClick={saveFees}
              disabled={updateFees.isPending}
              className="bg-[#4DC9EE] hover:bg-[#2E8FD6] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60"
            >
              {updateFees.isPending ? "Saving…" : "Save Fee Schedule"}
            </button>
          </div>
          <div className="mt-3 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed">
            <strong>Also earning for you:</strong> card <em>interchange</em> — every time a user spends on their S-PAY card,
            the merchant pays ~1–1.5% and Stripe shares a portion with you automatically. Plus the FX spread on payouts if
            you quote slightly inside the mid-market rate via Noah.
          </div>
        </Section>

        <Section icon={<Landmark size={16} />} title="KYC & Global Payouts (Noah)">
          <StatusRow label="Noah API Key" ok={s?.noah?.configured} note="NOAH_API_KEY — covers KYC, virtual accounts, and global payouts" />
          <StatusRow label="Noah Webhook Secret" ok={s?.noah?.webhookConfigured} note="NOAH_WEBHOOK_SECRET — verifies incoming webhook events" />
          <div className="mt-3 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed space-y-1.5">
            <p><strong>Noah handles everything in one integration:</strong></p>
            <p>• <strong>KYC</strong> — automated identity verification. Noah triggers <code className="bg-blue-100 px-1 rounded">customer.kyc_approved</code> or <code className="bg-blue-100 px-1 rounded">customer.kyc_rejected</code> webhooks automatically. No manual review needed.</p>
            <p>• <strong>Global Payouts</strong> — send money via M-Pesa, MTN Mobile Money, PIX (Brazil), SEPA (Europe), and local bank transfers across 100+ countries.</p>
            <p><strong>To enable:</strong> Apply at noah.com for a partner account → get API key → set NOAH_API_KEY on Render. Register your webhook URL (<code className="bg-blue-100 px-1 rounded">/webhooks/noah</code>) in the Noah dashboard and set NOAH_WEBHOOK_SECRET on Render.</p>
          </div>
        </Section>

        <Section icon={<Shield size={16} />} title="Admin Access">
          <div className="text-sm text-gray-700">
            <p className="mb-2">Accounts with admin access (set via <code className="bg-gray-100 px-1 rounded text-xs">ADMIN_EMAILS</code> env var):</p>
            <ul className="space-y-1">
              {(s?.adminEmails ?? []).map((email: string) => (
                <li key={email} className="flex items-center gap-2 text-xs font-mono bg-gray-50 rounded-lg px-3 py-2">
                  <Shield size={12} className="text-[#4DC9EE]" /> {email}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3">To add an admin, set <code className="bg-gray-100 px-1 rounded">ADMIN_EMAILS=email1@x.com,email2@x.com</code> on Render.</p>
          </div>
        </Section>

      </div>
    </AdminLayout>
  );
}
