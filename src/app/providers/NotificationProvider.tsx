import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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
import {
  getPushConfigurationError,
  getPushSupportError,
  registerPushNotifications,
} from "../../features/notifications/services/pushService";
import { resolveNotificationActionUrl } from "../../features/notifications/utils/notificationLinks";

type PushPermissionState = NotificationPermission | "unsupported";

type NotificationContextValue = {
  notifications: NotificationRow[];
  unreadCount: number;
  loading: boolean;
  actionLoading: boolean;
  error: string;
  pushSupported: boolean;
  pushEnabled: boolean;
  pushPermission: PushPermissionState;
  pushLoading: boolean;
  pushError: string;
  enablePushNotifications: () => Promise<boolean>;
  reload: () => Promise<void>;
  markOneAsRead: (notificationId: string) => Promise<void>;
  markEverythingAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | undefined>(
  undefined,
);

export function NotificationProvider({
  userId,
  organizationId,
  children,
}: {
  userId?: string | null;
  organizationId?: string | null;
  children: React.ReactNode;
}) {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  const [pushSupported, setPushSupported] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushPermission, setPushPermission] =
    useState<PushPermissionState>("unsupported");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState("");
  const autoRegisteredPushFor = useRef<string | null>(null);

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
        getUserNotifications({ userId, organizationId: organizationId ?? undefined, limit: 50 }),
        getUnreadNotificationCount(userId, organizationId),
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
  }, [organizationId, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    const supportError = getPushSupportError();
    const configurationError = supportError ? "" : getPushConfigurationError();
    const setupError = supportError || configurationError;

    setPushSupported(!setupError);
    setPushError(setupError);
    setPushPermission(
      typeof Notification === "undefined" ? "unsupported" : Notification.permission,
    );
  }, []);

  const enablePushNotifications = useCallback(async () => {
    if (!userId || !organizationId) {
      setPushError("You need to be signed in to enable browser notifications.");
      return false;
    }

    const supportError = getPushSupportError();
    if (supportError) {
      setPushSupported(false);
      setPushError(supportError);
      return false;
    }

    const configurationError = getPushConfigurationError();
    if (configurationError) {
      setPushSupported(false);
      setPushError(configurationError);
      return false;
    }

    try {
      setPushSupported(true);
      setPushLoading(true);
      setPushError("");

      await registerPushNotifications({ userId, organizationId });

      setPushPermission(Notification.permission);
      setPushEnabled(true);
      autoRegisteredPushFor.current = `${userId}:${organizationId}`;
      return true;
    } catch (err) {
      setPushPermission(
        typeof Notification === "undefined" ? "unsupported" : Notification.permission,
      );
      setPushEnabled(false);
      setPushError(
        err instanceof Error
          ? err.message
          : "Failed to enable browser notifications.",
      );
      return false;
    } finally {
      setPushLoading(false);
    }
  }, [organizationId, userId]);

  useEffect(() => {
    if (!userId || !organizationId || !pushSupported || pushEnabled) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    const registrationKey = `${userId}:${organizationId}`;
    if (autoRegisteredPushFor.current === registrationKey) return;
    autoRegisteredPushFor.current = registrationKey;

    void enablePushNotifications();
  }, [
    enablePushNotifications,
    organizationId,
    pushEnabled,
    pushSupported,
    userId,
  ]);

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
          if (
            organizationId &&
            incoming.organization_id !== organizationId
          ) {
            return;
          }

          setNotifications((prev) => {
            const exists = prev.some((item) => item.id === incoming.id);
            if (exists) return prev;
            return [incoming, ...prev];
          });

          if (!incoming.is_read) {
            setUnreadCount((prev) => prev + 1);

            if (navigator.onLine) {
              toast.info(incoming.message || incoming.title, {
                onClick: () => {
                  const targetUrl = resolveNotificationActionUrl(incoming);
                  if (targetUrl) {
                    window.location.assign(targetUrl);
                  }
                },
              });
            }
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
          if (
            organizationId &&
            updated.organization_id !== organizationId
          ) {
            return;
          }

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
            } else if (existing.is_read && !updated.is_read) {
              setUnreadCount((count) => count + 1);
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
  }, [organizationId, userId]);

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

      await markAllNotificationsAsRead(userId, organizationId);
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
  }, [organizationId, userId, reload]);

  const value = useMemo(
    () => ({
      notifications,
      unreadCount,
      loading,
      actionLoading,
      error,
      pushSupported,
      pushEnabled,
      pushPermission,
      pushLoading,
      pushError,
      enablePushNotifications,
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
      pushSupported,
      pushEnabled,
      pushPermission,
      pushLoading,
      pushError,
      enablePushNotifications,
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
