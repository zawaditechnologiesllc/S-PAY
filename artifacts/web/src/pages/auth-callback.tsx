import { useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { setToken } from "@/lib/auth";
import spayLogo from "@assets/S-PAY_LOGO_1779718036468.webp";

export default function AuthCallback() {
  const [, setLocation] = useLocation();
  const search = useSearch();

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");
    const error = params.get("error");

    if (token) {
      setToken(token);
      setLocation("/dashboard");
    } else {
      // error=google_cancelled or error=google_failed
      setLocation(`/login?error=${error ?? "unknown"}`);
    }
  }, [search, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="text-center">
        <img src={spayLogo} alt="S-PAY" className="mx-auto w-16 h-16 rounded-[22%] shadow-xl mb-5 block" />
        <p className="text-[#1A2B4A] font-semibold text-sm">Signing you in…</p>
      </div>
    </div>
  );
}
