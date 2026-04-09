import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../lib/hooks/useAuth";
import ChatSidebar from "../components/ChatSidebar";
import MessageInput from "../components/MessageInput";
import MessageList from "../components/MessageList";
import NewChatModal from "../components/NewChatModal";
import {
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

  const activeConversation = useMemo(
    () =>
      conversations.find(
        (conversation) => conversation.id === activeConversationId,
      ) ?? null,
    [conversations, activeConversationId],
  );

  const otherTyping = Object.entries(typingUsers).some(
    ([userId, isTyping]) => userId !== user?.id && isTyping,
  );

  useEffect(() => {
    void loadConversations();
  }, [user?.id]);

  useEffect(() => {
    if (!activeConversationId) return;

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
                            : incomingMessage.body,
                      created_at: incomingMessage.created_at,
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
    };
  }, [activeConversationId, user?.id]);

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

      if (!activeConversationId && data.length > 0) {
        setActiveConversationId(data[0].id);
      }
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

  async function handleSend() {
    if (!user?.id || !activeConversationId || !input.trim()) return;

    try {
      setSending(true);
      setError("");

      await sendMessage({
        conversationId: activeConversationId,
        userId: user.id,
        body: input,
        messageType: "text",
      });

      setInput("");

      if (typingChannelRef.current) {
        typingChannelRef.current.sendTyping(user.id, false);
      }
    } catch (err: any) {
      console.error("SEND MESSAGE ERROR:", err);
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

      await sendMessage({
        conversationId: activeConversationId,
        userId: user.id,
        messageType: "image",
        attachmentUrl: uploaded.publicUrl,
        attachmentName: uploaded.fileName,
      });
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

      await sendMessage({
        conversationId: activeConversationId,
        userId: user.id,
        messageType: "audio",
        attachmentUrl: uploaded.publicUrl,
        attachmentName: uploaded.fileName,
      });
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
      await loadConversations();
      setActiveConversationId(conversation.id);
    } catch (err: any) {
      console.error("CREATE DIRECT CHAT ERROR:", err);
      setError(err?.message || "Failed to start direct chat.");
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

  const latestOtherSender = [...messages]
    .reverse()
    .find((message) => message.sender_id !== user?.id)?.sender;

  const isOtherOnline = latestOtherSender?.last_seen_at
    ? Date.now() - new Date(latestOtherSender.last_seen_at).getTime() <=
      2 * 60 * 1000
    : false;

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
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-orange-400">
                  {(activeConversation?.display_name || "C")
                    .split(" ")
                    .slice(0, 2)
                    .map((item) => item[0]?.toUpperCase() ?? "")
                    .join("")}
                </div>

                {activeConversation?.type === "direct" ? (
                  <span
                    className={[
                      "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-neutral-950",
                      isOtherOnline ? "bg-green-400" : "bg-white/20",
                    ].join(" ")}
                  />
                ) : null}
              </div>

              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold">
                  {activeConversation?.display_name || "Select a conversation"}
                </h2>

                <p className="mt-1 text-sm text-white/50">
                  {otherTyping
                    ? "Typing..."
                    : activeConversation?.type === "direct"
                      ? getPresenceLabel(latestOtherSender?.last_seen_at)
                      : activeConversation
                        ? `Conversation type: ${activeConversation.type}`
                        : "Choose a conversation from the left"}
                </p>
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
      />
    </>
  );
}
