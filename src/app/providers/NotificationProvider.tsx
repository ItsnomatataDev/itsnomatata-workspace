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
  checkPushEnabledForUser,
  getPushConfigurationError,
  getPushSupportError,
  registerPushNotifications,
  syncPushSubscriptionWithServer,
  unregisterPushNotifications,
} from "../../features/notifications/services/pushService";
import { syncAppBadge } from "../../features/notifications/services/appBadge";
import { resolveNotificationActionUrl } from "../../features/notifications/utils/notificationLinks";
import {
  playSystemSound,
  resolveSoundKindFromNotification,
} from "../../lib/sounds/systemSounds";

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
  disablePushNotifications: () => Promise<boolean>;
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
    void syncAppBadge(userId ? unreadCount : 0);
  }, [unreadCount, userId]);

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

  const refreshPushEnabledState = useCallback(async () => {
    if (!userId) {
      setPushEnabled(false);
      return;
    }

    setPushEnabled(await checkPushEnabledForUser(userId));
  }, [userId]);

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
      autoRegisteredPushFor.current = `${userId}:${organizationId}`;
      await refreshPushEnabledState();
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
  }, [organizationId, refreshPushEnabledState, userId]);

  const disablePushNotifications = useCallback(async () => {
    if (!userId) {
      setPushError("You need to be signed in to manage browser notifications.");
      return false;
    }

    try {
      setPushLoading(true);
      setPushError("");
      await unregisterPushNotifications({ userId });
      autoRegisteredPushFor.current = null;
      await refreshPushEnabledState();
      return true;
    } catch (err) {
      setPushError(
        err instanceof Error
          ? err.message
          : "Failed to disable browser notifications.",
      );
      return false;
    } finally {
      setPushLoading(false);
    }
  }, [refreshPushEnabledState, userId]);

  useEffect(() => {
    void refreshPushEnabledState();
  }, [refreshPushEnabledState]);

  useEffect(() => {
    if (!userId || !organizationId || !pushSupported) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") {
      return;
    }

    const registrationKey = `${userId}:${organizationId}`;
    if (autoRegisteredPushFor.current === registrationKey) return;

    let cancelled = false;

    void (async () => {
      try {
        await syncPushSubscriptionWithServer({ userId, organizationId });
        if (!cancelled) {
          autoRegisteredPushFor.current = registrationKey;
          await refreshPushEnabledState();
        }
      } catch (err) {
        console.warn("PUSH SUBSCRIPTION SYNC:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [organizationId, pushSupported, refreshPushEnabledState, userId]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== "NOTIFICATION_CLICK") return;
      const url = typeof event.data.url === "string" ? event.data.url : "";
      if (!url) return;

      try {
        const parsed = new URL(url, window.location.origin);
        if (parsed.origin !== window.location.origin) return;
        window.location.assign(`${parsed.pathname}${parsed.search}${parsed.hash}`);
      } catch {
        // Ignore malformed URLs from the service worker.
      }
    };

    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);

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

            const soundKind = resolveSoundKindFromNotification({
              type: incoming.type,
              metadata:
                incoming.metadata && typeof incoming.metadata === "object"
                  ? (incoming.metadata as Record<string, unknown>)
                  : null,
            });
            void playSystemSound(soundKind);

            if (navigator.onLine) {
              const targetUrl = resolveNotificationActionUrl(incoming);
              toast.info(incoming.message || incoming.title, {
                onClick: () => {
                  if (targetUrl.startsWith("/")) {
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
      disablePushNotifications,
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
      disablePushNotifications,
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
