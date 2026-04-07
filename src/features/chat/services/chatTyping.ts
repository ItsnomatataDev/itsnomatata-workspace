import { supabase } from "../../../lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function createTypingChannel(
  conversationId: string,
  onTypingChange: (payload: { userId: string; isTyping: boolean }) => void,
) {
  const channel: RealtimeChannel = supabase.channel(
    `chat-typing:${conversationId}`,
  );

  channel.on("broadcast", { event: "typing" }, ({ payload }) => {
    onTypingChange(payload as { userId: string; isTyping: boolean });
  });

  channel.subscribe();

  return {
    channel,
    sendTyping(userId: string, isTyping: boolean) {
      void channel.send({
        type: "broadcast",
        event: "typing",
        payload: { userId, isTyping },
      });
    },
    cleanup() {
      void supabase.removeChannel(channel);
    },
  };
}