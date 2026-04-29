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

export async function findFirstTaskSubmissionFile(params: {
  organizationId: string;
  taskId: string;
  submissionId: string;
}) {
  const folderPath =
    `${params.organizationId}/${params.taskId}/${params.submissionId}`;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(folderPath, {
      limit: 1,
      sortBy: {
        column: "created_at",
        order: "desc",
      },
    });

  if (error) throw error;

  const file = data?.find((item) => item.name && item.id);
  if (!file) return null;

  return {
    filePath: `${folderPath}/${file.name}`,
    fileName: file.name,
    mimeType: file.metadata?.mimetype as string | null | undefined,
    fileSize: file.metadata?.size as number | null | undefined,
  };
}
