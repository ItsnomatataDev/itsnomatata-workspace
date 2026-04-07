import { MessageSquare, Plus } from "lucide-react";
import type { ChatConversation } from "../types/chat";

export default function ChatSidebar({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  loading,
}: {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewChat: () => void;
  loading: boolean;
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
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                      <MessageSquare size={18} className="text-orange-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-white">
                          {conversation.display_name ||
                            conversation.title ||
                            "Direct conversation"}
                        </p>

                        {typeof conversation.unread_count === "number" &&
                        conversation.unread_count > 0 ? (
                          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[11px] font-semibold text-black">
                            {conversation.unread_count > 99
                              ? "99+"
                              : conversation.unread_count}
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-xs uppercase tracking-wide text-white/40">
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
