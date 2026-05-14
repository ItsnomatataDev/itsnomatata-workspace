import { supabase } from "../../../lib/supabase/client";
import {
  createOrganizationInvitation,
  getOrganizationRoles,
} from "../../platform-admin/services/platformAdminService";
import type { OrganizationInvitation, OrganizationRole } from "../../platform-admin/types/platformAdmin";

export type OrganizationMemberRow = {
  id: string;
  organization_id: string;
  user_id: string;
  role: string;
  status: string;
  joined_at: string | null;
  created_at: string | null;
  profiles?: {
    id: string;
    full_name: string | null;
    email: string | null;
    primary_role: string | null;
    department: string | null;
    account_status: string | null;
  } | null;
};

export async function getOrganizationMembers(
  organizationId: string,
): Promise<OrganizationMemberRow[]> {
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      "id, organization_id, user_id, role, status, joined_at, created_at, profiles:user_id (id, full_name, email, primary_role, department, account_status)",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return ((data ?? []) as unknown as OrganizationMemberRow[]).map((member) => ({
    ...member,
    profiles: Array.isArray(member.profiles)
      ? (member.profiles[0] ?? null)
      : (member.profiles ?? null),
  }));
}

export async function getOrganizationMemberRoles(
  organizationId: string,
): Promise<OrganizationRole[]> {
  return getOrganizationRoles(organizationId);
}

export async function inviteOrganizationMember(params: {
  organizationId: string;
  email: string;
  fullName?: string | null;
  roleKey: string;
}): Promise<OrganizationInvitation> {
  return createOrganizationInvitation({
    organizationId: params.organizationId,
    email: params.email,
    fullName: params.fullName ?? null,
    roleKey: params.roleKey,
  });
}
