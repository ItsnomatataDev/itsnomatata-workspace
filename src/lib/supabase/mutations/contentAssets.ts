import { supabase } from "../client";
import type { ContentAsset } from "../queries/contentAssets";

export interface CreateContentAssetInput {
  organization_id: string;
  client_id?: string | null;
  campaign_id?: string | null;
  task_id?: string | null;
  uploaded_by?: string | null;
  file_name: string;
  file_path: string;
  file_url?: string | null;
  mime_type?: string | null;
  asset_type?: string;
  asset_status?: string;
}

export const createContentAsset = async (payload: CreateContentAssetInput) => {
  const { data, error } = await supabase
    .from("content_assets")
    .insert({
      organization_id: payload.organization_id,
      client_id: payload.client_id ?? null,
      campaign_id: payload.campaign_id ?? null,
      task_id: payload.task_id ?? null,
      uploaded_by: payload.uploaded_by ?? null,
      file_name: payload.file_name,
      file_path: payload.file_path,
      file_url: payload.file_url ?? null,
      mime_type: payload.mime_type ?? null,
      asset_type: payload.asset_type ?? "other",
      asset_status: payload.asset_status ?? "uploaded",
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as ContentAsset;
};
