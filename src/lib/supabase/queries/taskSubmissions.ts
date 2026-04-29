import { supabase } from "../client";
import {
  findFirstTaskSubmissionFile,
  getTaskSubmissionSignedUrl,
} from "../storage/taskSubmissions";

export type TaskSubmissionStatus = "pending" | "approved" | "rejected";
export type TaskSubmissionType = "website" | "media" | "document" | "general";

export interface TaskSubmissionItem {
  id: string;
  task_id: string;
  organization_id: string;
  submitted_by: string | null;
  user_id: string | null;
  submission_type: TaskSubmissionType;
  title: string;
  notes: string | null;
  link_url: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  signed_file_url: string | null;
  approval_status: TaskSubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  approved_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskSubmissionTypeOption {
  id: string;
  name: string;
  description: string;
  requires_file: boolean;
}

export async function getTaskSubmissions(
  taskId: string,
): Promise<TaskSubmissionItem[]> {
  const { data, error } = await supabase
    .from("task_submissions")
    .select(`
      id,
      task_id,
      organization_id,
      submitted_by,
      submission_type,
      title,
      notes,
      link_url,
      file_path,
      file_name,
      mime_type,
      file_size,
      approval_status,
      reviewed_by,
      reviewed_at,
      review_note,
      created_at,
      updated_at
    `)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => {
      const recoveredFile = !row.file_path
        ? await findFirstTaskSubmissionFile({
            organizationId: row.organization_id,
            taskId: row.task_id,
            submissionId: row.id,
          })
        : null;
      const filePath = row.file_path ?? recoveredFile?.filePath ?? null;
      const signedFileUrl = filePath
        ? await getTaskSubmissionSignedUrl(filePath)
        : null;

      return {
        ...row,
        file_path: filePath,
        file_name: row.file_name ?? recoveredFile?.fileName ?? null,
        mime_type: row.mime_type ?? recoveredFile?.mimeType ?? null,
        file_size: row.file_size ?? recoveredFile?.fileSize ?? null,
        user_id: row.submitted_by,
        signed_file_url: signedFileUrl,
        approved_by: row.reviewed_by,
        review_notes: row.review_note,
      } as TaskSubmissionItem;
    }),
  );
}

export async function getTaskSubmissionTypes(): Promise<TaskSubmissionTypeOption[]> {
  const { data, error } = await supabase
    .from("task_submission_types")
    .select("*")
    .order("name");

  if (error) throw error;

  return data ?? [];
}
