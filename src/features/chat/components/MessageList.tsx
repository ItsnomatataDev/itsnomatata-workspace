import { Check, CheckCheck, Trash2 } from "lucide-react";
import type { ChatConversation } from "../types/chat";
import type { ChatMessage } from "../types/chat";
import { deleteMessage } from "../services/chatService";

function isRecentlyOnline(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  return diff <= 2 * 60 * 1000;
}

function getSeenStatus(params: {
  message: ChatMessage;
  currentUserId?: string;
  conversation: ChatConversation | null;
  messages: ChatMessage[];
}) {
  const { message, currentUserId, conversation, messages } = params;

  if (!currentUserId) return "sent";
  if (message.sender_id !== currentUserId) return null;
  if (!conversation || conversation.type !== "direct") return null;

  const otherMember = conversation.members?.find(
    (member) => member.user_id !== currentUserId,
  );

  const lastReadMessageId = otherMember?.last_read_message_id;
  if (!lastReadMessageId) return "sent";

  const messageIndex = messages.findIndex((item) => item.id === message.id);
  const lastReadIndex = messages.findIndex(
    (item) => item.id === lastReadMessageId,
  );

  if (messageIndex === -1 || lastReadIndex === -1) return "sent";

  return lastReadIndex >= messageIndex ? "seen" : "sent";
}

export default function MessageList({
  messages,
  currentUserId,
  loading,
  hasConversation,
  conversation,
  onMessageDeleted,
}: {
  messages: ChatMessage[];
  currentUserId: string | undefined;
  loading: boolean;
  hasConversation: boolean;
  conversation: ChatConversation | null;
  onMessageDeleted?: (messageId: string) => void;
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
    <div className="space-y-4">
      {messages.map((message) => {
        const isMine = message.sender_id === currentUserId;
        const senderName =
          message.sender?.full_name || message.sender?.email || "Unknown user";
        const online = isRecentlyOnline(message.sender?.last_seen_at);
        const seenStatus = getSeenStatus({
          message,
          currentUserId,
          conversation,
          messages,
        });

        const handleDelete = async () => {
          if (!currentUserId || !isMine) return;
          try {
            await deleteMessage({ messageId: message.id, userId: currentUserId });
            onMessageDeleted?.(message.id);
          } catch (err) {
            console.error("Failed to delete message:", err);
          }
        };

        return (
          <div
            key={message.id}
            className={`flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={[
                "max-w-[82%] rounded-2xl px-4 py-3 text-sm shadow-sm",
                isMine
                  ? "bg-orange-500 text-black"
                  : "border border-white/10 bg-white/10 text-white",
              ].join(" ")}
            >
              {!isMine ? (
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs font-semibold text-orange-400">
                    {senderName}
                  </span>
                  <span
                    className={[
                      "inline-block h-2.5 w-2.5 rounded-full",
                      online ? "bg-green-400" : "bg-white/20",
                    ].join(" ")}
                  />
                </div>
              ) : null}

              {message.is_deleted ? (
                <p className="italic opacity-70">This message was deleted.</p>
              ) : message.message_type === "image" && message.attachment_url ? (
                <div className="space-y-2">
                  <img
                    src={message.attachment_url}
                    alt={message.attachment_name || "Shared image"}
                    className="max-h-80 w-full rounded-xl object-cover"
                  />
                  {message.body ? (
                    <p className="whitespace-pre-wrap wrap-break-word">
                      {message.body}
                    </p>
                  ) : null}
                </div>
              ) : message.message_type === "audio" && message.attachment_url ? (
                <div className="space-y-2">
                  <audio
                    controls
                    src={message.attachment_url}
                    className="w-full"
                  />
                  {message.body ? (
                    <p className="whitespace-pre-wrap wrap-break-word">
                      {message.body}
                    </p>
                  ) : null}
                </div>
              ) : message.message_type === "file" && message.attachment_url ? (
                <div className="space-y-2">
                  <a
                    href={message.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm underline"
                  >
                    {message.attachment_name || "Open attachment"}
                  </a>
                  {message.body ? (
                    <p className="whitespace-pre-wrap wrap-break-word">
                      {message.body}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="whitespace-pre-wrap wrap-break-word">
                  {message.body}
                </p>
              )}

              <div className="mt-2 flex items-center justify-between gap-3">
                <p
                  className={[
                    "text-[11px]",
                    isMine ? "text-black/70" : "text-white/40",
                  ].join(" ")}
                >
                  {new Date(message.created_at).toLocaleString()}
                </p>

                <div className="flex items-center gap-2">
                  {isMine && !message.is_deleted ? (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="rounded p-1 text-black/50 hover:bg-black/10 hover:text-black"
                      title="Delete message"
                    >
                      <Trash2 size={12} />
                    </button>
                  ) : null}

                  {isMine && seenStatus ? (
                    <span
                      className={[
                        "inline-flex items-center",
                        seenStatus === "seen" ? "text-sky-700" : "text-black/70",
                      ].join(" ")}
                      title={seenStatus === "seen" ? "Seen" : "Sent"}
                    >
                      {seenStatus === "seen" ? (
                        <CheckCheck size={14} />
                      ) : (
                        <Check size={14} />
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
