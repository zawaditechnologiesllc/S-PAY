import { QueryClient, dehydrate, hydrate, type Query } from "@tanstack/react-query";

/**
 * One React Query client, tuned for slow / intermittent connections:
 *
 *  - Retries transient + network failures with exponential backoff (but never
 *    client errors, and never mutations — money actions must not auto-repeat).
 *  - Refetches when the network reconnects.
 *  - Keeps data for a day (gcTime) so it survives navigation.
 *  - PERSISTS the cache to localStorage and rehydrates it on boot, so reopening
 *    the app shows the last-known balance / history / accounts instantly —
 *    before any request finishes, and even fully offline — then refreshes in the
 *    background (stale-while-revalidate).
 */

const CACHE_KEY = "spay:rq";
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // a day
const MAX_BYTES = 2_000_000;            // ~2MB localStorage budget

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        const status = (error as { status?: number })?.status;
        if (typeof status === "number" && status >= 400 && status < 500) return false; // 4xx won't fix itself
        return count < 3;
      },
      retryDelay: (i) => Math.min(1000 * 2 ** i, 15000),
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      staleTime: 60 * 1000,
      gcTime: MAX_AGE_MS,
    },
    mutations: { retry: 0 },
  },
});

// Persist successful queries, but skip the large, fast-changing jobs feeds so the
// stored blob stays small and focused on account data that's useful offline.
function shouldPersist(query: Query): boolean {
  if (query.state.status !== "success") return false;
  return !JSON.stringify(query.queryKey).includes("jobs");
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;
function scheduleSave(): void {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const state = dehydrate(queryClient, {
        shouldDehydrateQuery: shouldPersist,
        shouldDehydrateMutation: () => false,
      });
      const blob = JSON.stringify({ t: Date.now(), state });
      if (blob.length <= MAX_BYTES) localStorage.setItem(CACHE_KEY, blob);
    } catch {
      /* storage full or disabled — ignore; the app still works without persistence */
    }
  }, 1500);
}

/** Rehydrate the cache from the last session, then keep saving it. Call once, before first render. */
export function installPersistence(): void {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const { t, state } = JSON.parse(raw) as { t: number; state: unknown };
      if (Date.now() - t < MAX_AGE_MS) hydrate(queryClient, state);
      else localStorage.removeItem(CACHE_KEY);
    }
  } catch {
    /* corrupt cache — drop it */
    try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
  }
  queryClient.getQueryCache().subscribe(scheduleSave);
}

/** Wipe in-memory + persisted cache (call on logout so the next user starts clean). */
export function clearAppCache(): void {
  clearTimeout(saveTimer);
  try { localStorage.removeItem(CACHE_KEY); } catch { /* ignore */ }
  queryClient.clear();
}
