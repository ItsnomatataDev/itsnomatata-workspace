import { Film } from "lucide-react";
import type { ContentReviewAsset } from "../services/contentReviewService";

export function isContentReviewVideo(asset: Pick<ContentReviewAsset, "asset_type" | "mime_type">) {
  return asset.asset_type === "video" || asset.mime_type?.startsWith("video/");
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
};

/** Full playback — use only for the active preview, not thumbnails. */
export function ContentReviewVideoPlayer({
  asset,
  className = "",
  controls = true,
  autoPlay = false,
  muted = false,
}: ContentReviewVideoPlayerProps) {
  return (
    <video
      src={asset.file_url}
      className={className}
      controls={controls}
      playsInline
      preload="metadata"
      autoPlay={autoPlay}
      muted={muted}
      aria-label={asset.file_name ?? "Video"}
    />
  );
}
