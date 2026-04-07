import { supabase } from "../client";

export type TaskAssignableUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  department: string | null;
};

export const searchTaskAssignableUsers = async ({
  organizationId,
  search,
}: {
  organizationId: string;
  search: string;
}): Promise<TaskAssignableUser[]> => {
  const trimmed = search.trim();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, department")
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true })
    .limit(12);

  if (trimmed) {
    query = query.or(`full_name.ilike.%${trimmed}%,email.ilike.%${trimmed}%`);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as TaskAssignableUser[];
};
