import type { ContentReviewAsset, ContentReviewDraft } from "../services/contentReviewService";
import { groupAssetsByDisplaySlot } from "./assetDisplaySlots";
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

export function getScheduleBatchReadiness(
  draft: ContentReviewDraft,
  assets: ContentReviewAsset[],
  expectedPosts = CONTENT_STUDIO_POSTS_PER_SCHEDULE,
): ClientBatchReadiness {
  const rows = buildSchedulePostRows(draft, assets, expectedPosts);
  const mediaComplete = rows.filter((row) => row.hasMedia).length;
  const captionsComplete = rows.filter((row) => row.hasCaption).length;
  const draftReadiness = getPostReadiness(
    draft,
    mediaComplete,
    assets.filter((asset) => asset.is_selected !== false),
  );

  const internalApproved = draftReadiness.internallyApproved ? expectedPosts : 0;
  const sentToClient = draftReadiness.sentToClient ? expectedPosts : 0;
  const clientReviewed = draftReadiness.clientReviewed ? expectedPosts : 0;

  const allPostsInternallyReady =
    mediaComplete >= expectedPosts &&
    captionsComplete >= expectedPosts &&
    draftReadiness.internallyApproved;

  const canSendBatchToClient =
    allPostsInternallyReady && draftReadiness.canSendToClient;

  return {
    expectedPosts,
    actualPosts: expectedPosts,
    mediaComplete,
    captionsComplete,
    internalApproved,
    sentToClient,
    clientReviewed,
    allPostsInternallyReady,
    canSendBatchToClient,
    mediaProgress: Math.round((mediaComplete / expectedPosts) * 100),
    captionsProgress: Math.round((captionsComplete / expectedPosts) * 100),
    internalProgress: draftReadiness.internallyApproved ? 100 : 0,
    sentProgress: Math.round((sentToClient / expectedPosts) * 100),
    clientReviewProgress: Math.round((clientReviewed / expectedPosts) * 100),
  };
}

export { defaultScheduleTitle };
