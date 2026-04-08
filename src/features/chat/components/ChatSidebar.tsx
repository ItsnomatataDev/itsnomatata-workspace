import { MessageSquare, Plus } from "lucide-react";
import type { ChatConversation } from "../types/chat";

function formatConversationTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const now = new Date();

  const sameDay = date.toDateString() === now.toDateString();

  if (sameDay) {
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
  });
}

function getMessagePreview(
  conversation: ChatConversation,
  currentUserId?: string | null,
) {
  if (!conversation.last_message) {
    return "No messages yet.";
  }

  const isMine = conversation.last_message.sender_id === currentUserId;
  const prefix = isMine ? "You: " : "";

  return `${prefix}${conversation.last_message.body || "Sent a message"}`;
}

export default function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  loading,
  currentUserId,
}: {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  loading: boolean;
  currentUserId?: string | null;
}) {
  return (
    <aside className="flex w-full max-w-sm flex-col border-r border-white/10 bg-black/40">
      <div className="border-b border-white/10 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Team Chat</h1>
            <p className="mt-1 text-sm text-white/50">
              Internal messaging for all workspace members
            </p>
          </div>

          <button
            type="button"
            onClick={onNewChat}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-black transition hover:bg-orange-400"
            aria-label="Start a new chat"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {loading ? (
          <div className="px-3 py-4 text-sm text-white/50">
            Loading conversations...
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-white/50">
            No conversations found.
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => {
              const isActive = conversation.id === activeConversationId;

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectConversation(conversation.id)}
                  className={[
                    "w-full rounded-xl border px-4 py-3 text-left transition",
                    isActive
                      ? "border-orange-500 bg-orange-500/10"
                      : "border-white/10 bg-white/3 hover:bg-white/6",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                      <MessageSquare size={18} className="text-orange-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {conversation.display_name ||
                            conversation.title ||
                            "Direct conversation"}
                        </p>

                        <div className="flex shrink-0 items-center gap-2">
                          {conversation.last_message?.created_at ? (
                            <span className="text-[11px] text-white/35">
                              {formatConversationTime(
                                conversation.last_message.created_at,
                              )}
                            </span>
                          ) : null}

                          {typeof conversation.unread_count === "number" &&
                          conversation.unread_count > 0 ? (
                            <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-semibold text-black">
                              {conversation.unread_count > 99
                                ? "99+"
                                : conversation.unread_count}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p className="mt-1 truncate text-xs text-white/45">
                        {getMessagePreview(conversation, currentUserId)}
                      </p>

                      <p className="mt-1 text-[11px] uppercase tracking-wide text-white/30">
                        {conversation.type}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
