import { supabase } from "../client";
import type { Client, ClientStatus } from "../queries/clients";

export interface CreateClientInput {
  organization_id: string;
  name: string;
  slug: string;
  industry?: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  brand_voice?: string;
  status?: ClientStatus;
  created_by?: string;
}

export interface UpdateClientInput {
  name?: string;
  slug?: string;
  industry?: string;
  description?: string;
  logo_url?: string;
  website_url?: string;
  brand_voice?: string;
  status?: ClientStatus;
}

export const createClient = async (
  payload: CreateClientInput,
): Promise<Client> => {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      organization_id: payload.organization_id,
      name: payload.name,
      slug: payload.slug,
      industry: payload.industry ?? null,
      description: payload.description ?? null,
      logo_url: payload.logo_url ?? null,
      website_url: payload.website_url ?? null,
      brand_voice: payload.brand_voice ?? null,
      status: payload.status ?? "active",
      created_by: payload.created_by ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data as Client;
};

export const updateClient = async (
  clientId: string,
  payload: UpdateClientInput,
): Promise<Client> => {
  const { data, error } = await supabase
    .from("clients")
    .update(payload)
    .eq("id", clientId)
    .select("*")
    .single();

  if (error) throw error;
  return data as Client;
};

export const deleteClient = async (clientId: string): Promise<void> => {
  const { error } = await supabase.from("clients").delete().eq("id", clientId);

  if (error) throw error;
};
