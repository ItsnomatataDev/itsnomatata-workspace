import { Maximize2, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type ContentReviewAsset,
  type ContentReviewDraft,
  type ContentReviewLayout,
} from "../services/contentReviewService";

type PreviewTheme = "public" | "internal";

function isVideo(asset?: ContentReviewAsset | null) {
  return Boolean(asset?.asset_type === "video" || asset?.mime_type?.startsWith("video/"));
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function resolveLayout(draft: ContentReviewDraft, assets: ContentReviewAsset[]): ContentReviewLayout {
  if (assets.length === 1 && draft.body?.trim()) return "split_media_text";
  return draft.layout_type;
}

function cropStyle(asset: ContentReviewAsset) {
  return {
    objectPosition: `${asset.crop_x ?? 50}% ${asset.crop_y ?? 50}%`,
    transform: `scale(${asset.crop_zoom ?? 1})`,
    transformOrigin: `${asset.crop_x ?? 50}% ${asset.crop_y ?? 50}%`,
  };
}

function MediaFrame({
  asset,
  theme,
  onViewLarger,
  showText = true,
}: {
  asset: ContentReviewAsset;
  theme: PreviewTheme;
  onViewLarger?: () => void;
  showText?: boolean;
}) {
  const border = theme === "internal" ? "border-white/10" : "border-neutral-200";
  const captionColor = theme === "internal" ? "text-white/55" : "text-neutral-600";
  const displayHeading = asset.heading?.trim();

  if (isVideo(asset)) {
    return (
      <figure className="space-y-3">
        <div className={`overflow-hidden rounded-2xl border ${border} bg-black`}>
          <video
            src={asset.file_url}
            controls
            playsInline
            className="max-h-[70vh] w-full bg-black object-contain"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          {showText && (displayHeading || asset.caption) ? (
            <figcaption className={`space-y-1 text-sm ${captionColor}`}>
              {displayHeading ? <strong className="block text-current">{displayHeading}</strong> : null}
              {asset.caption ? <span className="block">{asset.caption}</span> : null}
            </figcaption>
          ) : (
            <span />
          )}
          {onViewLarger ? (
            <button
              type="button"
              onClick={onViewLarger}
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

  return (
    <figure className="space-y-3">
      <div className={`max-h-[70vh] overflow-hidden rounded-2xl border ${border}`}>
        <img
          src={asset.file_url}
          alt={asset.heading ?? asset.caption ?? "Content review media"}
          className="max-h-[70vh] w-full object-cover"
          style={cropStyle(asset)}
        />
      </div>
      {showText && (displayHeading || asset.caption) ? (
        <figcaption className={`space-y-1 text-sm ${captionColor}`}>
          {displayHeading ? <strong className="block text-current">{displayHeading}</strong> : null}
          {asset.caption ? <span className="block">{asset.caption}</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function ContentReviewRenderer({
  draft,
  assets,
  theme = "public",
}: {
  draft: ContentReviewDraft;
  assets: ContentReviewAsset[];
  theme?: PreviewTheme;
}) {
  const [expandedVideo, setExpandedVideo] = useState<ContentReviewAsset | null>(null);
  const selectedAssets = useMemo(
    () => assets.filter((asset) => asset.is_selected !== false),
    [assets],
  );
  const layout = useMemo(() => resolveLayout(draft, selectedAssets), [draft, selectedAssets]);
  const primaryAsset = selectedAssets[0] ?? null;
  const extraAssets = selectedAssets.slice(1);

  const shell =
    theme === "internal"
      ? "overflow-hidden rounded-2xl border border-white/10 bg-black text-white"
      : "overflow-hidden rounded-3xl border border-neutral-200 bg-white text-neutral-950 shadow-xl";
  const eyebrow = theme === "internal" ? "text-orange-400" : "text-orange-600";
  const muted = theme === "internal" ? "text-white/65" : "text-neutral-600";
  const body = theme === "internal" ? "text-white/75" : "text-neutral-700";
  const note =
    theme === "internal"
      ? "border-orange-500/20 bg-orange-500/10 text-orange-100"
      : "border-orange-200 bg-orange-50 text-orange-950";
  const status =
    theme === "internal"
      ? "bg-orange-500 text-black"
      : "bg-orange-500 text-black";
  const galleryGrid =
    selectedAssets.length <= 2 ? "md:grid-cols-2" : selectedAssets.length <= 5 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4";

  const textBlock = (asset?: ContentReviewAsset, index = 0) => (
    <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8">
      <p className={`text-xs uppercase tracking-[0.28em] ${eyebrow}`}>
        {formatStatus(layout)}
      </p>
      {(asset?.heading?.trim() || index === 0) ? (
        <h2 className="mt-3 text-3xl font-bold sm:text-4xl">
          {asset?.heading?.trim() || draft.title}
        </h2>
      ) : null}
      {index === 0 && draft.subtitle ? <p className={`mt-3 text-lg ${muted}`}>{draft.subtitle}</p> : null}
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
      {index === 0 && draft.summary ? <p className={`mt-6 text-lg font-medium leading-8 ${body}`}>{draft.summary}</p> : null}
      {asset?.caption ? (
        <p className={`mt-5 whitespace-pre-wrap leading-8 ${body}`}>{asset.caption}</p>
      ) : index === 0 && draft.body ? (
        <p className={`mt-5 whitespace-pre-wrap leading-8 ${body}`}>{draft.body}</p>
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
    </div>
  );

  const splitBlock = (asset: ContentReviewAsset, index = 0) => (
    <div
      key={asset.id}
      className={`grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)] ${index > 0 ? "border-t border-inherit" : ""}`}
    >
      <div className={theme === "internal" ? "p-4 sm:p-5" : "p-4 sm:p-6"}>
        <MediaFrame
          asset={asset}
          theme={theme}
          showText={false}
          onViewLarger={isVideo(asset) ? () => setExpandedVideo(asset) : undefined}
        />
      </div>
      {textBlock(asset, index)}
    </div>
  );

  return (
    <>
      <article className={shell}>
        {layout === "split_media_text" && primaryAsset ? (
          selectedAssets.map((asset, index) => splitBlock(asset, index))
        ) : (
          <>
            {primaryAsset ? (
              <div className={theme === "internal" ? "p-4 sm:p-5" : "p-4 sm:p-6"}>
                <MediaFrame
                  asset={primaryAsset}
                  theme={theme}
                  onViewLarger={isVideo(primaryAsset) ? () => setExpandedVideo(primaryAsset) : undefined}
                />
              </div>
            ) : null}
            {textBlock(primaryAsset ?? undefined)}
          </>
        )}
      </article>

      {layout !== "split_media_text" && extraAssets.length > 0 ? (
        <section className={`mt-6 grid gap-4 ${galleryGrid}`}>
          {extraAssets.map((asset) => (
            <MediaFrame
              key={asset.id}
              asset={asset}
              theme={theme}
              onViewLarger={isVideo(asset) ? () => setExpandedVideo(asset) : undefined}
            />
          ))}
        </section>
      ) : null}

      {expandedVideo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
          <div className="flex max-h-full w-full max-w-6xl flex-col gap-4">
            <div className="flex items-center justify-between gap-4 text-white">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-orange-400">
                  Video preview
                </p>
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
