import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, MessageSquareX } from "lucide-react";
import { useAuth } from "../../../lib/hooks/useAuth";
import { supabase } from "../../../lib/supabase/client";
import ChatSidebar from "../components/ChatSidebar";
import MessageInput from "../components/MessageInput";
import MessageList from "../components/MessageList";
import NewChatModal from "../components/NewChatModal";
import type { GifSelection } from "../components/GifPickerPanel";
import {
  createGroupConversation,
  deleteConversationForUser,
  findOrCreateDirectConversation,
  getConversations,
  getMessages,
  markConversationAsRead,
  sendMessage,
  toggleMessageReaction,
  uploadChatAttachment,
} from "../services/chatService";
import {
  subscribeToConversationMembers,
  subscribeToConversationMessages,
  subscribeToUserPresence,
  type ChatRealtimeStatus,
} from "../services/chatRealtime";
import { isRecentlyOnline, touchChatPresence } from "../utils/presence";
import { createTypingChannel } from "../services/chatTyping";
import type { ChatConversation, ChatMessage, ChatUser } from "../types/chat";
import { formatMessagePreview } from "../utils/parseMessageContent";
import { playSystemSound } from "../../../lib/sounds/systemSounds";

function getMessagePreview(message: Pick<
  ChatMessage,
  "body" | "message_type" | "attachment_name" | "is_deleted" | "metadata"
>) {
  if (message.is_deleted) return "This message was deleted.";
  if (
    message.metadata?.message_type === "gif" ||
    message.metadata?.type === "gif" ||
    message.metadata?.gif
  ) {
    return "GIF";
  }
  if (message.message_type === "image") return "Image";
  if (message.message_type === "audio") return "Voice note";
  if (message.message_type === "file") {
    return message.attachment_name
      ? `File: ${message.attachment_name}`
      : "File";
  }
  return formatMessagePreview(message.body);
}

function getConversationSortTime(conversation: ChatConversation) {
  return new Date(
    conversation.last_message?.created_at ??
      conversation.last_message_at ??
      conversation.updated_at ??
      conversation.created_at,
  ).getTime();
}

function sortConversations(conversations: ChatConversation[]) {
  return [...conversations].sort(
    (a, b) => getConversationSortTime(b) - getConversationSortTime(a),
  );
}

