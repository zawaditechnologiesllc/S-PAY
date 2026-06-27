/**
 * Route-chunk prefetching — what makes navigation feel instant.
 *
 * Every page is code-split (`lazy(() => import(...))`), so the FIRST time you
 * open a route the browser must download its JS chunk before it can render —
 * that's the spinner you see after each click. Here we prefetch those chunks
 * ahead of the click:
 *
 *   • on idle, right after a logged-in shell mounts, we warm the routes that
 *     account type can reach (user core, payroll for business, the admin set);
 *   • on hover / focus / touch of a nav link, we warm that exact route.
 *
 * By the time the user clicks, the dynamic import resolves from cache and the
 * page renders immediately — no network round-trip, no Suspense fallback.
 *
 * The import specifiers below are the SAME as the lazy() factories in App.tsx,
 * so Vite emits one shared chunk per page; prefetching warms the very chunk the
 * router will later import (it does not duplicate code).
 */

type Mod = { default: unknown };
type Importer = () => Promise<Mod>;

// Keyed by route path so a nav link can prefetch by its href.
const routeImporters: Record<string, Importer> = {
  // ── user app ──
  "/dashboard": () => import("@/pages/dashboard"),
  "/wallet": () => import("@/pages/wallet"),
  "/banking": () => import("@/pages/banking"),
  "/banking/withdraw": () => import("@/pages/withdraw"),
  "/deposit": () => import("@/pages/deposit"),
  "/card": () => import("@/pages/card"),
  "/jobs": () => import("@/pages/jobs"),
  "/profile": () => import("@/pages/profile"),
  "/security": () => import("@/pages/security"),
  "/support": () => import("@/pages/support"),
  "/wallet/exchange": () => import("@/pages/exchange-withdraw"),
  "/how-it-works": () => import("@/pages/how-it-works"),
  // ── payroll (business) ──
  "/payroll": () => import("@/pages/payroll"),
  "/payroll/keys": () => import("@/pages/payroll/keys"),
  "/payroll/batches": () => import("@/pages/payroll/batches"),
  // ── admin ──
  "/admin": () => import("@/pages/admin/dashboard"),
  "/admin/users": () => import("@/pages/admin/users"),
  "/admin/transactions": () => import("@/pages/admin/transactions"),
  "/admin/payroll": () => import("@/pages/admin/payroll"),
  "/admin/jobs": () => import("@/pages/admin/jobs"),
  "/admin/seo": () => import("@/pages/admin/seo"),
  "/admin/enquiries": () => import("@/pages/admin/enquiries"),
  "/admin/settings": () => import("@/pages/admin/settings"),
};

// Route groups warmed together once a shell mounts.
export const USER_CORE_ROUTES = [
  "/dashboard", "/wallet", "/banking", "/card", "/jobs",
  "/profile", "/security", "/deposit", "/banking/withdraw",
];
export const PAYROLL_ROUTES = ["/payroll", "/payroll/keys", "/payroll/batches"];
export const ADMIN_ROUTES = [
  "/admin", "/admin/users", "/admin/transactions", "/admin/payroll",
  "/admin/jobs", "/admin/seo", "/admin/enquiries", "/admin/settings",
];

const warmed = new Set<string>();

function importerFor(path: string): Importer | undefined {
  if (routeImporters[path]) return routeImporters[path];
  // Fall back to the longest matching known prefix (e.g. dynamic detail routes).
  const match = Object.keys(routeImporters)
    .filter((p) => path.startsWith(p))
    .sort((a, b) => b.length - a.length)[0];
  return match ? routeImporters[match] : undefined;
}

/** Prefetch a single route's chunk now (used on hover/focus). Deduped. */
export function prefetchRoute(path: string): void {
  if (warmed.has(path)) return;
  const imp = importerFor(path);
  if (!imp) return;
  warmed.add(path);
  imp().catch(() => warmed.delete(path)); // a failed prefetch can be retried later
}

const onIdle = (fn: () => void): void => {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (typeof ric === "function") ric(fn, { timeout: 2500 });
  else setTimeout(fn, 300);
};

/**
 * Prefetch several routes during idle time, one per idle slice so we never
 * compete with the page the user is actually looking at.
 */
export function prefetchRoutesIdle(paths: string[]): void {
  for (const path of paths) {
    if (warmed.has(path)) continue;
    onIdle(() => prefetchRoute(path));
  }
}

/** Handlers to spread onto a nav link so hovering/focusing warms its route. */
export function linkPrefetchHandlers(path: string) {
  const go = () => prefetchRoute(path);
  return { onMouseEnter: go, onFocus: go, onTouchStart: go };
}
