import { getAssetAttachments } from "../../../lib/supabase/queries/assetAttachments";
import {
  createAssetAttachment,
  deleteAssetAttachment,
  uploadAssetAttachmentFile,
  type CreateAssetAttachmentInput,
} from "../../../lib/supabase/mutations/assetAttachments";

export async function fetchAssetAttachments(assetId: string) {
  return getAssetAttachments(assetId);
}

export async function addAssetAttachment(input: CreateAssetAttachmentInput) {
  return createAssetAttachment(input);
}

export async function removeAssetAttachment(id: string) {
  return deleteAssetAttachment(id);
}

export async function uploadAttachmentFile(params: {
  file: File;
  assetId: string;
}) {
  return uploadAssetAttachmentFile(params);
}