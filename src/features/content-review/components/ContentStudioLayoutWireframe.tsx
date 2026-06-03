import type { ContentReviewLayout } from "../services/contentReviewService";

type WireframeProps = {
  layout: ContentReviewLayout;
  compact?: boolean;
  active?: boolean;
};

function Block({
  className = "",
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center rounded-md border border-dashed border-white/20 bg-white/5 text-[9px] font-semibold uppercase tracking-wide text-white/35 ${className}`}
    >
      {label}
    </div>
  );
}

export default function ContentStudioLayoutWireframe({
  layout,
  compact = false,
  active = false,
}: WireframeProps) {
  const pad = compact ? "p-2 gap-1" : "p-3 gap-1.5";
  const shell = `rounded-xl border ${active ? "border-orange-500/50 bg-orange-500/8" : "border-white/10 bg-black/40"} ${pad}`;

  const rowMin = compact ? "min-h-7" : "min-h-10";

  if (layout === "split_media_text") {
    return (
      <div className={`grid grid-cols-2 ${shell}`}>
        <Block label="Image" className={rowMin} />
        <Block label="Text" className={rowMin} />
      </div>
    );
  }

  if (layout === "gallery") {
    return (
      <div className={`space-y-1.5 ${shell}`}>
        <div className="grid grid-cols-2 gap-1">
          <Block label="Img" className="aspect-square" />
          <Block label="Img" className="aspect-square" />
          <Block label="Img" className="aspect-square" />
          <Block label="Img" className="aspect-square" />
        </div>
        <Block label="Caption" className="h-6" />
      </div>
    );
  }

  if (layout === "article") {
    return (
      <div className={`space-y-1.5 ${shell}`}>
        <Block label="Headline" className="h-5" />
        <Block label="Story" className="h-8" />
        <Block label="Image" className="h-7" />
      </div>
    );
  }

  if (layout === "event_announcement" || layout === "campaign_preview") {
    return (
      <div className={`space-y-1.5 ${shell}`}>
        <Block label="Hero" className="h-10" />
        <Block label="Headline + CTA" className="h-6" />
      </div>
    );
  }

  if (layout === "testimonial") {
    return (
      <div className={`space-y-1.5 ${shell}`}>
        <Block label="Quote" className="h-8" />
        <Block label="Photo" className="h-7" />
      </div>
    );
  }

  // media_showcase — default for monthly schedules
  return (
    <div className={`space-y-1.5 ${shell}`}>
      <div className="grid grid-cols-3 gap-1">
        <Block label="P1" className="aspect-4/3" />
        <Block label="P2" className="aspect-4/3" />
        <Block label="P3" className="aspect-4/3" />
      </div>
      <Block label="Story + social caption" className="h-7" />
    </div>
  );
}
