import type { NotificationItem as NotificationRow } from "../services/notificationService";

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function NotificationItem({
  notification,
  onRead,
}: {
  notification: NotificationRow;
  onRead: (notificationId: string) => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        notification.is_read
          ? "border-white/10 bg-black/30"
          : "border-orange-500/20 bg-orange-500/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-white">{notification.title}</p>
          <p className="mt-2 text-sm text-white/70">{notification.message}</p>
          <p className="mt-3 text-xs text-white/40">
            {formatDateTime(notification.created_at)}
          </p>
        </div>

        {!notification.is_read ? (
          <button
            type="button"
            onClick={() => onRead(notification.id)}
            className="shrink-0 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black"
          >
            Mark read
          </button>
        ) : (
          <span className="shrink-0 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/45">
            Read
          </span>
        )}
      </div>
    </div>
  );
}
