import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import type { ContentReviewAsset } from "../services/contentReviewService";

type Props = {
  assets: ContentReviewAsset[];
  renderSlide: (asset: ContentReviewAsset) => ReactNode;
  className?: string;
  frameClassName?: string;
};

export default function MediaCarousel({
  assets,
  renderSlide,
  className = "",
  frameClassName = "",
}: Props) {
  const [index, setIndex] = useState(0);
  const count = assets.length;
  const current = assets[index] ?? assets[0];

  if (!current) return null;

  if (count <= 1) {
    return <div className={className}>{renderSlide(current)}</div>;
  }

  const goPrev = () => setIndex((value) => (value - 1 + count) % count);
  const goNext = () => setIndex((value) => (value + 1) % count);

  return (
    <div className={`relative ${className}`}>
      <div className={frameClassName}>{renderSlide(current)}</div>

      <button
        type="button"
        onClick={goPrev}
        className="absolute left-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg transition hover:bg-black/90"
        aria-label="Previous image"
      >
        <ChevronLeft size={18} />
      </button>

      <button
        type="button"
        onClick={goNext}
        className="absolute right-3 top-1/2 z-20 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/70 text-white shadow-lg transition hover:bg-black/90"
        aria-label="Next image"
      >
        <ChevronRight size={18} />
      </button>

      <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/60 px-2 py-1">
        {assets.map((asset, dotIndex) => (
          <button
            key={asset.id}
            type="button"
            onClick={() => setIndex(dotIndex)}
            className={[
              "h-2 w-2 rounded-full transition",
              dotIndex === index ? "bg-orange-400" : "bg-white/40 hover:bg-white/70",
            ].join(" ")}
            aria-label={`Show image ${dotIndex + 1} of ${count}`}
          />
        ))}
      </div>
    </div>
  );
}

export function carouselCropStyle(asset: ContentReviewAsset): CSSProperties {
  return {
    "--crop-position": `${asset.crop_x ?? 50}% ${asset.crop_y ?? 50}%`,
    "--crop-transform": `scale(${asset.crop_zoom ?? 1})`,
    "--crop-origin": `${asset.crop_x ?? 50}% ${asset.crop_y ?? 50}%`,
  } as CSSProperties;
}
