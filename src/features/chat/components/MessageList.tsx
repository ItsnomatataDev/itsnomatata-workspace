import { Check, CheckCheck, RotateCcw, Trash2 } from "lucide-react";
import type { ChatConversation } from "../types/chat";
import type { ChatMessage } from "../types/chat";
import { deleteMessage } from "../services/chatService";
import MessageReactions from "./MessageReactions";

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

function isSameDay(a: string, b?: string) {
  if (!b) return false;
  return new Date(a).toDateString() === new Date(b).toDateString();
}

function formatDateSeparator(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString([], {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getMediaMetadata(message: ChatMessage) {
  const metadata = message.metadata ?? {};
  const type = metadata.message_type ?? metadata.type;
  if (type !== "gif" && type !== "meme") return null;

  const gifUrl = metadata.gif && typeof metadata.gif === "object"
    ? metadata.gif.url
    : null;
  const mediaUrl = typeof metadata.media_url === "string"
    ? metadata.media_url
    : typeof gifUrl === "string"
      ? gifUrl
      : null;
  if (!mediaUrl) return null;

  return {
    type,
    mediaUrl,
    provider: typeof metadata.media_provider === "string"
      ? metadata.media_provider
      : metadata.gif?.provider ?? null,
    caption: typeof metadata.caption === "string" ? metadata.caption : null,
  };
}

export default function MessageList({
  messages,
  currentUserId,
  loading,
  hasConversation,
  conversation,
  onMessageDeleted,
  onRetryMessage,
  onToggleReaction,
  currentUserRole,
}: {
  messages: ChatMessage[];
  currentUserId: string | undefined;
  loading: boolean;
  hasConversation: boolean;
  conversation: ChatConversation | null;
  onMessageDeleted?: (messageId: string) => void;
  onRetryMessage?: (message: ChatMessage) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  currentUserRole?: string | null;
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
      {messages.map((message, index) => {
        const isMine = message.sender_id === currentUserId;
        const previousMessage = messages[index - 1];
        const showDateSeparator = !isSameDay(
          message.created_at,
          previousMessage?.created_at,
        );
        const senderName =
          message.sender_profile?.full_name ||
          message.sender_profile?.email ||
          "Unknown user";
        const online = isRecentlyOnline(message.sender_profile?.last_seen_at);
        const membership = conversation?.members?.find(
          (member) => member.user_id === currentUserId,
        );
        const canDelete =
          !message.is_deleted &&
          Boolean(currentUserId) &&
          (isMine ||
            currentUserRole === "admin" ||
            currentUserRole === "manager" ||
            membership?.role === "owner" ||
            membership?.role === "admin");
        const seenStatus = getSeenStatus({
          message,
          currentUserId,
          conversation,
          messages,
        });

        const handleDelete = async () => {
          if (!currentUserId || !canDelete) return;
          const confirmed = window.confirm(
            "Delete this message? It will be hidden from the conversation.",
          );
          if (!confirmed) return;

          try {
            await deleteMessage({ messageId: message.id, userId: currentUserId });
            onMessageDeleted?.(message.id);
          } catch (err) {
            console.error("Failed to delete message:", err);
            window.alert("Unable to delete this message. Your permissions may not allow it.");
          }
        };

        const media = getMediaMetadata(message);
        const failed = message.local_status === "failed";
        const sending = message.local_status === "sending";

        return (
          <div key={message.id} className="space-y-3">
            {showDateSeparator ? (
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="rounded-full border border-white/10 bg-black/50 px-3 py-1 text-[11px] font-medium text-white/40">
                  {formatDateSeparator(message.created_at)}
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            ) : null}

            <div className={`group flex ${isMine ? "justify-end" : "justify-start"}`}>
              <div
                className={[
                  "max-w-[92%] overflow-hidden rounded-2xl px-4 py-3 text-sm shadow-sm sm:max-w-[82%]",
                  isMine
                    ? "bg-orange-500 text-black"
                    : "border border-white/10 bg-white/10 text-white",
                  failed ? "ring-2 ring-red-500/40" : "",
                  sending ? "opacity-70" : "",
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
              ) : media ? (
                <div className="space-y-2">
                  <img
                    src={media.mediaUrl}
                    alt={media.type === "gif" ? "Shared GIF" : "Shared meme"}
                    className="max-h-86 w-full rounded-xl object-cover"
                    loading="lazy"
                  />
                  {media.caption || message.body ? (
                    <p className="whitespace-pre-wrap wrap-break-word">
                      {media.caption || message.body}
                    </p>
                  ) : null}
                </div>
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
                    className="inline-flex max-w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm underline"
                  >
                    <span className="truncate">
                      {message.attachment_name || "Open attachment"}
                    </span>
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
                  {sending
                    ? "Sending..."
                    : failed
                      ? message.local_error ?? "Failed to send"
                      : new Date(message.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                </p>

                <div className="flex items-center gap-2">
                  {failed && onRetryMessage ? (
                    <button
                      type="button"
                      onClick={() => onRetryMessage(message)}
                      className="rounded p-1 text-red-200 transition hover:bg-red-500/20"
                      title="Retry sending"
                    >
                      <RotateCcw size={12} />
                    </button>
                  ) : null}

                  {canDelete ? (
                    <button
                      type="button"
                      onClick={handleDelete}
                      className={[
                        "rounded p-1 transition",
                        isMine
                          ? "text-black/50 hover:bg-black/10 hover:text-black"
                          : "text-white/40 hover:bg-white/10 hover:text-white",
                      ].join(" ")}
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

              {!message.is_deleted ? (
                <MessageReactions
                  reactions={message.reactions ?? []}
                  currentUserId={currentUserId}
                  disabled={!currentUserId || sending}
                  onToggle={(emoji) => onToggleReaction?.(message.id, emoji)}
                />
              ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
