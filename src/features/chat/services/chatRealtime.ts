import { supabase } from "../../../lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { isRecentlyOnline } from "../utils/presence";
import type {
  ChatConversationMember,
  ChatMessage,
  ChatMessageReaction,
} from "../types/chat";

export type ChatRealtimeStatus =
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED";

export function subscribeToConversationMessages(params: {
  conversationId: string;
  onMessage: (message: ChatMessage) => void;
  onUpdate?: (message: ChatMessage) => void;
  onDelete?: (messageId: string) => void;
  onReactionInsert?: (reaction: ChatMessageReaction) => void;
  onReactionDelete?: (reaction: ChatMessageReaction) => void;
  onStatusChange?: (status: ChatRealtimeStatus) => void;
}) {
  const channel: RealtimeChannel = supabase
    .channel(`chat:conversation:${params.conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${params.conversationId}`,
      },
      (payload) => {
        params.onMessage(payload.new as ChatMessage);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${params.conversationId}`,
      },
      (payload) => {
        params.onUpdate?.(payload.new as ChatMessage);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${params.conversationId}`,
      },
      (payload) => {
        params.onDelete?.(payload.old.id as string);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "message_reactions",
      },
      (payload) => {
        params.onReactionInsert?.(payload.new as ChatMessageReaction);
      },
    )
    .on(
      "postgres_changes",
      {
        event: "DELETE",
        schema: "public",
        table: "message_reactions",
      },
      (payload) => {
        params.onReactionDelete?.(payload.old as ChatMessageReaction);
      },
    )
    .subscribe((status) => {
      if (status === "SUBSCRIBED") {
        params.onStatusChange?.("SUBSCRIBED");
      } else if (status === "CHANNEL_ERROR") {
        params.onStatusChange?.("CHANNEL_ERROR");
        if (import.meta.env.DEV) {
          console.error(
            `[chat] realtime error for conversation ${params.conversationId}`,
          );
        }
      } else if (status === "TIMED_OUT") {
        params.onStatusChange?.("TIMED_OUT");
        if (import.meta.env.DEV) {
          console.error(
            `[chat] realtime timeout for conversation ${params.conversationId}`,
          );
        }
      } else if (status === "CLOSED") {
        params.onStatusChange?.("CLOSED");
      }
    });

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToConversationMembers(params: {
  conversationId: string;
  currentUserId: string;
  onMemberUpdate: (member: ChatConversationMember) => void;
  onReadReceipt?: (payload: {
    userId: string;
    lastReadMessageId: string;
    readAt: string;
  }) => void;
}) {
  const channel: RealtimeChannel = supabase
    .channel(`chat:members:${params.conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "chat_conversation_members",
        filter: `conversation_id=eq.${params.conversationId}`,
      },
      (payload) => {
        const member = payload.new as ChatConversationMember;
        // Only notify when OTHER members update (e.g. read receipts)
        if (member.user_id !== params.currentUserId) {
          params.onMemberUpdate(member);
        }
      },
    )
    .on("broadcast", { event: "read_receipt" }, ({ payload }) => {
      const receipt = payload as {
        userId?: string;
        lastReadMessageId?: string;
        readAt?: string;
      };

      if (
        receipt.userId &&
        receipt.userId !== params.currentUserId &&
        receipt.lastReadMessageId
      ) {
        params.onReadReceipt?.({
          userId: receipt.userId,
          lastReadMessageId: receipt.lastReadMessageId,
          readAt: receipt.readAt ?? new Date().toISOString(),
        });
      }
    })
    .subscribe();

  return {
    sendReadReceipt(userId: string, lastReadMessageId: string) {
      void channel.send({
        type: "broadcast",
        event: "read_receipt",
        payload: {
          userId,
          lastReadMessageId,
          readAt: new Date().toISOString(),
        },
      });
    },
    cleanup() {
      void supabase.removeChannel(channel);
    },
  };
}

function profilePresenceFilter(userIds: string[]) {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return null;
  if (unique.length === 1) return `id=eq.${unique[0]}`;
  return `id=in.(${unique.join(",")})`;
}

export function subscribeToUserPresence(params: {
  userIds: string[];
  onPresenceChange: (userId: string, isOnline: boolean, lastSeenAt: string | null) => void;
}) {
  const filter = profilePresenceFilter(params.userIds);
  if (!filter) {
    return () => undefined;
  }

  const channel: RealtimeChannel = supabase
    .channel(`chat-presence:${params.userIds.join("-")}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter,
      },
      (payload) => {
        const lastSeenAt = payload.new.last_seen_at as string | null;
        const isOnline = isRecentlyOnline(lastSeenAt);
        params.onPresenceChange(payload.new.id as string, isOnline, lastSeenAt);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