export default function ChatPage() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const membersUnsubscribeRef = useRef<null | (() => void)>(null);
  const presenceUnsubscribeRef = useRef<null | (() => void)>(null);
  const markReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const realtimeWasConnectedRef = useRef(false);
  const [realtimeStatus, setRealtimeStatus] = useState<ChatRealtimeStatus | "idle">("idle");
  const typingChannelRef = useRef<ReturnType<
    typeof createTypingChannel
  > | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const deepLinkedConversationId = useMemo(
    () => new URLSearchParams(location.search).get("conversationId"),
    [location.search],
  );

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
    if (!activeConversation) return [];

    const groupMembers = activeConversation.members ?? [];

    return groupMembers.filter((member) => {
      if (member.user_id === user?.id) return false;
      return isRecentlyOnline(member.profile?.last_seen_at);
    });
  }, [groupMembers, activeConversation, user?.id]);

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

  const mergeConversationMessage = useCallback(
    (message: ChatMessage, options?: { forceUnreadZero?: boolean }) => {
      let foundConversation = false;

      setConversations((current) => {
        const next = current.map((conversation) => {
          if (conversation.id !== message.conversation_id) {
            return conversation;
          }

          foundConversation = true;

          const isOpenConversation =
            conversation.id === activeConversationId ||
            options?.forceUnreadZero === true;
          const isFromCurrentUser = message.sender_id === user?.id;

          if (!isOpenConversation && !isFromCurrentUser) {
            void playSystemSound("message");
          }

          return {
            ...conversation,
            members: conversation.members,
            last_message_at: message.created_at,
            updated_at: message.created_at,
            last_message: {
              id: message.id,
              sender_id: message.sender_id,
              body: getMessagePreview(message),
              message_type: message.message_type,
              metadata: message.metadata ?? null,
              created_at: message.created_at,
            },
            unread_count:
              isOpenConversation || isFromCurrentUser
                ? 0
                : (conversation.unread_count ?? 0) + 1,
          };
        });

        return sortConversations(next);
      });

      if (!foundConversation) {
        void loadConversations();
      }
    },
    [activeConversationId, user?.id],
  );

  useEffect(() => {
    void loadConversations();
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`chat:sidebar:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          mergeConversationMessage(payload.new as ChatMessage);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chat_messages",
        },
        (payload) => {
          const updatedMessage = payload.new as ChatMessage;
          setConversations((current) =>
            sortConversations(
              current.map((conversation) => {
                if (conversation.last_message?.id !== updatedMessage.id) {
                  return conversation;
                }

                return {
                  ...conversation,
                  last_message: {
                    ...conversation.last_message,
                    body: getMessagePreview(updatedMessage),
                    message_type: updatedMessage.message_type,
                    created_at: updatedMessage.created_at,
                  },
                };
              }),
            ),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [mergeConversationMessage, user?.id]);

  useEffect(() => {
    if (!deepLinkedConversationId || conversations.length === 0) return;

    const exists = conversations.some(
      (conversation) => conversation.id === deepLinkedConversationId,
    );

    if (exists) {
      setActiveConversationId(deepLinkedConversationId);
    }
  }, [conversations, deepLinkedConversationId]);

  useEffect(() => {
    if (!user?.id || !activeConversationId) return;
    void touchChatPresence(user.id);
  }, [user?.id, activeConversationId]);

  useEffect(() => {
    const otherUserId = activeOtherMember?.user_id;
    if (!otherUserId) {
      if (presenceUnsubscribeRef.current) {
        presenceUnsubscribeRef.current();
        presenceUnsubscribeRef.current = null;
      }
      return;
    }

    presenceUnsubscribeRef.current = subscribeToUserPresence({
      userIds: [otherUserId],
      onPresenceChange: (userId, _isOnline, lastSeenAt) => {
        setConversations((current) =>
          current.map((conversation) => {
            if (conversation.id !== activeConversationId) return conversation;
            return {
              ...conversation,
              members: conversation.members?.map((member) =>
                member.user_id === userId
                  ? {
                      ...member,
                      profile: member.profile
                        ? { ...member.profile, last_seen_at: lastSeenAt }
                        : member.profile,
                    }
                  : member,
              ),
            };
          }),
        );
      },
    });

    return () => {
      if (presenceUnsubscribeRef.current) {
        presenceUnsubscribeRef.current();
        presenceUnsubscribeRef.current = null;
      }
    };
  }, [activeConversationId, activeOtherMember?.user_id]);

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

    if (membersUnsubscribeRef.current) {
      membersUnsubscribeRef.current();
      membersUnsubscribeRef.current = null;
    }

    setRealtimeStatus("idle");

    if (user?.id) {
      membersUnsubscribeRef.current = subscribeToConversationMembers({
        conversationId: activeConversationId,
        currentUserId: user.id,
        onMemberUpdate: (updatedMember) => {
          setConversations((current) =>
            current.map((conversation) => {
              if (conversation.id !== activeConversationId) return conversation;
              return {
                ...conversation,
                members: conversation.members?.map((member) =>
                  member.user_id === updatedMember.user_id
                    ? {
                        ...member,
                        ...updatedMember,
                        profile: member.profile,
                      }
                    : member,
                ),
              };
            }),
          );
        },
      });
    }

    unsubscribeRef.current = subscribeToConversationMessages({
      conversationId: activeConversationId,
      onStatusChange: (status) => {
        setRealtimeStatus(status);
        if (status === "SUBSCRIBED") {
          if (realtimeWasConnectedRef.current) {
            void loadMessagesForConversation(activeConversationId);
          }
          realtimeWasConnectedRef.current = true;
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          realtimeWasConnectedRef.current = false;
        }
      },
      onMessage: async (incomingMessage) => {
        // Fetch sender profile for the incoming message
        if (incomingMessage.sender_id) {
          const { data: senderProfile } = await supabase
            .from("profiles")
            .select("id, full_name, email, last_seen_at")
            .eq("id", incomingMessage.sender_id)
            .single();

          incomingMessage.sender_profile = senderProfile;
        }

        setMessages((current) => {
          const exists = current.some(
            (message) => message.id === incomingMessage.id,
          );
          if (exists) return current;
          return [...current, incomingMessage];
        });

        mergeConversationMessage(incomingMessage, { forceUnreadZero: true });

        if (user?.id && incomingMessage.sender_id !== user.id) {
          void markConversationAsRead({
            conversationId: activeConversationId,
            userId: user.id,
            lastReadMessageId: incomingMessage.id,
          });
        }
      },
      onUpdate: (updatedMessage) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === updatedMessage.id
              ? {
                  ...message,
                  ...updatedMessage,
                  sender_profile:
                    updatedMessage.sender_profile ?? message.sender_profile,
                }
              : message,
          ),
        );
      },
      onDelete: (deletedMessageId) => {
        setMessages((current) =>
          current.filter((message) => message.id !== deletedMessageId),
        );
      },
      onReactionInsert: async (reaction) => {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("id", reaction.user_id)
          .maybeSingle();

        const hydratedReaction = {
          ...reaction,
          profile: profileData ?? null,
        };

        setMessages((current) =>
          current.map((message) => {
            if (message.id !== reaction.message_id) return message;
            const exists = (message.reactions ?? []).some(
              (item) =>
                item.id === reaction.id ||
                (
                  item.user_id === reaction.user_id &&
                  item.emoji === reaction.emoji
                ),
            );
            if (exists) return message;
            return {
              ...message,
              reactions: [...(message.reactions ?? []), hydratedReaction],
            };
          }),
        );
      },
      onReactionDelete: (reaction) => {
        setMessages((current) =>
          current.map((message) =>
            message.id === reaction.message_id
              ? {
                  ...message,
                  reactions: (message.reactions ?? []).filter(
                    (item) => item.id !== reaction.id,
                  ),
                }
              : message,
          ),
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

      if (membersUnsubscribeRef.current) {
        membersUnsubscribeRef.current();
        membersUnsubscribeRef.current = null;
      }

      setRealtimeStatus("idle");
      realtimeWasConnectedRef.current = false;

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
  }, [activeConversationId, mergeConversationMessage, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!user?.id || !activeConversationId || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage?.id) return;

    if (markReadTimeoutRef.current) {
      clearTimeout(markReadTimeoutRef.current);
    }

    markReadTimeoutRef.current = setTimeout(() => {
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
    }, 250);

    return () => {
      if (markReadTimeoutRef.current) {
        clearTimeout(markReadTimeoutRef.current);
        markReadTimeoutRef.current = null;
      }
    };
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
    mergeConversationMessage(sentMessage, { forceUnreadZero: true });
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

  async function handleSendFile(file: File) {
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
        messageType: "file",
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
      console.error("SEND FILE ERROR:", err);
      setError(err?.message || "Failed to send file.");
    } finally {
      setSending(false);
    }
  }

  async function handleSendGif(selection: GifSelection) {
    if (!user?.id || !activeConversationId || !selection.mediaUrl.trim()) return;

    try {
      setSending(true);
      setError("");

      const caption = selection.caption?.trim() || "";
      const sentMessage = await sendMessage({
        conversationId: activeConversationId,
        userId: user.id,
        body: caption || undefined,
        messageType: "text",
        metadata: {
          message_type: "gif",
          type: "gif",
          caption: caption || null,
          media_url: selection.mediaUrl.trim(),
          media_provider: selection.provider,
          gif: {
            provider: selection.provider,
            url: selection.mediaUrl.trim(),
            preview_url: selection.previewUrl ?? selection.mediaUrl.trim(),
            title: selection.title ?? null,
          },
        },
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
      console.error("SEND GIF ERROR:", err);
      setError(err?.message || "Failed to send GIF.");
    } finally {
      setSending(false);
    }
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    if (!user?.id || !emoji.trim()) return;

    const optimisticReaction = {
      id: `local:${messageId}:${user.id}:${emoji}`,
      message_id: messageId,
      user_id: user.id,
      emoji,
      created_at: new Date().toISOString(),
      profile: {
        id: user.id,
        full_name: profile?.full_name ?? null,
        email: profile?.email ?? null,
      },
    };

    const currentMessage = messages.find((message) => message.id === messageId);
    const existingReaction = currentMessage?.reactions?.find(
      (reaction) => reaction.user_id === user.id && reaction.emoji === emoji,
    );

    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;
        return {
          ...message,
          reactions: existingReaction
            ? (message.reactions ?? []).filter(
                (reaction) =>
                  !(reaction.user_id === user.id && reaction.emoji === emoji),
              )
            : [...(message.reactions ?? []), optimisticReaction],
        };
      }),
    );

    try {
      const result = await toggleMessageReaction({
        messageId,
        userId: user.id,
        emoji,
      });

      if (!result.removed && result.reaction) {
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? {
                  ...message,
                  reactions: (message.reactions ?? []).map((reaction) =>
                    reaction.id === optimisticReaction.id
                      ? {
                          ...result.reaction!,
                          profile: optimisticReaction.profile,
                        }
                      : reaction,
                  ),
                }
              : message,
          ),
        );
      }
    } catch (err: any) {
      console.error("TOGGLE REACTION ERROR:", err);
      setError(
        err?.message?.toLowerCase?.().includes("row-level security")
          ? "Reaction was blocked by database permissions. Check message_reactions RLS policies."
          : err?.message || "Failed to update reaction.",
      );
      if (activeConversationId) {
        await loadMessagesForConversation(activeConversationId);
      }
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

  async function handleDeleteConversation(conversation: ChatConversation) {
    if (!user?.id) return;

    const label = conversation.display_name || conversation.title || "this chat";
    const confirmed = window.confirm(
      `Delete "${label}" from your chat list? You will leave this conversation and it will disappear from your sidebar.`,
    );

    if (!confirmed) return;

    try {
      setError("");

      await deleteConversationForUser({
        conversationId: conversation.id,
        userId: user.id,
      });

      setConversations((current) =>
        current.filter((item) => item.id !== conversation.id),
      );

      if (activeConversationId === conversation.id) {
        handleCloseChat();
      }
    } catch (err) {
      console.error("DELETE CONVERSATION ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete the chat.",
      );
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
  const hasActiveConversation = Boolean(activeConversationId);

  return (
    <>
      <div className="m-2 flex h-[calc(100dvh-1rem)] overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 sm:m-4 sm:h-[calc(100dvh-2rem)] sm:rounded-3xl">
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={setActiveConversationId}
          onDeleteConversation={handleDeleteConversation}
          onNewChat={() => setNewChatOpen(true)}
          loading={loadingConversations}
          currentUserId={user?.id}
          className={hasActiveConversation ? "hidden md:flex" : "flex"}
        />

        <section
          className={[
            "min-w-0 flex-1 flex-col text-white",
            hasActiveConversation ? "flex" : "hidden md:flex",
          ].join(" ")}
        >
          <div className="border-b border-white/10 px-4 py-3 sm:px-5 sm:py-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              {hasActiveConversation ? (
                <button
                  type="button"
                  onClick={handleCloseChat}
                  className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:border-orange-500/40 hover:text-orange-300 md:hidden"
                >
                  <ArrowLeft size={16} />
                  Chats
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:border-orange-500/40 hover:text-orange-300 sm:px-4"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
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
                      isRecentlyOnline(activeOtherMember?.profile?.last_seen_at)
                        ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]"
                        : "bg-white/20",
                    ].join(" ")}
                  />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="truncate text-base font-semibold">
                  {activeConversation?.display_name || "Select a conversation"}
                </h2>

                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-sm text-white/50">{headerSubtitle}</p>
                  {activeConversationId && realtimeStatus !== "idle" ? (
                    <span
                      className={[
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                        realtimeStatus === "SUBSCRIBED"
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-orange-500/15 text-orange-200",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "h-1.5 w-1.5 rounded-full",
                          realtimeStatus === "SUBSCRIBED" ? "bg-emerald-400" : "bg-orange-400 animate-pulse",
                        ].join(" ")}
                      />
                      {realtimeStatus === "SUBSCRIBED" ? "Live" : "Reconnecting"}
                    </span>
                  ) : null}
                </div>

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

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
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
              currentUserRole={profile?.primary_role ?? null}
              onMessageDeleted={(messageId) => {
                setMessages((current) =>
                  current.map((message) =>
                    message.id === messageId
                      ? { ...message, is_deleted: true }
                      : message,
                  ),
                );
              }}
              onToggleReaction={(messageId, emoji) =>
                void handleToggleReaction(messageId, emoji)
              }
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
            onFileSelect={(file) => void handleSendFile(file)}
            onGifSelect={(selection) => void handleSendGif(selection)}
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
