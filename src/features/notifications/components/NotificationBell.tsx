import { useState } from "react";
import { Bell, CheckCheck, Inbox, Zap } from "lucide-react";
import { Link } from "react-router-dom";
import { useNotifications } from "../../../lib/hooks/useNotifications";
import { useAuth } from "../../../app/providers/AuthProvider";
import { createNotification } from "../../../lib/supabase/mutations/notifications";

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
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string>("");

  const auth = useAuth();
  const profile = auth?.profile;

  const {
    notifications,
    unreadCount,
    loading,
    actionLoading,
    markOneAsRead,
    markEverythingAsRead,
    reload,
  } = useNotifications();

  const latest = notifications.slice(0, 6);

  const handleTestNotification = async () => {
    if (!profile?.organization_id || !profile?.id) {
      setTestResult("Missing org or user ID");
      return;
    }
    setTesting(true);
    setTestResult("");
    try {
      await createNotification({
        organizationId: profile.organization_id,
        userId: profile.id,
        type: "system_alert",
        title: "Test notification",
        message: "If you see this, insert + read are working.",
        actionUrl: "/notifications",
        priority: "high",
      });
      setTestResult("Sent! Reloading...");
      await reload();
      setTestResult("Sent and reloaded.");
    } catch (err: any) {
      console.error("TEST NOTIFICATION ERROR:", err);
      setTestResult(`Error: ${err?.message || "unknown"}`);
    } finally {
      setTesting(false);
    }
  };

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
        <div className="fixed inset-x-3 top-18 z-50 max-h-[calc(100dvh-5.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/70 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-3 sm:w-96">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 px-4 py-4">
            <div>
              <p className="text-base font-semibold text-white">
                Notifications
              </p>
              <p className="mt-1 text-xs text-white/50">
                {unreadCount} unread notification{unreadCount === 1 ? "" : "s"}
              </p>
            </div>

            <button
              type="button"
              disabled={actionLoading || unreadCount === 0}
              onClick={() => void markEverythingAsRead()}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-400 hover:bg-orange-500/10 hover:text-orange-300 disabled:opacity-50"
            >
              <CheckCheck size={14} />
              <span className="hidden sm:inline">Mark all read</span>
              <span className="sm:hidden">Read</span>
            </button>
          </div>

          <div className="max-h-[56dvh] overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-white/60">
                Loading notifications...
              </div>
            ) : latest.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center text-sm text-white/60">
                <Inbox size={28} className="mb-3 text-white/25" />
                <p className="font-medium text-white/70">No notifications yet</p>
                <p className="mt-1 text-xs text-white/40">
                  New alerts will appear here.
                </p>
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
                  className="block border-b border-white/5 px-4 py-3.5 transition hover:bg-white/5"
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
                        <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-white/60">
                          {item.message}
                        </p>
                      ) : null}

                      <p className="mt-2 text-[11px] text-white/40">
                        {timeAgo(item.created_at)}
                      </p>
                    </div>

                    {!item.is_read ? (
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-orange-500" />
                    ) : null}
                  </div>
                </Link>
              ))
            )}
          </div>

          <div className="space-y-3 border-t border-white/10 px-4 py-3">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="block rounded-xl bg-white/5 px-4 py-3 text-center text-sm font-semibold text-orange-400 hover:bg-white/10 hover:text-orange-300"
            >
              View all notifications
            </Link>

            {import.meta.env.DEV ? (
              <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2">
                <button
                  type="button"
                  onClick={() => void handleTestNotification()}
                  disabled={testing}
                  className="flex items-center gap-1.5 text-xs font-medium text-white/50 transition hover:text-orange-400 disabled:opacity-50"
                >
                  <Zap size={12} />
                  {testing ? "Sending test..." : "Send test notification"}
                </button>

                {testResult ? (
                  <p className="mt-1 text-[11px] text-white/40">
                    {testResult}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
