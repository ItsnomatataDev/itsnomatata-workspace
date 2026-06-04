import type { ContentReviewComment } from "../services/contentReviewService";
import { CONTENT_STUDIO_POSTS_PER_SCHEDULE } from "./contentStudioTerms";

const POST_SLOT_PATTERN = /^\[Post\s+(\d+)\]/i;

/** Parse 0-based display slot from portal feedback body (e.g. "[Post 3]"). */
export function parsePostSlotFromCommentBody(body: string): number | null {
  const match = body.trim().match(POST_SLOT_PATTERN);
  if (!match) return null;
  const oneBased = Number.parseInt(match[1], 10);
  if (!Number.isFinite(oneBased) || oneBased < 1) return null;
  return oneBased - 1;
}

export function resolveCommentDisplaySlot(comment: ContentReviewComment): number | null {
  if (
    typeof comment.display_slot === "number" &&
    comment.display_slot >= 0 &&
    comment.display_slot < CONTENT_STUDIO_POSTS_PER_SCHEDULE
  ) {
    return comment.display_slot;
  }
  return parsePostSlotFromCommentBody(comment.body);
}

export function getClientApprovedSlots(
  comments: ContentReviewComment[],
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): number[] {
  const slots = new Set<number>();
  for (const comment of comments) {
    if (comment.author_type !== "client" || comment.comment_type !== "approval_note") {
      continue;
    }
    const slot = resolveCommentDisplaySlot(comment);
    if (slot !== null && slot >= 0 && slot < expectedPosts) {
      slots.add(slot);
    }
  }
  return [...slots].sort((a, b) => a - b);
}

export function getClientChangesRequestedSlots(
  comments: ContentReviewComment[],
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): number[] {
  const slots = new Set<number>();
  for (const comment of comments) {
    if (comment.author_type !== "client" || comment.comment_type !== "change_request") {
      continue;
    }
    const slot = resolveCommentDisplaySlot(comment);
    if (slot !== null && slot >= 0 && slot < expectedPosts) {
      slots.add(slot);
    }
  }
  return [...slots].sort((a, b) => a - b);
}

export function areAllClientPostsApproved(
  comments: ContentReviewComment[],
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): boolean {
  return getClientApprovedSlots(comments, expectedPosts).length >= expectedPosts;
}

export function feedbackSourceLabel(source: "client" | "internal") {
  return source === "client" ? "Client review" : "Internal review";
}

export function feedbackEventLabel(
  eventType: "approval_note" | "change_request" | "internal_comment" | "client_comment",
) {
  switch (eventType) {
    case "approval_note":
      return "Approval";
    case "change_request":
      return "Changes requested";
    case "internal_comment":
      return "Internal note";
    case "client_comment":
      return "Client comment";
    default:
      return "Update";
  }
}
