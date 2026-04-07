import { supabase } from "../../../lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { ChatMessage } from "../types/chat";

export function subscribeToConversationMessages(params: {
  conversationId: string;
  onMessage: (message: ChatMessage) => void;
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
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}