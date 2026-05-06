import { supabase } from "../../../lib/supabase/client";
import {
  sendBulkNotifications,
} from "../../notifications/services/notificationService";
import type {
  ChatConversation,
  ChatConversationMember,
  ChatConversationMemberProfile,
  ChatMessage,
  ChatMessageReaction,
  ChatMessageType,
  ChatUser,
  SendChatMessageInput,
} from "../types/chat";

const CHAT_BUCKET = "chat-attachments";

type BulkNotificationSummary = {
  ok?: boolean;
  total?: number;
  succeeded?: number;
  failed?: number;
  results?: Array<{
    userId?: string;
    ok?: boolean;
    error?: string;
  }>;
};

type ConversationMemberRow = Omit<ChatConversationMember, "profile">;

type ConversationRow = Omit<
  ChatConversation,
  "members" | "display_name" | "unread_count" | "last_message"
> & {
  members?: ConversationMemberRow[];
};

type LastMessageRow = {
  conversation_id: string;
  id: string;
  sender_id: string;
  body: string | null;
  message_type: ChatMessageType;
  attachment_name: string | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  is_deleted: boolean;
};

type UnreadMessageRow = {
  conversation_id: string;
  id: string;
  sender_id: string;
  created_at: string;
};

function getChatMessagePreview(params: {
  body?: string | null;
  messageType?: string | null;
  attachmentName?: string | null;
  metadata?: Record<string, unknown> | null;
  isDeleted?: boolean;
}) {
  if (params.isDeleted) return "This message was deleted.";

  const body = params.body?.trim() ?? "";
  const type = params.messageType ?? "text";
  const metadataType = typeof params.metadata?.type === "string"
    ? params.metadata.type
    : null;

  if (metadataType === "gif") {
    return params.metadata?.caption
      ? `GIF: ${String(params.metadata.caption)}`
      : "GIF";
  }

  if (metadataType === "meme") {
    return params.metadata?.caption
      ? `Meme: ${String(params.metadata.caption)}`
      : "Meme";
  }

  if (type === "image") {
    return params.attachmentName ? `Image: ${params.attachmentName}` : "Image";
  }

  if (type === "audio") return "Voice note";

  if (type === "file") {
    return params.attachmentName ? `File: ${params.attachmentName}` : "File";
  }

  if (type === "system") return body || "System message";

  return body || "New message";
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

function getConversationDisplayName(params: {
  conversation: ConversationRow;
  members: ChatConversationMember[];
  currentUserId?: string;
}) {
  if (params.conversation.type === "direct") {
    const otherMember = params.members.find(
      (member) => member.user_id !== params.currentUserId,
    );

    return (
      otherMember?.profile?.full_name?.trim() ||
      otherMember?.profile?.email?.trim() ||
      "Unknown user"
    );
  }

  const explicitName =
    params.conversation.name?.trim() || params.conversation.title?.trim();

  if (explicitName && !explicitName.startsWith("direct:")) return explicitName;

  const participantNames = params.members
    .filter((member) => member.user_id !== params.currentUserId)
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

async function dispatchChatNotificationsWithFallback(params: {
  organizationId: string;
  userIds: string[];
  type: "chat_message";
  title: string;
  message: string;
  entityType: "chat";
  entityId: string;
  actionUrl: string;
  priority: "medium";
  metadata: Record<string, unknown>;
  referenceId: string;
  referenceType: "chat_conversation";
  actorUserId: string;
  dedupeKey: string;
  channels?: ReadonlyArray<"in_app" | "push">;
  sendEmail?: false;
}) {
  async function createViaEdge() {
    const { data, error } = await supabase.functions.invoke(
      "create-notification",
      {
        body: {
          organizationId: params.organizationId,
          userIds: params.userIds,
          type: params.type,
          title: params.title,
          message: params.message,
          entityType: params.entityType,
          entityId: params.entityId,
          actionUrl: params.actionUrl,
          priority: params.priority,
          metadata: {
            ...params.metadata,
            category: "chat",
          },
          referenceId: params.referenceId,
          referenceType: params.referenceType,
          actorUserId: params.actorUserId,
          category: "chat",
          dedupeKey: params.dedupeKey,
          channels: params.channels ?? ["in_app", "push"],
          sendEmail: params.sendEmail ?? false,
        },
      },
    );

    if (error) throw error;
    return data;
  }

  try {
    const result = await sendBulkNotifications({
      ...params,
      channels: ["in_app", "push"],
      sendEmail: false as const,
    }) as BulkNotificationSummary;

    if (result.ok === false || (result.failed ?? 0) > 0) {
      const failureDetails = result.results
        ?.filter((item) => item.ok === false)
        .map((item) => `${item.userId ?? "unknown"}: ${item.error ?? "failed"}`)
        .join("; ");

      throw new Error(
        `Chat notification delivery failed for ${result.failed ?? "some"} recipient(s). ${failureDetails ?? ""}`.trim(),
      );
    }

    return result;
  } catch (primaryError) {
    logChatError(
      "CHAT notification primary send failed, trying edge fallback:",
      primaryError,
    );

    return createViaEdge();
  }
}

function buildMessagePreview(params: {
  body?: string | null;
  messageType?: string | null;
  attachmentName?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return getChatMessagePreview(params);
}

function logChatError(message: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.error(message, error);
  }
}

async function getConversationMeta(conversationId: string) {
  const { data, error } = await supabase
    .from("chat_conversations")
    .select("id, title, type, organization_id")
    .eq("id", conversationId)
    .single();

  if (error) throw error;

  return data as {
    id: string;
    title: string | null;
    type: "direct" | "group" | "department" | "announcement";
    organization_id: string;
  };
}

async function getConversationRecipientIds(
  conversationId: string,
  senderId: string,
) {
  const { data, error } = await supabase
    .from("chat_conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);

  if (error) throw error;

  return (data ?? [])
    .map((row) => row.user_id)
    .filter((userId): userId is string =>
      Boolean(userId && userId !== senderId)
    );
}

async function notifyConversationMembers(params: {
  conversationId: string;
  senderId: string;
  senderName: string;
  messageId: string;
  body?: string | null;
  messageType?: string | null;
  attachmentName?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    const [conversation, recipientIds] = await Promise.all([
      getConversationMeta(params.conversationId),
      getConversationRecipientIds(params.conversationId, params.senderId),
    ]);

    if (recipientIds.length === 0) {
      return;
    }

    const preview = buildMessagePreview({
      body: params.body,
      messageType: params.messageType,
      attachmentName: params.attachmentName,
      metadata: params.metadata,
    });

    const title = conversation.type === "direct"
      ? `${params.senderName} sent you a message`
      : `${params.senderName} in ${conversation.title || "Group chat"}`;

    const payload = {
      organizationId: conversation.organization_id,
      userIds: recipientIds,
      type: "chat_message" as const,
      title,
      message: preview,
      entityType: "chat" as const,
      entityId: conversation.id,
      actionUrl: `/chat?conversationId=${conversation.id}&messageId=${params.messageId}`,
      priority: "medium" as const,
      metadata: {
        conversationId: conversation.id,
        conversationType: conversation.type,
        conversationTitle: conversation.title,
        senderId: params.senderId,
        senderName: params.senderName,
        messageId: params.messageId,
        messageType: params.messageType ?? "text",
        messageMetadata: params.metadata ?? null,
      },
      referenceId: conversation.id,
      referenceType: "chat_conversation" as const,
      actorUserId: params.senderId,
      category: "chat",
      dedupeKey: `chat-message:${params.messageId}`,
      channels: ["in_app", "push"] as const,
      sendEmail: false as const,
    };

    await dispatchChatNotificationsWithFallback(payload);
  } catch (error) {
    logChatError("CHAT NOTIFICATION ERROR:", error);
  }
}
export async function getConversations(
  currentUserId?: string,
): Promise<ChatConversation[]> {
  if (!currentUserId) return [];

  const { data: currentMemberships, error: currentMembershipsError } =
    await supabase
      .from("chat_conversation_members")
      .select("conversation_id")
      .eq("user_id", currentUserId);

  if (currentMembershipsError) throw currentMembershipsError;

  const visibleConversationIds = [
    ...new Set(
      (currentMemberships ?? [])
        .map((membership) => membership.conversation_id)
        .filter(Boolean),
    ),
  ];

  if (visibleConversationIds.length === 0) return [];

  const { data, error } = await supabase
    .from("chat_conversations")
    .select(`
      *,
      members:chat_conversation_members (
        id,
        conversation_id,
        user_id,
        role,
        joined_at,
        is_muted,
        last_read_message_id
      )
    `)
    .in("id", visibleConversationIds)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  const conversations = (data ?? []) as ConversationRow[];

  // Collect all user IDs from conversation members
  const allUserIds = new Set<string>();
  conversations.forEach((conv) => {
    conv.members?.forEach((member) => {
      allUserIds.add(member.user_id);
    });
  });

  // Fetch all profiles in a single query
  // Note: This relies on profiles RLS policy allowing viewing org members
  const profileIds = Array.from(allUserIds);
  const profilesResult =
    profileIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email, last_seen_at")
          .in("id", profileIds)
      : { data: [], error: null };

  const profilesData = profilesResult.data as ChatConversationMemberProfile[];
  const profilesError = profilesResult.error;

  if (profilesError) logChatError("Failed to fetch profiles:", profilesError);

  // Create a map of user_id -> profile
  const profilesMap = new Map((profilesData ?? []).map((p) => [p.id, p]));

  // Fetch last messages for all conversations
  const conversationIds = conversations.map((conversation) => conversation.id);
  const lastMessagesResult =
    conversationIds.length > 0
      ? await supabase
          .from("chat_messages")
          .select(
            "conversation_id, id, sender_id, body, message_type, attachment_name, metadata, created_at, is_deleted",
          )
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: false })
      : { data: [], error: null };

  const lastMessagesData = lastMessagesResult.data as LastMessageRow[];
  const lastMessagesError = lastMessagesResult.error;

  if (lastMessagesError) {
    logChatError("Failed to fetch last messages:", lastMessagesError);
  }

  // Create a map of conversation_id -> last message
  const lastMessagesMap = new Map<string, LastMessageRow>();
  (lastMessagesData ?? []).forEach((msg) => {
    const existing = lastMessagesMap.get(msg.conversation_id);
    if (!existing || new Date(msg.created_at) > new Date(existing.created_at)) {
      lastMessagesMap.set(msg.conversation_id, msg);
    }
  });

  // Fetch all messages to calculate unread counts
  const allMessagesResult =
    conversationIds.length > 0
      ? await supabase
          .from("chat_messages")
          .select("conversation_id, id, sender_id, created_at")
          .in("conversation_id", conversationIds)
          .order("created_at", { ascending: true })
      : { data: [], error: null };

  const allMessagesData = allMessagesResult.data as UnreadMessageRow[];
  const allMessagesError = allMessagesResult.error;

  if (allMessagesError) {
    logChatError("Failed to fetch all messages for unread count:", allMessagesError);
  }

  // Create a map of conversation_id -> array of messages
  const messagesByConversation = new Map<string, UnreadMessageRow[]>();
  (allMessagesData ?? []).forEach((msg) => {
    if (!messagesByConversation.has(msg.conversation_id)) {
      messagesByConversation.set(msg.conversation_id, []);
    }
    messagesByConversation.get(msg.conversation_id)!.push(msg);
  });

  return sortConversations(conversations.map((conversation) => {
    // Attach profiles to members
    const membersWithProfiles = conversation.members?.map((member) => ({
      ...member,
      profile: profilesMap.get(member.user_id) || null,
    })) ?? [];

    const myMembership = membersWithProfiles?.find(
      (member) => member.user_id === currentUserId,
    );

    const displayName = getConversationDisplayName({
      conversation,
      members: membersWithProfiles,
      currentUserId,
    });

    // Get last message for this conversation
    const lastMessage = lastMessagesMap.get(conversation.id) || null;


    const messageBody = lastMessage
      ? getChatMessagePreview({
          body: lastMessage.body,
          messageType: lastMessage.message_type,
          attachmentName: lastMessage.attachment_name,
          metadata: lastMessage.metadata,
          isDeleted: lastMessage.is_deleted,
        })
      : null;

    // Calculate unread count
    let unreadCount = 0;
    const myLastReadId = myMembership?.last_read_message_id;
    const conversationMessages = messagesByConversation.get(conversation.id) || [];
    
    if (myLastReadId) {
      // Count messages after the last read message that were sent by others
      const lastReadIndex = conversationMessages.findIndex((m) => m.id === myLastReadId);
      if (lastReadIndex !== -1) {
        unreadCount = conversationMessages
          .slice(lastReadIndex + 1)
          .filter((m) => m.sender_id !== currentUserId).length;
      }
    } else {
      // No last read message, count all messages from others
      unreadCount = conversationMessages.filter((m) => m.sender_id !== currentUserId).length;
    }

    return {
      ...conversation,
      members: membersWithProfiles,
      display_name: displayName,
      unread_count: unreadCount,
      last_message: lastMessage ? {
        id: lastMessage.id,
        sender_id: lastMessage.sender_id,
        body: messageBody,
        message_type: lastMessage.message_type,
        metadata: lastMessage.metadata ?? null,
        created_at: lastMessage.created_at,
      } : null,
    };
  }));
}

export async function getMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const messages = (data ?? []) as ChatMessage[];

  // Collect all unique sender IDs from messages
  const senderIds = new Set<string>();
  messages.forEach((msg) => {
    if (msg.sender_id) senderIds.add(msg.sender_id);
  });

  // Fetch all sender profiles in a single query
  const profileIds = Array.from(senderIds);
  const profilesResult = profileIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", profileIds)
    : { data: [], error: null };

  const profilesData = profilesResult.data;
  const profilesError = profilesResult.error;

  if (profilesError) {
    logChatError("Failed to fetch sender profiles:", profilesError);
  }

  // Create a map of user_id -> profile
  const profilesMap = new Map(
    (profilesData ?? []).map((p) => [p.id, p]),
  );

  const reactions = await getMessageReactions(messages.map((message) => message.id));
  const reactionsByMessage = new Map<string, ChatMessageReaction[]>();
  for (const reaction of reactions) {
    const list = reactionsByMessage.get(reaction.message_id) ?? [];
    list.push(reaction);
    reactionsByMessage.set(reaction.message_id, list);
  }

  return messages.map((message) => ({
    ...message,
    sender_profile: profilesMap.get(message.sender_id) || null,
    reactions: reactionsByMessage.get(message.id) ?? [],
  }));
}

