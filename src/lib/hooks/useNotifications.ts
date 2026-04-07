import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  readAllNotifications,
  readNotification,
  type NotificationItem,
} from "../../features/notifications/services/notificationService";

export function useNotifications(userId?: string | null) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const refreshNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [items, unread] = await Promise.all([
        fetchNotifications(userId, 30),
        fetchUnreadNotificationCount(userId),
      ]);

      setNotifications(items);
      setUnreadCount(unread);
    } catch (err: any) {
      console.error("REFRESH NOTIFICATIONS ERROR:", err);
      setError(err?.message || "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void refreshNotifications();
  }, [refreshNotifications]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshNotifications();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshNotifications]);

  const markOneAsRead = useCallback(
    async (notificationId: string) => {
      if (!userId) return;

      try {
        setActionLoading(true);
        await readNotification(notificationId);

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
      } catch (err: any) {
        console.error("MARK NOTIFICATION READ ERROR:", err);
        setError(err?.message || "Failed to mark notification as read.");
      } finally {
        setActionLoading(false);
      }
    },
    [userId],
  );

  const markEverythingAsRead = useCallback(async () => {
    if (!userId) return;

    try {
      setActionLoading(true);
      await readAllNotifications(userId);

      setNotifications((prev) =>
        prev.map((item) => ({
          ...item,
          is_read: true,
          read_at: new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (err: any) {
      console.error("MARK ALL NOTIFICATIONS READ ERROR:", err);
      setError(err?.message || "Failed to mark all notifications as read.");
    } finally {
      setActionLoading(false);
    }
  }, [userId]);

  return {
    notifications,
    unreadCount,
    loading,
    actionLoading,
    error,
    refreshNotifications,
    markOneAsRead,
    markEverythingAsRead,
  };
}