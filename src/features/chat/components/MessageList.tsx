import type { ChatMessage } from "../types/chat";

export default function MessageList({
  messages,
  currentUserId,
  loading,
  hasConversation,
}: {
  messages: ChatMessage[];
  currentUserId: string | undefined;
  loading: boolean;
  hasConversation: boolean;
}) {
  if (!hasConversation) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/50">
        Select a conversation to start chatting.
      </div>
    );
  }

  if (loading) {
    return <div className="text-sm text-white/50">Loading messages...</div>;
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/50">
        No messages yet. Start the conversation.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((message) => {
        const isMine = message.sender_id === currentUserId;
        const senderName =
          message.sender?.full_name || message.sender?.email || "Unknown user";

        return (
          <div
            key={message.id}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={[
                "max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                isMine ? "bg-orange-500 text-black" : "bg-white/10 text-white",
              ].join(" ")}
            >
              {!isMine ? (
                <p className="mb-1 text-xs font-semibold text-orange-400">
                  {senderName}
                </p>
              ) : null}

              <p className="whitespace-pre-wrap wrap-break-word">
                {message.is_deleted
                  ? "This message was deleted."
                  : message.body}
              </p>

              <p
                className={[
                  "mt-2 text-[11px]",
                  isMine ? "text-black/70" : "text-white/40",
                ].join(" ")}
              >
                {new Date(message.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