export async function getMessageReactions(
  messageIds: string[],
): Promise<ChatMessageReaction[]> {
  const uniqueIds = Array.from(new Set(messageIds.filter(Boolean)));
  if (uniqueIds.length === 0) return [];

  const { data, error } = await supabase
    .from("message_reactions")
    .select("*")
    .in("message_id", uniqueIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  const reactions = (data ?? []) as ChatMessageReaction[];
  const userIds = Array.from(new Set(reactions.map((item) => item.user_id)));
  const profilesResult = userIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [], error: null };

  if (profilesResult.error) {
    logChatError("Failed to fetch reaction profiles:", profilesResult.error);
  }

  const profileMap = new Map(
    (profilesResult.data ?? []).map((profile) => [profile.id, profile]),
  );

  return reactions.map((reaction) => ({
    ...reaction,
    profile: profileMap.get(reaction.user_id) ?? null,
  }));
}

export async function uploadChatAttachment(params: {
  file: File;
  conversationId: string;
  userId: string;
}) {
  const extension = params.file.name.split(".").pop() || "bin";
  const filePath =
    `${params.conversationId}/${params.userId}/${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(CHAT_BUCKET)
    .upload(filePath, params.file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from(CHAT_BUCKET).getPublicUrl(filePath);

  return {
    path: filePath,
    publicUrl: data.publicUrl,
    fileName: params.file.name,
  };
}

export async function sendMessage(
  params: SendChatMessageInput,
): Promise<ChatMessage | null> {
  const body = params.body?.trim() ?? "";
  const messageType = params.messageType ?? "text";

  if (!body && !params.attachmentUrl && messageType !== "system") {
    return null;
  }

  const insertPayload = {
    conversation_id: params.conversationId,
    sender_id: params.userId,
    body: body || null,
    message_type: messageType,
    attachment_url: params.attachmentUrl ?? null,
    attachment_name: params.attachmentName ?? null,
    metadata: params.metadata ?? {},
  };

  const { data, error } = await supabase
    .from("chat_messages")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error) throw error;

  const message = data as ChatMessage;

  if (messageType !== "system") {
    // Get sender name from profiles table
    const { data: senderProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", params.userId)
      .single();

    const senderName = senderProfile?.full_name?.trim() ||
      senderProfile?.email?.trim() ||
      "Someone";

    void notifyConversationMembers({
      conversationId: params.conversationId,
      senderId: params.userId,
      senderName,
      messageId: message.id,
      body,
      messageType,
      attachmentName: params.attachmentName ?? null,
      metadata: params.metadata ?? null,
    });
  }

  return message;
}

export async function toggleMessageReaction(params: {
  messageId: string;
  userId: string;
  emoji: string;
}): Promise<{ removed: boolean; reaction: ChatMessageReaction | null }> {
  const emoji = params.emoji.trim();
  if (!emoji) throw new Error("emoji is required");

  const { data: existing, error: existingError } = await supabase
    .from("message_reactions")
    .select("*")
    .eq("message_id", params.messageId)
    .eq("user_id", params.userId)
    .eq("emoji", emoji)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    const { error } = await supabase
      .from("message_reactions")
      .delete()
      .eq("id", existing.id);

    if (error) throw error;
    return { removed: true, reaction: null };
  }

  const { data, error } = await supabase
    .from("message_reactions")
    .insert({
      message_id: params.messageId,
      user_id: params.userId,
      emoji,
    })
    .select("*")
    .single();

  if (error) throw error;
  return { removed: false, reaction: data as ChatMessageReaction };
}

export async function markConversationAsRead(params: {
  conversationId: string;
  userId: string;
  lastReadMessageId: string;
}) {
  const { error } = await supabase
    .from("chat_conversation_members")
    .update({
      last_read_message_id: params.lastReadMessageId,
    })
    .eq("conversation_id", params.conversationId)
    .eq("user_id", params.userId);

  if (error) throw error;
}

export async function deleteMessage(params: {
  messageId: string;
  userId: string;
}) {
  const { error } = await supabase
    .from("chat_messages")
    .update({
      is_deleted: true,
      body: null,
      attachment_url: null,
      attachment_name: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.messageId);

  if (error) throw error;
}

export async function deleteConversationForUser(params: {
  conversationId: string;
  userId: string;
}) {
  const { error: membershipError } = await supabase
    .from("chat_conversation_members")
    .delete()
    .eq("conversation_id", params.conversationId)
    .eq("user_id", params.userId);

  if (membershipError) throw membershipError;
}

export async function getOrganizationUsers(
  organizationId: string,
  currentUserId: string,
): Promise<ChatUser[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, last_seen_at")
    .eq("organization_id", organizationId)
    .neq("id", currentUserId)
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatUser[];
}

export async function findOrCreateDirectConversation(params: {
  currentUserId: string;
  otherUserId: string;
  organizationId: string;
}): Promise<ChatConversation> {
  const { currentUserId, otherUserId, organizationId } = params;

  const { data: memberships, error: membershipError } = await supabase
    .from("chat_conversation_members")
    .select("conversation_id, user_id")
    .in("user_id", [currentUserId, otherUserId]);

  if (membershipError) throw membershipError;

  const grouped = new Map<string, string[]>();

  for (const row of memberships ?? []) {
    const existing = grouped.get(row.conversation_id) ?? [];
    existing.push(row.user_id);
    grouped.set(row.conversation_id, existing);
  }

  const candidateConversationIds = Array.from(grouped.entries())
    .filter(([, userIds]) => {
      const unique = Array.from(new Set(userIds));
      return (
        unique.length === 2 &&
        unique.includes(currentUserId) &&
        unique.includes(otherUserId)
      );
    })
    .map(([conversationId]) => conversationId);

  if (candidateConversationIds.length > 0) {
    const { data: existingConversation, error: conversationError } =
      await supabase
        .from("chat_conversations")
        .select("*")
        .in("id", candidateConversationIds)
        .eq("type", "direct")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

    if (conversationError) throw conversationError;

    if (existingConversation) {
      return existingConversation as ChatConversation;
    }
  }

  const tempTitle = `direct:${currentUserId}:${otherUserId}:${Date.now()}`;

  const { data: createdConversation, error: createConversationError } =
    await supabase
      .from("chat_conversations")
      .insert({
        organization_id: organizationId,
        title: tempTitle,
        type: "direct",
        created_by: currentUserId,
      })
      .select("*")
      .single();

  if (createConversationError) throw createConversationError;

  const { error: memberInsertError } = await supabase
    .from("chat_conversation_members")
    .insert([
      {
        conversation_id: createdConversation.id,
        user_id: currentUserId,
        role: "owner",
      },
      {
        conversation_id: createdConversation.id,
        user_id: otherUserId,
        role: "member",
      },
    ]);

  if (memberInsertError) throw memberInsertError;

  return createdConversation as ChatConversation;
}

export async function createGroupConversation(params: {
  currentUserId: string;
  organizationId: string;
  title: string;
  memberIds: string[];
}): Promise<ChatConversation> {
  const cleanTitle = params.title.trim();
  const uniqueMemberIds = Array.from(
    new Set([params.currentUserId, ...params.memberIds]),
  );

  if (!cleanTitle) {
    throw new Error("Group title is required.");
  }

  if (uniqueMemberIds.length < 3) {
    throw new Error(
      "A group chat must have at least 3 participants including you.",
    );
  }

  const { data: createdConversation, error: createConversationError } =
    await supabase
      .from("chat_conversations")
      .insert({
        organization_id: params.organizationId,
        title: cleanTitle,
        type: "group",
        created_by: params.currentUserId,
      })
      .select("*")
      .single();

  if (createConversationError) throw createConversationError;

  const memberRows = uniqueMemberIds.map((userId) => ({
    conversation_id: createdConversation.id,
    user_id: userId,
    role: userId === params.currentUserId ? "owner" : "member",
  }));

  const { error: memberInsertError } = await supabase
    .from("chat_conversation_members")
    .insert(memberRows);

  if (memberInsertError) throw memberInsertError;

  const recipientIds = uniqueMemberIds.filter(
    (userId) => userId !== params.currentUserId,
  );

  if (recipientIds.length > 0) {
    void sendBulkNotifications({
      organizationId: params.organizationId,
      userIds: recipientIds,
      type: "chat_message",
      title: "You were added to a group chat",
      message: `You were added to "${cleanTitle}".`,
      entityType: "chat",
      entityId: createdConversation.id,
      actionUrl: "/chat",
      priority: "medium",
      metadata: {
        conversationId: createdConversation.id,
        conversationType: "group",
        conversationTitle: cleanTitle,
      },
      referenceId: createdConversation.id,
      referenceType: "chat_conversation",
      sendEmail: true,
    }).catch(async (error) => {
      logChatError("GROUP CHAT NOTIFICATION ERROR:", error);

      try {
        await supabase.functions.invoke("create-notification", {
          body: {
            organizationId: params.organizationId,
            userIds: recipientIds,
            type: "chat_message",
            title: "You were added to a group chat",
            message: `You were added to "${cleanTitle}".`,
            entityType: "chat",
            entityId: createdConversation.id,
            actionUrl: "/chat",
            priority: "medium",
            metadata: {
              conversationId: createdConversation.id,
              conversationType: "group",
              conversationTitle: cleanTitle,
            },
            referenceId: createdConversation.id,
            referenceType: "chat_conversation",
          },
        });
      } catch (fallbackError) {
        logChatError(
          "GROUP CHAT NOTIFICATION EDGE FALLBACK ERROR:",
          fallbackError,
        );
      }
    });
  }

  return createdConversation as ChatConversation;
}
