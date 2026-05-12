import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AIAction,
  AIActionApproval,
  ActionStatus,
  ApprovalStatus,
} from './aiTypes';

type JsonRecord = Record<string, unknown>;

type PaginatedResult<T> = {
  total: number;
  page: number;
  pageSize: number;
} & T;

type GetActionsOptions = {
  page?: number;
  pageSize?: number;
  status?: ActionStatus;
  requiresApproval?: boolean;
};

type GetApprovalsOptions = {
  page?: number;
  pageSize?: number;
  status?: ApprovalStatus;
};

type CreateActionInput = {
  actionType: string;
  requestedBy: string;
  conversationId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  payload?: JsonRecord;
  requiresApproval?: boolean;
};

type UpdateActionInput = Partial<
  Pick<
    AIAction,
    | 'conversation_id'
    | 'action_type'
    | 'requested_by'
    | 'target_type'
    | 'target_id'
    | 'payload'
    | 'status'
    | 'requires_approval'
  >
>;

export class AIActionService {
  private supabase: SupabaseClient;

  constructor(supabaseUrlOrClient: string | SupabaseClient, supabaseAnonKey?: string) {
    if (typeof supabaseUrlOrClient === 'string') {
      if (!supabaseAnonKey) {
        throw new Error('Supabase anon key is required when initializing AIActionService with a URL.');
      }

      this.supabase = createClient(supabaseUrlOrClient, supabaseAnonKey);
    } else {
      this.supabase = supabaseUrlOrClient;
    }
  }

  async getActions(
    organizationId: string,
    options: GetActionsOptions = {},
  ): Promise<PaginatedResult<{ actions: AIAction[] }>> {
    try {
      const {
        page = 1,
        pageSize = 20,
        status,
        requiresApproval,
      } = options;

      let query = this.supabase
        .from('ai_actions')
        .select('*', { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      if (typeof requiresApproval === 'boolean') {
        query = query.eq('requires_approval', requiresApproval);
      }

      const from = Math.max(page - 1, 0) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw new Error(`Failed to fetch AI actions: ${error.message}`);
      }

      return {
        actions: (data ?? []) as AIAction[],
        total: count ?? 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('AIActionService.getActions error:', error);
      throw error;
    }
  }

  async getAction(actionId: string): Promise<AIAction | null> {
    try {
      const { data, error } = await this.supabase
        .from('ai_actions')
        .select('*')
        .eq('id', actionId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch AI action: ${error.message}`);
      }

      return (data as AIAction | null) ?? null;
    } catch (error) {
      console.error('AIActionService.getAction error:', error);
      throw error;
    }
  }

  async createAction(
    organizationId: string,
    data: CreateActionInput,
  ): Promise<AIAction> {
    try {
      const { data: action, error } = await this.supabase
        .from('ai_actions')
        .insert({
          organization_id: organizationId,
          action_type: data.actionType,
          requested_by: data.requestedBy,
          conversation_id: data.conversationId ?? null,
          target_type: data.targetType ?? null,
          target_id: data.targetId ?? null,
          payload: data.payload ?? {},
          status: 'pending',
          requires_approval: data.requiresApproval ?? false,
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create AI action: ${error.message}`);
      }

      return action as AIAction;
    } catch (error) {
      console.error('AIActionService.createAction error:', error);
      throw error;
    }
  }

  async updateAction(actionId: string, updates: UpdateActionInput): Promise<AIAction> {
    try {
      const { data, error } = await this.supabase
        .from('ai_actions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', actionId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update AI action: ${error.message}`);
      }

      return data as AIAction;
    } catch (error) {
      console.error('AIActionService.updateAction error:', error);
      throw error;
    }
  }

  async executeAction(actionId: string, executedBy: string): Promise<AIAction> {
    const existingAction = await this.getAction(actionId);

    if (!existingAction) {
      throw new Error('AI action not found.');
    }

    return this.updateAction(actionId, {
      status: 'executed',
      payload: {
        ...(existingAction.payload ?? {}),
        executed_at: new Date().toISOString(),
        executed_by: executedBy,
      } as JsonRecord,
    });
  }

  async failAction(actionId: string, failureMessage: string): Promise<AIAction> {
    const existingAction = await this.getAction(actionId);

    if (!existingAction) {
      throw new Error('AI action not found.');
    }

    return this.updateAction(actionId, {
      status: 'failed',
      payload: {
        ...(existingAction.payload ?? {}),
        failed_at: new Date().toISOString(),
        error: failureMessage,
      } as JsonRecord,
    });
  }

  async getApprovals(
    organizationId: string,
    options: GetApprovalsOptions = {},
  ): Promise<PaginatedResult<{ approvals: AIActionApproval[] }>> {
    try {
      const { page = 1, pageSize = 20, status } = options;

      let query = this.supabase
        .from('ai_action_approvals')
        .select(
          `
          *,
          ai_actions (
            id,
            organization_id,
            conversation_id,
            action_type,
            requested_by,
            target_type,
            target_id,
            payload,
            status,
            requires_approval,
            created_at,
            updated_at
          )
        `,
          { count: 'exact' },
        )
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const from = Math.max(page - 1, 0) * pageSize;
      const to = from + pageSize - 1;

      const { data, error, count } = await query.range(from, to);

      if (error) {
        throw new Error(`Failed to fetch AI approvals: ${error.message}`);
      }

      return {
        approvals: (data ?? []) as AIActionApproval[],
        total: count ?? 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('AIActionService.getApprovals error:', error);
      throw error;
    }
  }

  async getApproval(approvalId: string): Promise<AIActionApproval | null> {
    try {
      const { data, error } = await this.supabase
        .from('ai_action_approvals')
        .select(
          `
          *,
          ai_actions (
            id,
            organization_id,
            conversation_id,
            action_type,
            requested_by,
            target_type,
            target_id,
            payload,
            status,
            requires_approval,
            created_at,
            updated_at
          )
        `,
        )
        .eq('id', approvalId)
        .maybeSingle();

      if (error) {
        throw new Error(`Failed to fetch AI approval: ${error.message}`);
      }

      return (data as AIActionApproval | null) ?? null;
    } catch (error) {
      console.error('AIActionService.getApproval error:', error);
      throw error;
    }
  }

  async approveAction(
    approvalId: string,
    approvedBy: string,
    notes?: string,
  ): Promise<AIActionApproval> {
    try {
      const { data: approval, error } = await this.supabase
        .from('ai_action_approvals')
        .update({
          approved_by: approvedBy,
          status: 'approved',
          notes: notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to approve AI action: ${error.message}`);
      }

      const typedApproval = approval as AIActionApproval;

      if (typedApproval.action_id) {
        await this.updateAction(typedApproval.action_id, {
          status: 'approved',
        });
      }

      return typedApproval;
    } catch (error) {
      console.error('AIActionService.approveAction error:', error);
      throw error;
    }
  }

