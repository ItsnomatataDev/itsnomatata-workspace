import { supabase } from "../client";

const BUCKET = "task-submissions";

function sanitizeFileName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_");
}

export async function uploadTaskSubmissionFile(params: {
  organizationId: string;
  taskId: string;
  submissionId: string;
  file: File;
}) {
  const { organizationId, taskId, submissionId, file } = params;

  const fileName = sanitizeFileName(file.name);
  const filePath = `${organizationId}/${taskId}/${submissionId}/${fileName}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || undefined,
    });

  if (error) throw error;

  return {
    bucket: BUCKET,
    filePath,
    fileName,
    mimeType: file.type || null,
    fileSize: file.size || null,
  };
}

export async function removeTaskSubmissionFile(filePath: string) {
  if (!filePath) return;

  const { error } = await supabase.storage
    .from(BUCKET)
    .remove([filePath]);

  if (error) throw error;
}

export async function getTaskSubmissionSignedUrl(filePath: string) {
  if (!filePath) return null;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(filePath, 60 * 60);

  if (error) throw error;

  return data?.signedUrl ?? null;
}