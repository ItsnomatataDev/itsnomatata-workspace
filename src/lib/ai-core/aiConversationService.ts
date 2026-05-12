// ============================================================
// AI Conversation Service - Conversation Management
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { 
  AIConversation, 
  AIMessage,
  ConversationListOptions,
  MessageListOptions,
  AIConversationListResponse,
  AIMessagesResponse,
  ConversationStatus,
  ChannelType
} from './aiTypes';

// ============================================================
// Conversation Service Class
// ============================================================

export class AIConversationService {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  // ============================================================
  // Conversation Management
  // ============================================================

  async getConversations(
    organizationId: string,
    options: ConversationListOptions = {}
  ): Promise<AIConversationListResponse> {
    try {
      const {
        page = 1,
        pageSize = 20,
        status,
        channel,
        assistantId,
      } = options;

      let query = this.supabase
        .from('ai_conversations')
        .select(`
          *,
          ai_assistants!inner(
            id,
            name,
            assistant_type
          ),
          profiles!inner(
            id,
            full_name,
            primary_role
          )
        `)
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }
      if (channel) {
        query = query.eq('channel', channel);
      }
      if (assistantId) {
        query = query.eq('assistant_id', assistantId);
      }

      // Get total count
      const { count } = await this.supabase
        .from('ai_conversations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: conversations, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch conversations: ${error.message}`);
      }

      return {
        conversations: conversations || [],
        total: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Conversation Service Error:', error);
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<AIConversation | null> {
    try {
      const { data: conversation, error } = await this.supabase
        .from('ai_conversations')
        .select(`
          *,
          ai_assistants!inner(
            id,
            name,
            assistant_type
          ),
          profiles!inner(
            id,
            full_name,
            primary_role
          )
        `)
        .eq('id', conversationId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch conversation: ${error.message}`);
      }

      return conversation;
    } catch (error) {
      console.error('Conversation Service Error:', error);
      throw error;
    }
  }

  async createConversation(
    organizationId: string,
    data: {
      userId?: string;
      customerId?: string;
      assistantId?: string;
      channel: ChannelType;
      title: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<AIConversation> {
    try {
      const { data: conversation, error } = await (this.supabase
        .from('ai_conversations')
        .insert({
          organization_id: organizationId,
          user_id: data.userId || null,
          customer_id: data.customerId || null,
          assistant_id: data.assistantId || null,
          channel: data.channel,
          title: data.title,
          status: 'active',
          metadata: data.metadata || {},
        } as any)
        .select()
        .single());

      if (error) {
        throw new Error(`Failed to create conversation: ${error.message}`);
      }

      return conversation!;
    } catch (error) {
      console.error('Conversation Service Error:', error);
      throw error;
    }
  }

  async updateConversation(
    conversationId: string,
    updates: Partial<AIConversation>
  ): Promise<AIConversation> {
    try {
      const { data: conversation, error } = await (this.supabase
        .from('ai_conversations')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', conversationId)
        .select()
        .single());

      if (error) {
        throw new Error(`Failed to update conversation: ${error.message}`);
      }

      return conversation!;
    } catch (error) {
      console.error('Conversation Service Error:', error);
      throw error;
    }
  }

  async archiveConversation(conversationId: string): Promise<void> {
    await this.updateConversation(conversationId, { status: 'archived' });
  }

  async closeConversation(conversationId: string): Promise<void> {
    await this.updateConversation(conversationId, { status: 'closed' });
  }

  // ============================================================
  // Message Management
  // ============================================================

  async getMessages(
    conversationId: string,
    options: MessageListOptions = {}
  ): Promise<AIMessagesResponse> {
    try {
      const { page = 1, pageSize = 50 } = options;
      
      if (!options.conversationId) {
        throw new Error('Conversation ID is required for getMessages');
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Get total count
      const { count } = await this.supabase
        .from('ai_messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', conversationId);

      const { data: messages, error } = await this.supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      return {
        messages: messages || [],
        total: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Conversation Service Error:', error);
      throw error;
    }
  }

  async addMessage(
    conversationId: string,
    organizationId: string,
    message: {
      senderType: 'employee' | 'customer' | 'ai';
      senderId?: string;
      content: string;
      role: 'user' | 'assistant' | 'system';
      metadata?: Record<string, unknown>;
    }
  ): Promise<AIMessage> {
    try {
      const { data: newMessage, error } = await (this.supabase
        .from('ai_messages')
        .insert({
          conversation_id: conversationId,
          organization_id: organizationId,
          sender_type: message.senderType,
          sender_id: message.senderId || null,
          content: message.content,
          role: message.role,
          metadata: message.metadata || {},
        } as any)
        .select()
        .single());

      if (error) {
        throw new Error(`Failed to add message: ${error.message}`);
      }

      return newMessage!;
    } catch (error) {
      console.error('Conversation Service Error:', error);
      throw error;
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  async getRecentConversations(
    organizationId: string,
    limit: number = 10
  ): Promise<AIConversation[]> {
    const result = await this.getConversations(organizationId, {
      page: 1,
      pageSize: limit,
    });

    return result.conversations;
  }

  async getConversationsByAssistant(
    organizationId: string,
    assistantId: string,
    limit: number = 10
  ): Promise<AIConversation[]> {
    const result = await this.getConversations(organizationId, {
      assistantId,
      pageSize: limit,
    });

    return result.conversations;
  }

  async getConversationsByChannel(
    organizationId: string,
    channel: ChannelType,
    limit: number = 10
  ): Promise<AIConversation[]> {
    const result = await this.getConversations(organizationId, {
      channel,
      pageSize: limit,
    });

    return result.conversations;
  }

  async searchConversations(
    organizationId: string,
    searchTerm: string,
    options: ConversationListOptions = {}
  ): Promise<AIConversationListResponse> {
    try {
      const { page = 1, pageSize = 20 } = options;

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: conversations, error, count } = await this.supabase
        .from('ai_conversations')
        .select(`
          *,
          ai_assistants!inner(
            id,
            name,
            assistant_type
          ),
          profiles!inner(
            id,
            full_name,
            primary_role
          )
        `, { count: 'exact' })
        .eq('organization_id', organizationId)
        .ilike('title', `%${searchTerm}%`)
        .order('updated_at', { ascending: false })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to search conversations: ${error.message}`);
      }

      return {
        conversations: conversations || [],
        total: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Conversation Service Error:', error);
      throw error;
    }
  }
}

// ============================================================
// Default Instance
// ============================================================

let defaultConversationService: AIConversationService | null = null;

export const getConversationService = (
  supabaseUrl?: string,
  supabaseAnonKey?: string
): AIConversationService => {
  if (!defaultConversationService && supabaseUrl && supabaseAnonKey) {
    defaultConversationService = new AIConversationService(supabaseUrl, supabaseAnonKey);
  }
  
  if (!defaultConversationService) {
    throw new Error('Conversation service not initialized. Provide Supabase URL and anon key.');
  }
  
  return defaultConversationService;
};

// ============================================================
// Utility Functions
// ============================================================

export const formatConversationTitle = (message: string): string => {
  const maxLength = 80;
  if (message.length <= maxLength) {
    return message;
  }
  
  return message.substring(0, maxLength - 3) + '...';
};

export const getConversationStatusColor = (status: ConversationStatus): string => {
  const colors = {
    active: 'green',
    archived: 'yellow',
    closed: 'gray',
  };
  
  return colors[status] || 'gray';
};

export const getChannelIcon = (channel: ChannelType): string => {
  const icons = {
    internal: 'message-circle',
    website: 'globe',
    whatsapp: 'phone',
    email: 'mail',
  };
  
  return icons[channel] || 'message-circle';
};
