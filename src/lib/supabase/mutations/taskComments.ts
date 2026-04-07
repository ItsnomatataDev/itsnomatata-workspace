import { supabase } from "../client";
import type { TaskCommentItem } from "../queries/tasks";

export type CreateTaskCommentInput = {
  task_id: string;
  organization_id: string;
  user_id?: string | null;
  comment: string;
  is_internal?: boolean;
};

export type UpdateTaskCommentInput = {
  comment?: string;
  is_internal?: boolean;
};

export async function addTaskComment(
  input: CreateTaskCommentInput,
): Promise<TaskCommentItem> {
  const trimmedComment = input.comment.trim();

  if (!trimmedComment) {
    throw new Error("Comment cannot be empty.");
  }

  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: input.task_id,
      organization_id: input.organization_id,
      user_id: input.user_id ?? null,
      comment: trimmedComment,
      is_internal: input.is_internal ?? false,
    })
    .select(
      "id, task_id, organization_id, user_id, comment, is_internal, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return data as TaskCommentItem;
}

export async function updateTaskComment(
  commentId: string,
  input: UpdateTaskCommentInput,
): Promise<TaskCommentItem> {
  const payload: Record<string, unknown> = {};

  if (input.comment !== undefined) {
    const trimmedComment = input.comment.trim();

    if (!trimmedComment) {
      throw new Error("Comment cannot be empty.");
    }

    payload.comment = trimmedComment;
  }

  if (input.is_internal !== undefined) {
    payload.is_internal = input.is_internal;
  }

  const { data, error } = await supabase
    .from("task_comments")
    .update(payload)
    .eq("id", commentId)
    .select(
      "id, task_id, organization_id, user_id, comment, is_internal, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return data as TaskCommentItem;
}

export async function deleteTaskComment(commentId: string) {
  const { error } = await supabase
    .from("task_comments")
    .delete()
    .eq("id", commentId);

  if (error) throw error;
  return true;
}