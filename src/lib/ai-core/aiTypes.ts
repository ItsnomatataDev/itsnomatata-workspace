export interface AIAssistant {
  id: string;
  organization_id: string;
  name: string;
  assistant_type: AssistantType;
  description?: string;
  system_prompt?: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AIConversation {
  id: string;
  organization_id: string;
  user_id?: string;
  customer_id?: string;
  assistant_id?: string;
  channel: ChannelType;
  title: string;
  status: ConversationStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AIMessage {
  id: string;
  conversation_id: string;
  organization_id: string;
  sender_type: SenderType;
  sender_id?: string;
  content: string;
  role: MessageRole;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AIKnowledgeSource {
  id: string;
  organization_id: string;
  title: string;
  source_type: KnowledgeSourceType;
  file_url?: string;
  raw_text?: string;
  metadata: Record<string, unknown>;
  uploaded_by: string;
  created_at: string;
}

export interface AIKnowledgeChunk {
  id: string;
  source_id: string;
  organization_id: string;
  chunk_text: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AITool {
  id: string;
  organization_id?: string;
  name: string;
  tool_key: string;
  description?: string;
  enabled: boolean;
  settings: Record<string, unknown>;
  created_at: string;
}

export interface AIAction {
  id: string;
  organization_id: string;
  conversation_id?: string;
  action_type: string;
  requested_by: string;
  target_type?: string;
  target_id?: string;
  payload: Record<string, unknown>;
  status: ActionStatus;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
}

export interface AIActionApproval {
  id: string;
  action_id: string;
  organization_id: string;
  approved_by?: string;
  status: ApprovalStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AIAuditLog {
  id: string;
  organization_id: string;
  actor_id?: string;
  actor_type: ActorType;
  event_type: string;
  reference_type?: string;
  reference_id?: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export interface AICustomerProfile {
  id: string;
  organization_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  company?: string;
  preferences: Record<string, unknown>;
  sentiment_score?: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AIChannelIntegration {
  id: string;
  organization_id: string;
  channel_type: ChannelType;
  provider: string;
  configuration: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}


export type AssistantType = 
  | 'internal_workspace'
  | 'website_chat'
  | 'whatsapp_support'
  | 'admin_command_center'
  | 'client_company_assistant';

export type ChannelType = 
  | 'internal'
  | 'website'
  | 'whatsapp'
  | 'email';

export type ConversationStatus = 
  | 'active'
  | 'archived'
  | 'closed';

export type SenderType = 
  | 'employee'
  | 'customer'
  | 'ai';

export type MessageRole = 
  | 'user'
  | 'assistant'
  | 'system'
  | 'tool';

export type KnowledgeSourceType = 
  | 'document'
  | 'faq'
  | 'website'
  | 'policy'
  | 'sop'
  | 'support_article';

export type ActionStatus = 
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'executed'
  | 'failed';

export type ApprovalStatus = 
  | 'pending'
  | 'approved'
  | 'rejected';

export type ActorType = 
  | 'employee'
  | 'customer'
  | 'ai'
  | 'system';

export interface AIChatRequest {
  assistantId?: string;
  message: string;
  conversationId?: string;
  customerId?: string;
  channel: ChannelType;
  context?: {
    userId?: string;
    organizationId?: string;
    role?: string;
    fullName?: string;
    department?: string;
    currentModule?: string;
    currentRoute?: string;
    timezone?: string;
    metadata?: Record<string, unknown>;
  };
  attachments?: Array<{
    name?: string;
    type?: string;
    url?: string;
    mimeType?: string;
    textContent?: string;
  }>;
}

export interface AIChatResponse {
  success: boolean;
  conversationId?: string;
  assistantId?: string;
  assistantName?: string;
  assistantType?: AssistantType;
  message?: string;
  metadata?: {
    model?: string;
    knowledge_sources_used?: number;
    organization_context?: boolean;
  };
  error?: string;
}

export interface AIConversationListResponse {
  conversations: AIConversation[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AIMessagesResponse {
  messages: AIMessage[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ConversationListOptions {
  page?: number;
  pageSize?: number;
  status?: ConversationStatus;
  channel?: ChannelType;
  assistantId?: string;
}

export interface MessageListOptions {
  page?: number;
  pageSize?: number;
  conversationId?: string;
}

export interface AssistantListOptions {
  page?: number;
  pageSize?: number;
  assistantType?: AssistantType;
  enabled?: boolean;
}

export interface KnowledgeListOptions {
  page?: number;
  pageSize?: number;
  sourceType?: KnowledgeSourceType;
  search?: string;
}
