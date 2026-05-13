import { supabase } from "../../../lib/supabase/client";

export type LeaveBalanceAuditRow = {
  id: string;
  organization_id: string;
  user_id: string;
  modified_by: string;
  previous_total: number;
  new_total: number;
  previous_remaining: number;
  new_remaining: number;
  reason: string;
  created_at: string;
};

export type LeaveBalanceEmployeeRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  leave_days_total: number;
  leave_days_remaining: number;
};

export type LeaveBalanceAuditHistoryRow = LeaveBalanceAuditRow & {
  employee: { full_name: string | null; email: string | null } | null;
  modifier: { full_name: string | null; email: string | null } | null;
};

export async function recordBalanceChange(params: {
  organizationId: string;
  userId: string;
  modifiedBy: string;
  previousTotal: number;
  newTotal: number;
  previousRemaining: number;
  newRemaining: number;
  reason: string;
}) {
  const { data, error } = await supabase
    .from("leave_balance_audit")
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      modified_by: params.modifiedBy,
      previous_total: params.previousTotal,
      new_total: params.newTotal,
      previous_remaining: params.previousRemaining,
      new_remaining: params.newRemaining,
      reason: params.reason,
    })
    .select()
    .single();

  if (error) throw error;
  return data as LeaveBalanceAuditRow;
}

export async function getLeaveBalanceEmployees(organizationId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, leave_days_total, leave_days_remaining")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (error) throw error;

  return (data ?? []).map((employee) => {
    const total = Number(employee.leave_days_total ?? 22);
    return {
      id: employee.id,
      full_name: employee.full_name ?? null,
      email: employee.email ?? null,
      primary_role: employee.primary_role ?? null,
      leave_days_total: total,
      leave_days_remaining: Number(employee.leave_days_remaining ?? total),
    };
  }) as LeaveBalanceEmployeeRow[];
}

export async function getRecentBalanceHistory(params: {
  organizationId: string;
  limit?: number;
}) {
  const { data, error } = await supabase
    .from("leave_balance_audit")
    .select(`
      *,
      employee:profiles!leave_balance_audit_user_id_fkey (
        full_name,
        email
      ),
      modifier:profiles!leave_balance_audit_modified_by_fkey (
        full_name,
        email
      )
    `)
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false })
    .limit(params.limit || 8);

  if (error) throw error;
  return (data ?? []) as LeaveBalanceAuditHistoryRow[];
}

export async function getBalanceHistory(params: {
  organizationId: string;
  userId: string;
  limit?: number;
}) {
  const { data, error } = await supabase
    .from("leave_balance_audit")
    .select(`
      *,
      modifier:profiles!leave_balance_audit_modified_by_fkey (
        full_name,
        email
      )
    `)
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .order("created_at", { ascending: false })
    .limit(params.limit || 50);

  if (error) throw error;
  return data as (LeaveBalanceAuditRow & { modifier: { full_name: string | null; email: string | null } | null })[];
}
