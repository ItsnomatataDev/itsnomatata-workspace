import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useNotificationContext } from "../../../app/providers/NotificationProvider";
import NotificationList from "../components/NotificationList";

export default function NotificationsPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;

  const {
    notifications,
    unreadCount,
    loading,
    error,
    markOneAsRead,
    markEverythingAsRead,
  } = useNotificationContext();

  if (!auth?.user || !profile) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">Notifications</h1>
              <p className="mt-2 text-sm text-white/50">
                Stay updated with activity across the system.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void markEverythingAsRead()}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
            >
              Mark all as read ({unreadCount})
            </button>
          </div>

          <NotificationList
            notifications={notifications}
            loading={loading}
            error={error}
            onRead={(notificationId) => void markOneAsRead(notificationId)}
          />
        </main>
      </div>
    </div>
  );
}
