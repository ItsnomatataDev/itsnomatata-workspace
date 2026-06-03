import { Maximize2, X } from "lucide-react";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import {
  type ContentReviewAsset,
  type ContentReviewDraft,
  type ContentReviewLayout,
} from "../services/contentReviewService";
import {
  contentReviewSlotAnchorId,
  groupAssetsByDisplaySlot,
  type ContentReviewDisplaySlot,
} from "../utils/assetDisplaySlots";
import { postLabel } from "../utils/contentStudioTerms";
import { shouldUseUnifiedPostCopy } from "../utils/postCopyLayout";
import MediaCarousel, { carouselCropStyle } from "./MediaCarousel";

type PreviewTheme = "public" | "internal";
type PreviewViewport = "responsive" | "mobile";

function isVideo(asset?: ContentReviewAsset | null) {
  return Boolean(asset?.asset_type === "video" || asset?.mime_type?.startsWith("video/"));
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function resolveLayout(draft: ContentReviewDraft, slots: ContentReviewDisplaySlot[]): ContentReviewLayout {
  if (slots.length === 1 && slots[0].assets.length === 1 && draft.body?.trim()) {
    return "split_media_text";
  }
  return draft.layout_type;
}

function cropStyle(asset: ContentReviewAsset) {
  return carouselCropStyle(asset);
}

function imageFrameClass(theme: PreviewTheme) {
  return theme === "internal" ? "bg-black" : "bg-neutral-100";
}

function mediaImageClass(viewport: PreviewViewport) {
  if (viewport === "mobile") {
    return "h-full max-h-[70vh] w-full object-contain";
  }

  return [
    "h-auto max-h-[70vh] w-full object-contain",
    "[object-position:var(--crop-position)] [transform-origin:var(--crop-origin)]",
    "sm:object-cover sm:[transform:var(--crop-transform)]",
  ].join(" ");
}

function previewImageSizes(theme: PreviewTheme) {
  if (theme === "internal") {
    return "(max-width: 640px) 100vw, (max-width: 1280px) 70vw, 900px";
  }
  return "(max-width: 640px) 100vw, (max-width: 1280px) 80vw, 1100px";
}

function MediaSlide({
  asset,
  theme,
  viewport = "responsive",
}: {
  asset: ContentReviewAsset;
  theme: PreviewTheme;
  viewport?: PreviewViewport;
}) {
  const border = theme === "internal" ? "border-white/10" : "border-neutral-200";

  if (isVideo(asset)) {
    return (
      <div className={`overflow-hidden rounded-2xl border ${border} bg-black`}>
        <video
          src={asset.file_url}
          controls
          playsInline
          className="max-h-[70vh] w-full bg-black object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${border} ${imageFrameClass(theme)} ${viewport === "mobile" ? "aspect-4/5 max-h-[70vh]" : "max-h-[70vh]"}`}
    >
      <img
        src={asset.file_url}
        alt={asset.heading ?? asset.caption ?? "Content review media"}
        sizes={previewImageSizes(theme)}
        loading="lazy"
        decoding="async"
        className={mediaImageClass(viewport)}
        style={cropStyle(asset)}
      />
    </div>
  );
}

function MediaFrame({
  slot,
  theme,
  viewport = "responsive",
  onViewLarger,
  showText = true,
}: {
  slot: ContentReviewDisplaySlot;
  theme: PreviewTheme;
  viewport?: PreviewViewport;
  onViewLarger?: (asset: ContentReviewAsset) => void;
  showText?: boolean;
}) {
  const border = theme === "internal" ? "border-white/10" : "border-neutral-200";
  const captionColor = theme === "internal" ? "text-white/55" : "text-neutral-600";
  const asset = slot.primary;
  const displayHeading = asset.heading?.trim();
  const hasVideo = slot.assets.some((item) => isVideo(item));

  return (
    <figure className="space-y-3">
      <MediaCarousel
        assets={slot.assets}
        frameClassName="relative"
        renderSlide={(slide) => <MediaSlide asset={slide} theme={theme} viewport={viewport} />}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        {showText && (displayHeading || asset.caption) ? (
          <figcaption className={`space-y-1 text-sm ${captionColor}`}>
            {displayHeading ? <strong className="block text-current">{displayHeading}</strong> : null}
            {asset.caption ? <span className="block">{asset.caption}</span> : null}
            {slot.assets.length > 1 ? (
              <span className="block text-xs opacity-80">{slot.assets.length} images in this post</span>
            ) : null}
          </figcaption>
        ) : (
          <span />
        )}
        {onViewLarger && hasVideo ? (
          <button
            type="button"
            onClick={() => {
              const videoAsset = slot.assets.find((item) => isVideo(item));
              if (videoAsset) onViewLarger(videoAsset);
            }}
            className={
              theme === "internal"
                ? "inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/15"
                : "inline-flex items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700 hover:bg-orange-100"
            }
          >
            <Maximize2 size={15} />
            View larger
          </button>
        ) : null}
      </div>
    </figure>
  );
}

function SlotSection({
  slot,
  theme,
  highlightDisplaySlot,
  children,
  className = "",
}: {
  slot: number;
  theme: PreviewTheme;
  highlightDisplaySlot?: number | null;
  children: ReactNode;
  className?: string;
}) {
  const highlighted = highlightDisplaySlot === slot;
  const ring =
    theme === "internal"
      ? "ring-orange-400/80 ring-offset-black"
      : "ring-orange-500/70 ring-offset-white";

  return (
    <div
      id={contentReviewSlotAnchorId(slot)}
      className={`scroll-mt-6 ${highlighted ? `rounded-2xl ring-2 ring-offset-2 ${ring}` : ""} ${className}`}
    >
      {highlighted ? (
        <p
          className={`px-4 pt-3 text-[11px] font-bold uppercase tracking-wide ${
            theme === "internal" ? "text-orange-300" : "text-orange-600"
          }`}
        >
          {postLabel(slot)}
        </p>
      ) : null}
      {children}
    </div>
  );
}

export function ContentReviewRenderer({
  draft,
  assets,
  theme = "public",
  viewport = "responsive",
  unifiedPostCopy,
  highlightDisplaySlot = null,
  renderSectionActions,
}: {
  draft: ContentReviewDraft;
  assets: ContentReviewAsset[];
  theme?: PreviewTheme;
  viewport?: PreviewViewport;
  unifiedPostCopy?: boolean;
  highlightDisplaySlot?: number | null;
  renderSectionActions?: (
    slot: ContentReviewDisplaySlot,
    index: number,
  ) => ReactNode;
}) {
  const [expandedVideo, setExpandedVideo] = useState<ContentReviewAsset | null>(null);
  const displaySlots = useMemo(() => groupAssetsByDisplaySlot(assets), [assets]);
  const useUnifiedCopy = unifiedPostCopy ?? shouldUseUnifiedPostCopy(assets);
  const layout = useMemo(() => {
    if (useUnifiedCopy && displaySlots.length > 0) return "media_showcase" as ContentReviewLayout;
    return resolveLayout(draft, displaySlots);
  }, [draft, displaySlots, useUnifiedCopy]);
  const primarySlot = displaySlots[0] ?? null;
  const extraSlots = displaySlots.slice(1);

  const shell =
    theme === "internal"
      ? "overflow-hidden rounded-2xl border border-white/10 bg-black text-white"
      : "overflow-hidden rounded-3xl border border-neutral-200 bg-white text-neutral-950 shadow-xl";
  const muted = theme === "internal" ? "text-white/65" : "text-neutral-600";
  const body = theme === "internal" ? "text-white/75" : "text-neutral-700";
  const note =
    theme === "internal"
      ? "border-orange-500/20 bg-orange-500/10 text-orange-100"
      : "border-orange-200 bg-orange-50 text-orange-950";
  const status = theme === "internal" ? "bg-orange-500 text-black" : "bg-orange-500 text-black";
  const galleryGrid =
    extraSlots.length <= 1 ? "md:grid-cols-1" : extraSlots.length <= 2 ? "md:grid-cols-2" : "md:grid-cols-2 xl:grid-cols-3";

  const unifiedTextBlock = () => (
    <div className={`flex min-w-0 flex-col justify-center ${viewport === "mobile" ? "p-6" : "p-6 sm:p-8"}`}>
      <h2 className={`font-bold ${viewport === "mobile" ? "text-3xl" : "text-3xl sm:text-4xl"}`}>{draft.title}</h2>
      {draft.subtitle ? <p className={`mt-3 ${viewport === "mobile" ? "text-base" : "text-lg"} ${muted}`}>{draft.subtitle}</p> : null}
      <div className="mt-5 flex flex-wrap gap-2 text-sm">
        <span className={`rounded-full px-3 py-1 font-semibold capitalize ${status}`}>
          {formatStatus(draft.status)}
        </span>
        {draft.scheduled_at ? (
          <span className={`rounded-full border px-3 py-1 ${theme === "internal" ? "border-white/10 text-white/65" : "border-neutral-200 text-neutral-600"}`}>
            Scheduled {new Date(draft.scheduled_at).toLocaleString()}
          </span>
        ) : null}
      </div>
      {draft.summary ? <p className={`mt-6 font-medium ${viewport === "mobile" ? "text-base leading-7" : "text-lg leading-8"} ${body}`}>{draft.summary}</p> : null}
      {draft.body ? (
        <p className={`mt-5 whitespace-pre-wrap ${viewport === "mobile" ? "leading-7" : "leading-8"} ${body}`}>{draft.body}</p>
      ) : null}
      {draft.captions ? (
        <p className={`mt-5 whitespace-pre-wrap rounded-2xl border p-4 text-sm ${theme === "internal" ? "border-white/10 bg-white/5 text-white/80" : "border-neutral-200 bg-neutral-50 text-neutral-800"}`}>
          {draft.captions}
        </p>
      ) : null}
      {draft.notes ? <div className={`mt-6 rounded-2xl border p-4 text-sm ${note}`}>{draft.notes}</div> : null}
      {draft.cta_label && draft.cta_url ? (
        <a
          href={draft.cta_url}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex w-fit rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black hover:bg-orange-400"
        >
          {draft.cta_label}
        </a>
      ) : null}
    </div>
  );

  const textBlock = (slot?: ContentReviewDisplaySlot, index = 0) => (
    <div className={`flex min-w-0 flex-col justify-center ${viewport === "mobile" ? "p-6" : "p-6 sm:p-8"}`}>
      {(slot?.primary.heading?.trim() || index === 0) ? (
        <h2 className={`font-bold ${viewport === "mobile" ? "text-3xl" : "text-3xl sm:text-4xl"}`}>
          {slot?.primary.heading?.trim() || draft.title}
        </h2>
      ) : null}
      {index === 0 && draft.subtitle ? <p className={`mt-3 ${viewport === "mobile" ? "text-base" : "text-lg"} ${muted}`}>{draft.subtitle}</p> : null}
      {index === 0 ? (
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <span className={`rounded-full px-3 py-1 font-semibold capitalize ${status}`}>
            {formatStatus(draft.status)}
          </span>
          {draft.scheduled_at ? (
            <span className={`rounded-full border px-3 py-1 ${theme === "internal" ? "border-white/10 text-white/65" : "border-neutral-200 text-neutral-600"}`}>
              Scheduled {new Date(draft.scheduled_at).toLocaleString()}
            </span>
          ) : null}
        </div>
      ) : null}
      {index === 0 && draft.summary ? <p className={`mt-6 font-medium ${viewport === "mobile" ? "text-base leading-7" : "text-lg leading-8"} ${body}`}>{draft.summary}</p> : null}
      {slot?.primary.caption ? (
        <p className={`mt-5 whitespace-pre-wrap ${viewport === "mobile" ? "leading-7" : "leading-8"} ${body}`}>{slot.primary.caption}</p>
      ) : index === 0 && draft.body ? (
        <p className={`mt-5 whitespace-pre-wrap ${viewport === "mobile" ? "leading-7" : "leading-8"} ${body}`}>{draft.body}</p>
      ) : null}
      {index === 0 && draft.notes ? <div className={`mt-6 rounded-2xl border p-4 text-sm ${note}`}>{draft.notes}</div> : null}
      {index === 0 && draft.cta_label && draft.cta_url ? (
        <a
          href={draft.cta_url}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-flex w-fit rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black hover:bg-orange-400"
        >
          {draft.cta_label}
        </a>
      ) : null}
      {slot && renderSectionActions ? (
        <div className="mt-4">{renderSectionActions(slot, index)}</div>
      ) : null}
    </div>
  );

  const splitBlock = (slot: ContentReviewDisplaySlot, index = 0) => (
    <SlotSection
      key={`slot-${slot.slot}`}
      slot={slot.slot}
      theme={theme}
      highlightDisplaySlot={highlightDisplaySlot}
      className={`grid gap-0 ${viewport === "mobile" ? "" : "lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]"} ${index > 0 ? "border-t border-inherit" : ""}`}
    >
      <div className={theme === "internal" ? "p-4 sm:p-5" : "p-4 sm:p-6"}>
        <MediaFrame
          slot={slot}
          theme={theme}
          viewport={viewport}
          showText={false}
          onViewLarger={setExpandedVideo}
        />
      </div>
      {textBlock(slot, index)}
    </SlotSection>
  );

  return (
    <>
      <article className={shell}>
        {useUnifiedCopy && displaySlots.length > 0 ? (
          <>
            <div className={`space-y-4 ${theme === "internal" ? "p-4 sm:p-5" : "p-4 sm:p-6"}`}>
              {displaySlots.map((slot) => (
                <SlotSection
                  key={`slot-${slot.slot}`}
                  slot={slot.slot}
                  theme={theme}
                  highlightDisplaySlot={highlightDisplaySlot}
                >
                  <MediaFrame
                    slot={slot}
                    theme={theme}
                    viewport={viewport}
                    showText={false}
                    onViewLarger={setExpandedVideo}
                  />
                </SlotSection>
              ))}
            </div>
            {unifiedTextBlock()}
          </>
        ) : layout === "split_media_text" && displaySlots.length > 0 ? (
          displaySlots.map((slot, index) => splitBlock(slot, index))
        ) : (
          <>
            {primarySlot ? (
              <SlotSection
                slot={primarySlot.slot}
                theme={theme}
                highlightDisplaySlot={highlightDisplaySlot}
              >
                <div className={theme === "internal" ? "p-4 sm:p-5" : "p-4 sm:p-6"}>
                  <MediaFrame
                    slot={primarySlot}
                    theme={theme}
                    viewport={viewport}
                    onViewLarger={setExpandedVideo}
                  />
                </div>
              </SlotSection>
            ) : null}
            {textBlock(primarySlot ?? undefined)}
          </>
        )}
      </article>

      {layout !== "split_media_text" && extraSlots.length > 0 ? (
        <section className={`mt-6 grid gap-4 ${galleryGrid}`}>
          {extraSlots.map((slot) => (
            <SlotSection
              key={`slot-${slot.slot}`}
              slot={slot.slot}
              theme={theme}
              highlightDisplaySlot={highlightDisplaySlot}
            >
              <MediaFrame
                slot={slot}
                theme={theme}
                viewport={viewport}
                onViewLarger={setExpandedVideo}
              />
            </SlotSection>
          ))}
        </section>
      ) : null}

      {expandedVideo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
          <div className="flex max-h-full w-full max-w-6xl flex-col gap-4">
            <div className="flex items-center justify-between gap-4 text-white">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-orange-400">Video preview</p>
                <h3 className="mt-1 text-xl font-semibold">
                  {expandedVideo.heading || expandedVideo.caption || draft.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setExpandedVideo(null)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white hover:bg-white/20"
                aria-label="Close video preview"
              >
                <X size={20} />
              </button>
            </div>
            <video
              src={expandedVideo.file_url}
              controls
              autoPlay
              playsInline
              className="max-h-[82vh] w-full rounded-2xl bg-black object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

export const ReviewLayoutPreview = ContentReviewRenderer;
