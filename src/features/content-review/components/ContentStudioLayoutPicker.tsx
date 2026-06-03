import type { ContentReviewLayout } from "../services/contentReviewService";
import { CONTENT_STUDIO_LAYOUT_OPTIONS } from "../utils/contentStudioLayouts";
import ContentStudioLayoutWireframe from "./ContentStudioLayoutWireframe";

export default function ContentStudioLayoutPicker({
  value,
  onChange,
  compact = false,
}: {
  value: ContentReviewLayout;
  onChange: (layout: ContentReviewLayout) => void;
  compact?: boolean;
}) {
  const selected = CONTENT_STUDIO_LAYOUT_OPTIONS.find((entry) => entry.value === value);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-white">How images and text appear</h3>
        <p className="mt-1 text-xs leading-relaxed text-white/50">
          This applies to the whole schedule on the client review link — where photos sit relative to
          story text and captions.
        </p>
      </div>
      {selected && !compact ? (
        <div className="rounded-xl border border-orange-500/30 bg-orange-500/8 p-3">
          <p className="text-xs font-semibold text-orange-100">Selected: {selected.label}</p>
          <p className="mt-1 text-[11px] text-white/55">{selected.description}</p>
          <div className="mt-3 max-w-[220px]">
            <ContentStudioLayoutWireframe layout={selected.value} active />
          </div>
        </div>
      ) : null}
      <div className={`grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>
        {CONTENT_STUDIO_LAYOUT_OPTIONS.map((layout) => {
          const isSelected = value === layout.value;
          return (
            <button
              key={layout.value}
              type="button"
              onClick={() => onChange(layout.value)}
              className={`rounded-xl border p-3 text-left transition ${
                isSelected
                  ? "border-orange-500/55 bg-orange-500/12 ring-1 ring-orange-500/25"
                  : "border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/[0.07]"
              }`}
            >
              <ContentStudioLayoutWireframe layout={layout.value} compact active={isSelected} />
              <p className="mt-2.5 text-sm font-semibold text-white">{layout.label}</p>
              <p className="mt-1 text-[11px] leading-snug text-white/45">{layout.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
