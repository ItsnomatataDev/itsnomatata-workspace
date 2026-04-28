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
  return data as (LeaveBalanceAuditRow & { modifier: { full_name: string; email: string } | null })[];
}
