import type { ContentReviewAsset, ContentReviewDraft } from "../services/contentReviewService";

import {
  CONTENT_STUDIO_POSTS_PER_SCHEDULE,
  CONTENT_STUDIO_POSTS_PER_CLIENT,
} from "./contentStudioTerms";

export { CONTENT_STUDIO_POSTS_PER_SCHEDULE, CONTENT_STUDIO_POSTS_PER_CLIENT };

export type StageLabel = "Missing" | "Ready" | "Pending" | "Approved" | "Not sent" | "Sent" | "Awaiting" | "Reviewed" | "Changes";

export type PostReadiness = {
  hasMedia: boolean;
  hasCaption: boolean;
  internallyApproved: boolean;
  sentToClient: boolean;
  clientReviewed: boolean;
  clientChangesRequested: boolean;
  canApproveInternally: boolean;
  canSendToClient: boolean;
  mediaLabel: StageLabel;
  captionLabel: StageLabel;
  internalLabel: StageLabel;
  clientReviewLabel: StageLabel;
};

export type ClientBatchReadiness = {
  expectedPosts: number;
  actualPosts: number;
  mediaComplete: number;
  captionsComplete: number;
  internalApproved: number;
  sentToClient: number;
  clientReviewed: number;
  allPostsInternallyReady: boolean;
  canSendBatchToClient: boolean;
  mediaProgress: number;
  captionsProgress: number;
  internalProgress: number;
  sentProgress: number;
  clientReviewProgress: number;
};

const INTERNAL_APPROVED = new Set<ContentReviewDraft["status"]>(["approved", "published"]);

type DraftDeliveryState = Pick<
  ContentReviewDraft,
  "status" | "last_viewed_at" | "changes_requested_at"
>;

/** True once the client portal or public review link has been used, or the draft was explicitly sent. */
export function hasBeenSentToClient(draft: DraftDeliveryState) {
  if (
    draft.status === "sent_to_client" ||
    draft.status === "viewed" ||
    draft.status === "changes_requested"
  ) {
    return true;
  }
  if (draft.status === "approved" || draft.status === "published") {
    return Boolean(draft.last_viewed_at || draft.changes_requested_at);
  }
  return false;
}

function isClientReviewed(draft: DraftDeliveryState) {
  if (draft.status === "viewed" || draft.status === "changes_requested") {
    return true;
  }
  if (draft.status === "approved" || draft.status === "published") {
    return hasBeenSentToClient(draft);
  }
  return false;
}

type PostCaptionDraft = Pick<ContentReviewDraft, "captions" | "body" | "summary">;
type PostCaptionAsset = Pick<ContentReviewAsset, "caption" | "heading" | "is_selected">;

/** True when the post has social copy from any source (draft fields or per-asset text). */
export function hasPostCaption(
  draft: PostCaptionDraft,
  assets?: PostCaptionAsset[],
): boolean {
  if (draft.captions?.trim() || draft.body?.trim() || draft.summary?.trim()) {
    return true;
  }
  if (!assets?.length) return false;
  return assets.some(
    (asset) =>
      asset.is_selected !== false &&
      Boolean(asset.caption?.trim() || asset.heading?.trim()),
  );
}

export function getPostReadiness(
  draft: ContentReviewDraft,
  assetCount: number,
  assets?: ContentReviewAsset[],
): PostReadiness {
  const hasMedia = assetCount > 0;
  const hasCaption = hasPostCaption(draft, assets);
  const internallyApproved = INTERNAL_APPROVED.has(draft.status);
  const sentToClient = hasBeenSentToClient(draft);
  const clientReviewed = isClientReviewed(draft);
  const clientChangesRequested = draft.status === "changes_requested";

  return {
    hasMedia,
    hasCaption,
    internallyApproved,
    sentToClient,
    clientReviewed,
    clientChangesRequested,
    canApproveInternally: hasMedia && hasCaption && !internallyApproved,
    canSendToClient: hasMedia && hasCaption && internallyApproved && !sentToClient,
    mediaLabel: hasMedia ? "Ready" : "Missing",
    captionLabel: hasCaption ? "Ready" : "Missing",
    internalLabel: internallyApproved ? "Approved" : "Pending",
    clientReviewLabel: clientChangesRequested
      ? "Changes"
      : draft.status === "approved" || draft.status === "published"
        ? "Reviewed"
        : sentToClient
          ? "Awaiting"
          : "Not sent",
  };
}

