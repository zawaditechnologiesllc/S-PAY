import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

/** Consistent back navigation for inner pages — history back with a sane fallback. */
export function BackButton({ fallback = "/dashboard", label = "Back" }: { fallback?: string; label?: string }) {
  const [, setLocation] = useLocation();
  const goBack = () => {
    if (window.history.length > 1) window.history.back();
    else setLocation(fallback);
  };
  return (
    <button
      onClick={goBack}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white bg-white/15 hover:bg-white/25 rounded-full pl-2.5 pr-4 py-1.5 transition-colors w-fit"
      aria-label="Go back"
    >
      <ArrowLeft size={16} /> {label}
    </button>
  );
}
