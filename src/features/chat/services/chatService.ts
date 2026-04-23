import { supabase } from "../../../lib/supabase/client";
import {
  sendBulkNotifications,
} from "../../notifications/services/notificationService";
import type {
  ChatConversation,
  ChatMessage,
  ChatUser,
  SendChatMessageInput,
} from "../types/chat";

const CHAT_BUCKET = "chat-attachments";

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
}) {
  try {
    return await sendBulkNotifications({
      ...params,
      sendEmail: true,
    });
  } catch (primaryError) {
    console.error(
      "CHAT notification primary send failed, trying edge fallback:",
      primaryError,
    );

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
          metadata: params.metadata,
          referenceId: params.referenceId,
          referenceType: params.referenceType,
        },
      },
    );

    if (error) {
      throw error;
    }

    return data;
  }
}

function buildMessagePreview(params: {
  body?: string | null;
  messageType?: string | null;
  attachmentName?: string | null;
}) {
  const body = params.body?.trim() ?? "";
  const type = params.messageType ?? "text";

  if (type === "image") {
    return params.attachmentName
      ? `📷 Image: ${params.attachmentName}`
      : "📷 Image";
  }

  if (type === "audio") {
    return "🎤 Voice note";
  }

  if (type === "file") {
    return params.attachmentName
      ? `📎 File: ${params.attachmentName}`
      : "📎 File";
  }

  if (type === "system") {
    return body || "System message";
  }

  return body || "New message";
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
  body?: string | null;
  messageType?: string | null;
  attachmentName?: string | null;
}) {
  try {
    const [conversation, recipientIds] = await Promise.all([
      getConversationMeta(params.conversationId),
      getConversationRecipientIds(params.conversationId, params.senderId),
    ]);

    console.log("CHAT conversation meta:", conversation);
    console.log("CHAT recipient IDs:", recipientIds);

    if (recipientIds.length === 0) {
      console.log("CHAT notification skipped: no recipients found");
      return;
    }

    const preview = buildMessagePreview({
      body: params.body,
      messageType: params.messageType,
      attachmentName: params.attachmentName,
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
      actionUrl: "/chat",
      priority: "medium" as const,
      metadata: {
        conversationId: conversation.id,
        conversationType: conversation.type,
        conversationTitle: conversation.title,
        senderId: params.senderId,
        senderName: params.senderName,
        messageType: params.messageType ?? "text",
      },
      referenceId: conversation.id,
      referenceType: "chat_conversation" as const,
      sendEmail: true,
    };

    console.log("CHAT notification payload:", payload);

    const result = await dispatchChatNotificationsWithFallback(payload);

    console.log("CHAT notification success:", result);
  } catch (error) {
    console.error("CHAT NOTIFICATION ERROR:", error);
  }
}
export async function getConversations(
  currentUserId?: string,
): Promise<ChatConversation[]> {
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
        last_read_message_id,
        profile:profiles (
          id,
          full_name,
          email,
          last_seen_at
        )
      ),
      messages:chat_messages (
        id,
        sender_id,
        body,
        message_type,
        created_at
      )
    `)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  const conversations = (data ?? []) as Array<
    ChatConversation & {
      messages?: Array<{
        id: string;
        sender_id: string;
        body: string | null;
        message_type?: string | null;
        created_at: string;
      }>;
    }
  >;

  return conversations.map((conversation) => {
    const myMembership = conversation.members?.find(
      (member) => member.user_id === currentUserId,
    );

    const otherMember = conversation.members?.find(
      (member) => member.user_id !== currentUserId,
    );

    const sortedMessagesDesc = [...(conversation.messages ?? [])].sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    const sortedMessagesAsc = [...(conversation.messages ?? [])].sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );

    const latestMessage = sortedMessagesDesc[0] ?? null;

    let unreadCount = 0;

    if (currentUserId) {
      if (!myMembership?.last_read_message_id) {
        unreadCount = sortedMessagesAsc.filter(
          (message) => message.sender_id !== currentUserId,
        ).length;
      } else {
        const lastReadIndex = sortedMessagesAsc.findIndex(
          (message) => message.id === myMembership.last_read_message_id,
        );

        if (lastReadIndex === -1) {
          unreadCount = sortedMessagesAsc.filter(
            (message) => message.sender_id !== currentUserId,
          ).length;
        } else {
          unreadCount = sortedMessagesAsc
            .slice(lastReadIndex + 1)
            .filter((message) => message.sender_id !== currentUserId).length;
        }
      }
    }

    const displayName = conversation.type === "direct"
      ? otherMember?.profile?.full_name ||
        otherMember?.profile?.email ||
        conversation.title ||
        "Direct conversation"
      : conversation.title || "Untitled conversation";

    return {
      ...conversation,
      display_name: displayName,
      unread_count: unreadCount,
      last_message: latestMessage
        ? {
          id: latestMessage.id,
          sender_id: latestMessage.sender_id,
          body: latestMessage.message_type === "image"
            ? "📷 Image"
            : latestMessage.message_type === "audio"
            ? "🎤 Voice note"
            : latestMessage.message_type === "file"
            ? "📎 File"
            : latestMessage.body,
          created_at: latestMessage.created_at,
        }
        : null,
    };
  });
}

export async function getMessages(
  conversationId: string,
): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select(`
      *,
      sender:profiles!chat_messages_sender_id_fkey (
        id,
        full_name,
        email,
        last_seen_at
      )
    `)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatMessage[];
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
  };

  const { data, error } = await supabase
    .from("chat_messages")
    .insert(insertPayload)
    .select(`
      *,
      sender:profiles!chat_messages_sender_id_fkey (
        id,
        full_name,
        email,
        last_seen_at
      )
    `)
    .single();

  if (error) throw error;

  const message = data as ChatMessage;

  if (messageType !== "system") {
    const senderName = message.sender?.full_name?.trim() ||
      message.sender?.email?.trim() ||
      "Someone";

    void notifyConversationMembers({
      conversationId: params.conversationId,
      senderId: params.userId,
      senderName,
      body,
      messageType,
      attachmentName: params.attachmentName ?? null,
    });
  }

  return message;
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
    .update({ is_deleted: true })
    .eq("id", params.messageId)
    .eq("sender_id", params.userId);

  if (error) throw error;
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
      console.error("GROUP CHAT NOTIFICATION ERROR:", error);

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
        console.error(
          "GROUP CHAT NOTIFICATION EDGE FALLBACK ERROR:",
          fallbackError,
        );
      }
    });
  }

  return createdConversation as ChatConversation;
}
