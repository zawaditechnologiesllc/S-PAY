import { useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetNotifications, getGetNotificationsQueryKey, useMarkNotificationsRead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Banknote, ShieldCheck, Megaphone } from "lucide-react";

/**
 * Full notifications page (Profile → Preferences → Notifications, and the
 * long-form counterpart to the header bell). Opening it marks everything read.
 */

const CATEGORY_ICON: Record<string, React.ReactNode> = {
  money: <Banknote size={18} />,
  account: <ShieldCheck size={18} />,
  announcement: <Megaphone size={18} />,
};

export default function Notifications() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useGetNotifications({
    query: { queryKey: getGetNotificationsQueryKey(), staleTime: 0, refetchOnMount: "always" },
  });
  const markRead = useMarkNotificationsRead();

  // Reading the page = reading the notifications.
  useEffect(() => {
    if ((data?.unreadCount ?? 0) > 0) {
      markRead.mutate(undefined, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.unreadCount]);

  const notifications = data?.notifications ?? [];

  return (
    <Layout back title="Notifications">
      <Card className="border-0 shadow-md rounded-2xl overflow-hidden bg-white dark:bg-gray-900 mt-4 max-w-2xl mx-auto">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3">
                  <Skeleton className="w-10 h-10 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-3 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-14 text-center text-gray-400">
              <Bell size={32} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium text-gray-600 dark:text-gray-300">Nothing yet</p>
              <p className="text-sm mt-1">Money in &amp; out, account updates and announcements land here.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50 dark:divide-gray-800">
              {notifications.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 px-5 py-4 ${n.unread ? "bg-blue-50/50 dark:bg-blue-950/30" : ""}`}>
                  <div className="w-10 h-10 rounded-full bg-[#4DC9EE]/10 text-[#4DC9EE] flex items-center justify-center flex-shrink-0 mt-0.5">
                    {CATEGORY_ICON[n.category ?? ""] ?? <Bell size={18} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{n.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{n.body}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
