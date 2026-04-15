import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquareX } from "lucide-react";
import { useAuth } from "../../../lib/hooks/useAuth";
import ChatSidebar from "../components/ChatSidebar";
import MessageInput from "../components/MessageInput";
import MessageList from "../components/MessageList";
import NewChatModal from "../components/NewChatModal";
import {
  createGroupConversation,
  findOrCreateDirectConversation,
  getConversations,
  getMessages,
  markConversationAsRead,
  sendMessage,
  uploadChatAttachment,
} from "../services/chatService";
import { subscribeToConversationMessages } from "../services/chatRealtime";
import { createTypingChannel } from "../services/chatTyping";
import type { ChatConversation, ChatMessage, ChatUser } from "../types/chat";

export default function ChatPage() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingChat, setCreatingChat] = useState(false);

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});

  const unsubscribeRef = useRef<null | (() => void)>(null);
  const typingChannelRef = useRef<ReturnType<
    typeof createTypingChannel
  > | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? null,
    [conversations, activeConversationId],
  );

  const activeOtherMember = useMemo(() => {
    if (!activeConversation || activeConversation.type !== "direct") {
      return null;
    }

    return (
      activeConversation.members?.find(
        (member) => member.user_id !== user?.id,
      ) ?? null
    );
  }, [activeConversation, user?.id]);

  const groupMembers = useMemo(() => {
    if (!activeConversation || activeConversation.type === "direct") return [];

    return (activeConversation.members ?? []).filter(
      (member) => member.user_id !== user?.id,
    );
  }, [activeConversation, user?.id]);

  const onlineGroupMembers = useMemo(() => {
    return groupMembers.filter((member) => {
      if (!member.profile?.last_seen_at) return false;
      return (
        Date.now() - new Date(member.profile.last_seen_at).getTime() <=
        2 * 60 * 1000
      );
    });
  }, [groupMembers]);

  const typingUserIds = useMemo(() => {
    return Object.entries(typingUsers)
      .filter(([userId, isTyping]) => userId !== user?.id && isTyping)
      .map(([userId]) => userId);
  }, [typingUsers, user?.id]);

  const typingNames = useMemo(() => {
    if (!activeConversation) return [];

    const members = activeConversation.members ?? [];

    return typingUserIds
      .map((userId) => {
        const member = members.find((item) => item.user_id === userId);
        return (
          member?.profile?.full_name || member?.profile?.email || "Someone"
        );
      })
      .filter(Boolean);
  }, [typingUserIds, activeConversation]);

  const typingLabel = useMemo(() => {
    if (typingNames.length === 0) return "";

    if (activeConversation?.type === "direct") {
      return "Typing...";
    }

    if (typingNames.length === 1) {
      return `${typingNames[0]} is typing...`;
    }

    if (typingNames.length === 2) {
      return `${typingNames[0]} and ${typingNames[1]} are typing...`;
    }

    return `${typingNames[0]}, ${typingNames[1]} and others are typing...`;
  }, [typingNames, activeConversation?.type]);

  useEffect(() => {
    void loadConversations();
  }, [user?.id]);

  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      return;
    }

    void loadMessagesForConversation(activeConversationId);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    unsubscribeRef.current = subscribeToConversationMessages({
      conversationId: activeConversationId,
      onMessage: (incomingMessage) => {
        setMessages((current) => {
          const exists = current.some(
            (message) => message.id === incomingMessage.id,
          );
          if (exists) return current;
          return [...current, incomingMessage];
        });

        setConversations((current) =>
          current
            .map((conversation) =>
              conversation.id === activeConversationId
                ? {
                    ...conversation,
                    last_message_at: incomingMessage.created_at,
                    updated_at: incomingMessage.created_at,
                    last_message: {
                      id: incomingMessage.id,
                      sender_id: incomingMessage.sender_id,
                      body:
                        incomingMessage.message_type === "image"
                          ? "📷 Image"
                          : incomingMessage.message_type === "audio"
                            ? "🎤 Voice note"
                            : incomingMessage.message_type === "file"
                              ? "📎 File"
                              : incomingMessage.body || "Sent a message",
                      created_at: incomingMessage.created_at,
                    },
                    unread_count: 0,
                  }
                : {
                    ...conversation,
                    unread_count:
                      incomingMessage.conversation_id === conversation.id &&
                      incomingMessage.sender_id !== user?.id
                        ? (conversation.unread_count ?? 0) + 1
                        : conversation.unread_count,
                  },
            )
            .sort((a, b) => {
              const aTime = a.last_message_at ?? a.created_at;
              const bTime = b.last_message_at ?? b.created_at;
              return new Date(bTime).getTime() - new Date(aTime).getTime();
            }),
        );
      },
    });

    if (typingChannelRef.current) {
      typingChannelRef.current.cleanup();
      typingChannelRef.current = null;
    }

    typingChannelRef.current = createTypingChannel(
      activeConversationId,
      ({ userId, isTyping }) => {
        if (userId === user?.id) return;

        setTypingUsers((current) => ({
          ...current,
          [userId]: isTyping,
        }));
      },
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }

      if (typingChannelRef.current) {
        typingChannelRef.current.cleanup();
        typingChannelRef.current = null;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      setTypingUsers({});
    };
  }, [activeConversationId, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!user?.id || !activeConversationId || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.id) return;

    void markConversationAsRead({
      conversationId: activeConversationId,
      userId: user.id,
      lastReadMessageId: lastMessage.id,
    });

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              unread_count: 0,
              members: conversation.members?.map((member) =>
                member.user_id === user.id
                  ? { ...member, last_read_message_id: lastMessage.id }
                  : member,
              ),
            }
          : conversation,
      ),
    );
  }, [messages, activeConversationId, user?.id]);

  async function loadConversations() {
    try {
      setError("");
      setLoadingConversations(true);

      const data = await getConversations(user?.id);
      setConversations(data);

      // Intentionally do not auto-open the latest conversation.
      // Users should choose from the chat list themselves.
      setActiveConversationId((current) => {
        if (!current) return null;
        const exists = data.some((conversation) => conversation.id === current);
        return exists ? current : null;
      });
    } catch (err) {
      console.error(err);
      setError("Failed to load conversations.");
    } finally {
      setLoadingConversations(false);
    }
  }

  async function loadMessagesForConversation(conversationId: string) {
    try {
      setError("");
      setLoadingMessages(true);

      const data = await getMessages(conversationId);
      setMessages(data);
    } catch (err) {
      console.error(err);
      setError("Failed to load messages.");
    } finally {
      setLoadingMessages(false);
    }
  }

  function updateConversationAfterSend(sentMessage: ChatMessage) {
    setConversations((current) =>
      current
        .map((conversation) =>
          conversation.id === sentMessage.conversation_id
            ? {
                ...conversation,
                last_message_at: sentMessage.created_at,
                updated_at: sentMessage.created_at,
                last_message: {
                  id: sentMessage.id,
                  sender_id: sentMessage.sender_id,
                  body:
                    sentMessage.message_type === "image"
                      ? "📷 Image"
                      : sentMessage.message_type === "audio"
                        ? "🎤 Voice note"
                        : sentMessage.message_type === "file"
                          ? "📎 File"
                          : sentMessage.body || "Sent a message",
                  created_at: sentMessage.created_at,
                },
                unread_count: 0,
              }
            : conversation,
        )
        .sort((a, b) => {
          const aTime = a.last_message_at ?? a.created_at;
          const bTime = b.last_message_at ?? b.created_at;
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        }),
    );
  }

  function handleCloseChat() {
    setActiveConversationId(null);
    setMessages([]);
    setTypingUsers({});

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (typingChannelRef.current) {
      typingChannelRef.current.cleanup();
      typingChannelRef.current = null;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }

  async function handleSend() {
    if (!user?.id || !activeConversationId || !input.trim()) return;

    const messageText = input.trim();

    try {
      setSending(true);
      setError("");
      setInput("");

      const sentMessage = await sendMessage({
        conversationId: activeConversationId,
        userId: user.id,
        body: messageText,
        messageType: "text",
      });

      if (sentMessage) {
        setMessages((current) => {
          const exists = current.some(
            (message) => message.id === sentMessage.id,
          );
          if (exists) return current;
          return [...current, sentMessage];
        });

        updateConversationAfterSend(sentMessage);
      }

      typingChannelRef.current?.sendTyping(user.id, false);
    } catch (err: any) {
      console.error("SEND MESSAGE ERROR:", err);
      setInput(messageText);
      setError(err?.message || "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendImage(file: File) {
    if (!user?.id || !activeConversationId) return;

    try {
      setSending(true);
      setError("");

      const uploaded = await uploadChatAttachment({
        file,
        conversationId: activeConversationId,
        userId: user.id,
      });

      const sentMessage = await sendMessage({
        conversationId: activeConversationId,
        userId: user.id,
        messageType: "image",
        attachmentUrl: uploaded.publicUrl,
        attachmentName: uploaded.fileName,
      });

      if (sentMessage) {
        setMessages((current) => {
          const exists = current.some(
            (message) => message.id === sentMessage.id,
          );
          if (exists) return current;
          return [...current, sentMessage];
        });

        updateConversationAfterSend(sentMessage);
      }
    } catch (err: any) {
      console.error("SEND IMAGE ERROR:", err);
      setError(err?.message || "Failed to send image.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendAudio(file: File) {
    if (!user?.id || !activeConversationId) return;

    try {
      setSending(true);
      setError("");

      const uploaded = await uploadChatAttachment({
        file,
        conversationId: activeConversationId,
        userId: user.id,
      });

      const sentMessage = await sendMessage({
        conversationId: activeConversationId,
        userId: user.id,
        messageType: "audio",
        attachmentUrl: uploaded.publicUrl,
        attachmentName: uploaded.fileName,
      });

      if (sentMessage) {
        setMessages((current) => {
          const exists = current.some(
            (message) => message.id === sentMessage.id,
          );
          if (exists) return current;
          return [...current, sentMessage];
        });

        updateConversationAfterSend(sentMessage);
      }
    } catch (err: any) {
      console.error("SEND AUDIO ERROR:", err);
      setError(err?.message || "Failed to send audio.");
    } finally {
      setSending(false);
    }
  }

  async function handleStartDirectChat(selectedUser: ChatUser) {
    if (!user?.id || !profile?.organization_id) return;

    try {
      setCreatingChat(true);
      setError("");

      const conversation = await findOrCreateDirectConversation({
        currentUserId: user.id,
        otherUserId: selectedUser.id,
        organizationId: profile.organization_id,
      });

      setNewChatOpen(false);
      const refreshed = await getConversations(user.id);
      setConversations(refreshed);
      setActiveConversationId(conversation.id);
    } catch (err: any) {
      console.error("CREATE DIRECT CHAT ERROR:", err);
      setError(err?.message || "Failed to start direct chat.");
    } finally {
      setCreatingChat(false);
    }
  }

  async function handleCreateGroup(params: {
    title: string;
    users: ChatUser[];
  }) {
    if (!user?.id || !profile?.organization_id) return;

    try {
      setCreatingChat(true);
      setError("");

      const conversation = await createGroupConversation({
        currentUserId: user.id,
        organizationId: profile.organization_id,
        title: params.title,
        memberIds: params.users.map((item) => item.id),
      });

      setNewChatOpen(false);
      const refreshed = await getConversations(user.id);
      setConversations(refreshed);
      setActiveConversationId(conversation.id);
    } catch (err: any) {
      console.error("CREATE GROUP CHAT ERROR:", err);
      setError(err?.message || "Failed to create group chat.");
    } finally {
      setCreatingChat(false);
    }
  }

  function handleTyping() {
    if (!user?.id || !typingChannelRef.current) return;

    typingChannelRef.current.sendTyping(user.id, true);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (!user?.id || !typingChannelRef.current) return;
      typingChannelRef.current.sendTyping(user.id, false);
    }, 1200);
  }

  function getPresenceLabel(lastSeenAt?: string | null) {
    if (!lastSeenAt) return "Offline";

    const lastSeen = new Date(lastSeenAt).getTime();
    const now = Date.now();
    const diffMinutes = Math.floor((now - lastSeen) / 1000 / 60);

    if (diffMinutes <= 2) return "Active now";
    if (diffMinutes < 60) return `Last seen ${diffMinutes} min ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Last seen ${diffHours}h ago`;

    return `Last seen ${new Date(lastSeenAt).toLocaleString()}`;
  }

  const headerSubtitle = useMemo(() => {
    if (!activeConversation) {
      return "Choose a conversation from the left";
    }

    if (typingLabel) {
      return typingLabel;
    }

    if (activeConversation.type === "direct") {
      return getPresenceLabel(activeOtherMember?.profile?.last_seen_at);
    }

    const totalMembers = activeConversation.members?.length ?? 0;
    const onlineCount = onlineGroupMembers.length;

    if (onlineCount > 0) {
      return `${totalMembers} members • ${onlineCount} online`;
    }

    return `${totalMembers} members`;
  }, [activeConversation, typingLabel, activeOtherMember, onlineGroupMembers]);

  const avatarText = (activeConversation?.display_name || "C")
    .split(" ")
    .slice(0, 2)
    .map((item) => item[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      <div className="flex h-[calc(100vh-2rem)] overflow-hidden border border-white/10 bg-neutral-950">
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          onNewChat={() => setNewChatOpen(true)}
          loading={loadingConversations}
          currentUserId={user?.id}
        />

        <section className="flex min-w-0 flex-1 flex-col text-white">
          <div className="border-b border-white/10 px-5 py-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:border-orange-500/40 hover:text-orange-300"
              >
                <ArrowLeft size={16} />
                Back to Dashboard
              </button>

              {activeConversationId ? (
                <button
                  type="button"
                  onClick={handleCloseChat}
                  className="inline-flex items-center gap-2 border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition hover:border-red-500/40 hover:bg-red-500/15"
                >
                  <MessageSquareX size={16} />
                  Close Chat
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-orange-400">
                  {avatarText}
                </div>

                {activeConversation?.type === "direct" ? (
                  <span
                    className={[
                      "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-neutral-950",
                      activeOtherMember?.profile?.last_seen_at &&
                      Date.now() -
                        new Date(
                          activeOtherMember.profile.last_seen_at,
                        ).getTime() <=
                        2 * 60 * 1000
                        ? "bg-green-400"
                        : "bg-white/20",
                    ].join(" ")}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">
                  {activeConversation?.display_name || "Select a conversation"}
                </h2>

                <p className="mt-1 text-sm text-white/50">{headerSubtitle}</p>

                {activeConversation?.type !== "direct" &&
                activeConversation?.members?.length ? (
                  <p className="mt-1 truncate text-xs text-white/35">
                    {(activeConversation.members ?? [])
                      .map(
                        (member) =>
                          member.profile?.full_name ||
                          member.profile?.email ||
                          "Unknown",
                      )
                      .join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {error ? (
              <div className="mb-4 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            <MessageList
              messages={messages}
              currentUserId={user?.id}
              loading={loadingMessages}
              hasConversation={Boolean(activeConversationId)}
              conversation={activeConversation}
            />

            <div ref={bottomRef} />
          </div>

          <MessageInput
            value={input}
            onChange={setInput}
            onSend={() => void handleSend()}
            onTyping={handleTyping}
            onImageSelect={(file) => void handleSendImage(file)}
            onAudioReady={(file) => void handleSendAudio(file)}
            disabled={!activeConversationId || creatingChat}
            sending={sending}
          />
        </section>
      </div>

      <NewChatModal
        open={newChatOpen}
        organizationId={profile?.organization_id}
        currentUserId={user?.id}
        onClose={() => setNewChatOpen(false)}
        onSelectUser={handleStartDirectChat}
        onCreateGroup={handleCreateGroup}
      />
    </>
  );
}
