import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Info, Loader2, MessageSquareX, X } from "lucide-react";
import { useAuth } from "../../../lib/hooks/useAuth";
import { supabase } from "../../../lib/supabase/client";
import { markChatConversationNotificationsAsRead } from "../../../lib/supabase/mutations/notifications";
import { withProfileDisplayName } from "../../../lib/utils/profileDisplay";
import ChatSidebar from "../components/ChatSidebar";
import ChatInfoPanel from "../components/ChatInfoPanel";
import MessageInput from "../components/MessageInput";
import MessageList from "../components/MessageList";
import NewChatModal from "../components/NewChatModal";
import UserAvatar from "../../../components/common/UserAvatar";
import type { GifSelection } from "../components/GifPickerPanel";
import {
  createGroupConversation,
  deleteConversationForUser,
  editMessage,
  findOrCreateDirectConversation,
  getBlockedUserIds,
  getConversationMembers,
  getConversations,
  getMessages,
  markConversationAsRead,
  sendMessage,
  blockChatUser,
  unblockChatUser,
  toggleMessageReaction,
  updateConversationDisappearingMessages,
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

function formatDisappearingSetting(seconds: number | null) {
  if (!seconds) return "off";
  if (seconds === 3600) return "1 hour";
  if (seconds === 86400) return "24 hours";
  if (seconds === 604800) return "7 days";
  if (seconds === 2592000) return "30 days";
  return `${Math.round(seconds / 3600)} hours`;
}

type PreviewProfile = {
  full_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

function ProfilePictureModal({
  profile,
  onClose,
}: {
  profile: PreviewProfile;
  onClose: () => void;
}) {
  const displayName = profile.full_name || profile.email || "Profile picture";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Profile picture"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 text-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">{displayName}</h2>
            <p className="mt-1 text-sm text-white/45">{profile.email || "No email available"}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/70 transition hover:bg-white/10 hover:text-white"
            aria-label="Close profile picture"
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-80 items-center justify-center bg-black p-6">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="max-h-[70vh] w-full rounded-2xl object-contain"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-center">
              <UserAvatar person={profile} size="xl" className="h-24 w-24" />
              <p className="text-sm text-white/50">No profile picture.</p>
            </div>
          )}
        </div>
      </div>
    </div>
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
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [error, setError] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [infoPanelOpen, setInfoPanelOpen] = useState(false);
  const [previewProfile, setPreviewProfile] = useState<PreviewProfile | null>(null);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [savingChatSetting, setSavingChatSetting] = useState(false);
  const [blockingUser, setBlockingUser] = useState(false);

  const unsubscribeRef = useRef<null | (() => void)>(null);
  const membersChannelRef = useRef<null | ReturnType<typeof subscribeToConversationMembers>>(null);
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
    if (!user?.id) {
      setBlockedUserIds([]);
      return;
    }

    getBlockedUserIds(user.id)
      .then(setBlockedUserIds)
      .catch((err) => {
        console.error("LOAD BLOCKED USERS ERROR:", err);
      });
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
    if (!user?.id || !activeConversationId) return;
    void markActiveConversationRead(null);
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
      setEditingMessage(null);
      return;
    }

    setEditingMessage(null);
    void loadMessagesForConversation(activeConversationId);

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (membersChannelRef.current) {
      membersChannelRef.current.cleanup();
      membersChannelRef.current = null;
    }

    setRealtimeStatus("idle");

    if (user?.id) {
      membersChannelRef.current = subscribeToConversationMembers({
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
        onReadReceipt: (receipt) => {
          setConversations((current) =>
            current.map((conversation) => {
              if (conversation.id !== activeConversationId) return conversation;
              return {
                ...conversation,
                members: conversation.members?.map((member) =>
                  member.user_id === receipt.userId
                    ? {
                        ...member,
                        last_read_message_id: receipt.lastReadMessageId,
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
            .select("id, username, full_name, email, avatar_url, last_seen_at")
            .eq("id", incomingMessage.sender_id)
            .single();

          incomingMessage.sender_profile = senderProfile
            ? withProfileDisplayName(senderProfile)
            : null;
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
          void markActiveConversationRead(incomingMessage.id);
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
          .select("id, username, full_name, email, avatar_url")
          .eq("id", reaction.user_id)
          .maybeSingle();

        const hydratedReaction = {
          ...reaction,
          profile: profileData ? withProfileDisplayName(profileData) : null,
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

      if (membersChannelRef.current) {
        membersChannelRef.current.cleanup();
        membersChannelRef.current = null;
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
    if (!activeConversationId || activeConversation?.type !== "direct") return;

    const refreshMembers = async () => {
      try {
        const members = await getConversationMembers(activeConversationId);
        setConversations((current) =>
          current.map((conversation) =>
            conversation.id === activeConversationId
              ? { ...conversation, members }
              : conversation,
          ),
        );
      } catch (err) {
        console.error("REFRESH CHAT MEMBERS ERROR:", err);
      }
    };

    void refreshMembers();
    const intervalId = window.setInterval(refreshMembers, 4000);
    return () => window.clearInterval(intervalId);
  }, [activeConversationId, activeConversation?.type]);

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
      void markActiveConversationRead(lastMessage.id);
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

  async function markActiveConversationRead(lastReadMessageId?: string | null) {
    if (!user?.id || !activeConversationId) return;

    if (lastReadMessageId) {
      void markConversationAsRead({
        conversationId: activeConversationId,
        userId: user.id,
        lastReadMessageId,
      });
      membersChannelRef.current?.sendReadReceipt(user.id, lastReadMessageId);
    }

    void markChatConversationNotificationsAsRead({
      userId: user.id,
      conversationId: activeConversationId,
      organizationId: profile?.organization_id ?? null,
    }).catch((err) => {
      console.error("MARK CHAT NOTIFICATIONS READ ERROR:", err);
    });

    window.dispatchEvent(
      new CustomEvent("chat:conversation-read", {
        detail: {
          userId: user.id,
          conversationId: activeConversationId,
        },
      }),
    );

    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeConversationId
          ? {
              ...conversation,
              unread_count: 0,
              members: lastReadMessageId
                ? conversation.members?.map((member) =>
                    member.user_id === user.id
                      ? { ...member, last_read_message_id: lastReadMessageId }
                      : member,
                  )
                : conversation.members,
            }
          : conversation,
      ),
    );
  }

  function updateConversationAfterSend(sentMessage: ChatMessage) {
    mergeConversationMessage(sentMessage, { forceUnreadZero: true });
  }

  function handleCloseChat() {
    setActiveConversationId(null);
    setMessages([]);
    setTypingUsers({});
    setEditingMessage(null);
    setInput("");

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    if (membersChannelRef.current) {
      membersChannelRef.current.cleanup();
      membersChannelRef.current = null;
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

    if (editingMessage) {
      const saved = await handleEditMessage(editingMessage.id, messageText);
      if (saved) {
        setEditingMessage(null);
        setInput("");
      }
      return;
    }

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
        username: profile?.username ?? null,
        full_name: profile?.display_name ?? profile?.full_name ?? null,
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

  async function handleEditMessage(messageId: string, body: string) {
    if (!user?.id) return false;

    try {
      setError("");
      const updatedMessage = await editMessage({
        messageId,
        userId: user.id,
        body,
      });

      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? {
                ...message,
                ...updatedMessage,
                sender_profile: message.sender_profile,
                reactions: message.reactions,
              }
            : message,
        ),
      );
      return true;
    } catch (err: any) {
      console.error("EDIT MESSAGE ERROR:", err);
      setError(err?.message || "Failed to edit message.");
      return false;
    }
  }

  async function handleDisappearingChange(seconds: number | null) {
    if (!activeConversationId || !user?.id) return;

    const previousSeconds = activeConversation?.disappearing_seconds ?? null;
    if (previousSeconds === seconds) return;

    try {
      setSavingChatSetting(true);
      setError("");
      const updatedConversation = await updateConversationDisappearingMessages({
        conversationId: activeConversationId,
        seconds,
      });

      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeConversationId
            ? {
                ...conversation,
                disappearing_seconds: updatedConversation.disappearing_seconds ?? null,
                updated_at: updatedConversation.updated_at,
              }
            : conversation,
        ),
      );

      const actorName =
        profile?.display_name ||
        profile?.full_name ||
        profile?.email ||
        "Someone";
      const systemBody = seconds
        ? `${actorName} set disappearing messages to ${formatDisappearingSetting(seconds)}.`
        : `${actorName} turned off disappearing messages.`;

      const systemMessage = await sendMessage({
        conversationId: activeConversationId,
        userId: user.id,
        body: systemBody,
        messageType: "system",
        metadata: {
          event: "disappearing_messages_changed",
          previous_seconds: previousSeconds,
          disappearing_seconds: seconds,
          notify_members: true,
          notification_title: "Chat disappearing messages changed",
        },
      });

      if (systemMessage) {
        setMessages((current) => {
          const exists = current.some((message) => message.id === systemMessage.id);
          if (exists) return current;
          return [...current, systemMessage];
        });
        updateConversationAfterSend(systemMessage);
      }
    } catch (err: any) {
      console.error("DISAPPEARING MESSAGE SETTING ERROR:", err);
      setError(err?.message || "Failed to update disappearing messages.");
    } finally {
      setSavingChatSetting(false);
    }
  }

  async function handleToggleBlock() {
    if (!user?.id || !activeOtherMember?.user_id || !activeConversationId) return;

    const otherUserId = activeOtherMember.user_id;
    const blocked = blockedUserIds.includes(otherUserId);
    const confirmed = window.confirm(
      blocked
        ? "Unblock this person?"
        : "Block this person? They will not be able to message you in direct chats.",
    );

    if (!confirmed) return;

    try {
      setBlockingUser(true);
      setError("");

      if (blocked) {
        await unblockChatUser({
          blockerId: user.id,
          blockedId: otherUserId,
        });
        setBlockedUserIds((current) => current.filter((id) => id !== otherUserId));
      } else {
        await blockChatUser({
          blockerId: user.id,
          blockedId: otherUserId,
          conversationId: activeConversationId,
        });
        setBlockedUserIds((current) => Array.from(new Set([...current, otherUserId])));
      }
    } catch (err: any) {
      console.error("BLOCK USER ERROR:", err);
      setError(err?.message || "Failed to update block setting.");
    } finally {
      setBlockingUser(false);
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
          onPreviewProfile={setPreviewProfile}
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
          <div className="border-b border-white/10 bg-neutral-950/95 px-4 py-3 backdrop-blur-xl sm:px-5 sm:py-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              {hasActiveConversation ? (
                <button
                  type="button"
                  onClick={handleCloseChat}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10 md:hidden"
                >
                  <ArrowLeft size={16} />
                  Chats
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => navigate("/dashboard")}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-2 text-sm font-medium text-white transition hover:border-white/25 hover:bg-white/10 sm:px-4"
              >
                <ArrowLeft size={16} />
                <span className="hidden sm:inline">Back to Dashboard</span>
                <span className="sm:hidden">Dashboard</span>
              </button>

              <div className="ml-auto flex items-center gap-2">
                {activeConversationId ? (
                  <button
                    type="button"
                    onClick={() => setInfoPanelOpen(true)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/75 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                    aria-label="Open chat info"
                    title="Chat info"
                  >
                    <Info size={17} />
                  </button>
                ) : null}

                {activeConversationId ? (
                  <button
                    type="button"
                    onClick={handleCloseChat}
                    className="inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-200 transition hover:border-red-400/40 hover:bg-red-500/15"
                  >
                    <MessageSquareX size={16} />
                    <span>Close Chat</span>
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  if (activeConversation?.type === "direct" && activeOtherMember?.profile) {
                    setPreviewProfile(activeOtherMember.profile);
                  } else if (activeConversation) {
                    setInfoPanelOpen(true);
                  }
                }}
                className="relative rounded-full focus:outline-none focus:ring-2 focus:ring-white/35"
                aria-label="View chat profile"
              >
                {activeConversation?.type === "direct" ? (
                  <UserAvatar
                    person={activeOtherMember?.profile ?? { full_name: activeConversation?.display_name }}
                    size="lg"
                    className="h-11 w-11"
                  />
                ) : (
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-semibold text-white/70">
                    {avatarText}
                  </div>
                )}

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
              </button>

              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  onClick={() => activeConversationId && setInfoPanelOpen(true)}
                  className="block max-w-full text-left"
                >
                <h2 className="truncate text-base font-semibold transition hover:text-white/80">
                  {activeConversation?.display_name || "Select a conversation"}
                </h2>
                </button>

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
              onProfileClick={setPreviewProfile}
              onMessageEditStart={(message) => {
                setEditingMessage(message);
                setInput(message.body ?? "");
              }}
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
            editing={Boolean(editingMessage)}
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

      <ChatInfoPanel
        open={infoPanelOpen}
        conversation={activeConversation}
        currentUserId={user?.id}
        messages={messages}
        blocked={Boolean(
          activeOtherMember?.user_id &&
          blockedUserIds.includes(activeOtherMember.user_id),
        )}
        savingSetting={savingChatSetting}
        blocking={blockingUser}
        onClose={() => setInfoPanelOpen(false)}
        onPreviewProfile={setPreviewProfile}
        onDisappearingChange={(seconds) => void handleDisappearingChange(seconds)}
        onToggleBlock={() => void handleToggleBlock()}
      />

      {previewProfile ? (
        <ProfilePictureModal
          profile={previewProfile}
          onClose={() => setPreviewProfile(null)}
        />
      ) : null}
    </>
  );
}
