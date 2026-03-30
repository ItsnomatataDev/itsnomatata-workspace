import { supabase } from "../client";

export interface ContentAsset {
  id: string;
  organization_id: string;
  client_id: string | null;
  campaign_id: string | null;
  task_id: string | null;
  uploaded_by: string | null;
  file_name: string;
  file_path: string;
  file_url: string | null;
  mime_type: string | null;
  asset_type: string;
  asset_status: string;
  file_size: number | null;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
  alt_text: string | null;
  tags: string[] | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

export const getContentAssets = async (organizationId?: string) => {
  let query = supabase
    .from("content_assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ContentAsset[];
};
