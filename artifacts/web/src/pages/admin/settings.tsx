import { AdminLayout } from "./layout";
import { useGetAdminSettings, getGetAdminSettingsQueryKey } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, Shield, CreditCard, Landmark, Database, Key } from "lucide-react";

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

export default function AdminSettings() {
  const { data, isLoading } = useGetAdminSettings({ query: { queryKey: getGetAdminSettingsQueryKey() } });

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

        <Section icon={<CreditCard size={16} />} title="Payments (Virtual Card)">
          <StatusRow label="Stripe" ok={s?.payments?.stripeConfigured} note="STRIPE_SECRET_KEY — for virtual card issuance" />
          <div className="mt-3 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 leading-relaxed">
            <strong>To enable Stripe:</strong> Sign up at stripe.com → Developers → API keys → copy Secret key. Add STRIPE_SECRET_KEY on Render. Also enable Stripe Issuing in your dashboard for virtual cards.
          </div>
        </Section>

        <Section icon={<Landmark size={16} />} title="Banking (Virtual Accounts)">
          <StatusRow label="Noah API" ok={s?.payments?.noahConfigured} note="NOAH_API_KEY — for USD/EUR virtual bank accounts" />
          <div className="mt-3 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 leading-relaxed">
            <strong>To enable Noah:</strong> Apply at noah.com for a partner account. Once approved, get your API key and set NOAH_API_KEY on Render.
          </div>
        </Section>

        <Section icon={<Shield size={16} />} title="Identity Verification (KYC)">
          <StatusRow label="Smile Identity" ok={s?.kyc?.smileIdConfigured} note="SMILE_ID_PARTNER_ID + SMILE_ID_API_KEY" />
          <div className="mt-3 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 leading-relaxed">
            <strong>To enable KYC:</strong> Sign up at smileidentity.com → Portal → get Partner ID and API Key. Set SMILE_ID_PARTNER_ID and SMILE_ID_API_KEY on Render. Smile ID covers Kenya, Nigeria, Ghana, Uganda, South Africa, and more.
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
