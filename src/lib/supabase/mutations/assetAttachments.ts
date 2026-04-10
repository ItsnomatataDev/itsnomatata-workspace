import { supabase } from "../client";

export interface CreateAssetAttachmentInput {
  organization_id: string;
  asset_id: string;
  attachment_type:
    | "invoice"
    | "receipt"
    | "warranty"
    | "insurance"
    | "manual"
    | "image"
    | "other";
  file_name: string;
  file_url: string;
  mime_type?: string | null;
  file_size_bytes?: number | null;
  notes?: string | null;
  uploaded_by?: string | null;
}

export async function createAssetAttachment(input: CreateAssetAttachmentInput) {
  const { data, error } = await supabase
    .from("asset_attachments")
    .insert(input)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to save attachment.");
  }

  return data;
}

export async function deleteAssetAttachment(id: string) {
  const { error } = await supabase
    .from("asset_attachments")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(error.message || "Failed to delete attachment.");
  }

  return true;
}

export async function uploadAssetAttachmentFile(params: {
  file: File;
  assetId: string;
}) {
  const fileExt = params.file.name.split(".").pop() || "bin";
  const filePath = `${params.assetId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from("asset-documents")
    .upload(filePath, params.file, {
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message || "Failed to upload file.");
  }

  const { data } = supabase.storage
    .from("asset-documents")
    .getPublicUrl(filePath);

  return {
    filePath,
    publicUrl: data.publicUrl,
  };
}