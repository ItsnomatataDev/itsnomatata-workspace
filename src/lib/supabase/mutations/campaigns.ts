import { supabase } from "../client";
import type { Campaign, CampaignStatus } from "../queries/campaigns";

export interface CreateCampaignInput {
  organization_id: string;
  client_id: string;
  name: string;
  description?: string;
  objective?: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: CampaignStatus;
  budget?: number | null;
  created_by?: string | null;
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string;
  objective?: string;
  start_date?: string | null;
  end_date?: string | null;
  status?: CampaignStatus;
  budget?: number | null;
}

export const createCampaign = async (payload: CreateCampaignInput) => {
  const { data, error } = await supabase
    .from("campaigns")
    .insert({
      organization_id: payload.organization_id,
      client_id: payload.client_id,
      name: payload.name,
      description: payload.description ?? null,
      objective: payload.objective ?? null,
      start_date: payload.start_date ?? null,
      end_date: payload.end_date ?? null,
      status: payload.status ?? "draft",
      budget: payload.budget ?? null,
      created_by: payload.created_by ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("CREATE CAMPAIGN ERROR:", error);
    throw new Error(error.message);
  }

  return data as Campaign;
};

export const updateCampaign = async (
  campaignId: string,
  payload: UpdateCampaignInput,
) => {
  const { data, error } = await supabase
    .from("campaigns")
    .update(payload)
    .eq("id", campaignId)
    .select("*")
    .single();

  if (error) {
    console.error("UPDATE CAMPAIGN ERROR:", error);
    throw new Error(error.message);
  }

  return data as Campaign;
};

export const deleteCampaign = async (campaignId: string) => {
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("id", campaignId);

  if (error) {
    console.error("DELETE CAMPAIGN ERROR:", error);
    throw new Error(error.message);
  }
};
