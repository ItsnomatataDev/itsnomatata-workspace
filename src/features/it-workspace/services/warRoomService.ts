import { supabase } from "../../../lib/supabase/client";

export type AdminUserAction =
  | "suspend"
  | "reactivate"
  | "soft_delete"
  | "hard_delete_auth_user";

export type AccountAccessRequest = {
  id: string;
  organization_id: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  company: string | null;
  requested_role: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
};

export type IncidentRow = {
  id: string;
  organization_id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "investigating" | "resolved";
  description: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type AuditLogRow = {
  id: string;
  organization_id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type SystemHealthResponse = {
  ok: boolean;
  checkedAt: string;
  organizationId: string;
  counts: Record<string, number>;
  tableChecks: Array<{ table: string; ok: boolean; error: string | null }>;
  warnings: string[];
  environment: Record<string, boolean>;
};

export async function runAdminUserAction(params: {
  action: AdminUserAction;
  targetUserId: string;
  reason?: string | null;
}) {
  const { data, error } = await supabase.functions.invoke("admin-user-actions", {
    body: {
      action: params.action,
      targetUserId: params.targetUserId,
      reason: params.reason ?? undefined,
    },
  });

  if (error) throw error;
  return data as { ok: boolean; action: AdminUserAction; targetUserId: string };
}

export async function getSystemHealth() {
  const { data, error } = await supabase.functions.invoke("system-health", {
    method: "POST",
    body: {},
  });

  if (error) throw error;
  return data as SystemHealthResponse;
}

export async function submitAccountAccessRequest(input: {
  fullName: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  requestedRole?: string | null;
  message?: string | null;
}) {
  const { data, error } = await supabase
    .from("account_access_requests")
    .insert({
      full_name: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || null,
      company: input.company?.trim() || null,
      requested_role: input.requestedRole?.trim() || null,
      message: input.message?.trim() || null,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw error;
  return data as { id: string };
}

export async function getAccountAccessRequests(organizationId: string) {
  const { data, error } = await supabase
    .from("account_access_requests")
    .select("*")
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return (data ?? []) as AccountAccessRequest[];
}

export async function reviewAccountAccessRequest(params: {
  requestId: string;
  organizationId: string;
  reviewerId: string;
  status: "approved" | "rejected";
  notes?: string | null;
}) {
  const { error } = await supabase
    .from("account_access_requests")
    .update({
      organization_id: params.organizationId,
      status: params.status,
      reviewed_by: params.reviewerId,
      reviewed_at: new Date().toISOString(),
      review_notes: params.notes ?? null,
    })
    .eq("id", params.requestId);

  if (error) throw error;

  await supabase.from("admin_audit_logs").insert({
    organization_id: params.organizationId,
    actor_user_id: params.reviewerId,
    action: `account_request_${params.status}`,
    reason: params.notes ?? null,
    metadata: { request_id: params.requestId },
  });

  return true;
}

export async function getIncidents(organizationId: string) {
  const { data, error } = await supabase
    .from("incidents")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return (data ?? []) as IncidentRow[];
}

export async function createIncident(params: {
  organizationId: string;
  title: string;
  severity: IncidentRow["severity"];
  description?: string | null;
  createdBy: string;
}) {
  const { data, error } = await supabase
    .from("incidents")
    .insert({
      organization_id: params.organizationId,
      title: params.title.trim(),
      severity: params.severity,
      description: params.description?.trim() || null,
      created_by: params.createdBy,
      status: "open",
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as IncidentRow;
}

export async function getAuditLogs(organizationId: string) {
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (error) throw error;
  return (data ?? []) as AuditLogRow[];
}
