import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark theme. The Tailwind dark variant is class-based
 * (@custom-variant dark in index.css), so toggling = adding/removing the
 * `dark` class on <html>. Choice persists in localStorage.
 */

const KEY = "spay-theme";

export function applyStoredTheme(): void {
  const stored = localStorage.getItem(KEY);
  const dark = stored === "dark" || (!stored && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(KEY, dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark((d) => !d)}
      className={`w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors ${className}`}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
