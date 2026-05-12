// ============================================================
// AI Assistant Service - Assistant Management
// ============================================================

import { createClient } from '@supabase/supabase-js';
import type { 
  AIAssistant,
  AssistantListOptions,
  AssistantType
} from './aiTypes';

// ============================================================
// Assistant Service Class
// ============================================================

export class AIAssistantService {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  // ============================================================
  // Assistant Management
  // ============================================================

  async getAssistants(
    organizationId: string,
    options: AssistantListOptions = {}
  ): Promise<{ assistants: AIAssistant[]; total: number; page: number; pageSize: number }> {
    try {
      const {
        page = 1,
        pageSize = 20,
        assistantType,
        enabled = true,
      } = options;

      let query = this.supabase
        .from('ai_assistants')
        .select(`
          *,
          profiles!inner(
            id,
            full_name,
            primary_role
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (assistantType) {
        query = query.eq('assistant_type', assistantType);
      }
      if (typeof enabled === 'boolean') {
        query = query.eq('enabled', enabled);
      }

      // Get total count
      const { count } = await this.supabase
        .from('ai_assistants')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

      // Apply pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: assistants, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch assistants: ${error.message}`);
      }

      return {
        assistants: assistants || [],
        total: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Assistant Service Error:', error);
      throw error;
    }
  }

  async getAssistant(assistantId: string): Promise<AIAssistant | null> {
    try {
      const { data: assistant, error } = await this.supabase
        .from('ai_assistants')
        .select(`
          *,
          profiles!inner(
            id,
            full_name,
            primary_role
          )
        `)
        .eq('id', assistantId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch assistant: ${error.message}`);
      }

      return assistant;
    } catch (error) {
      console.error('Assistant Service Error:', error);
      throw error;
    }
  }

  async createAssistant(
    organizationId: string,
    data: {
      name: string;
      assistantType: AssistantType;
      description?: string;
      systemPrompt?: string;
      settings?: Record<string, unknown>;
      createdBy: string;
    }
  ): Promise<AIAssistant> {
    try {
      const { data: assistant, error } = await (this.supabase
        .from('ai_assistants')
        .insert({
          organization_id: organizationId,
          name: data.name,
          assistant_type: data.assistantType,
          description: data.description || null,
          system_prompt: data.systemPrompt || null,
          enabled: true,
          settings: data.settings || {},
          created_by: data.createdBy,
        } as any)
        .select()
        .single());

      if (error) {
        throw new Error(`Failed to create assistant: ${error.message}`);
      }

      return assistant!;
    } catch (error) {
      console.error('Assistant Service Error:', error);
      throw error;
    }
  }

  async updateAssistant(
    assistantId: string,
    updates: Partial<AIAssistant>
  ): Promise<AIAssistant> {
    try {
      const { data: assistant, error } = await (this.supabase
        .from('ai_assistants')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', assistantId)
        .select()
        .single());

      if (error) {
        throw new Error(`Failed to update assistant: ${error.message}`);
      }

      return assistant!;
    } catch (error) {
      console.error('Assistant Service Error:', error);
      throw error;
    }
  }

  async enableAssistant(assistantId: string): Promise<void> {
    await this.updateAssistant(assistantId, { enabled: true });
  }

  async disableAssistant(assistantId: string): Promise<void> {
    await this.updateAssistant(assistantId, { enabled: false });
  }

  async deleteAssistant(assistantId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ai_assistants')
        .delete()
        .eq('id', assistantId);

      if (error) {
        throw new Error(`Failed to delete assistant: ${error.message}`);
      }
    } catch (error) {
      console.error('Assistant Service Error:', error);
      throw error;
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  async getAssistantsByType(
    organizationId: string,
    assistantType: AssistantType
  ): Promise<AIAssistant[]> {
    const result = await this.getAssistants(organizationId, {
      assistantType,
      pageSize: 100, // Get all of this type
    });

    return result.assistants;
  }

  async getEnabledAssistants(
    organizationId: string
  ): Promise<AIAssistant[]> {
    const result = await this.getAssistants(organizationId, {
      enabled: true,
      pageSize: 100, // Get all enabled
    });

    return result.assistants;
  }

  async getDefaultAssistant(
    organizationId: string,
    assistantType: AssistantType
  ): Promise<AIAssistant | null> {
    const assistants = await this.getAssistantsByType(organizationId, assistantType);
    return assistants.find(assistant => assistant.enabled) || null;
  }

  async searchAssistants(
    organizationId: string,
    searchTerm: string,
    options: AssistantListOptions = {}
  ): Promise<{ assistants: AIAssistant[]; total: number; page: number; pageSize: number }> {
    try {
      const { page = 1, pageSize = 20 } = options;

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: assistants, error, count } = await this.supabase
        .from('ai_assistants')
        .select(`
          *,
          profiles!inner(
            id,
            full_name,
            primary_role
          )
        `, { count: 'exact' })
        .eq('organization_id', organizationId)
        .ilike('name', `%${searchTerm}%`)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        throw new Error(`Failed to search assistants: ${error.message}`);
      }

      return {
        assistants: assistants || [],
        total: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Assistant Service Error:', error);
      throw error;
    }
  }
}

// ============================================================
// Default Instance
// ============================================================

let defaultAssistantService: AIAssistantService | null = null;

export const getAssistantService = (
  supabaseUrl?: string,
  supabaseAnonKey?: string
): AIAssistantService => {
  if (!defaultAssistantService && supabaseUrl && supabaseAnonKey) {
    defaultAssistantService = new AIAssistantService(supabaseUrl, supabaseAnonKey);
  }
  
  if (!defaultAssistantService) {
    throw new Error('Assistant service not initialized. Provide Supabase URL and anon key.');
  }
  
  return defaultAssistantService;
};

// ============================================================
// Utility Functions
// ============================================================

export const getAssistantTypeLabel = (type: AssistantType): string => {
  const labels = {
    internal_workspace: 'Internal Workspace',
    website_chat: 'Website Chat',
    whatsapp_support: 'WhatsApp Support',
    admin_command_center: 'Admin Command Center',
    client_company_assistant: 'Client Company Assistant',
  };
  
  return labels[type] || type;
};

export const getAssistantTypeIcon = (type: AssistantType): string => {
  const icons = {
    internal_workspace: 'cpu',
    website_chat: 'globe',
    whatsapp_support: 'phone',
    admin_command_center: 'shield',
    client_company_assistant: 'building',
  };
  
  return icons[type] || 'cpu';
};

export const formatAssistantSettings = (settings: Record<string, unknown>): string => {
  return JSON.stringify(settings, null, 2);
};

export const parseAssistantSettings = (settingsString: string): Record<string, unknown> => {
  try {
    return JSON.parse(settingsString);
  } catch {
    return {};
  }
};
