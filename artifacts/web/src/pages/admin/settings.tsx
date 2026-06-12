import { useEffect, useState } from "react";
import { AdminLayout } from "./layout";
import {
  useGetAdminSettings, getGetAdminSettingsQueryKey,
  useGetFeatureFlags, getGetFeatureFlagsQueryKey, useUpdateFeatureFlags,
  useGetFeeSchedule, getGetFeeScheduleQueryKey, useUpdateFeeSchedule,
  useGetWalletProviders, getGetWalletProvidersQueryKey, useUpdateWalletProviders,
  useGetAdminSiteContent, getGetAdminSiteContentQueryKey, useUpdateSiteContent,
  useSendAdminNotification,
  useGetAdminTeam, getGetAdminTeamQueryKey, useGrantAdminRole, useRevokeAdminRole,
  type WalletProvidersUpdateRequestActiveProvider,
} from "@workspace/api-client-react";
import { CheckCircle2, XCircle, Shield, CreditCard, Landmark, Database, Key, Users, Percent, Wrench, Wallet, Paintbrush, Megaphone, UserPlus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function StatusRow({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
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
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
      <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider text-[#1A2B4A]">
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

// Display names + cost notes shown next to each WaaS so the admin can pick on price
const WALLET_PROVIDER_LABELS: Record<string, string> = {
  privy: "Privy",
  cdp: "Coinbase CDP",
  turnkey: "Turnkey",
  openfort: "Openfort",
  thirdweb: "thirdweb",
  dynamic: "Dynamic",
};
const WALLET_PROVIDER_NOTES: Record<string, string> = {
  privy: "MAU-tier pricing: free under ~500 monthly-active wallet users, then $299/mo (Core, up to 2,500 MAU) — the expensive one. Keys in a TEE.",
  cdp: "Coinbase Developer Platform: $0.005 per wallet operation, first 5,000 ops/month free — no MAU billing. Keys in Coinbase's TEE.",
  turnkey: "Per-signature pricing: 25 free signatures/mo, then ~$0.10 each (Pro $99/mo → ~$0.01) — no MAU billing. Non-custodial TEE.",
  openfort: "Self-hostable wallet infra: free dev tier, then flat platform pricing (no per-MAU wallet billing). Keys via configurable signer.",
  thirdweb: "Usage-based: free tier, server wallets in Vault (TEE) + Transactions API billed per usage — no MAU billing.",
  dynamic: "TSS-MPC server wallets: free dev tier, then per-wallet/usage pricing (embedded-wallet MAU tiers don't apply to server wallets).",
};

function FeeInput({ label, hint, value, onChange, prefix, suffix }: {
  label: string; hint: string; value: string; onChange: (v: string) => void; prefix?: string; suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{hint}</p>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {prefix && <span className="text-sm text-gray-500 dark:text-gray-400">{prefix}</span>}
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 h-9 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 text-sm text-right focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20"
        />
        {suffix && <span className="text-sm text-gray-500 dark:text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

export default function AdminSettings() {
  const { data, isLoading } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });
  const { data: flags, refetch: refetchFlags } = useGetFeatureFlags({ query: { queryKey: getGetFeatureFlagsQueryKey() } });
  const { data: fees, refetch: refetchFees } = useGetFeeSchedule({ query: { queryKey: getGetFeeScheduleQueryKey() } });
  const { data: walletProviders, refetch: refetchWalletProviders } = useGetWalletProviders({ query: { queryKey: getGetWalletProvidersQueryKey() } });
  const updateFlags = useUpdateFeatureFlags();
  const updateFees = useUpdateFeeSchedule();
  const updateWalletProviders = useUpdateWalletProviders();
  const { toast } = useToast();

  const setActiveProvider = (key: string) => {
    updateWalletProviders.mutate(
      { data: { activeProvider: key as WalletProvidersUpdateRequestActiveProvider } },
      {
        onSuccess: () => {
          toast({
            title: `New wallets now use ${WALLET_PROVIDER_LABELS[key] ?? key}`,
            description: "Existing wallets keep their current provider — keys never move. Live within 15 seconds.",
          });
          refetchWalletProviders();
        },
        onError: () => toast({ title: "Could not switch provider", description: "Please try again.", variant: "destructive" }),
      },
    );
  };

  const toggleProvider = (key: string, next: boolean) => {
    updateWalletProviders.mutate(
      { data: { enabled: { [key]: next } } },
      {
        onSuccess: () => {
          toast({
            title: next ? `${key} switched ON` : `${key} switched OFF`,
            description: next
              ? "This provider can create wallets and sign transfers again."
              : "Kill switch: no new wallets and no transfers signed via this provider until re-enabled. Balances are unaffected (funds live on-chain).",
          });
          refetchWalletProviders();
        },
        onError: () => toast({ title: "Could not update", description: "Please try again.", variant: "destructive" }),
      },
    );
  };

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

  const [maintMessage, setMaintMessage] = useState("");
  useEffect(() => {
    if (flags?.maintenanceMessage !== undefined) setMaintMessage(flags.maintenanceMessage ?? "");
  }, [flags?.maintenanceMessage]);

  const toggleMaintenance = () => {
    const next = !flags?.maintenanceMode;
    updateFlags.mutate(
      { data: { maintenanceMode: next, maintenanceMessage: maintMessage || undefined } },
      {
        onSuccess: () => {
          toast({
            title: next ? "🛠 Maintenance mode ON" : "✅ Maintenance mode OFF — back live",
            description: next
              ? "Users now see the maintenance screen. Sign-in, webhooks, and this admin panel stay up."
              : "All traffic is being served normally again.",
          });
          refetchFlags();
        },
        onError: () => toast({ title: "Could not update", description: "Please try again.", variant: "destructive" }),
      },
    );
  };

  const saveMaintenanceMessage = () => {
    updateFlags.mutate(
      { data: { maintenanceMessage: maintMessage } },
      {
        onSuccess: () => { toast({ title: "Maintenance message saved" }); refetchFlags(); },
        onError: () => toast({ title: "Could not save", variant: "destructive" }),
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

        <p className="text-sm text-gray-500 dark:text-gray-400">
          This page shows which integrations are configured. Set environment variables on Render to enable each service.
        </p>

        <Section icon={<Wrench size={16} />} title="Maintenance Mode">
          <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Platform Maintenance Switch</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {flags?.maintenanceMode
                  ? "ON — users see the maintenance screen. Sign-in, webhooks & admin stay reachable."
                  : "OFF — platform serving all traffic normally."}
              </p>
            </div>
            <button
              onClick={toggleMaintenance}
              disabled={updateFlags.isPending}
              aria-label="Toggle maintenance mode"
              className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
                flags?.maintenanceMode ? "bg-amber-500" : "bg-gray-300"
              }`}
            >
              <span className={`absolute top-1 w-6 h-6 bg-white dark:bg-gray-900 rounded-full shadow transition-all ${
                flags?.maintenanceMode ? "left-7" : "left-1"
              }`} />
            </button>
          </div>
          <div className="py-3 space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Message shown to users</p>
            <textarea
              value={maintMessage}
              onChange={(e) => setMaintMessage(e.target.value)}
              maxLength={280}
              rows={2}
              className="w-full rounded-xl border border-gray-200 dark:border-gray-700 p-3 text-sm focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20"
              placeholder="S-PAY is undergoing scheduled maintenance. We'll be back shortly — your funds are safe."
            />
            <button
              onClick={saveMaintenanceMessage}
              disabled={updateFlags.isPending}
              className="text-sm font-semibold text-[#4DC9EE] hover:underline disabled:opacity-60"
            >
              Save message
            </button>
          </div>
        </Section>

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

        <TeamSection />
        <SiteContentSection />
        <NotificationSection />

        <Section icon={<Wallet size={16} />} title="Wallet Infrastructure (Celo · WaaS)">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-3 leading-relaxed">
            Wallets are provisioned <strong>just-in-time on the first money action</strong> (send, deposit address,
            withdrawal) — never at signup or login. Jobs-board traffic can sign up and browse all day without
            creating a single billable wallet user; you only pay your wallet provider for people who actually move money.
          </p>
          {(walletProviders?.providers ?? []).map((p) => {
            const isActive = walletProviders?.activeProvider === p.key;
            return (
              <div key={p.key} className="py-3 border-b border-gray-50 dark:border-gray-800 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                      {p.label}
                      {isActive && (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-[#4DC9EE] px-2 py-0.5 rounded-full">
                          Active — creates new wallets
                        </span>
                      )}
                      {p.configured ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} /> Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <XCircle size={10} /> Not set
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{p.envHint} · {p.wallets.toLocaleString()} wallet{p.wallets === 1 ? "" : "s"}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{WALLET_PROVIDER_NOTES[p.key]}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {!isActive && (
                      <button
                        onClick={() => setActiveProvider(p.key)}
                        disabled={updateWalletProviders.isPending || !p.configured || !p.enabled}
                        className="text-xs font-semibold text-[#4DC9EE] hover:underline disabled:opacity-40 disabled:no-underline"
                        title={!p.configured ? "Set this provider's env vars on Render first" : !p.enabled ? "Switch this provider on first" : undefined}
                      >
                        Make active
                      </button>
                    )}
                    <button
                      onClick={() => toggleProvider(p.key, !p.enabled)}
                      disabled={updateWalletProviders.isPending}
                      aria-label={`Toggle ${p.label}`}
                      className={`relative w-14 h-8 rounded-full transition-colors flex-shrink-0 disabled:opacity-60 ${
                        p.enabled ? "bg-green-500" : "bg-gray-300"
                      }`}
                    >
                      <span className={`absolute top-1 w-6 h-6 bg-white dark:bg-gray-900 rounded-full shadow transition-all ${
                        p.enabled ? "left-7" : "left-1"
                      }`} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          <div className="mt-3 p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed space-y-1.5">
            <p><strong>How the switches work:</strong></p>
            <p>• <strong>Active</strong> — the provider that creates wallets for users doing their <em>first</em> money action. Switch it anytime; it only affects new wallets.</p>
            <p>• <strong>On/Off toggle</strong> — kill switch per provider. OFF blocks new wallets <em>and</em> pauses sends from wallets it holds keys for (users see “transfers briefly paused”). Balances and deposits are unaffected — funds live on-chain, not at the provider.</p>
            <p>• <strong>Existing wallets never migrate.</strong> A wallet's private key stays with the provider that created it, so keep a provider's env keys set (even when OFF for new wallets) as long as it still holds wallets.</p>
            <p>• Full setup steps per provider: <code className="bg-blue-100 px-1 rounded">docs/WALLET-PROVIDERS.md</code> in the repo.</p>
          </div>
        </Section>

        <Section icon={<CreditCard size={16} />} title="Virtual Card Program">
          {/* The master switch — flips users between waitlist and live card creation */}
          <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Card Program Master Switch</p>
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
                className={`absolute top-1 w-6 h-6 bg-white dark:bg-gray-900 rounded-full shadow transition-all ${
                  flags?.cardProgramEnabled ? "left-7" : "left-1"
                }`}
              />
            </button>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-[#4DC9EE]" />
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Card Waitlist</p>
            </div>
            <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{(flags?.cardWaitlistCount ?? 0).toLocaleString()} waiting</span>
          </div>
          <StatusRow label="Stripe API Key" ok={s?.stripe?.configured} note="STRIPE_SECRET_KEY — for virtual card issuance" />
          <StatusRow label="Stripe Webhook" ok={s?.stripe?.webhookConfigured} note="STRIPE_WEBHOOK_SECRET — for card authorization events" />
          <div className="mt-3 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 leading-relaxed">
            <strong>Launch checklist:</strong> ① stripe.com → Developers → API keys → set STRIPE_SECRET_KEY on Render (enable Stripe Issuing on the account). ② Add the webhook endpoint (<code className="bg-amber-100 px-1 rounded">/webhooks/stripe</code>) and set STRIPE_WEBHOOK_SECRET. ③ Flip the master switch above — the waitlist instantly becomes “Create My Virtual Card” for KYC-approved users.
          </div>
        </Section>

        <Section icon={<Percent size={16} />} title="Fees & Revenue">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
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
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <p className="mb-2">Accounts with admin access (set via <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-xs">ADMIN_EMAILS</code> env var):</p>
            <ul className="space-y-1">
              {(s?.adminEmails ?? []).map((email: string) => (
                <li key={email} className="flex items-center gap-2 text-xs font-mono bg-gray-50 dark:bg-gray-800/60 rounded-lg px-3 py-2">
                  <Shield size={12} className="text-[#4DC9EE]" /> {email}
                </li>
              ))}
            </ul>
            <p className="text-xs text-gray-400 mt-3">To add an admin, set <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">ADMIN_EMAILS=email1@x.com,email2@x.com</code> on Render.</p>
          </div>
        </Section>

      </div>
    </AdminLayout>
  );
}


// ─── Site content: hero, footer, colours — live edits, no deploy ─────────────

function SiteContentSection() {
  const { data, refetch } = useGetAdminSiteContent({ query: { queryKey: getGetAdminSiteContentQueryKey() } });
  const save = useUpdateSiteContent();
  const { toast } = useToast();
  const [form, setForm] = useState({ heroTitle: "", heroSubtitle: "", heroCta: "", announcement: "", footerTagline: "", primaryColor: "#4DC9EE", accentColor: "#1A2B4A" });
  useEffect(() => { if (data) setForm(data); }, [data]);

  const submit = () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(form.primaryColor) || !/^#[0-9a-fA-F]{6}$/.test(form.accentColor)) {
      toast({ title: "Colours must be hex", description: "Example: #4DC9EE", variant: "destructive" });
      return;
    }
    save.mutate({ data: form }, {
      onSuccess: () => { toast({ title: "Site content saved", description: "Live on the landing page within a minute." }); refetch(); },
      onError: () => toast({ title: "Could not save", variant: "destructive" }),
    });
  };

  const Field = ({ label, value, onChange, max = 160 }: { label: string; value: string; onChange: (v: string) => void; max?: number }) => (
    <div className="space-y-1 py-2">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{label}</p>
      <input value={value} maxLength={max} onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 px-3 text-sm focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20" />
    </div>
  );

  return (
    <Section icon={<Paintbrush size={16} />} title="Site Content (Hero · Footer · Colours)">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Edits the public landing page live — no deploy. Leave a field as-is to keep it.</p>
      <Field label="Hero title" value={form.heroTitle} onChange={(v) => setForm((f) => ({ ...f, heroTitle: v }))} />
      <Field label="Hero subtitle" value={form.heroSubtitle} onChange={(v) => setForm((f) => ({ ...f, heroSubtitle: v }))} max={300} />
      <Field label="Hero button text" value={form.heroCta} onChange={(v) => setForm((f) => ({ ...f, heroCta: v }))} max={60} />
      <Field label="Announcement ribbon (empty = hidden)" value={form.announcement} onChange={(v) => setForm((f) => ({ ...f, announcement: v }))} />
      <Field label="Footer tagline" value={form.footerTagline} onChange={(v) => setForm((f) => ({ ...f, footerTagline: v }))} />
      <div className="grid grid-cols-2 gap-3 py-2">
        {(["primaryColor", "accentColor"] as const).map((k) => (
          <div key={k} className="space-y-1">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{k === "primaryColor" ? "Primary colour" : "Accent colour"}</p>
            <div className="flex items-center gap-2">
              <input type="color" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="w-10 h-10 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer" />
              <input value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="flex-1 h-10 rounded-lg border border-gray-200 dark:border-gray-700 px-3 text-sm font-mono" />
            </div>
          </div>
        ))}
      </div>
      <button onClick={submit} disabled={save.isPending} className="bg-[#4DC9EE] hover:bg-[#2E8FD6] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60 mt-2">
        {save.isPending ? "Saving…" : "Save Site Content"}
      </button>
    </Section>
  );
}

// ─── Manual notifications: message everyone, or one user by email ────────────

function NotificationSection() {
  const send = useSendAdminNotification();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");

  const submit = () => {
    if (!title.trim() || !body.trim()) {
      toast({ title: "Title and message are required", variant: "destructive" });
      return;
    }
    send.mutate({ data: { title: title.trim(), body: body.trim(), ...(email.trim() ? { email: email.trim() } : {}) } }, {
      onSuccess: (r) => {
        toast({ title: "Notification sent", description: (r as { message?: string })?.message });
        setTitle(""); setBody(""); setEmail("");
      },
      onError: (err) => toast({ title: "Could not send", description: (err as { data?: { message?: string } })?.data?.message ?? "Try again.", variant: "destructive" }),
    });
  };

  return (
    <Section icon={<Megaphone size={16} />} title="Send a Notification">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Appears instantly in every user's in-app notification bell. Leave the email empty to broadcast to all users.</p>
      <div className="space-y-3">
        <input value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} placeholder="Title — e.g. New: GCash withdrawals are live 🎉"
          className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 px-3 text-sm focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20" />
        <textarea value={body} maxLength={500} rows={3} onChange={(e) => setBody(e.target.value)} placeholder="Message…"
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-sm focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Specific user's email (optional — empty = everyone)"
          className="w-full h-10 rounded-lg border border-gray-200 dark:border-gray-700 px-3 text-sm focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20" />
        <button onClick={submit} disabled={send.isPending} className="bg-[#4DC9EE] hover:bg-[#2E8FD6] text-white text-sm font-bold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-60">
          {send.isPending ? "Sending…" : email.trim() ? "Send to user" : "Send to everyone"}
        </button>
      </div>
    </Section>
  );
}


// ─── Team & roles: superadmins appoint managers/support, everyone sees the team ─

const ROLE_HELP: Record<string, string> = {
  superadmin: "Everything — switches, fees, site content, and managing this team",
  manager: "Operations — users & KYC, transactions, job listings, enquiries, notifications",
  support: "Enquiries inbox + read-only users, transactions and stats",
};

function TeamSection() {
  const { data, refetch } = useGetAdminTeam({ query: { queryKey: getGetAdminTeamQueryKey() } });
  const grant = useGrantAdminRole();
  const revoke = useRevokeAdminRole();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"superadmin" | "manager" | "support">("support");
  const isSuper = data?.myRole === "superadmin";

  const apiMsg = (err: unknown, fb: string) => (err as { data?: { message?: string } })?.data?.message ?? fb;

  const add = () => {
    if (!email.trim()) { toast({ title: "Enter the person's email", variant: "destructive" }); return; }
    grant.mutate({ data: { email: email.trim(), role } }, {
      onSuccess: () => { toast({ title: "Role granted", description: `${email.trim()} is now ${role}.` }); setEmail(""); refetch(); },
      onError: (err) => toast({ title: "Could not grant role", description: apiMsg(err, "Try again."), variant: "destructive" }),
    });
  };

  const remove = (userId: string, who: string) => {
    revoke.mutate({ userId }, {
      onSuccess: () => { toast({ title: "Role removed", description: `${who} no longer has admin access.` }); refetch(); },
      onError: (err) => toast({ title: "Could not remove", description: apiMsg(err, "Try again."), variant: "destructive" }),
    });
  };

  return (
    <Section icon={<Users size={16} />} title="Team & Roles">
      <p className="text-xs text-gray-500 mb-3">
        Your role: <strong className="uppercase">{data?.myRole ?? "…"}</strong>. Owners from <code className="bg-gray-100 px-1 rounded">ADMIN_EMAILS</code> are permanent superadmins; appoint more admins below (they must register an account first). Revoked roles lose access immediately.
      </p>

      <div className="space-y-2 mb-4">
        {(data?.admins ?? []).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-gray-50">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{a.fullName} <span className="text-gray-400 font-normal">· {a.email}</span></p>
              <p className="text-[11px] text-gray-400">{ROLE_HELP[a.role]}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                a.role === "superadmin" ? "bg-purple-50 text-purple-700" : a.role === "manager" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}>{a.role}</span>
              {a.source === "env" ? (
                <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-700 px-2 py-1 rounded-full" title="Set via ADMIN_EMAILS on Render">Owner</span>
              ) : isSuper ? (
                <button onClick={() => remove(a.id, a.email)} disabled={revoke.isPending} className="text-red-400 hover:text-red-600 p-1" aria-label={`Remove ${a.email}`}>
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {isSuper && (
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5"><UserPlus size={15} className="text-[#4DC9EE]" /> Add an admin</p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="registered-user@email.com"
              className="flex-1 h-10 rounded-lg border border-gray-200 px-3 text-sm focus:outline-none focus:border-[#4DC9EE] focus:ring-2 focus:ring-[#4DC9EE]/20" />
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm bg-white">
              <option value="support">Support</option>
              <option value="manager">Manager</option>
              <option value="superadmin">Superadmin</option>
            </select>
            <button onClick={add} disabled={grant.isPending}
              className="bg-[#4DC9EE] hover:bg-[#2E8FD6] text-white text-sm font-bold px-5 h-10 rounded-xl transition-colors disabled:opacity-60">
              {grant.isPending ? "Granting…" : "Grant role"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">{ROLE_HELP[role]}</p>
        </div>
      )}
    </Section>
  );
}
