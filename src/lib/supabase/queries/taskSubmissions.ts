import { supabase } from "../client";

export type TaskSubmissionStatus = "pending" | "approved" | "rejected";

export interface TaskSubmissionItem {
  id: string;
  task_id: string;
  organization_id: string;
  user_id: string | null;
  submission_type: string; // 'website' | 'media' | 'document' | 'general'
  title: string;
  notes: string | null;
  link_url: string | null;
  file_name: string | null;
  signed_file_url: string | null;
  approval_status: TaskSubmissionStatus;
  approved_by: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskSubmissionType {
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
      user_id,
      submission_type,
      title,
      notes,
      link_url,
      file_name,
      signed_file_url,
      approval_status,
      approved_by,
      review_notes,
      created_at,
      updated_at
    `)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return data ?? [];
}

export async function getTaskSubmissionTypes(): Promise<TaskSubmissionType[]> {
  const { data, error } = await supabase
    .from("task_submission_types")
    .select("*")
    .order("name");

  if (error) throw error;

  return data ?? [];
}
