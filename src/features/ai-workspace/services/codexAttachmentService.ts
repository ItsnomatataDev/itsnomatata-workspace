import { supabase } from "../../../lib/supabase/client";

const MAX_BYTES = 12 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/csv",
  "text/tab-separated-values",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
]);

function resolveUploadMimeType(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) return "text/csv";
  if (name.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (name.endsWith(".xls")) return "application/vnd.ms-excel";
  return file.type || "application/octet-stream";
}

export async function uploadCodexChatFile(file: File): Promise<{
  url: string;
  download_url: string;
  name: string;
  size: number;
  mimeType: string;
  textContent?: string;
}> {
  if (file.size > MAX_BYTES) {
    throw new Error("File must be 12MB or smaller.");
  }

  const mimeType = resolveUploadMimeType(file);
  if (!ALLOWED_TYPES.has(mimeType) && !file.name.match(/\.(pdf|csv|txt|xlsx|xls|docx?|png|jpe?g|webp|gif|md)$/i)) {
    throw new Error("Unsupported file type for Codex chat upload.");
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    throw new Error("Sign in before uploading Codex chat files.");
  }

  const path = `${authData.user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
  const { error } = await supabase.storage
    .from("codex-chat-files")
    .upload(path, file, { contentType: mimeType, upsert: false });

  if (error) throw error;

  const { data: signedUrl, error: signedUrlError } = await supabase.storage
    .from("codex-chat-files")
    .createSignedUrl(path, 60 * 60);

  if (signedUrlError || !signedUrl?.signedUrl) {
    throw new Error("Failed to create a secure file link.");
  }

  let textContent: string | undefined;
  const isSmallTextLike = file.size < 512_000 &&
    (mimeType === "text/csv" || mimeType === "text/plain" ||
      file.name.endsWith(".csv") || file.name.endsWith(".txt") ||
      file.name.endsWith(".md"));
  if (isSmallTextLike) {
    textContent = (await file.text()).slice(0, 40_000);
  }

  return {
    url: signedUrl.signedUrl,
    download_url: signedUrl.signedUrl,
    name: file.name,
    size: file.size,
    mimeType,
    textContent,
  };
}
