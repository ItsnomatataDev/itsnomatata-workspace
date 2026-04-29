import { supabase } from "../../../lib/supabase/client";
import { notifyTaskCommented } from "../../notifications/services/notificationOrchestrationService";

export interface TaskCommentItem {
  id: string;
  task_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  author_name?: string | null;
  author_email?: string | null;
}

const COMMENT_SELECT = `
  id,
  task_id,
  user_id,
  comment,
  created_at,
  updated_at,
  author_name,
  author_email
`;

async function getTaskContext(taskId: string) {
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, organization_id, assigned_to, created_by")
    .eq("id", taskId)
    .single();

  if (error) {
    throw new Error(`Failed to load task context: ${error.message}`);
  }

  return data as {
    id: string;
    title: string;
    organization_id: string;
    assigned_to: string | null;
    created_by: string | null;
  };
}

async function getAuthorProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load comment author: ${error.message}`);
  }

  return data as
    | {
        id: string;
        full_name: string | null;
        email: string | null;
      }
    | null;
}

async function getTaskNotificationRecipients(taskId: string, authorUserId: string) {
  const { data, error } = await supabase
    .from("task_watchers")
    .select("user_id")
    .eq("task_id", taskId);

  if (error) {
    throw new Error(`Failed to load comment recipients: ${error.message}`);
  }

  const ids = [...new Set((data ?? []).map((item) => item.user_id as string))];
  return ids.filter((id) => id && id !== authorUserId);
}

export async function getTaskComments(
  taskId: string,
): Promise<TaskCommentItem[]> {
  if (!taskId) throw new Error("taskId is required");

  const { data, error } = await supabase
    .from("task_comments")
    .select(COMMENT_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Failed to load task comments: ${error.message}`);
  }

  return (data ?? []) as TaskCommentItem[];
}

export async function createTaskComment(params: {
  taskId: string;
  userId: string;
  comment: string;
}): Promise<TaskCommentItem> {
  const { taskId, userId, comment } = params;

  if (!taskId) throw new Error("taskId is required");
  if (!userId) throw new Error("userId is required");
  if (!comment.trim()) throw new Error("comment is required");

  const author = await getAuthorProfile(userId);

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      user_id: userId,
      comment: comment.trim(),
      author_name: author?.full_name ?? null,
      author_email: author?.email ?? null,
    })
    .select(COMMENT_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to create task comment: ${error.message}`);
  }

  try {
    const task = await getTaskContext(taskId);
    const recipients = await getTaskNotificationRecipients(taskId, userId);

    await notifyTaskCommented({
      organizationId: task.organization_id,
      taskId: task.id,
      taskTitle: task.title,
      commentId: data.id,
      authorUserId: userId,
      authorName: author?.full_name || author?.email || "A team member",
      extraUserIds: recipients,
    });
  } catch (notificationError) {
    console.error("TASK COMMENT NOTIFICATION ERROR:", notificationError);
  }

  return data as TaskCommentItem;
}

export async function deleteTaskComment(commentId: string): Promise<void> {
  if (!commentId) throw new Error("commentId is required");

  const { error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    throw new Error(`Failed to delete task comment: ${error.message}`);
  }
}
