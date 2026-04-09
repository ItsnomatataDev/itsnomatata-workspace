import { supabase } from "../client";
import { getTaskSubmissionSignedUrl } from "../storage/taskSubmissions";

export type TaskSubmissionType = "website" | "media" | "document" | "general";

export interface TaskSubmissionItem {
  id: string;
  organization_id: string;
  task_id: string;
  submitted_by: string;
  submission_type: TaskSubmissionType;
  title: string;
  notes: string | null;
  link_url: string | null;
  file_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  approval_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;

  submitted_by_name?: string | null;
  submitted_by_email?: string | null;
  reviewed_by_name?: string | null;
  reviewed_by_email?: string | null;
  signed_file_url?: string | null;
}

export async function getTaskSubmissions(taskId: string): Promise<TaskSubmissionItem[]> {
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("task_submissions")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const submissions = (data ?? []) as TaskSubmissionItem[];

  const userIds = Array.from(
    new Set(
      submissions
        .flatMap((item) => [item.submitted_by, item.reviewed_by])
        .filter(Boolean),
    ),
  ) as string[];

  let profileMap = new Map<string, { full_name: string | null; email: string | null }>();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    if (profilesError) throw profilesError;

    profileMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        {
          full_name: profile.full_name ?? null,
          email: profile.email ?? null,
        },
      ]),
    );
  }

  const withUrls = await Promise.all(
    submissions.map(async (item) => {
      const signedUrl = item.file_path
        ? await getTaskSubmissionSignedUrl(item.file_path)
        : null;

      return {
        ...item,
        submitted_by_name: profileMap.get(item.submitted_by)?.full_name ?? null,
        submitted_by_email: profileMap.get(item.submitted_by)?.email ?? null,
        reviewed_by_name: item.reviewed_by
          ? profileMap.get(item.reviewed_by)?.full_name ?? null
          : null,
        reviewed_by_email: item.reviewed_by
          ? profileMap.get(item.reviewed_by)?.email ?? null
          : null,
        signed_file_url: signedUrl,
      };
    }),
  );

  return withUrls;
}

export async function getLatestTaskSubmission(taskId: string): Promise<TaskSubmissionItem | null> {
  const items = await getTaskSubmissions(taskId);
  return items[0] ?? null;
}