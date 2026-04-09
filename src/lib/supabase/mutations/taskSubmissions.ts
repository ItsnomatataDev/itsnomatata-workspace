import { supabase } from "../client";
import { removeTaskSubmissionFile, uploadTaskSubmissionFile } from "../storage/taskSubmissions";
import type { TaskSubmissionType } from "../queries/taskSubmissions";

export async function createTaskSubmission(params: {
  organizationId: string;
  taskId: string;
  submittedBy: string;
  submissionType: TaskSubmissionType;
  title: string;
  notes?: string | null;
  linkUrl?: string | null;
  file?: File | null;
}) {
  const {
    organizationId,
    taskId,
    submittedBy,
    submissionType,
    title,
    notes = null,
    linkUrl = null,
    file = null,
  } = params;

  if (!organizationId) throw new Error("organizationId is required");
  if (!taskId) throw new Error("taskId is required");
  if (!submittedBy) throw new Error("submittedBy is required");
  if (!title.trim()) throw new Error("Submission title is required");

  const { data: inserted, error: insertError } = await supabase
    .from("task_submissions")
    .insert({
      organization_id: organizationId,
      task_id: taskId,
      submitted_by: submittedBy,
      submission_type: submissionType,
      title: title.trim(),
      notes,
      link_url: linkUrl,
    })
    .select("*")
    .single();

  if (insertError) throw insertError;

  if (file) {
    const uploaded = await uploadTaskSubmissionFile({
      organizationId,
      taskId,
      submissionId: inserted.id,
      file,
    });

    const { data: updated, error: updateError } = await supabase
      .from("task_submissions")
      .update({
        file_path: uploaded.filePath,
        file_name: uploaded.fileName,
        mime_type: uploaded.mimeType,
        file_size: uploaded.fileSize,
      })
      .eq("id", inserted.id)
      .select("*")
      .single();

    if (updateError) throw updateError;
    return updated;
  }

  return inserted;
}

export async function approveTaskSubmission(params: {
  submissionId: string;
  reviewedBy: string;
  reviewNote?: string | null;
}) {
  const { submissionId, reviewedBy, reviewNote = null } = params;

  const { data, error } = await supabase
    .from("task_submissions")
    .update({
      approval_status: "approved",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote,
    })
    .eq("id", submissionId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function rejectTaskSubmission(params: {
  submissionId: string;
  reviewedBy: string;
  reviewNote?: string | null;
}) {
  const { submissionId, reviewedBy, reviewNote = null } = params;

  const { data, error } = await supabase
    .from("task_submissions")
    .update({
      approval_status: "rejected",
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote,
    })
    .eq("id", submissionId)
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTaskSubmission(params: {
  submissionId: string;
  filePath?: string | null;
}) {
  const { submissionId, filePath = null } = params;

  if (filePath) {
    await removeTaskSubmissionFile(filePath);
  }

  const { error } = await supabase
    .from("task_submissions")
    .delete()
    .eq("id", submissionId);

  if (error) throw error;
}