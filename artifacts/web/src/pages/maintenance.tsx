import { Wrench, RefreshCw } from "lucide-react";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.webp";

export default function Maintenance({ message }: { message?: string }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1A2B4A] via-[#1e3560] to-[#0d1f38] flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <img src={spayLogo} alt="S-PAY" className="w-16 h-16 rounded-[22%] mx-auto mb-6 shadow-xl" />
        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center mx-auto mb-5">
          <Wrench size={24} className="text-[#4DC9EE]" />
        </div>
        <h1 className="text-2xl font-black text-white mb-3">We'll be right back</h1>
        <p className="text-blue-200 text-sm leading-relaxed mb-8">
          {message || "S-PAY is undergoing scheduled maintenance. We'll be back shortly — your funds are safe."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 bg-[#4DC9EE] text-white font-bold px-6 py-3 rounded-xl hover:bg-[#2E8FD6] transition-colors text-sm"
        >
          <RefreshCw size={15} /> Check again
        </button>
        <div className="flex items-center justify-center gap-2 mt-10">
          <span className="w-2 h-2 rounded-full bg-[#FCFF52]" />
          <span className="text-white/50 text-xs font-semibold">Built on Celo</span>
        </div>
      </div>
    </div>
  );
}
