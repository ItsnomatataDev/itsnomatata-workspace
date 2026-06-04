import type {
  ContentReviewAsset,
  ContentReviewComment,
  ContentReviewDraft,
} from "../services/contentReviewService";
import { groupAssetsByDisplaySlot } from "./assetDisplaySlots";
import {
  areAllActiveClientSlotsApproved,
  areAllActiveSlotsInternallyApproved,
  getClientApprovedSlots,
  getInternalApprovedSlots,
} from "./contentReviewFeedback";
import {
  CONTENT_STUDIO_POSTS_PER_SCHEDULE,
  defaultScheduleTitle,
  postLabel,
  scheduleMonthKey,
} from "./contentStudioTerms";
import {
  getPostReadiness,
  hasPostCaption,
  type ClientBatchReadiness,
} from "./contentStudioProgress";

const LEGACY_POST_TITLE = /^post\s+\d+$/i;

export function isLegacyPostSlotDraft(draft: Pick<ContentReviewDraft, "title">) {
  return LEGACY_POST_TITLE.test(draft.title.trim());
}

export function draftScheduleMonthKey(draft: Pick<ContentReviewDraft, "scheduled_at" | "created_at">) {
  const source = draft.scheduled_at ?? draft.created_at;
  return source.slice(0, 7);
}

export function scheduleMonthStartIso(monthKey: string) {
  return `${monthKey}-01T08:00:00.000Z`;
}

export function formatScheduleDate(draft: Pick<ContentReviewDraft, "scheduled_at" | "created_at">) {
  const source = draft.scheduled_at ?? draft.created_at;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/** All schedule-level drafts for a client (excludes legacy per-post "Post N" rows). */
export function listClientScheduleDrafts(drafts: ContentReviewDraft[]) {
  return drafts
    .filter((draft) => !isLegacyPostSlotDraft(draft))
    .sort((a, b) => {
      const monthCmp = draftScheduleMonthKey(b).localeCompare(
        draftScheduleMonthKey(a),
      );
      if (monthCmp !== 0) return monthCmp;
      return b.updated_at.localeCompare(a.updated_at);
    });
}

export function schedulesForMonth(
  drafts: ContentReviewDraft[],
  monthKey: string,
) {
  return listClientScheduleDrafts(drafts).filter(
    (draft) => draftScheduleMonthKey(draft) === monthKey,
  );
}

export function resolveClientScheduleDraft(
  drafts: ContentReviewDraft[],
  monthKey: string = scheduleMonthKey(),
) {
  const inMonth = schedulesForMonth(drafts, monthKey);
  if (inMonth.length > 0) return inMonth[0];
  const nonLegacy = listClientScheduleDrafts(drafts);
  return nonLegacy[0] ?? null;
}

export type SchedulePostRow = {
  slot: number;
  label: string;
  assets: ContentReviewAsset[];
  assetCount: number;
  hasMedia: boolean;
  hasCaption: boolean;
};

/** Posts that have media attached (schedules are not required to fill all 10 slots). */
export function getActiveSchedulePostRows(rows: SchedulePostRow[]) {
  return rows.filter((row) => row.hasMedia);
}

export function getActiveSchedulePostSlots(rows: SchedulePostRow[]) {
  return getActiveSchedulePostRows(rows).map((row) => row.slot);
}

export function buildSchedulePostRows(
  draft: ContentReviewDraft,
  assets: ContentReviewAsset[],
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): SchedulePostRow[] {
  const slots = groupAssetsByDisplaySlot(assets);
  const bySlot = new Map(slots.map((entry) => [entry.slot, entry.assets]));

  return Array.from({ length: expectedPosts }, (_, slot) => {
    const slotAssets = bySlot.get(slot) ?? [];
    const hasMedia = slotAssets.length > 0;
    const hasCaption = hasMedia && hasPostCaption(draft, slotAssets);
    return {
      slot,
      label: postLabel(slot),
      assets: slotAssets,
      assetCount: slotAssets.length,
      hasMedia,
      hasCaption,
    };
  });
}

export function getScheduleOverallProgress(batch: ClientBatchReadiness) {
  return Math.round(
    (batch.mediaProgress +
      batch.captionsProgress +
      batch.internalProgress +
      batch.clientReviewProgress) /
      4,
  );
}

export function getScheduleBatchReadiness(
  draft: ContentReviewDraft,
  assets: ContentReviewAsset[],
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
  comments: ContentReviewComment[] = [],
): ClientBatchReadiness {
  const rows = buildSchedulePostRows(draft, assets, expectedPosts);
  const activeRows = getActiveSchedulePostRows(rows);
  const activeSlots = getActiveSchedulePostSlots(rows);
  const postCount = activeRows.length;
  const mediaComplete = postCount;
  const captionsComplete = activeRows.filter((row) => row.hasCaption).length;
  const draftReadiness = getPostReadiness(
    draft,
    mediaComplete,
    assets.filter((asset) => asset.is_selected !== false),
  );

  const internalApprovedOnActive = activeSlots.filter((slot) =>
    getInternalApprovedSlots(comments, expectedPosts).includes(slot),
  ).length;
  const allActiveInternallyApproved = areAllActiveSlotsInternallyApproved(
    comments,
    activeSlots,
  );
  const internalApproved = internalApprovedOnActive;

  const sentToClient = draftReadiness.sentToClient ? postCount : 0;
  const clientApprovedOnActive = activeSlots.filter((slot) =>
    getClientApprovedSlots(comments, expectedPosts).includes(slot),
  ).length;
  const allActiveClientApproved = areAllActiveClientSlotsApproved(comments, activeSlots);
  const clientReviewed = draftReadiness.clientReviewed
    ? postCount
    : allActiveClientApproved
      ? postCount
      : clientApprovedOnActive;

  const allPostsInternallyReady =
    postCount > 0 &&
    captionsComplete === postCount &&
    allActiveInternallyApproved;

  const canSendBatchToClient =
    allPostsInternallyReady && !draftReadiness.sentToClient;

  const progressDenom = Math.max(postCount, 1);

  return {
    expectedPosts: postCount,
    actualPosts: postCount,
    mediaComplete,
    captionsComplete,
    internalApproved,
    sentToClient,
    clientReviewed,
    allPostsInternallyReady,
    canSendBatchToClient,
    mediaProgress: postCount === 0 ? 0 : Math.round((mediaComplete / progressDenom) * 100),
    captionsProgress:
      postCount === 0 ? 0 : Math.round((captionsComplete / progressDenom) * 100),
    internalProgress:
      postCount === 0 ? 0 : Math.round((internalApprovedOnActive / progressDenom) * 100),
    sentProgress: postCount === 0 ? 0 : Math.round((sentToClient / progressDenom) * 100),
    clientReviewProgress:
      postCount === 0 ? 0 : Math.round((clientApprovedOnActive / progressDenom) * 100),
  };
}

export { defaultScheduleTitle };
