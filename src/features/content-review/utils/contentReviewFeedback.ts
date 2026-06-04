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

type InternalSlotDecision = "approval_note" | "change_request";

function latestInternalDecisionBySlot(
  comments: ContentReviewComment[],
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): Map<number, InternalSlotDecision> {
  const latest = new Map<number, { type: InternalSlotDecision; at: string }>();
  for (const comment of comments) {
    if (comment.author_type !== "internal") continue;
    if (
      comment.comment_type !== "approval_note" &&
      comment.comment_type !== "change_request"
    ) {
      continue;
    }
    const slot = resolveCommentDisplaySlot(comment);
    if (slot === null || slot < 0 || slot >= expectedPosts) continue;
    const prev = latest.get(slot);
    if (!prev || comment.created_at > prev.at) {
      latest.set(slot, { type: comment.comment_type as InternalSlotDecision, at: comment.created_at });
    }
  }
  const decisions = new Map<number, InternalSlotDecision>();
  for (const [slot, entry] of latest) {
    decisions.set(slot, entry.type);
  }
  return decisions;
}

export function getInternalApprovedSlots(
  comments: ContentReviewComment[],
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): number[] {
  const decisions = latestInternalDecisionBySlot(comments, expectedPosts);
  return [...decisions.entries()]
    .filter(([, type]) => type === "approval_note")
    .map(([slot]) => slot)
    .sort((a, b) => a - b);
}

export function getInternalChangesRequestedSlots(
  comments: ContentReviewComment[],
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): number[] {
  const decisions = latestInternalDecisionBySlot(comments, expectedPosts);
  return [...decisions.entries()]
    .filter(([, type]) => type === "change_request")
    .map(([slot]) => slot)
    .sort((a, b) => a - b);
}

export function areAllInternalPostsApproved(
  comments: ContentReviewComment[],
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): boolean {
  return getInternalApprovedSlots(comments, expectedPosts).length >= expectedPosts;
}

export function isInternalSlotApproved(
  comments: ContentReviewComment[],
  slot: number,
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): boolean {
  return getInternalApprovedSlots(comments, expectedPosts).includes(slot);
}

export function shouldShowInternalPostReviewActions(
  comments: ContentReviewComment[],
  slot: number,
  row: { hasMedia: boolean; hasCaption: boolean },
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): boolean {
  if (!row.hasMedia || !row.hasCaption) return false;
  if (areAllClientPostsApproved(comments, expectedPosts)) return false;
  if (getClientApprovedSlots(comments, expectedPosts).includes(slot)) return false;
  if (isInternalSlotApproved(comments, slot, expectedPosts)) return false;
  return true;
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
