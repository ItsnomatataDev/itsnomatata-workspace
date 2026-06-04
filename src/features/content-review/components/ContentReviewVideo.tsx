import { Film } from "lucide-react";
import type { ContentReviewAsset } from "../services/contentReviewService";
import { isVideoAsset } from "../utils/mediaUpload";

export function isContentReviewVideo(
  asset: Pick<ContentReviewAsset, "asset_type" | "mime_type" | "file_name">,
) {
  return isVideoAsset(asset);
}

/** Lightweight placeholder — avoids loading/decoding every video in a filmstrip. */
export function ContentReviewVideoThumb({ className = "" }: { className?: string }) {
  return (
    <div
      className={`flex h-full w-full flex-col items-center justify-center gap-1 bg-black/85 text-white/70 ${className}`}
      aria-hidden
    >
      <Film size={22} className="text-orange-300/90" />
      <span className="text-[10px] font-semibold uppercase tracking-wide">Video</span>
    </div>
  );
}

type ContentReviewVideoPlayerProps = {
  asset: Pick<ContentReviewAsset, "file_url" | "file_name">;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  /** When false, the browser does not buffer the file until the user plays (reduces lag). */
  preload?: "none" | "metadata" | "auto";
};

/** Full playback — use only for the active preview, not thumbnails. */
export function ContentReviewVideoPlayer({
  asset,
  className = "",
  controls = true,
  autoPlay = false,
  muted = false,
  preload = "none",
}: ContentReviewVideoPlayerProps) {
  return (
    <video
      key={asset.file_url}
      src={asset.file_url}
      className={className}
      controls={controls}
      playsInline
      preload={preload}
      autoPlay={autoPlay}
      muted={muted}
      aria-label={asset.file_name ?? "Video"}
    />
  );
}
