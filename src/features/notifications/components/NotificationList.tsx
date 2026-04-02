import NotificationItem from "./NotificationItem";
import type { NotificationItem as NotificationRow } from "../services/notificationService";

export default function NotificationList({
  notifications,
  loading,
  error,
  onRead,
}: {
  notifications: NotificationRow[];
  loading?: boolean;
  error?: string;
  onRead: (notificationId: string) => void;
}) {
  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
        Loading notifications...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
        {error}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
        No notifications yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onRead={onRead}
        />
      ))}
    </div>
  );
}
