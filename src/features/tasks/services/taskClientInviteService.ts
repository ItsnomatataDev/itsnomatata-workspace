import { supabase } from "../../../lib/supabase/client";

export interface TaskClientInviteItem {
  id: string;
  task_id: string;
  organization_id: string;
  client_id: string | null;
  client_contact_id: string | null;
  invited_email: string | null;
  invited_name: string | null;
  can_view: boolean;
  can_comment: boolean;
  can_review_submissions: boolean;
  can_approve: boolean;
  invited_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientLookupItem {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
}

export interface InviteClientToTaskInput {
  taskId: string;
  organizationId: string;
  clientId?: string | null;
  clientContactId?: string | null;
  invitedEmail?: string | null;
  invitedName?: string | null;
  invitedBy?: string | null;
  canView?: boolean;
  canComment?: boolean;
  canReviewSubmissions?: boolean;
  canApprove?: boolean;
}

const CLIENT_INVITE_SELECT = `
  id,
  task_id,
  organization_id,
  client_id,
  client_contact_id,
  invited_email,
  invited_name,
  can_view,
  can_comment,
  can_review_submissions,
  can_approve,
  invited_by,
  created_at,
  updated_at
`;

export async function searchClients(params: {
  organizationId: string;
  search: string;
  limit?: number;
}): Promise<ClientLookupItem[]> {
  const { organizationId, search, limit = 10 } = params;

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  const trimmed = search.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from("clients")
    .select("id, name, email, phone")
    .eq("organization_id", organizationId)
    .or(`name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`)
    .limit(limit);

  if (error) {
    throw new Error(`Failed to search clients: ${error.message}`);
  }

  return (data ?? []) as ClientLookupItem[];
}

export async function getTaskClientInvites(
  taskId: string,
): Promise<TaskClientInviteItem[]> {
  if (!taskId) {
    throw new Error("taskId is required");
  }

  const { data, error } = await supabase
    .from("task_client_invites")
    .select(CLIENT_INVITE_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load task client invites: ${error.message}`);
  }

  return (data ?? []) as TaskClientInviteItem[];
}

export async function inviteClientToTask(
  input: InviteClientToTaskInput,
): Promise<TaskClientInviteItem> {
  if (!input.taskId) {
    throw new Error("taskId is required");
  }

  if (!input.organizationId) {
    throw new Error("organizationId is required");
  }

  if (!input.clientId && !input.clientContactId && !input.invitedEmail) {
    throw new Error(
      "Either clientId, clientContactId, or invitedEmail is required.",
    );
  }

  const payload = {
    task_id: input.taskId,
    organization_id: input.organizationId,
    client_id: input.clientId ?? null,
    client_contact_id: input.clientContactId ?? null,
    invited_email: input.invitedEmail ?? null,
    invited_name: input.invitedName ?? null,
    invited_by: input.invitedBy ?? null,
    can_view: input.canView ?? true,
    can_comment: input.canComment ?? true,
    can_review_submissions: input.canReviewSubmissions ?? true,
    can_approve: input.canApprove ?? false,
  };

  const { data, error } = await supabase
    .from("task_client_invites")
    .insert(payload)
    .select(CLIENT_INVITE_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to invite client to task: ${error.message}`);
  }

  return data as TaskClientInviteItem;
}

export async function removeTaskClientInvite(inviteId: string): Promise<void> {
  if (!inviteId) {
    throw new Error("inviteId is required");
  }

  const { error } = await supabase
    .from("task_client_invites")
    .delete()
    .eq("id", inviteId);

  if (error) {
    throw new Error(`Failed to remove client invite: ${error.message}`);
  }
}