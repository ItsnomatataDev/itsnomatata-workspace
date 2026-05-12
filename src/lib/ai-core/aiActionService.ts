
import { createClient } from '@supabase/supabase-js';
import type { 
  AIAction,
  AIActionApproval,
  ActionStatus,
  ApprovalStatus
} from './aiTypes';


export class AIActionService {
  private supabase: ReturnType<typeof createClient>;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

 
  async getActions(
    organizationId: string,
    options: {
      page?: number;
      pageSize?: number;
      status?: ActionStatus;
      requiresApproval?: boolean;
    } = {}
  ): Promise<{ actions: AIAction[]; total: number; page: number; pageSize: number }> {
    try {
      const {
        page = 1,
        pageSize = 20,
        status,
        requiresApproval,
      } = options;

      let query = this.supabase
        .from('ai_actions')
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
        .order('created_at', { ascending: false });

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }
      if (typeof requiresApproval === 'boolean') {
        query = query.eq('requires_approval', requiresApproval);
      }

      const { count } = await this.supabase
        .from('ai_actions')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

   
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: actions, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch actions: ${error.message}`);
      }

      return {
        actions: actions || [],
        total: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Action Service Error:', error);
      throw error;
    }
  }

  async getAction(actionId: string): Promise<AIAction | null> {
    try {
      const { data: action, error } = await this.supabase
        .from('ai_actions')
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
        .eq('id', actionId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch action: ${error.message}`);
      }

      return action;
    } catch (error) {
      console.error('Action Service Error:', error);
      throw error;
    }
  }

  async createAction(
    organizationId: string,
    data: {
      actionType: string;
      requestedBy: string;
      conversationId?: string;
      targetType?: string;
      targetId?: string;
      payload: Record<string, unknown>;
      requiresApproval?: boolean;
    }
  ): Promise<AIAction> {
    try {
      const { data: action, error } = await (this.supabase
        .from('ai_actions')
        .insert({
          organization_id: organizationId,
          action_type: data.actionType,
          requested_by: data.requestedBy,
          conversation_id: data.conversationId || null,
          target_type: data.targetType || null,
          target_id: data.targetId || null,
          payload: data.payload,
          status: 'pending',
          requires_approval: data.requiresApproval || false,
        } as any)
        .select()
        .single());

      if (error) {
        throw new Error(`Failed to create action: ${error.message}`);
      }

      return action!;
    } catch (error) {
      console.error('Action Service Error:', error);
      throw error;
    }
  }

  async updateAction(
    actionId: string,
    updates: Partial<AIAction>
  ): Promise<AIAction> {
    try {
      const { data: action, error } = await (this.supabase
        .from('ai_actions')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', actionId)
        .select()
        .single());

      if (error) {
        throw new Error(`Failed to update action: ${error.message}`);
      }

      return action!;
    } catch (error) {
      console.error('Action Service Error:', error);
      throw error;
    }
  }

  async executeAction(actionId: string, executedBy: string): Promise<void> {
    await this.updateAction(actionId, { 
      status: 'executed',

      payload: {
        executed_at: new Date().toISOString(),
        executed_by: executedBy,
      } as any,
    });
  }

  async failAction(actionId: string, error: string): Promise<void> {
    await this.updateAction(actionId, { 
      status: 'failed',
      // Add failure metadata
      payload: {
        failed_at: new Date().toISOString(),
        error: error,
      } as any,
    });
  }

  async getApprovals(
    organizationId: string,
    options: {
      page?: number;
      pageSize?: number;
      status?: ApprovalStatus;
    } = {}
  ): Promise<{ approvals: AIActionApproval[]; total: number; page: number; pageSize: number }> {
    try {
      const { page = 1, pageSize = 20, status } = options;

      let query = this.supabase
        .from('ai_action_approvals')
        .select(`
          *,
          ai_actions!inner(
            id,
            action_type,
            payload
          ),
          profiles!inner(
            id,
            full_name,
            primary_role
          ),
          reviewer_profiles!inner(
            id,
            full_name,
            primary_role
          )
        `)
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { count } = await this.supabase
        .from('ai_action_approvals')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId);

   
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data: approvals, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch approvals: ${error.message}`);
      }

      return {
        approvals: approvals || [],
        total: count || 0,
        page,
        pageSize,
      };
    } catch (error) {
      console.error('Approval Service Error:', error);
      throw error;
    }
  }

  async getApproval(approvalId: string): Promise<AIActionApproval | null> {
    try {
      const { data: approval, error } = await this.supabase
        .from('ai_action_approvals')
        .select(`
          *,
          ai_actions!inner(
            id,
            action_type,
            payload
          ),
          profiles!inner(
            id,
            full_name,
            primary_role
          ),
          reviewer_profiles!inner(
            id,
            full_name,
            primary_role
          )
        `)
        .eq('id', approvalId)
        .single();

      if (error) {
        throw new Error(`Failed to fetch approval: ${error.message}`);
      }

      return approval;
    } catch (error) {
      console.error('Approval Service Error:', error);
      throw error;
    }
  }

  async approveAction(
    approvalId: string,
    approvedBy: string,
    notes?: string
  ): Promise<AIActionApproval> {
    try {
      const { data: approval, error } = await (this.supabase
        .from('ai_action_approvals')
        .update({
          approved_by: approvedBy,
          status: 'approved',
          notes: notes || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', approvalId)
        .select()
        .single());

      if (error) {
        throw new Error(`Failed to approve action: ${error.message}`);
      }

   
      if (approval?.action_id) {
        await this.updateAction(approval.action_id, { 
          status: 'approved',
        });
      }

      return approval!;
    } catch (error) {
      console.error('Approval Service Error:', error);
      throw error;
    }
  }

  async rejectAction(
    approvalId: string,
    approvedBy: string,
    notes?: string
  ): Promise<AIActionApproval> {
    try {

      const { data: approval, error } = await (this.supabase
        .from('ai_action_approvals')
        .update({
          approved_by: approvedBy,
          status: 'rejected',
          notes: notes || null,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', approvalId)
        .select()
        .single());

      if (error) {
        throw new Error(`Failed to reject action: ${error.message}`);
      }

      // Then update the action status
      if (approval?.action_id) {
        await this.updateAction(approval.action_id, { 
          status: 'rejected',
        });
      }

      return approval!;
    } catch (error) {
      console.error('Approval Service Error:', error);
      throw error;
    }
  }

  // ============================================================
  // Utility Methods
  // ============================================================

  async getPendingActions(organizationId: string): Promise<AIAction[]> {
    const result = await this.getActions(organizationId, {
      status: 'pending',
      pageSize: 100, // Get all pending
    });

    return result.actions;
  }

  async getActionsRequiringApproval(organizationId: string): Promise<AIAction[]> {
    const result = await this.getActions(organizationId, {
      requiresApproval: true,
      pageSize: 100, // Get all requiring approval
    });

    return result.actions;
  }

  async getPendingApprovals(organizationId: string): Promise<AIActionApproval[]> {
    const result = await this.getApprovals(organizationId, {
      status: 'pending',
      pageSize: 100, // Get all pending
    });

    return result.approvals;
  }

  async getActionsByType(
    organizationId: string,
    actionType: string
  ): Promise<AIAction[]> {
    const result = await this.getActions(organizationId, {
      pageSize: 100,
    });

    return result.actions.filter(action => action.action_type === actionType);
  }

  async getActionsByUser(
    organizationId: string,
    requestedBy: string
  ): Promise<AIAction[]> {
    const result = await this.getActions(organizationId, {
      pageSize: 100,
    });

    return result.actions.filter(action => action.requested_by === requestedBy);
  }
}

// ============================================================
// Default Instance
// ============================================================

let defaultActionService: AIActionService | null = null;

export const getActionService = (
  supabaseUrl?: string,
  supabaseAnonKey?: string
): AIActionService => {
  if (!defaultActionService && supabaseUrl && supabaseAnonKey) {
    defaultActionService = new AIActionService(supabaseUrl, supabaseAnonKey);
  }
  
  if (!defaultActionService) {
    throw new Error('Action service not initialized. Provide Supabase URL and anon key.');
  }
  
  return defaultActionService;
};

// ============================================================
// Utility Functions
// ============================================================

export const getActionStatusColor = (status: ActionStatus): string => {
  const colors = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
    executed: 'blue',
    failed: 'red',
  };
  
  return colors[status] || 'gray';
};

export const getApprovalStatusColor = (status: ApprovalStatus): string => {
  const colors = {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
  };
  
  return colors[status] || 'gray';
};

export const getActionTypeLabel = (actionType: string): string => {
  // Convert snake_case to Title Case
  return actionType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export const isActionExecutable = (action: AIAction, userRole?: string): boolean => {
  // Actions can be executed if they don't require approval
  // or if the user is an admin/manager
  if (!action.requires_approval) {
    return true;
  }
  
  // For now, we'll assume admins/managers can execute
  // In a real implementation, you'd check user permissions
  return ['admin', 'manager'].includes(userRole || '');
};

export const formatActionPayload = (payload: Record<string, unknown>): string => {
  return JSON.stringify(payload, null, 2);
};

export const parseActionPayload = (payloadString: string): Record<string, unknown> => {
  try {
    return JSON.parse(payloadString);
  } catch {
    return {};
  }
};
