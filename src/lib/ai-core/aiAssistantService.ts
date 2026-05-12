
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AIAssistant,
  AssistantListOptions,
  AssistantType,
} from './aiTypes';

type JsonRecord = Record<string, unknown>;

type AssistantListResponse = {
  assistants: AIAssistant[];
  total: number;
  page: number;
  pageSize: number;
};

type CreateAssistantInput = {
  name: string;
  assistantType: AssistantType;
  description?: string | null;
  systemPrompt?: string | null;
  settings?: JsonRecord;
  createdBy: string;
};

type UpdateAssistantInput = Partial<
  Pick<
    AIAssistant,
    | 'name'
    | 'assistant_type'
    | 'description'
    | 'system_prompt'
    | 'enabled'
    | 'settings'
  >
>;


export class AIAssistantService {
  private supabase: SupabaseClient;

  constructor(supabaseUrlOrClient: string | SupabaseClient, supabaseAnonKey?: string) {
    if (typeof supabaseUrlOrClient === 'string') {
      if (!supabaseAnonKey) {
        throw new Error('Supabase anon key is required when initializing AIAssistantService with a URL.');
      }

      this.supabase = createClient(supabaseUrlOrClient, supabaseAnonKey);
    } else {
      this.supabase = supabaseUrlOrClient;
    }
  }


  async getAssistants(
    organizationId: string,
    options: AssistantListOptions = {},
  ): Promise<AssistantListResponse> {
    try {
      const {
        page = 1,
        pageSize = 20,
        assistantType,
        enabled = true,
      } = options;

      let query = this.supabase
        .from('ai_assistants')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (assistantType) {
        query = query.eq('assistant_type', assistantType);
      }

      if (typeof enabled === 'boolean') {
        query = query.eq('enabled', enabled);
      }

      const from = Math.max(page - 1, 0) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw new Error(`Failed to fetch assistants: ${error.message}`);
      }

      return {
        assistants: (data ?? []) as AIAssistant[],
        total: count ?? 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('AIAssistantService.getAssistants error:', error);
      throw error;
    }
  }

  async getAssistant(assistantId: string): Promise<AIAssistant | null> {
    try {
      const { data, error } = await this.supabase
        .from('ai_assistants')
        .select('*')
        .eq('id', assistantId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch assistant: ${error.message}`);
      }

      return (data as AIAssistant | null) ?? null;
    } catch (error) {
      console.error('AIAssistantService.getAssistant error:', error);
      throw error;
    }
  }

  async createAssistant(
    organizationId: string,
    data: CreateAssistantInput,
  ): Promise<AIAssistant> {
    try {
      const { data: assistant, error } = await this.supabase
        .from('ai_assistants')
        .insert({
          organization_id: organizationId,
          name: data.name,
          assistant_type: data.assistantType,
          description: data.description ?? null,
          system_prompt: data.systemPrompt ?? null,
          enabled: true,
          settings: data.settings ?? {},
          created_by: data.createdBy,
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create assistant: ${error.message}`);
      }

      return assistant as AIAssistant;
    } catch (error) {
      console.error('AIAssistantService.createAssistant error:', error);
      throw error;
    }
  }

  async updateAssistant(
    assistantId: string,
    updates: UpdateAssistantInput,
  ): Promise<AIAssistant> {
    try {
      const { data, error } = await this.supabase
        .from('ai_assistants')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', assistantId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update assistant: ${error.message}`);
      }

      return data as AIAssistant;
    } catch (error) {
      console.error('AIAssistantService.updateAssistant error:', error);
      throw error;
    }
  }

  async enableAssistant(assistantId: string): Promise<AIAssistant> {
    return this.updateAssistant(assistantId, { enabled: true });
  }

  async disableAssistant(assistantId: string): Promise<AIAssistant> {
    return this.updateAssistant(assistantId, { enabled: false });
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
      console.error('AIAssistantService.deleteAssistant error:', error);
      throw error;
    }
  }

  async getAssistantsByType(
    organizationId: string,
    assistantType: AssistantType,
  ): Promise<AIAssistant[]> {
    const result = await this.getAssistants(organizationId, {
      assistantType,
      pageSize: 100,
    });

    return result.assistants;
  }

  async getEnabledAssistants(organizationId: string): Promise<AIAssistant[]> {
    const result = await this.getAssistants(organizationId, {
      enabled: true,
      pageSize: 100,
    });

    return result.assistants;
  }

  async getDefaultAssistant(
    organizationId: string,
    assistantType: AssistantType,
  ): Promise<AIAssistant | null> {
    const assistants = await this.getAssistantsByType(organizationId, assistantType);
    return assistants.find((assistant) => assistant.enabled) ?? null;
  }

  async searchAssistants(
    organizationId: string,
    searchTerm: string,
    options: AssistantListOptions = {},
  ): Promise<AssistantListResponse> {
    try {
      const { page = 1, pageSize = 20 } = options;

      let query = this.supabase
        .from('ai_assistants')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (searchTerm.trim()) {
        const term = `%${searchTerm.trim()}%`;
        query = query.or(`name.ilike.${term},description.ilike.${term},system_prompt.ilike.${term}`);
      }

      const from = Math.max(page - 1, 0) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw new Error(`Failed to search assistants: ${error.message}`);
      }

      return {
        assistants: (data ?? []) as AIAssistant[],
        total: count ?? 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('AIAssistantService.searchAssistants error:', error);
      throw error;
    }
  }
}

let defaultAssistantService: AIAssistantService | null = null;

export const getAssistantService = (
  supabaseUrlOrClient?: string | SupabaseClient,
  supabaseAnonKey?: string,
): AIAssistantService => {
  if (!defaultAssistantService && supabaseUrlOrClient) {
    defaultAssistantService = new AIAssistantService(supabaseUrlOrClient, supabaseAnonKey);
  }

  if (!defaultAssistantService) {
    throw new Error('Assistant service not initialized. Provide a Supabase client or Supabase URL and anon key.');
  }

  return defaultAssistantService;
};


export const getAssistantTypeLabel = (type: AssistantType): string => {
  const labels: Record<AssistantType, string> = {
    internal_workspace: 'Internal Workspace',
    website_chat: 'Website Chat',
    whatsapp_support: 'WhatsApp Support',
    admin_command_center: 'Admin Command Center',
    client_company_assistant: 'Client Company Assistant',
  };

  return labels[type] ?? type;
};

export const getAssistantTypeIcon = (type: AssistantType): string => {
  const icons: Record<AssistantType, string> = {
    internal_workspace: 'cpu',
    website_chat: 'globe',
    whatsapp_support: 'phone',
    admin_command_center: 'shield',
    client_company_assistant: 'building',
  };

  return icons[type] ?? 'cpu';
};

export const formatAssistantSettings = (settings: JsonRecord): string => {
  return JSON.stringify(settings ?? {}, null, 2);
};

export const parseAssistantSettings = (settingsString: string): JsonRecord => {
  try {
    const parsed = JSON.parse(settingsString);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
