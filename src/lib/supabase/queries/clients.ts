import { supabase } from "../client";

export type ClientStatus = "lead" | "active" | "paused" | "closed";

export interface Client {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  industry: string | null;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  brand_voice: string | null;
  status: ClientStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const getClients = async (
  organizationId?: string,
): Promise<Client[]> => {
  let query = supabase
    .from("clients")
    .select("*")
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as Client[];
};

export const getClientById = async (
  clientId: string,
): Promise<Client | null> => {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error) throw error;
  return data as Client;
};

export const getMyClients = async (
  userId: string,
  organizationId?: string,
): Promise<Client[]> => {
  const { data: taskRows, error: taskError } = await supabase
    .from("tasks")
    .select("client_id")
    .eq("assigned_to", userId)
    .not("client_id", "is", null);

  if (taskError) throw taskError;

  const uniqueClientIds = [
    ...new Set((taskRows ?? []).map((row) => row.client_id).filter(Boolean)),
  ] as string[];

  if (uniqueClientIds.length === 0) return [];

  let query = supabase
    .from("clients")
    .select("*")
    .in("id", uniqueClientIds)
    .order("updated_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data ?? []) as Client[];
};
