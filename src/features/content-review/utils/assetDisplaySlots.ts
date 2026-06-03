import type { ContentReviewAsset } from "../services/contentReviewService";

export type ContentReviewDisplaySlot = {
  slot: number;
  assets: ContentReviewAsset[];
  primary: ContentReviewAsset;
};

export function assetDisplaySlot(asset: ContentReviewAsset, fallbackIndex = 0) {
  return asset.display_slot ?? asset.sort_order ?? fallbackIndex;
}

export function assetsInDisplaySlot(assets: ContentReviewAsset[], slot: number) {
  return assets
    .filter((asset) => asset.is_selected !== false && assetDisplaySlot(asset) === slot)
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
}

export function contentReviewSlotAnchorId(slot: number) {
  return `content-review-slot-${slot}`;
}

export function groupAssetsByDisplaySlot(assets: ContentReviewAsset[]): ContentReviewDisplaySlot[] {
  const selected = assets.filter((asset) => asset.is_selected !== false);
  const slotMap = new Map<number, ContentReviewAsset[]>();

  for (const asset of selected) {
    const slot = asset.display_slot ?? asset.sort_order ?? 0;
    const bucket = slotMap.get(slot) ?? [];
    bucket.push(asset);
    slotMap.set(slot, bucket);
  }

  return Array.from(slotMap.entries())
    .sort(([left], [right]) => left - right)
    .map(([slot, slotAssets]) => {
      const ordered = [...slotAssets].sort((a, b) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return a.created_at.localeCompare(b.created_at);
      });
      return {
        slot,
        assets: ordered,
        primary: ordered[0],
      };
    });
}