  async rejectAction(
    approvalId: string,
    approvedBy: string,
    notes?: string,
  ): Promise<AIActionApproval> {
    try {
      const { data: approval, error } = await this.supabase
        .from('ai_action_approvals')
        .update({
          approved_by: approvedBy,
          status: 'rejected',
          notes: notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', approvalId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to reject AI action: ${error.message}`);
      }

      const typedApproval = approval as AIActionApproval;

      if (typedApproval.action_id) {
        await this.updateAction(typedApproval.action_id, {
          status: 'rejected',
        });
      }

      return typedApproval;
    } catch (error) {
      console.error('AIActionService.rejectAction error:', error);
      throw error;
    }
  }

  async getPendingActions(organizationId: string): Promise<AIAction[]> {
    const result = await this.getActions(organizationId, {
      status: 'pending',
      pageSize: 100,
    });

    return result.actions;
  }

  async getActionsRequiringApproval(organizationId: string): Promise<AIAction[]> {
    const result = await this.getActions(organizationId, {
      requiresApproval: true,
      pageSize: 100,
    });

    return result.actions;
  }

  async getPendingApprovals(organizationId: string): Promise<AIActionApproval[]> {
    const result = await this.getApprovals(organizationId, {
      status: 'pending',
      pageSize: 100,
    });

    return result.approvals;
  }

  async getActionsByType(
    organizationId: string,
    actionType: string,
  ): Promise<AIAction[]> {
    const result = await this.getActions(organizationId, {
      pageSize: 100,
    });

    return result.actions.filter((action) => action.action_type === actionType);
  }

  async getActionsByUser(
    organizationId: string,
    requestedBy: string,
  ): Promise<AIAction[]> {
    const result = await this.getActions(organizationId, {
      pageSize: 100,
    });

    return result.actions.filter((action) => action.requested_by === requestedBy);
  }
}

// ============================================================
// Default Instance
// ============================================================

let defaultActionService: AIActionService | null = null;

export const getActionService = (
  supabaseUrlOrClient?: string | SupabaseClient,
  supabaseAnonKey?: string,
): AIActionService => {
  if (!defaultActionService && supabaseUrlOrClient) {
    defaultActionService = new AIActionService(supabaseUrlOrClient, supabaseAnonKey);
  }

  if (!defaultActionService) {
    throw new Error('Action service not initialized. Provide a Supabase client or Supabase URL and anon key.');
  }

  return defaultActionService;
};

// ============================================================
// Utility Functions
// ============================================================

export const getActionStatusColor = (status: ActionStatus): string => {
  const colors: Record<ActionStatus, string> = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
    executed: 'blue',
    failed: 'red',
  };

  return colors[status] ?? 'gray';
};

export const getApprovalStatusColor = (status: ApprovalStatus): string => {
  const colors: Record<ApprovalStatus, string> = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
  };

  return colors[status] ?? 'gray';
};

export const getActionTypeLabel = (actionType: string): string => {
  return actionType
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const isActionExecutable = (action: AIAction, userRole?: string): boolean => {
  if (!action.requires_approval) {
    return true;
  }

  return ['admin', 'manager'].includes(userRole ?? '');
};

export const formatActionPayload = (payload: JsonRecord): string => {
  return JSON.stringify(payload ?? {}, null, 2);
};

export const parseActionPayload = (payloadString: string): JsonRecord => {
  try {
    const parsed = JSON.parse(payloadString);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
};
