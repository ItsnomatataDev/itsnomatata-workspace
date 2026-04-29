import { supabase } from "../client";
import { removeTaskSubmissionFile, uploadTaskSubmissionFile } from "../storage/taskSubmissions";
import type { TaskSubmissionType } from "../queries/taskSubmissions";
import {
  sendBulkNotifications,
  sendNotification,
} from "../../../features/notifications/services/notificationService";

type TaskSubmissionContext = {
  id: string;
  title: string;
  organization_id: string;
  assigned_to: string | null;
  assigned_by: string | null;
  created_by: string | null;
};

async function getTaskContext(taskId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, organization_id, assigned_to, assigned_by, created_by")
    .eq("id", taskId)
    .maybeSingle();

  if (error) throw error;
  return data as TaskSubmissionContext | null;
}

async function createReviewComment(params: {
  organizationId: string;
  taskId: string;
  userId: string;
  comment: string;
}) {
  const trimmed = params.comment.trim();
  if (!trimmed) return;

  const { data: reviewer } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", params.userId)
    .maybeSingle();

  const { error } = await supabase.from("task_comments").insert({
    organization_id: params.organizationId,
    task_id: params.taskId,
    user_id: params.userId,
    comment: trimmed,
    is_internal: false,
    author_name: reviewer?.full_name ?? null,
    author_email: reviewer?.email ?? null,
  });

  if (error) throw error;
}

async function notifySubmissionCreated(params: {
  submissionId: string;
  task: TaskSubmissionContext;
  submittedBy: string;
  title: string;
}) {
  const reviewerIds = [
    params.task.assigned_by,
    params.task.created_by,
  ].filter((id): id is string => Boolean(id && id !== params.submittedBy));

  if (reviewerIds.length === 0) return;

  await sendBulkNotifications({
    organizationId: params.task.organization_id,
    userIds: reviewerIds,
    type: "task_updated",
    title: "Task submission ready for review",
    message: `"${params.title}" was submitted for "${params.task.title}".`,
    entityType: "task",
    entityId: params.task.id,
    actionUrl: `/tasks/${params.task.id}`,
    priority: "high",
    referenceId: params.task.id,
    referenceType: "task",
    actorUserId: params.submittedBy,
    category: "tasks",
    dedupeKey: `task-submission-created:${params.submissionId}`,
    metadata: {
      taskId: params.task.id,
      taskTitle: params.task.title,
      submissionId: params.submissionId,
      submissionTitle: params.title,
      submittedBy: params.submittedBy,
    },
  });
}

async function notifySubmissionReviewed(params: {
  submissionId: string;
  task: TaskSubmissionContext;
  submittedBy: string;
  reviewedBy: string;
  approved: boolean;
  reviewNote?: string | null;
}) {
  await sendNotification({
    organizationId: params.task.organization_id,
    userId: params.submittedBy,
    type: params.approved ? "task_completed" : "task_updated",
    title: params.approved ? "Submission approved" : "Submission sent back",
    message: params.approved
      ? `Your submission for "${params.task.title}" was approved.`
      : `Your submission for "${params.task.title}" needs changes.${params.reviewNote ? ` ${params.reviewNote}` : ""}`,
    entityType: "task",
    entityId: params.task.id,
    actionUrl: `/tasks/${params.task.id}`,
    priority: params.approved ? "medium" : "high",
    referenceId: params.task.id,
    referenceType: "task",
    actorUserId: params.reviewedBy,
    category: "tasks",
    dedupeKey: `task-submission-${params.approved ? "approved" : "rejected"}:${params.submissionId}`,
    metadata: {
      taskId: params.task.id,
      taskTitle: params.task.title,
      submissionId: params.submissionId,
      reviewedBy: params.reviewedBy,
      approved: params.approved,
      reviewNote: params.reviewNote ?? null,
    },
  });
}

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
    try {
      const task = await getTaskContext(taskId);
      if (task) {
        await notifySubmissionCreated({
          submissionId: inserted.id,
          task,
          submittedBy,
          title: title.trim(),
        });
      }
    } catch (notificationError) {
      console.error("TASK SUBMISSION NOTIFICATION ERROR:", notificationError);
    }

    return updated;
  }

  try {
    const task = await getTaskContext(taskId);
    if (task) {
      await notifySubmissionCreated({
        submissionId: inserted.id,
        task,
        submittedBy,
        title: title.trim(),
      });
    }
  } catch (notificationError) {
    console.error("TASK SUBMISSION NOTIFICATION ERROR:", notificationError);
  }

  return inserted;
}

export async function approveTaskSubmission(params: {
  submissionId: string;
  reviewedBy: string;
  reviewNote?: string | null;
}) {
  const { submissionId, reviewedBy, reviewNote = null } = params;

  const { data: beforeReview, error: beforeReviewError } = await supabase
    .from("task_submissions")
    .select("id, task_id, organization_id, submitted_by, title")
    .eq("id", submissionId)
    .maybeSingle();

  if (beforeReviewError) throw beforeReviewError;

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

  try {
    const task = beforeReview?.task_id
      ? await getTaskContext(beforeReview.task_id)
      : null;

    if (task && beforeReview?.submitted_by) {
      if (reviewNote?.trim()) {
        await createReviewComment({
          organizationId: task.organization_id,
          taskId: task.id,
          userId: reviewedBy,
          comment: `Approved submission "${beforeReview.title}".\n\n${reviewNote.trim()}`,
        });
      }

      await notifySubmissionReviewed({
        submissionId,
        task,
        submittedBy: beforeReview.submitted_by,
        reviewedBy,
        approved: true,
        reviewNote,
      });
    }
  } catch (notificationError) {
    console.error("TASK SUBMISSION APPROVAL NOTIFICATION ERROR:", notificationError);
  }

  return data;
}

export async function rejectTaskSubmission(params: {
  submissionId: string;
  reviewedBy: string;
  reviewNote?: string | null;
}) {
  const { submissionId, reviewedBy, reviewNote = null } = params;

  const { data: beforeReview, error: beforeReviewError } = await supabase
    .from("task_submissions")
    .select("id, task_id, organization_id, submitted_by, title")
    .eq("id", submissionId)
    .maybeSingle();

  if (beforeReviewError) throw beforeReviewError;

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

  try {
    const task = beforeReview?.task_id
      ? await getTaskContext(beforeReview.task_id)
      : null;

    if (task && beforeReview?.submitted_by) {
      await createReviewComment({
        organizationId: task.organization_id,
        taskId: task.id,
        userId: reviewedBy,
        comment: `Sent back submission "${beforeReview.title}".${reviewNote?.trim() ? `\n\n${reviewNote.trim()}` : ""}`,
      });

      await notifySubmissionReviewed({
        submissionId,
        task,
        submittedBy: beforeReview.submitted_by,
        reviewedBy,
        approved: false,
        reviewNote,
      });
    }
  } catch (notificationError) {
    console.error("TASK SUBMISSION REJECTION NOTIFICATION ERROR:", notificationError);
  }

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
