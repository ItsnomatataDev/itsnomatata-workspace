import type { ContentReviewAsset } from "../services/contentReviewService";

export function shouldUseUnifiedPostCopy(assets: ContentReviewAsset[]) {
  const selected = assets.filter((asset) => asset.is_selected !== false);
  if (selected.length === 0) return true;
  return selected.every((asset) => !asset.caption?.trim() && !asset.heading?.trim());
}