export function getClientBatchReadiness(
  drafts: ContentReviewDraft[],
  assetCountByDraftId: Record<string, number>,
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
  assetsByDraftId: Record<string, ContentReviewAsset[]> = {},
): ClientBatchReadiness {
  const sorted = [...drafts].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const slots = sorted.slice(0, expectedPosts);
  const denominator = expectedPosts;

  let mediaComplete = 0;
  let captionsComplete = 0;
  let internalApproved = 0;
  let sentToClient = 0;
  let clientReviewed = 0;

  for (const draft of slots) {
    const readiness = getPostReadiness(
      draft,
      assetCountByDraftId[draft.id] ?? 0,
      assetsByDraftId[draft.id],
    );
    if (readiness.hasMedia) mediaComplete += 1;
    if (readiness.hasCaption) captionsComplete += 1;
    if (readiness.internallyApproved) internalApproved += 1;
    if (readiness.sentToClient) sentToClient += 1;
    if (readiness.clientReviewed) clientReviewed += 1;
  }

  const allPostsInternallyReady =
    slots.length >= expectedPosts &&
    slots.every((draft) => {
      const readiness = getPostReadiness(
        draft,
        assetCountByDraftId[draft.id] ?? 0,
        assetsByDraftId[draft.id],
      );
      return readiness.hasMedia && readiness.hasCaption && readiness.internallyApproved;
    });

  const canSendBatchToClient =
    allPostsInternallyReady &&
    slots.some((draft) => {
      const readiness = getPostReadiness(
        draft,
        assetCountByDraftId[draft.id] ?? 0,
        assetsByDraftId[draft.id],
      );
      return readiness.canSendToClient;
    });

  return {
    expectedPosts,
    actualPosts: drafts.length,
    mediaComplete,
    captionsComplete,
    internalApproved,
    sentToClient,
    clientReviewed,
    allPostsInternallyReady,
    canSendBatchToClient,
    mediaProgress: toPercent(mediaComplete, denominator),
    captionsProgress: toPercent(captionsComplete, denominator),
    internalProgress: toPercent(internalApproved, denominator),
    sentProgress: toPercent(sentToClient, denominator),
    clientReviewProgress: toPercent(clientReviewed, denominator),
  };
}

export function toPercent(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function stageBadgeClass(label: StageLabel) {
  if (label === "Ready" || label === "Approved" || label === "Reviewed") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }
  if (label === "Sent" || label === "Awaiting") {
    return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
  }
  if (label === "Changes") {
    return "border-orange-400/30 bg-orange-500/10 text-orange-200";
  }
  if (label === "Pending") {
    return "border-amber-400/30 bg-amber-500/10 text-amber-200";
  }
  return "border-white/10 bg-white/5 text-white/55";
}

const STAFF_RECALL_STATUSES = new Set<ContentReviewDraft["status"]>([
  "sent_to_client",
  "viewed",
  "changes_requested",
]);

/** Staff can pull a schedule back from review (internal approve, mistaken send, or client feedback). */
export function canRevokeScheduleApproval(
  draft: Pick<ContentReviewDraft, "status">,
  readiness?: PostReadiness,
) {
  if (draft.status === "published" || draft.status === "archived") return false;
  if (INTERNAL_APPROVED.has(draft.status)) return true;
  if (STAFF_RECALL_STATUSES.has(draft.status)) return true;
  if (readiness?.internallyApproved && !readiness.sentToClient) return true;
  return false;
}

/** @deprecated Prefer canRevokeScheduleApproval(draft, readiness). */
export function canRevokeInternalApproval(
  readiness: PostReadiness,
  draft?: Pick<ContentReviewDraft, "status">,
) {
  if (draft) return canRevokeScheduleApproval(draft, readiness);
  return readiness.internallyApproved && !readiness.sentToClient;
}

export function revokeScheduleApprovalLabel(
  draft: Pick<ContentReviewDraft, "status">,
) {
  if (STAFF_RECALL_STATUSES.has(draft.status) || draft.status === "changes_requested") {
    return "Recall from client";
  }
  return "Unapprove schedule";
}

export function sendGateHint(readiness: PostReadiness) {
  const missing: string[] = [];
  if (!readiness.hasMedia) missing.push("media");
  if (!readiness.hasCaption) missing.push("caption");
  if (!readiness.internallyApproved) missing.push("internal approval");
  if (readiness.sentToClient) return "Already sent to client.";
  if (missing.length === 0) return "Ready to send for client review.";
  return `Complete ${missing.join(", ")} before sending.`;
}

export function batchSendGateHint(batch: ClientBatchReadiness) {
  if (batch.mediaComplete < batch.expectedPosts) {
    return `Add media to each post in the schedule (${batch.mediaComplete}/${batch.expectedPosts} ready).`;
  }
  if (batch.captionsComplete < batch.expectedPosts) {
    return `Add captions to each post in the schedule (${batch.captionsComplete}/${batch.expectedPosts} ready).`;
  }
  if (!batch.allPostsInternallyReady) {
    return "All posts in the schedule need media, captions, and internal approval.";
  }
  if (batch.sentToClient >= batch.expectedPosts && !batch.canSendBatchToClient) {
    return "Every post in this schedule was already sent to the client.";
  }
  if (batch.canSendBatchToClient) {
    return "Send the full schedule to the client review portal.";
  }
  return "Some posts in this schedule are already with the client.";
}
