import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
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
  userId?: string;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
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
        getUserNotifications({ userId, limit: 30 }),
        getUnreadNotificationCount(userId),
      ]);

      setNotifications(items);
      setUnreadCount(unread);
    } catch (err) {
      console.error("NOTIFICATIONS LOAD ERROR:", err);
      setError(
        err instanceof Error ? err.message : "Failed to load notifications",
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
          const newNotification = payload.new as NotificationRow;

          setNotifications((prev) => {
            const exists = prev.some((item) => item.id === newNotification.id);
            if (exists) return prev;
            return [newNotification, ...prev];
          });

          if (!newNotification.is_read) {
            setUnreadCount((prev) => prev + 1);
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
      try {
        setError("");

        await markNotificationAsRead(notificationId);

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

        setUnreadCount((prev) => {
          const target = notifications.find(
            (item) => item.id === notificationId,
          );
          if (target && !target.is_read) {
            return Math.max(0, prev - 1);
          }
          return prev;
        });
      } catch (err) {
        console.error("MARK NOTIFICATION READ ERROR:", err);
        setError(
          err instanceof Error
            ? err.message
            : "Failed to mark notification as read",
        );
      }
    },
    [notifications],
  );

  const markEverythingAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      setError("");

      await markAllNotificationsAsRead(userId);

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
          read_at: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (err) {
      console.error("MARK ALL NOTIFICATIONS READ ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to mark all notifications as read",
      );
    }
  }, [userId]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      error,
      reload,
      markOneAsRead,
      markEverythingAsRead,
    }),
    [
      notifications,
      unreadCount,
      loading,
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
