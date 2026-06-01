import { MessageSquare, Plus, Trash2, Users } from "lucide-react";
import type { ChatConversation } from "../types/chat";
import { formatMessagePreview } from "../utils/parseMessageContent";

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

  if (conversation.last_message.body === "This message was deleted.") {
    return `${prefix}This message was deleted.`;
  }

  return `${prefix}${formatMessagePreview(conversation.last_message.body)}`;
}

function getInitials(value?: string | null) {
  const clean = value?.trim();
  if (!clean) return "?";

  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return clean.slice(0, 2).toUpperCase();
}

function getConversationDisplayName(
  conversation: ChatConversation,
  currentUserId?: string | null,
) {
  if (conversation.display_name?.trim()) {
    return conversation.display_name.trim();
  }

  if (conversation.type === "direct") {
    const otherMember = conversation.members?.find(
      (member) => member.user_id !== currentUserId,
    );

    return (
      otherMember?.profile?.full_name?.trim() ||
      otherMember?.profile?.email?.trim() ||
      "Unknown user"
    );
  }

  const explicitName = conversation.name?.trim() || conversation.title?.trim();
  if (explicitName && !explicitName.startsWith("direct:")) return explicitName;

  const participantNames = (conversation.members ?? [])
    .filter((member) => member.user_id !== currentUserId)
    .map(
      (member) =>
        member.profile?.full_name?.trim() ||
        member.profile?.email?.trim() ||
        null,
    )
    .filter((value): value is string => Boolean(value));

  return participantNames.length > 0
    ? participantNames.join(", ")
    : "Group conversation";
}

function isOnline(lastSeenAt?: string | null) {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() <= 2 * 60 * 1000;
}

export default function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewChat,
  loading,
  currentUserId,
  className = "",
}: {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onDeleteConversation: (conversation: ChatConversation) => void;
  onNewChat: () => void;
  loading: boolean;
  currentUserId?: string | null;
  className?: string;
}) {
  return (
    <aside
      className={[
        "flex w-full flex-col border-r border-white/10 bg-black/40 md:max-w-sm",
        className,
      ].join(" ")}
    >
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
              const otherMember =
                conversation.type === "direct"
                  ? conversation.members?.find(
                      (member) => member.user_id !== currentUserId,
                    )
                  : null;

              const online = isOnline(otherMember?.profile?.last_seen_at);
              const displayName = getConversationDisplayName(
                conversation,
                currentUserId,
              );
              const latestTime =
                conversation.last_message?.created_at ??
                conversation.last_message_at ??
                conversation.updated_at ??
                conversation.created_at;

              return (
                <div
                  key={conversation.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectConversation(conversation.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectConversation(conversation.id);
                    }
                  }}
                  className={[
                    "group w-full cursor-pointer rounded-2xl border px-4 py-3 text-left transition",
                    isActive
                      ? "border-orange-500/70 bg-orange-500/15 shadow-lg shadow-orange-500/5"
                      : "border-white/10 bg-white/3 hover:border-white/15 hover:bg-white/6",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={[
                        "relative mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-bold",
                        isActive
                          ? "border-orange-500/35 bg-orange-500/20 text-orange-200"
                          : "border-white/10 bg-white/8 text-white/80",
                      ].join(" ")}
                    >
                      {conversation.type === "direct" ? (
                        getInitials(displayName)
                      ) : (
                        <Users size={18} className="text-orange-300" />
                      )}
                      {conversation.type === "direct" ? (
                        <span
                          className={[
                            "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-neutral-950",
                            online ? "bg-green-400" : "bg-white/20",
                          ].join(" ")}
                        />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {displayName}
                          </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {latestTime ? (
                            <span className="text-[11px] text-white/35">
                              {formatConversationTime(latestTime)}
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

                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(event) => {
                              event.stopPropagation();
                              onDeleteConversation(conversation);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                event.stopPropagation();
                                onDeleteConversation(conversation);
                              }
                            }}
                            className="rounded-lg p-1 text-white/25 opacity-100 transition hover:bg-red-500/10 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100"
                            title="Delete chat"
                            aria-label={`Delete ${displayName}`}
                          >
                            <Trash2 size={13} />
                          </span>
                        </div>
                      </div>

                      <p className="mt-1 truncate text-xs text-white/45">
                        {getMessagePreview(conversation, currentUserId)}
                      </p>

                      <div className="mt-2 flex items-center gap-2 text-[11px] uppercase tracking-wide text-white/30">
                        <MessageSquare size={11} className="text-orange-500/70" />
                        <span>{conversation.type.replace("_", " ")}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
