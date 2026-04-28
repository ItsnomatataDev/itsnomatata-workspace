import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "react-toastify";
import { supabase } from "../../lib/supabase/client";
import {
  getUserNotifications,
  getUnreadNotificationCount,
  type NotificationRow,
} from "../../lib/supabase/queries/notifications";
import {
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "../../lib/supabase/mutations/notifications";

type NotificationContextValue = {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  actionLoading: boolean;
  error: string;
  reload: () => Promise<void>;
  markOneAsRead: (notificationId: string) => Promise<void>;
  markEverythingAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined,
);

export function NotificationProvider({
  userId,
  children,
}: {
  userId?: string | null;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setError("");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [items, unread] = await Promise.all([
        getUserNotifications({ userId, limit: 50 }),
        getUnreadNotificationCount(userId),
      ]);

      setNotifications(items);
      setUnreadCount(unread);
    } catch (err) {
      console.error("NOTIFICATIONS LOAD ERROR:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load notifications.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const incoming = payload.new as NotificationRow;

          setNotifications((prev) => {
            const exists = prev.some((item) => item.id === incoming.id);
            if (exists) return prev;
            return [incoming, ...prev];
          });

          if (!incoming.is_read) {
            setUnreadCount((prev) => prev + 1);

            // Show toast notification for new notification
            toast.info(incoming.message || incoming.title, {
              onClick: () => {
                // Navigate to action URL if available
                if (incoming.action_url) {
                  window.location.href = incoming.action_url;
                }
              },
            });
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as NotificationRow;

          setNotifications((prev) => {
            const existing = prev.find((item) => item.id === updated.id);

            if (!existing) {
              if (!updated.is_read) {
                setUnreadCount((count) => count + 1);
              }
              return [updated, ...prev];
            }

            if (!existing.is_read && updated.is_read) {
              setUnreadCount((count) => Math.max(0, count - 1));
            }

            return prev.map((item) =>
              item.id === updated.id ? updated : item,
            );
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log(`Realtime notifications active for ${userId}`);
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markOneAsRead = useCallback(
    async (notificationId: string) => {
      setError("");

      const existing = notifications.find((item) => item.id === notificationId);
      if (!existing || existing.is_read) return;

      try {
        setActionLoading(true);

        setNotifications((prev) =>
          prev.map((item) =>
            item.id === notificationId
              ? {
                  ...item,
                  is_read: true,
                  read_at: new Date().toISOString(),
                }
              : item,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));

        await markNotificationAsRead(notificationId);
      } catch (err) {
        console.error("MARK NOTIFICATION READ ERROR:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to mark notification as read.",
        );
        await reload();
      } finally {
        setActionLoading(false);
      }
    },
    [notifications, reload],
  );

  const markEverythingAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      setActionLoading(true);
      setError("");

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
          read_at: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);

      await markAllNotificationsAsRead(userId);
    } catch (err) {
      console.error("MARK ALL NOTIFICATIONS READ ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark all notifications as read.",
      );
      await reload();
    } finally {
      setActionLoading(false);
    }
  }, [userId, reload]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      actionLoading,
      error,
      reload,
      markOneAsRead,
      markEverythingAsRead,
    }),
    [
      notifications,
      unreadCount,
      loading,
      actionLoading,
      error,
      reload,
      markOneAsRead,
      markEverythingAsRead,
    ],
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotificationContext() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error(
      "useNotificationContext must be used inside NotificationProvider",
    );
  }

  return context;
}
