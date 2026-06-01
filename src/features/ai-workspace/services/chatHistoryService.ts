import { supabase } from "../../../lib/supabase/client";

const USE_REMOTE_AI_CHAT_HISTORY = false;

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachments?: ChatAttachment[];
  metadata?: {
    model?: string;
    temperature?: number;
    tokens?: number;
    processingTime?: number;
    context?: Record<string, any>;
  };
  createdAt: string;
  updatedAt?: string;
  userId: string;
  isDeleted?: boolean;
}

export interface ChatAttachment {
  id: string;
  messageId: string;
  type: "image" | "document" | "audio" | "video";
  name: string;
  url: string;
  download_url?: string;
  size: number;
  mimeType: string;
  uploadedAt: string;
  textContent?: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
    documentId?: string | null;
    trained?: boolean;
    message?: string;
    uploadError?: string;
    codexStorage?: boolean;
    textContent?: string;
  };
}

export interface ChatConversation {
  id: string;
  title: string;
  userId: string;
  role?: string;
  context?: {
    currentRoute?: string;
    currentModule?: string;
    organizationId?: string;
    department?: string;
  };
  metadata?: {
    totalMessages?: number;
    lastActivity?: string;
    tags?: string[];
    isPinned?: boolean;
    isArchived?: boolean;
    projectId?: string | null;
    projectName?: string | null;
    localOnly?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChatSession {
  conversation: ChatConversation;
  messages: ChatMessage[];
  hasMore: boolean;
  nextCursor?: string;
}

function getLocalConversationKey(userId: string, organizationId?: string | null) {
  return `ai_workspace_local_conversations:${organizationId ?? "default"}:${userId}`;
}

function getLocalMessageKey(conversationId: string) {
  return `ai_workspace_local_messages:${conversationId}`;
}

function readLocalConversations(
  userId: string,
  organizationId?: string | null,
): ChatConversation[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(
      getLocalConversationKey(userId, organizationId),
    );
    if (!value) return [];

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalConversations(
  userId: string,
  organizationId: string | null | undefined,
  conversations: ChatConversation[],
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getLocalConversationKey(userId, organizationId),
    JSON.stringify(conversations),
  );
}

function readLocalMessages(conversationId: string): ChatMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const value = window.localStorage.getItem(getLocalMessageKey(conversationId));
    if (!value) return [];

    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalMessages(conversationId: string, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getLocalMessageKey(conversationId),
    JSON.stringify(messages),
  );
}

function makeLocalConversation(params: {
  userId: string;
  organizationId: string;
  title?: string;
  role?: string;
  context?: ChatConversation["context"];
  projectId?: string | null;
  projectName?: string | null;
}): ChatConversation {
  const now = new Date().toISOString();

  return {
    id: `local_${crypto.randomUUID()}`,
    title: params.title || "New Chat",
    userId: params.userId,
    role: params.role,
    context: params.context,
    metadata: {
      totalMessages: 0,
      lastActivity: now,
      tags: [],
      isPinned: false,
      isArchived: false,
      projectId: params.projectId ?? null,
      projectName: params.projectName ?? null,
      localOnly: true,
    },
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeConversationProjectId(
  value: unknown,
): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : null;
}

function normalizeConversation(conversation: ChatConversation): ChatConversation {
  return {
    ...conversation,
    metadata: {
      totalMessages: conversation.metadata?.totalMessages ?? 0,
      lastActivity: conversation.metadata?.lastActivity ?? conversation.updatedAt,
      tags: conversation.metadata?.tags ?? [],
      isPinned: conversation.metadata?.isPinned ?? false,
      isArchived: conversation.metadata?.isArchived ?? false,
      ...conversation.metadata,
      projectId: normalizeConversationProjectId(
        conversation.metadata?.projectId,
      ),
      projectName: conversation.metadata?.projectName ?? null,
    },
  };
}

export class ChatHistoryService {
  static async createConversation(params: {
    userId: string;
    organizationId: string;
    title?: string;
    role?: string;
    context?: ChatConversation["context"];
    toolId?: string;
    projectId?: string | null;
    projectName?: string | null;
  }): Promise<ChatConversation> {
    if (!USE_REMOTE_AI_CHAT_HISTORY) {
      const conversation = makeLocalConversation(params);
      const conversations = [
        conversation,
        ...readLocalConversations(params.userId, params.organizationId),
      ];
      writeLocalConversations(
        params.userId,
        params.organizationId,
        conversations,
      );
      return conversation;
    }

    try {
      const { data, error } = await supabase
        .from("ai_conversations")
        .insert({
          user_id: params.userId,
          organization_id: params.organizationId,
          title: params.title || "New Chat",
          tool_id: params.toolId,
          metadata: {
            role: params.role,
            context: params.context,
            totalMessages: 0,
            lastActivity: new Date().toISOString(),
            tags: [],
            isPinned: false,
            isArchived: false,
            projectId: params.projectId ?? null,
            projectName: params.projectName ?? null,
          },
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapConversationRow(data);
    } catch (error) {
      const conversation = makeLocalConversation(params);
      const conversations = [
        conversation,
        ...readLocalConversations(params.userId, params.organizationId),
      ];
      writeLocalConversations(
        params.userId,
        params.organizationId,
        conversations,
      );
      return conversation;
    }
  }

  static async getConversation(conversationId: string): Promise<ChatConversation | null> {
    if (!USE_REMOTE_AI_CHAT_HISTORY) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("id", conversationId)
        .single();

      if (error) throw error;
      return data ? this.mapConversationRow(data) : null;
    } catch (error) {
      console.error("Error getting conversation:", error);
      return null;
    }
  }

  static async getUserConversations(params: {
    userId: string;
    organizationId?: string;
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  }): Promise<{
    conversations: ChatConversation[];
    total: number;
    hasMore: boolean;
  }> {
    if (!USE_REMOTE_AI_CHAT_HISTORY) {
      const conversations = readLocalConversations(
        params.userId,
        params.organizationId,
      ).map(normalizeConversation);
      return { conversations, total: conversations.length, hasMore: false };
    }

    try {
      let query = supabase
        .from("ai_conversations")
        .select("*", { count: "exact" })
        .eq("user_id", params.userId);

      if (params.organizationId) {
        query = query.eq("organization_id", params.organizationId);
      }

      query = query.order("updated_at", { ascending: false });

      if (params.limit) query = query.limit(params.limit);
      if (params.offset) query = query.range(params.offset, params.offset + (params.limit || 10) - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      const conversations = data?.map(this.mapConversationRow) || [];
      const localConversations = readLocalConversations(
        params.userId,
        params.organizationId,
      );
      const mergedConversations = [...localConversations, ...conversations]
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
      const total = count || 0;
      const hasMore = params.offset ? params.offset + conversations.length < total : false;

      return {
        conversations: mergedConversations,
        total: total + localConversations.length,
        hasMore,
      };
    } catch (error) {
      const conversations = readLocalConversations(
        params.userId,
        params.organizationId,
      ).map(normalizeConversation);
      return { conversations, total: conversations.length, hasMore: false };
    }
  }

  static async getChatSession(params: {
    conversationId: string;
    userId: string;
    organizationId?: string | null;
    limit?: number;
    cursor?: string;
  }): Promise<ChatSession> {
    try {
      if (params.conversationId.startsWith("local_")) {
        const messages = readLocalMessages(params.conversationId);
        const conversations = readLocalConversations(
          params.userId,
          params.organizationId,
        ).map(normalizeConversation);
        const conversation = conversations.find(
          (item) => item.id === params.conversationId,
        ) ?? {
          id: params.conversationId,
          title: "Local Chat",
          userId: params.userId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        return {
          conversation: normalizeConversation(conversation),
          messages,
          hasMore: false,
        };
      }

      // Get conversation
      const conversation = await this.getConversation(params.conversationId);
      if (!conversation) throw new Error("Conversation not found");

      // Get messages
      let query = supabase
        .from("ai_messages")
        .select("*")
        .eq("conversation_id", params.conversationId)
        .order("created_at", { ascending: false });

      if (params.limit) query = query.limit(params.limit);
      if (params.cursor) {
        query = query.lt("created_at", params.cursor);
      }

      const { data, error } = await query;

      if (error) throw error;

      const messages = data?.map(this.mapMessageRow).reverse() || [];
      const hasMore = data?.length === (params.limit || 50);
      const nextCursor = hasMore && messages.length > 0 ? messages[messages.length - 1].createdAt : undefined;

      return {
        conversation,
        messages,
        hasMore,
        nextCursor,
      };
    } catch (error) {
      console.error("Error getting chat session:", error);
      throw new Error("Failed to load chat session");
    }
  }

  static async addMessage(params: {
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    userId: string;
    organizationId?: string | null;
    type?: string;
    toolId?: string;
    data?: Record<string, any>;
    sources?: Array<Record<string, any>>;
    requiresApproval?: boolean;
    approvalId?: string;
    error?: boolean;
  }): Promise<ChatMessage> {
    try {
      if (params.conversationId.startsWith("local_")) {
        const now = new Date().toISOString();
        const message: ChatMessage = {
          id: `local_msg_${crypto.randomUUID()}`,
          conversationId: params.conversationId,
          role: params.role,
          content: params.content,
          attachments: Array.isArray(params.data?.attachments)
            ? (params.data.attachments as any[]).map((attachment, index) => ({
              id: attachment.id || `local_attachment_${index}`,
              messageId: `local_msg_${index}`,
              type: attachment.type || "document",
              name: attachment.name || "Attachment",
              url: attachment.url || "",
              size: attachment.size || 0,
              mimeType: attachment.mimeType || "",
              uploadedAt: now,
              metadata: attachment.metadata,
            }))
            : [],
          metadata: params.data,
          createdAt: now,
          userId: params.userId,
        };

        const messages = [...readLocalMessages(params.conversationId), message];
        writeLocalMessages(params.conversationId, messages);
        return message;
      }

      // Add message
      const { data: message, error: messageError } = await supabase
        .from("ai_messages")
        .insert({
          conversation_id: params.conversationId,
          user_id: params.userId,
          organization_id: params.organizationId,
          sender_id: params.userId,
          sender_type: params.role === "assistant" ? "ai" : "employee",
          role: params.role,
          content: params.content,
          type: params.type || "text",
          tool_id: params.toolId,
          data: params.data || {},
          sources: params.sources || [],
          requires_approval: params.requiresApproval || false,
          approval_id: params.approvalId,
          error: params.error || false,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      return this.mapMessageRow(message);
    } catch (error) {
      console.warn("Supabase message save failed:", error);
      throw new Error("Failed to add message");
    }
  }

  static async updateMessage(params: {
    messageId: string;
    userId: string;
    content?: string;
    data?: Record<string, any>;
    sources?: Array<Record<string, any>>;
  }): Promise<ChatMessage> {
    try {
      const { data, error } = await supabase
        .from("ai_messages")
        .update({
          content: params.content,
          data: params.data,
          sources: params.sources,
        })
        .eq("id", params.messageId)
        .select()
        .single();

      if (error) throw error;
      return this.mapMessageRow(data);
    } catch (error) {
      console.error("Error updating message:", error);
      throw new Error("Failed to update message");
    }
  }

  static async deleteMessage(params: {
    messageId: string;
    userId: string;
  }): Promise<void> {
    try {
      await supabase
        .from("ai_messages")
        .delete()
        .eq("id", params.messageId);
    } catch (error) {
      console.error("Error deleting message:", error);
      throw new Error("Failed to delete message");
    }
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      if (conversationId.startsWith("local_")) {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(getLocalMessageKey(conversationId));
          const keys = Object.keys(window.localStorage).filter((key) =>
            key.startsWith("ai_workspace_local_conversations:"),
          );
          keys.forEach((key) => {
            const value = window.localStorage.getItem(key);
            if (!value) return;
            try {
              const conversations = JSON.parse(value);
              if (!Array.isArray(conversations)) return;
              window.localStorage.setItem(
                key,
                JSON.stringify(
                  conversations.filter(
                    (conversation: ChatConversation) =>
                      conversation.id !== conversationId,
                  ),
                ),
              );
            } catch {
              // Ignore malformed local cache entries.
            }
          });
        }
        return;
      }

      if (!USE_REMOTE_AI_CHAT_HISTORY) return;

      await supabase
        .from("ai_conversations")
        .delete()
        .eq("id", conversationId);
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw new Error("Failed to delete conversation");
    }
  }

  static async updateConversation(params: {
    conversationId: string;
    title?: string;
    metadata?: Record<string, any>;
  }): Promise<ChatConversation> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (params.title !== undefined) updateData.title = params.title;
      if (params.metadata !== undefined) updateData.metadata = params.metadata;

      const { data, error } = await supabase
        .from("ai_conversations")
        .update(updateData)
        .eq("id", params.conversationId)
        .select()
        .single();

      if (error) throw error;
      return this.mapConversationRow(data);
    } catch (error) {
      console.error("Error updating conversation:", error);
      throw new Error("Failed to update conversation");
    }
  }

  static async searchConversations(params: {
    userId: string;
    query: string;
    limit?: number;
  }): Promise<ChatConversation[]> {
    try {
      const { data, error } = await supabase
        .from("ai_conversations")
        .select("*")
        .eq("user_id", params.userId)
        .ilike("title", `%${params.query}%`)
        .order("updated_at", { ascending: false })
        .limit(params.limit || 20);

      if (error) throw error;
      return data?.map(this.mapConversationRow) || [];
    } catch (error) {
      console.error("Error searching conversations:", error);
      return [];
    }
  }

  static async searchMessages(params: {
    userId: string;
    query: string;
    conversationId?: string;
    limit?: number;
  }): Promise<{
    messages: (ChatMessage & { conversation: ChatConversation })[];
  }> {
    try {
      let query = supabase
        .from("ai_messages")
        .select(`
          *,
          conversation:ai_conversations!inner(*)
        `)
        .ilike("content", `%${params.query}%`)
        .order("created_at", { ascending: false });

      if (params.conversationId) {
        query = query.eq("conversation_id", params.conversationId);
      }

      if (params.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;

      if (error) throw error;

      const messages = data?.map((msg: any) => ({
        ...this.mapMessageRow(msg),
        conversation: this.mapConversationRow(msg.conversation),
      })) || [];

      return { messages };
    } catch (error) {
      console.error("Error searching messages:", error);
      return { messages: [] };
    }
  }

  static async updateConversationActivity(conversationId: string): Promise<void> {
    try {
      const { data: count } = await supabase
        .from("ai_messages")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversationId);

      await supabase
        .from("ai_conversations")
        .update({
          updated_at: new Date().toISOString(),
          metadata: {
            totalMessages: count || 0,
            lastActivity: new Date().toISOString(),
          },
        })
        .eq("id", conversationId);
    } catch (error) {
      console.error("Error updating conversation activity:", error);
    }
  }

  // Mapping functions
  private static mapConversationRow(row: any): ChatConversation {
    return {
      id: row.id,
      title: row.title || "New Chat",
      userId: row.user_id,
      role: row.metadata?.role,
      context: row.metadata?.context,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapMessageRow(row: any): ChatMessage {
    const rawAttachments = Array.isArray(row.data?.attachments)
      ? row.data.attachments
      : [];

    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      attachments: rawAttachments.map((attachment: any, index: number) => ({
        id: attachment.id || `${row.id}_attachment_${index}`,
        messageId: row.id,
        type: attachment.type || "document",
        name: attachment.name || "Attachment",
        url: attachment.url || "",
        size: attachment.size || 0,
        mimeType: attachment.mimeType || attachment.mime_type || "",
        uploadedAt: attachment.uploadedAt || row.created_at,
        metadata: attachment.metadata,
      })),
      metadata: {
        ...row.data,
        model: row.data?.model,
        temperature: row.data?.temperature,
        tokens: row.data?.tokens,
        processingTime: row.data?.processingTime,
        context: row.data?.context,
      },
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userId: row.user_id || "",
    };
  }

  private static mapAttachmentRow(row: any): ChatAttachment {
    return {
      id: row.id,
      messageId: row.message_id,
      type: row.type,
      name: row.name,
      url: row.url,
      size: row.size,
      mimeType: row.mime_type,
      uploadedAt: row.uploaded_at,
      metadata: row.metadata,
    };
  }
}
