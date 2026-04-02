import { useState } from "react";
import { Bell } from "lucide-react";
import { useNotificationContext } from "../../../app/providers/NotificationProvider";
import NotificationList from "./NotificationList";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    loading,
    error,
    markOneAsRead,
    markEverythingAsRead,
  } = useNotificationContext();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative rounded-2xl border border-white/10 bg-white/5 p-3 text-white hover:bg-white/10"
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-3 w-95 max-w-[90vw] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-4">
            <div>
              <h3 className="font-semibold text-white">Notifications</h3>
              <p className="text-xs text-white/45">
                {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => void markEverythingAsRead()}
              className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-105 overflow-y-auto p-4">
            <NotificationList
              notifications={notifications}
              loading={loading}
              error={error}
              onRead={(notificationId) => void markOneAsRead(notificationId)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
