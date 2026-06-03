import type { ContentReviewAsset } from "../services/contentReviewService";
import { assetDisplaySlot, assetsInDisplaySlot } from "./assetDisplaySlots";

export const CONTENT_REVIEW_ASSET_DRAG_TYPE = "application/x-content-review-asset-id";

export function readDraggedAssetId(event: { dataTransfer: DataTransfer }): string | null {
  return event.dataTransfer.getData(CONTENT_REVIEW_ASSET_DRAG_TYPE) || null;
}

export function setDraggedAssetId(event: { dataTransfer: DataTransfer }, assetId: string) {
  event.dataTransfer.setData(CONTENT_REVIEW_ASSET_DRAG_TYPE, assetId);
  event.dataTransfer.effectAllowed = "move";
}

function reindexSlotAssets(slotAssets: ContentReviewAsset[], slot: number) {
  return slotAssets.map((asset, index) => ({
    ...asset,
    display_slot: slot,
    sort_order: index,
  }));
}

function replaceSlotAssets(
  assets: ContentReviewAsset[],
  slot: number,
  slotAssets: ContentReviewAsset[],
) {
  const others = assets.filter((asset) => assetDisplaySlot(asset) !== slot);
  return [...others, ...slotAssets];
}

/** Reorder within a post or move an asset into another post (display slot). */
export function computeAssetReorder(
  assets: ContentReviewAsset[],
  draggedId: string,
  targetId: string,
): ContentReviewAsset[] | null {
  const dragged = assets.find((asset) => asset.id === draggedId);
  const target = assets.find((asset) => asset.id === targetId);
  if (!dragged || !target || draggedId === targetId) return null;

  const draggedSlot = assetDisplaySlot(dragged);
  const targetSlot = assetDisplaySlot(target);

  if (draggedSlot === targetSlot) {
    const inSlot = assetsInDisplaySlot(assets, draggedSlot);
    const fromIndex = inSlot.findIndex((asset) => asset.id === draggedId);
    const toIndex = inSlot.findIndex((asset) => asset.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return null;
    const reordered = [...inSlot];
    const [item] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, item);
    return replaceSlotAssets(assets, draggedSlot, reindexSlotAssets(reordered, draggedSlot));
  }

  const sourceAssets = assetsInDisplaySlot(assets, draggedSlot).filter((asset) => asset.id !== draggedId);
  const targetAssets = assetsInDisplaySlot(assets, targetSlot);
  const insertIndex = targetAssets.findIndex((asset) => asset.id === targetId);
  const nextTarget = [...targetAssets];
  nextTarget.splice(insertIndex < 0 ? nextTarget.length : insertIndex, 0, {
    ...dragged,
    display_slot: targetSlot,
  });

  let next = replaceSlotAssets(assets, draggedSlot, reindexSlotAssets(sourceAssets, draggedSlot));
  next = replaceSlotAssets(next, targetSlot, reindexSlotAssets(nextTarget, targetSlot));
  return next;
}

/** Drop files or library items onto an empty post slot. */
export function nextSortOrderForSlot(assets: ContentReviewAsset[], slot: number) {
  const inSlot = assetsInDisplaySlot(assets, slot);
  if (inSlot.length === 0) return 0;
  return Math.max(...inSlot.map((asset) => asset.sort_order)) + 1;
}

export function assetUpdatesFromOrdered(assets: ContentReviewAsset[]) {
  return assets.map((asset) => ({
    id: asset.id,
    sort_order: asset.sort_order,
    display_slot: asset.display_slot ?? assetDisplaySlot(asset),
  }));
}

/** Move an asset into another post (display slot), appended at the end of that post. */
export function computeMoveToSlot(
  assets: ContentReviewAsset[],
  assetId: string,
  targetSlot: number,
): ContentReviewAsset[] | null {
  const dragged = assets.find((asset) => asset.id === assetId);
  if (!dragged) return null;
  const sourceSlot = assetDisplaySlot(dragged);
  if (sourceSlot === targetSlot) return null;

  const sourceAssets = assetsInDisplaySlot(assets, sourceSlot).filter((asset) => asset.id !== assetId);
  const targetAssets = [
    ...assetsInDisplaySlot(assets, targetSlot),
    { ...dragged, display_slot: targetSlot },
  ];

  let next = replaceSlotAssets(assets, sourceSlot, reindexSlotAssets(sourceAssets, sourceSlot));
  next = replaceSlotAssets(next, targetSlot, reindexSlotAssets(targetAssets, targetSlot));
  return next;
}
