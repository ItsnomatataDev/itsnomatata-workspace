export type ChatConversationType =
  | "direct"
  | "group"
  | "department"
  | "announcement";

export type ChatConversationMemberProfile = {
  id: string;
  username?: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  last_seen_at?: string | null;
};

export type ChatConversationMember = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  is_muted: boolean;
  last_read_message_id?: string | null;
  profile?: ChatConversationMemberProfile | null;
};

export type ChatConversationLastMessage = {
  id: string;
  sender_id: string;
  body: string | null;
  message_type?: ChatMessageType;
  metadata?: ChatMessageMetadata | null;
  created_at: string;
};

export type ChatConversation = {
  id: string;
  organization_id: string;
  name?: string | null;
  title: string | null;
  type: ChatConversationType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  members?: ChatConversationMember[];
  display_name?: string;
  unread_count?: number;
  last_message?: ChatConversationLastMessage | null;
};

export type ChatMessageType = "text" | "image" | "audio" | "file" | "system";

export type ChatMessageMetadata = {
  type?: "text" | "gif" | "meme";
  message_type?: "text" | "gif" | "meme";
  media_url?: string | null;
  media_provider?: string | null;
  caption?: string | null;
  gif?: {
    provider: "giphy" | "tenor" | "url";
    url: string;
    preview_url?: string | null;
    title?: string | null;
  } | null;
  [key: string]: unknown;
};

export type ChatMessageReaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
  profile?: {
    id: string;
    username?: string | null;
    full_name: string | null;
    email: string | null;
    avatar_url?: string | null;
  } | null;
};

export type ChatMessageSender = {
  id: string;
  username?: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  last_seen_at?: string | null;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string | null;
  message_type: ChatMessageType;
  reply_to_message_id: string | null;
  attachment_url: string | null;
  attachment_name: string | null;
  metadata?: ChatMessageMetadata | null;
  reactions?: ChatMessageReaction[];
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  sender_profile?: ChatMessageSender | null;
  local_status?: "sending" | "sent" | "failed";
  local_error?: string | null;
  client_id?: string;
};

export type ChatUser = {
  id: string;
  username?: string | null;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  primary_role: string | null;
  last_seen_at?: string | null;
};

export type SendChatMessageInput = {
  conversationId: string;
  userId: string;
  body?: string;
  messageType?: ChatMessageType;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  metadata?: ChatMessageMetadata | null;
};
