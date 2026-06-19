import { AdminLayout } from "./layout";
import { CheckCircle2, XCircle, Building2, TrendingUp, Users, Banknote, ArrowRight } from "lucide-react";

export default function AdminPayroll() {
  return (
    <AdminLayout title="Payroll Management">
      <div className="space-y-6 max-w-4xl">

        <p className="text-sm text-gray-500 dark:text-gray-400">
          Payroll system status, configured employers, and batch processing metrics.
        </p>

        {/* Stats grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Employers</p>
                <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">0</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Building2 size={20} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">KYB verified and funded</p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Payroll Batches (30d)</p>
                <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">0</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-500/10 flex items-center justify-center text-green-600">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Submitted & completed</p>
          </div>

          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Workers Paid (30d)</p>
                <p className="text-3xl font-black text-gray-900 dark:text-gray-100 mt-1">0</p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center text-purple-600">
                <Users size={20} />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-3">Auto-onboarded + existing</p>
          </div>
        </div>

        {/* System Configuration */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
            <span className="text-[#4DC9EE]"><Banknote size={16} /></span> Payout Provider Configuration
          </h3>

          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Configure preferred providers in Settings → Payout Providers. Each is live-switchable with no downtime.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: "Noah", status: "unconfigured", corridor: "100+ countries", fee: "0.25–1%" },
                { name: "Bridge (Stripe)", status: "unconfigured", corridor: "USD/EUR", fee: "0.5%" },
                { name: "Conduit", status: "unconfigured", corridor: "LatAm/Africa/Asia", fee: "0.8%" },
                { name: "Yellow Card", status: "unconfigured", corridor: "Africa + mobile money", fee: "0.9%" },
                { name: "Thunes", status: "unconfigured", corridor: "140+ countries", fee: "1.1%" },
              ].map((p) => (
                <div key={p.name} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                      {p.status === "unconfigured" ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                          <XCircle size={10} /> Not configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} /> Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{p.corridor}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5">{p.fee} per transaction</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-3 bg-blue-50 rounded-xl text-xs text-blue-700 leading-relaxed">
              <strong>Next steps:</strong> Go to <strong>Settings → Payout Providers</strong> and set environment variables on Render for each provider you want to use. Start with one (e.g., Noah or Bridge) and expand to others for corridor coverage.
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-4 text-sm uppercase tracking-wider">
            Quick Links
          </h3>
          <div className="space-y-2">
            <a href="/admin/settings#payout-providers" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Configure Payout Providers</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Set env keys, choose preferred provider</p>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </a>

            <a href="/admin/settings#fees--revenue" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Set Payroll Fees</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Flat + percent for batch payroll commissions</p>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </a>

            <a href="https://s-pay.gitbook.io/s-pay/payroll" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Payroll API Docs</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Integration guide for marketplaces</p>
              </div>
              <ArrowRight size={16} className="text-gray-400" />
            </a>
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
