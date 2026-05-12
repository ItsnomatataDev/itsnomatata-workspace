import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AIConversation,
  AIMessage,
  ConversationListOptions,
  MessageListOptions,
  AIConversationListResponse,
  AIMessagesResponse,
  ConversationStatus,
  ChannelType,
} from './aiTypes';

type JsonRecord = Record<string, unknown>;

type CreateConversationInput = {
  userId?: string | null;
  customerId?: string | null;
  assistantId?: string | null;
  channel: ChannelType;
  title: string;
  metadata?: JsonRecord;
};

type UpdateConversationInput = Partial<
  Pick<
    AIConversation,
    | 'assistant_id'
    | 'user_id'
    | 'customer_id'
    | 'channel'
    | 'title'
    | 'status'
    | 'metadata'
  >
>;

type AddMessageInput = {
  senderType: 'employee' | 'customer' | 'ai';
  senderId?: string | null;
  content: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  metadata?: JsonRecord;
};

export class AIConversationService {
  private supabase: SupabaseClient;

  constructor(supabaseUrlOrClient: string | SupabaseClient, supabaseAnonKey?: string) {
    if (typeof supabaseUrlOrClient === 'string') {
      if (!supabaseAnonKey) {
        throw new Error('Supabase anon key is required when initializing AIConversationService with a URL.');
      }

      this.supabase = createClient(supabaseUrlOrClient, supabaseAnonKey);
    } else {
      this.supabase = supabaseUrlOrClient;
    }
  }

  async getConversations(
    organizationId: string,
    options: ConversationListOptions = {},
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
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (channel) {
        query = query.eq('channel', channel);
      }

      if (assistantId) {
        query = query.eq('assistant_id', assistantId);
      }

      const from = Math.max(page - 1, 0) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw new Error(`Failed to fetch conversations: ${error.message}`);
      }

      return {
        conversations: (data ?? []) as AIConversation[],
        total: count ?? 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('AIConversationService.getConversations error:', error);
      throw error;
    }
  }

  async getConversation(conversationId: string): Promise<AIConversation | null> {
    try {
      const { data, error } = await this.supabase
        .from('ai_conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch conversation: ${error.message}`);
      }

      return (data as AIConversation | null) ?? null;
    } catch (error) {
      console.error('AIConversationService.getConversation error:', error);
      throw error;
    }
  }

  async createConversation(
    organizationId: string,
    data: CreateConversationInput,
  ): Promise<AIConversation> {
    try {
      const { data: conversation, error } = await this.supabase
        .from('ai_conversations')
        .insert({
          organization_id: organizationId,
          user_id: data.userId ?? null,
          customer_id: data.customerId ?? null,
          assistant_id: data.assistantId ?? null,
          channel: data.channel,
          title: data.title,
          status: 'active',
          metadata: data.metadata ?? {},
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create conversation: ${error.message}`);
      }

      return conversation as AIConversation;
    } catch (error) {
      console.error('AIConversationService.createConversation error:', error);
      throw error;
    }
  }

  async updateConversation(
    conversationId: string,
    updates: UpdateConversationInput,
  ): Promise<AIConversation> {
    try {
      const { data, error } = await this.supabase
        .from('ai_conversations')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', conversationId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update conversation: ${error.message}`);
      }

      return data as AIConversation;
    } catch (error) {
      console.error('AIConversationService.updateConversation error:', error);
      throw error;
    }
  }

  async archiveConversation(conversationId: string): Promise<AIConversation> {
    return this.updateConversation(conversationId, { status: 'archived' });
  }

  async closeConversation(conversationId: string): Promise<AIConversation> {
    return this.updateConversation(conversationId, { status: 'closed' });
  }

  async getMessages(
    conversationId: string,
    options: MessageListOptions = {},
  ): Promise<AIMessagesResponse> {
    try {
      if (!conversationId) {
        throw new Error('Conversation ID is required for getMessages.');
      }

      const { page = 1, pageSize = 50 } = options;

      const from = Math.max(page - 1, 0) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await this.supabase
        .from('ai_messages')
        .select('*', { count: 'exact' })
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to fetch messages: ${error.message}`);
      }

      return {
        messages: (data ?? []) as AIMessage[],
        total: count ?? 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('AIConversationService.getMessages error:', error);
      throw error;
    }
  }

  async addMessage(
    conversationId: string,
    organizationId: string,
    message: AddMessageInput,
  ): Promise<AIMessage> {
    try {
      const { data, error } = await this.supabase
        .from('ai_messages')
        .insert({
          conversation_id: conversationId,
          organization_id: organizationId,
          sender_type: message.senderType,
          sender_id: message.senderId ?? null,
          content: message.content,
          role: message.role,
          metadata: message.metadata ?? {},
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to add message: ${error.message}`);
      }

      await this.updateConversation(conversationId, {
        metadata: {
          last_message_at: new Date().toISOString(),
        },
      });

      return data as AIMessage;
    } catch (error) {
      console.error('AIConversationService.addMessage error:', error);
      throw error;
    }
  }

  async getRecentConversations(
    organizationId: string,
    limit = 10,
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
    limit = 10,
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
    limit = 10,
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
    options: ConversationListOptions = {},
  ): Promise<AIConversationListResponse> {
    try {
      const { page = 1, pageSize = 20 } = options;

      const from = Math.max(page - 1, 0) * pageSize;
      const to = from + pageSize - 1;

      let query = this.supabase
        .from('ai_conversations')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });

      if (searchTerm.trim()) {
        query = query.ilike('title', `%${searchTerm.trim()}%`);
      }

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw new Error(`Failed to search conversations: ${error.message}`);
      }

      return {
        conversations: (data ?? []) as AIConversation[],
        total: count ?? 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('AIConversationService.searchConversations error:', error);
      throw error;
    }
  }
}

let defaultConversationService: AIConversationService | null = null;

export const getConversationService = (
  supabaseUrlOrClient?: string | SupabaseClient,
  supabaseAnonKey?: string,
): AIConversationService => {
  if (!defaultConversationService && supabaseUrlOrClient) {
    defaultConversationService = new AIConversationService(supabaseUrlOrClient, supabaseAnonKey);
  }

  if (!defaultConversationService) {
    throw new Error('Conversation service not initialized. Provide a Supabase client or Supabase URL and anon key.');
  }

  return defaultConversationService;
};

export const formatConversationTitle = (message: string): string => {
  const maxLength = 80;

  if (message.length <= maxLength) {
    return message;
  }

  return `${message.substring(0, maxLength - 3)}...`;
};

export const getConversationStatusColor = (status: ConversationStatus): string => {
  const colors: Record<ConversationStatus, string> = {
    active: 'green',
    archived: 'yellow',
    closed: 'gray',
  };

  return colors[status] ?? 'gray';
};

export const getChannelIcon = (channel: ChannelType): string => {
  const icons: Record<ChannelType, string> = {
    internal: 'message-circle',
    website: 'globe',
    whatsapp: 'phone',
    email: 'mail',
  };

  return icons[channel] ?? 'message-circle';
};
