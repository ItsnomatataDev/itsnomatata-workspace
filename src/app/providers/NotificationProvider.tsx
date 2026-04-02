import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { useNotifications } from "../../lib/hooks/useNotifications";
import type { NotificationItem } from "../../features/notifications/services/notificationService";

type NotificationContextType = {
  notifications: NotificationItem[];
  unreadCount: number;
  loading: boolean;
  actionLoading: boolean;
  error: string;
  refreshNotifications: () => Promise<void>;
  markOneAsRead: (notificationId: string) => Promise<void>;
  markEverythingAsRead: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const userId = auth?.user?.id ?? null;

  const {
    notifications,
    unreadCount,
    loading,
    actionLoading,
    error,
    refreshNotifications,
    markOneAsRead,
    markEverythingAsRead,
  } = useNotifications(userId);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        actionLoading,
        error,
        refreshNotifications,
        markOneAsRead,
        markEverythingAsRead,
      }}
    >
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
