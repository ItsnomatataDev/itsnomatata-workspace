export type ChatConversationType =
  | "direct"
  | "group"
  | "department"
  | "announcement";

export type ChatConversationMemberProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
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

export type ChatConversation = {
  id: string;
  organization_id: string;
  title: string | null;
  type: ChatConversationType;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  members?: ChatConversationMember[];
  display_name?: string;
  unread_count?: number;
};

export type ChatMessageType = "text" | "image" | "file" | "system";

export type ChatMessageSender = {
  id: string;
  full_name: string | null;
  email: string | null;
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
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  sender?: ChatMessageSender | null;
};

export type ChatUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  last_seen_at?: string | null;
};