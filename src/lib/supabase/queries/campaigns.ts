import { supabase } from "../client";

export type CampaignStatus =
  | "draft"
  | "planned"
  | "in_progress"
  | "review"
  | "completed"
  | "cancelled";

export interface Campaign {
  id: string;
  organization_id: string;
  client_id: string;
  name: string;
  description: string | null;
  objective: string | null;
  start_date: string | null;
  end_date: string | null;
  status: CampaignStatus;
  budget: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const getCampaigns = async (organizationId?: string) => {
  let query = supabase
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Campaign[];
};

export const getCampaignById = async (campaignId: string) => {
  const { data, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (error) throw error;
  return data as Campaign;
};
