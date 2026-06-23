import { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

/**
 * A slim banner shown only while the device is offline. On flaky connections the
 * app keeps working from its persisted cache (stale-while-revalidate), so this
 * just tells the user why data might be a little behind — and disappears the
 * moment connectivity returns.
 */
export function OfflineBanner() {
  const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[100] bg-amber-500 text-white text-xs font-semibold py-1.5 px-3 flex items-center justify-center gap-2 shadow"
    >
      <WifiOff size={13} />
      You&apos;re offline — showing your last saved data. We&apos;ll refresh once you&apos;re back online.
    </div>
  );
}
