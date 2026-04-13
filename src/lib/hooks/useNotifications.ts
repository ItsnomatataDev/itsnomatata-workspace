import { useNotificationContext } from "../../app/providers/NotificationProvider";

export function useNotifications(_userId?: string | null) {
  return useNotificationContext();
}