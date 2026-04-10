import { supabase } from "../client";

export async function getAssetAttachments(assetId: string) {
  const { data, error } = await supabase
    .from("asset_attachments")
    .select(`
      id,
      organization_id,
      asset_id,
      attachment_type,
      file_name,
      file_url,
      mime_type,
      file_size_bytes,
      notes,
      uploaded_by,
      created_at,
      uploaded_profile:profiles!asset_attachments_uploaded_by_fkey(
        id,
        full_name,
        email
      )
    `)
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load asset attachments.");
  }

  return data ?? [];
}