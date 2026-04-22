import { useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { useNotifications } from "../../../lib/hooks/useNotifications";

function timeAgo(dateString: string) {
  const date = new Date(dateString).getTime();
  const now = Date.now();
  const diffMinutes = Math.floor((now - date) / 1000 / 60);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);

  const {
    notifications,
    unreadCount,
    loading,
    actionLoading,
    markOneAsRead,
    markEverythingAsRead,
  } = useNotifications();

  const latest = notifications.slice(0, 6);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="relative border border-white/10 bg-white/5 rounded-full p-3 text-white transition hover:bg-white/10"
      >
        <Bell size={18} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 rounded-2xl min-w-5 items-center justify-center bg-orange-500 px-1 text-[10px] font-bold text-black">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right z-50 mt-3 w-90 overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-white">Notifications</p>
              <p className="text-xs text-white/50">
                {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
              </p>
            </div>

            <button
              type="button"
              disabled={actionLoading || unreadCount === 0}
              onClick={() => void markEverythingAsRead()}
              className="text-xs font-semibold text-orange-400 hover:text-orange-300 disabled:opacity-50"
            >
              Mark all read
            </button>
          </div>

          <div className="max-h-105 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-white/60">
                Loading notifications...
              </div>
            ) : latest.length === 0 ? (
              <div className="p-4 text-sm text-white/60">
                No notifications yet.
              </div>
            ) : (
              latest.map((item) => (
                <Link
                  key={item.id}
                  to={item.action_url || "/notifications"}
                  onClick={() => {
                    void markOneAsRead(item.id);
                    setOpen(false);
                  }}
                  className="block border-b border-white/5 px-4 py-3 transition hover:bg-white/5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-semibold ${
                          item.is_read ? "text-white/70" : "text-white"
                        }`}
                      >
                        {item.title}
                      </p>

                      {item.message ? (
                        <p className="mt-1 line-clamp-2 text-xs text-white/60">
                          {item.message}
                        </p>
                      ) : null}

                      <p className="mt-2 text-[11px] text-white/40">
                        {timeAgo(item.created_at)}
                      </p>
                    </div>

                    {!item.is_read ? (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 bg-orange-500" />
                    ) : null}
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="border-t border-white/10 px-4 py-3">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-semibold text-orange-400 hover:text-orange-300"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
