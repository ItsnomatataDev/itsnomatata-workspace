// ============================================================
// AI Core Layer - Main Export File
// ============================================================

// Export all types
export type {
  AIAssistant,
  AIConversation,
  AIMessage,
  AIKnowledgeSource,
  AIKnowledgeChunk,
  AITool,
  AIAction,
  AIActionApproval,
  AIAuditLog,
  AICustomerProfile,
  AIChannelIntegration,
  AssistantType,
  ChannelType,
  ConversationStatus,
  SenderType,
  MessageRole,
  KnowledgeSourceType,
  ActionStatus,
  ApprovalStatus,
  ActorType,
  AIChatRequest,
  AIChatResponse,
  AIConversationListResponse,
  AIMessagesResponse,
  ConversationListOptions,
  MessageListOptions,
  AssistantListOptions,
  KnowledgeListOptions,
} from './aiTypes';

// Export all services
export { AICoreService, aiCoreService } from './aiCoreService';
export { AIConversationService, getConversationService } from './aiConversationService';
export { AIAssistantService, getAssistantService } from './aiAssistantService';
export { AIKnowledgeService, getKnowledgeService } from './aiKnowledgeService';
export { AIActionService, getActionService } from './aiActionService';

// Export utility functions
export {
  createChatMessage,
  createChatMessageWithContext,
  isChatError,
  getChatErrorMessage,
} from './aiCoreService';

export {
  formatConversationTitle,
  getConversationStatusColor,
  getChannelIcon,
} from './aiConversationService';

export {
  getAssistantTypeLabel,
  getAssistantTypeIcon,
  formatAssistantSettings,
  parseAssistantSettings,
} from './aiAssistantService';

export {
  getSourceTypeLabel,
  getSourceTypeIcon,
  formatKnowledgeSourceTitle,
  truncateText,
} from './aiKnowledgeService';

export {
  getActionStatusColor,
  getApprovalStatusColor,
  getActionTypeLabel,
  isActionExecutable,
  formatActionPayload,
  parseActionPayload,
} from './aiActionService';

// ============================================================
// AI Core Layer Information
// ============================================================

/**
 * AI Core Layer - Multi-Tenant AI Operating System
 * 
 * This layer provides the foundation for:
 * - Internal AI assistant
 * - AI workspace
 * - Website AI chat
 * - WhatsApp AI
 * - Automation AI
 * - Customer support AI
 * - Company knowledge AI
 * - Future autonomous AI systems
 * 
 * Architecture Features:
 * - Organization-aware security
 * - Multi-channel support (internal, website, whatsapp, email)
 * - Knowledge management with vector search
 * - Action approval system
 * - Comprehensive audit logging
 * - Scalable multi-tenant design
 * 
 * Usage:
 * 
 * ```typescript
 * import { aiCoreService } from '@/lib/ai-core';
 * 
 * const response = await aiCoreService.sendMessage({
 *   message: "Hello, how can I help you?",
 *   channel: 'internal',
 *   context: {
 *     userId: user.id,
 *     organizationId: user.organizationId,
 *     role: user.role,
 *   }
 * });
 * ```
 */
