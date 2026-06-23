import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

/**
 * Catches render errors anywhere below it and shows a recovery screen instead of
 * a blank page. Without this, any thrown error in a route unmounts the whole
 * React tree and the user sees nothing. `resetKey` (the route location) clears
 * the error when the user navigates, so a crash on one page never traps them.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode; resetKey?: unknown },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown): void {
    // Surface it for debugging; replace with a reporter (Sentry…) when wired.
    // eslint-disable-next-line no-console
    console.error("Unhandled render error:", error, info);
  }

  componentDidUpdate(prev: { resetKey?: unknown }): void {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center gap-4 bg-white dark:bg-gray-950 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-500/10 text-red-500 flex items-center justify-center">
          <AlertTriangle size={28} />
        </div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Something went wrong</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          This page hit an unexpected error. Reloading usually fixes it — your money and data are safe.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => window.location.reload()}
            className="px-5 py-2.5 rounded-xl bg-[#4DC9EE] text-white font-semibold hover:bg-[#2E8FD6] transition-colors"
          >
            Reload
          </button>
          <a
            href="/dashboard"
            className="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Go home
          </a>
        </div>
      </div>
    );
  }
}
