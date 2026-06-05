import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../supabase/client";
import { useAuth } from "../../app/providers/AuthProvider";
import { useNotifications } from "./useNotifications";
import { getUnreadInboxDocumentCount } from "../../features/employee-inbox/services/employeeDocumentService";
import { getChatUnreadTotal } from "../../features/chat/services/chatService";
import { getPendingLeaveRequestCount } from "../../features/leave/services/leaveService";
import { countUnreadLeaveNotifications } from "../../features/notifications/utils/notificationCategories";

const LEAVE_REVIEW_ROLES = new Set([
  "admin",
  "org_admin",
  "super_admin",
  "superadmin",
  "manager",
]);

export type SidebarBadgeCounts = {
  inbox: number;
  chat: number;
  leave: number;
  adminLeave: number;
};

export function useSidebarBadges(): SidebarBadgeCounts {
  const auth = useAuth();
  const location = useLocation();
  const { notifications } = useNotifications();

  const userId = auth?.user?.id ?? null;
  const organizationId = auth?.profile?.organization_id ?? null;
  const role = String(auth?.profile?.primary_role ?? "");

  const [inboxUnread, setInboxUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [pendingLeave, setPendingLeave] = useState(0);

  const leaveNotificationUnread = useMemo(
    () => countUnreadLeaveNotifications(notifications),
    [notifications],
  );

  const canReviewLeave = LEAVE_REVIEW_ROLES.has(role);

  const refreshInboxUnread = useCallback(async () => {
    if (!userId) {
      setInboxUnread(0);
      return;
    }

    try {
      setInboxUnread(await getUnreadInboxDocumentCount(userId));
    } catch (err) {
      console.warn("SIDEBAR INBOX BADGE ERROR:", err);
    }
  }, [userId]);

  const refreshChatUnread = useCallback(async () => {
    if (!userId) {
      setChatUnread(0);
      return;
    }

    try {
      setChatUnread(await getChatUnreadTotal(userId));
    } catch (err) {
      console.warn("SIDEBAR CHAT BADGE ERROR:", err);
    }
  }, [userId]);

  const refreshPendingLeave = useCallback(async () => {
    if (!organizationId || !canReviewLeave) {
      setPendingLeave(0);
      return;
    }

    try {
      setPendingLeave(await getPendingLeaveRequestCount(organizationId));
    } catch (err) {
      console.warn("SIDEBAR LEAVE BADGE ERROR:", err);
    }
  }, [canReviewLeave, organizationId]);

  useEffect(() => {
    void refreshInboxUnread();
    void refreshChatUnread();
    void refreshPendingLeave();
  }, [refreshChatUnread, refreshInboxUnread, refreshPendingLeave]);

  useEffect(() => {
    if (!userId) return;

    const inboxChannel = supabase
      .channel(`sidebar-inbox:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "employee_document_recipients",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void refreshInboxUnread();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(inboxChannel);
    };
  }, [refreshInboxUnread, userId]);

  useEffect(() => {
    if (!userId) return;

    const chatChannel = supabase
      .channel(`sidebar-chat:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => {
          void refreshChatUnread();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_conversation_members" },
        () => {
          void refreshChatUnread();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(chatChannel);
    };
  }, [refreshChatUnread, userId]);

  useEffect(() => {
    if (!organizationId || !canReviewLeave) return;

    const leaveChannel = supabase
      .channel(`sidebar-leave:${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "leave_requests",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          void refreshPendingLeave();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(leaveChannel);
    };
  }, [canReviewLeave, organizationId, refreshPendingLeave]);

  useEffect(() => {
    if (location.pathname.startsWith("/inbox")) {
      void refreshInboxUnread();
    }
    if (location.pathname.startsWith("/chat")) {
      void refreshChatUnread();
    }
    if (location.pathname.startsWith("/leave") || location.pathname.startsWith("/admin/leave")) {
      void refreshPendingLeave();
    }
  }, [location.pathname, refreshChatUnread, refreshInboxUnread, refreshPendingLeave]);

  return {
    inbox: inboxUnread,
    chat: chatUnread,
    leave: leaveNotificationUnread,
    adminLeave: canReviewLeave
      ? Math.max(pendingLeave, leaveNotificationUnread)
      : 0,
  };
}
