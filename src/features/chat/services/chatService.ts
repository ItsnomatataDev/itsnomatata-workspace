import { supabase } from "../../../lib/supabase/client";
import type {
  ChatConversation,
  ChatMessage,
  ChatUser,
} from "../types/chat";

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

    const displayName =
      conversation.type === "direct"
        ? otherMember?.profile?.full_name ||
          otherMember?.profile?.email ||
          conversation.title ||
          "Direct conversation"
        : conversation.title || "Untitled conversation";

    return {
      ...conversation,
      display_name: displayName,
      unread_count: unreadCount,
      last_message: latestMessage,
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

export async function sendMessage(params: {
  conversationId: string;
  userId: string;
  body: string;
}): Promise<ChatMessage | null> {
  const message = params.body.trim();
  if (!message) return null;

  const { error: insertError } = await supabase.from("chat_messages").insert({
    conversation_id: params.conversationId,
    sender_id: params.userId,
    body: message,
    message_type: "text",
  });

  if (insertError) throw insertError;

  const { data, error: fetchError } = await supabase
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
    .eq("conversation_id", params.conversationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (fetchError) throw fetchError;

  return (data as ChatMessage | null) ?? null;
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

  const { error: createConversationError } = await supabase
    .from("chat_conversations")
    .insert({
      organization_id: organizationId,
      title: tempTitle,
      type: "direct",
      created_by: currentUserId,
    });

  if (createConversationError) {
    throw createConversationError;
  }

  const { data: newConversation, error: fetchConversationError } =
    await supabase
      .from("chat_conversations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("type", "direct")
      .eq("created_by", currentUserId)
      .eq("title", tempTitle)
      .maybeSingle();

  if (fetchConversationError) {
    throw fetchConversationError;
  }

  if (!newConversation) {
    throw new Error("Direct conversation was created but could not be fetched.");
  }

  const { error: memberInsertError } = await supabase
    .from("chat_conversation_members")
    .insert([
      {
        conversation_id: newConversation.id,
        user_id: currentUserId,
        role: "owner",
      },
      {
        conversation_id: newConversation.id,
        user_id: otherUserId,
        role: "member",
      },
    ]);

  if (memberInsertError) {
    throw memberInsertError;
  }

  return newConversation as ChatConversation;
}