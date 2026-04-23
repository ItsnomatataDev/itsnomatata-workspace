import { supabase } from "../../../lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChatMessage } from "../types/chat";

export function subscribeToConversationMessages(params: {
  conversationId: string;
  onMessage: (message: ChatMessage) => void;
  onUpdate?: (message: ChatMessage) => void;
  onDelete?: (messageId: string) => void;
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
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeToUserPresence(params: {
  userIds: string[];
  onPresenceChange: (userId: string, isOnline: boolean) => void;
}) {
  const channel: RealtimeChannel = supabase
    .channel("user-presence")
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=in.(${params.userIds.join(",")})`,
      },
      (payload) => {
        const lastSeenAt = payload.new.last_seen_at as string | null;
        const isOnline = lastSeenAt
          ? Date.now() - new Date(lastSeenAt).getTime() <= 2 * 60 * 1000
          : false;
        params.onPresenceChange(payload.new.id as string, isOnline);
      },
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}