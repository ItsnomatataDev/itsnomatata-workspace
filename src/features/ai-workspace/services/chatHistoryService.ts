import { supabase } from "../../../lib/supabase/client";

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
  size: number;
  mimeType: string;
  uploadedAt: string;
  metadata?: {
    width?: number;
    height?: number;
    duration?: number;
    thumbnail?: string;
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

export class ChatHistoryService {
  static async createConversation(params: {
    userId: string;
    title?: string;
    role?: string;
    context?: ChatConversation["context"];
  }): Promise<ChatConversation> {
    try {
      const { data, error } = await supabase
        .from("chat_conversations")
        .insert({
          user_id: params.userId,
          title: params.title || "New Chat",
          role: params.role,
          context: params.context,
          metadata: {
            totalMessages: 0,
            lastActivity: new Date().toISOString(),
            tags: [],
            isPinned: false,
            isArchived: false,
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapConversationRow(data);
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw new Error("Failed to create chat conversation");
    }
  }

  static async getConversation(conversationId: string): Promise<ChatConversation | null> {
    try {
      const { data, error } = await supabase
        .from("chat_conversations")
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
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  }): Promise<{
    conversations: ChatConversation[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      let query = supabase
        .from("chat_conversations")
        .select("*", { count: "exact" })
        .eq("user_id", params.userId)
        .eq("metadata->>isArchived", params.includeArchived ? "true" : "false")
        .order("metadata->>lastActivity", { ascending: false });

      if (params.limit) query = query.limit(params.limit);
      if (params.offset) query = query.offset(params.offset);

      const { data, error, count } = await query;

      if (error) throw error;

      const conversations = data?.map(this.mapConversationRow) || [];
      const total = count || 0;
      const hasMore = params.offset ? params.offset + conversations.length < total : false;

      return { conversations, total, hasMore };
    } catch (error) {
      console.error("Error getting user conversations:", error);
      return { conversations: [], total: 0, hasMore: false };
    }
  }

  static async getChatSession(params: {
    conversationId: string;
    userId: string;
    limit?: number;
    cursor?: string;
  }): Promise<ChatSession> {
    try {
      // Get conversation
      const conversation = await this.getConversation(params.conversationId);
      if (!conversation) throw new Error("Conversation not found");

      // Get messages
      let query = supabase
        .from("chat_messages")
        .select(`
          *,
          attachments:chat_attachments(*)
        `)
        .eq("conversation_id", params.conversationId)
        .eq("is_deleted", false)
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
    attachments?: Omit<ChatAttachment, "id" | "messageId" | "uploadedAt">[];
    metadata?: ChatMessage["metadata"];
  }): Promise<ChatMessage> {
    try {
      // Add message
      const { data: message, error: messageError } = await supabase
        .from("chat_messages")
        .insert({
          conversation_id: params.conversationId,
          role: params.role,
          content: params.content,
          user_id: params.userId,
          metadata: params.metadata,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Add attachments if provided
      if (params.attachments && params.attachments.length > 0) {
        const attachmentsData = params.attachments.map(attachment => ({
          message_id: message.id,
          type: attachment.type,
          name: attachment.name,
          url: attachment.url,
          size: attachment.size,
          mime_type: attachment.mimeType,
          metadata: attachment.metadata,
          uploaded_at: new Date().toISOString(),
        }));

        const { error: attachmentError } = await supabase
          .from("chat_attachments")
          .insert(attachmentsData);

        if (attachmentError) throw attachmentError;
      }

      // Update conversation metadata
      await this.updateConversationActivity(params.conversationId);

      return this.mapMessageRow({
        ...message,
        attachments: params.attachments || [],
      });
    } catch (error) {
      console.error("Error adding message:", error);
      throw new Error("Failed to add message");
    }
  }

  static async updateMessage(params: {
    messageId: string;
    userId: string;
    content?: string;
    metadata?: ChatMessage["metadata"];
  }): Promise<ChatMessage> {
    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .update({
          content: params.content,
          metadata: params.metadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.messageId)
        .eq("user_id", params.userId)
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
        .from("chat_messages")
        .update({
          is_deleted: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.messageId)
        .eq("user_id", params.userId);
    } catch (error) {
      console.error("Error deleting message:", error);
      throw new Error("Failed to delete message");
    }
  }

  static async deleteConversation(conversationId: string): Promise<void> {
    try {
      await supabase
        .from("chat_conversations")
        .update({
          metadata: {
            ...supabase.rpc("get_conversation_metadata", { conversation_id: conversationId }),
            isArchived: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw new Error("Failed to delete conversation");
    }
  }

  static async updateConversation(params: {
    conversationId: string;
    userId: string;
    title?: string;
    tags?: string[];
    isPinned?: boolean;
    isArchived?: boolean;
  }): Promise<ChatConversation> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (params.title !== undefined) updateData.title = params.title;
      if (params.tags !== undefined) {
        updateData.metadata = {
          ...supabase.rpc("get_conversation_metadata", { conversation_id: params.conversationId }),
          tags: params.tags,
        };
      }
      if (params.isPinned !== undefined) {
        updateData.metadata = {
          ...supabase.rpc("get_conversation_metadata", { conversation_id: params.conversationId }),
          isPinned: params.isPinned,
        };
      }
      if (params.isArchived !== undefined) {
        updateData.metadata = {
          ...supabase.rpc("get_conversation_metadata", { conversation_id: params.conversationId }),
          isArchived: params.isArchived,
        };
      }

      const { data, error } = await supabase
        .from("chat_conversations")
        .update(updateData)
        .eq("id", params.conversationId)
        .eq("user_id", params.userId)
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
        .from("chat_conversations")
        .select("*")
        .eq("user_id", params.userId)
        .ilike("title", `%${params.query}%`)
        .order("metadata->>lastActivity", { ascending: false })
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
        .from("chat_messages")
        .select(`
          *,
          conversation:chat_conversations!inner(*)
        `)
        .eq("user_id", params.userId)
        .eq("is_deleted", false)
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

      const messages = data?.map(item => ({
        ...this.mapMessageRow(item),
        conversation: this.mapConversationRow(item.conversation),
      })) || [];

      return { messages };
    } catch (error) {
      console.error("Error searching messages:", error);
      return { messages: [] };
    }
  }

  private static async updateConversationActivity(conversationId: string): Promise<void> {
    try {
      // Get message count
      const { count } = await supabase
        .from("chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", conversationId)
        .eq("is_deleted", false);

      await supabase
        .from("chat_conversations")
        .update({
          metadata: {
            totalMessages: count || 0,
            lastActivity: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", conversationId);
    } catch (error) {
      console.error("Error updating conversation activity:", error);
    }
  }

  private static mapConversationRow(row: any): ChatConversation {
    return {
      id: row.id,
      title: row.title,
      userId: row.user_id,
      role: row.role,
      context: row.context,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapMessageRow(row: any): ChatMessage {
    return {
      id: row.id,
      conversationId: row.conversation_id,
      role: row.role,
      content: row.content,
      attachments: row.attachments?.map(this.mapAttachmentRow) || [],
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      userId: row.user_id,
      isDeleted: row.is_deleted,
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
