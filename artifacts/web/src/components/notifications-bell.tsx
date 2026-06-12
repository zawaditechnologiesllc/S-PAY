import { useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useGetNotifications, getGetNotificationsQueryKey, useMarkNotificationsRead,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

/** Header bell: unread badge + dropdown of personal and broadcast notifications. */
export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useGetNotifications({
    query: { queryKey: getGetNotificationsQueryKey(), refetchInterval: 60_000 },
  });
  const markRead = useMarkNotificationsRead();
  const unread = data?.unreadCount ?? 0;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && unread > 0) {
      markRead.mutate(undefined, {
        onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
      });
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button className="relative w-10 h-10 rounded-full bg-white/20 text-white flex items-center justify-center hover:bg-white/30 transition-colors" aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}>
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <p className="font-bold text-sm text-gray-900 dark:text-gray-100">Notifications</p>
          {unread > 0 && <span className="text-[11px] text-gray-400 inline-flex items-center gap-1"><CheckCheck size={12} /> marking read…</span>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {(data?.notifications?.length ?? 0) === 0 ? (
            <p className="text-sm text-gray-400 text-center py-10">Nothing yet — money and account updates land here.</p>
          ) : (
            data!.notifications.map((n) => (
              <div key={n.id} className={`px-4 py-3 border-b border-gray-50 dark:border-gray-800 last:border-0 ${n.unread ? "bg-blue-50/50 dark:bg-blue-950/30" : ""}`}>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{n.title}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{n.body}</p>
                <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
