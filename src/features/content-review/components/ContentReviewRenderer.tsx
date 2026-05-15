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

function MediaFrame({
  asset,
  theme,
  onViewLarger,
}: {
  asset: ContentReviewAsset;
  theme: PreviewTheme;
  onViewLarger?: () => void;
}) {
  const border = theme === "internal" ? "border-white/10" : "border-neutral-200";
  const captionColor = theme === "internal" ? "text-white/55" : "text-neutral-600";

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
          {asset.caption ? (
            <figcaption className={`text-sm ${captionColor}`}>{asset.caption}</figcaption>
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
      <img
        src={asset.file_url}
        alt={asset.caption ?? asset.file_name}
        className={`max-h-[70vh] w-full rounded-2xl border ${border} object-cover`}
      />
      {asset.caption ? (
        <figcaption className={`text-sm ${captionColor}`}>{asset.caption}</figcaption>
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
  const layout = useMemo(() => resolveLayout(draft, assets), [draft, assets]);
  const primaryAsset = assets[0] ?? null;
  const extraAssets = layout === "split_media_text" ? assets.slice(1) : assets.slice(1);

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
    assets.length <= 2 ? "md:grid-cols-2" : assets.length <= 5 ? "md:grid-cols-2 xl:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4";

  const textBlock = (
    <div className="flex min-w-0 flex-col justify-center p-6 sm:p-8">
      <p className={`text-xs uppercase tracking-[0.28em] ${eyebrow}`}>
        {formatStatus(layout)}
      </p>
      <h2 className="mt-3 text-3xl font-bold sm:text-4xl">{draft.title}</h2>
      {draft.subtitle ? <p className={`mt-3 text-lg ${muted}`}>{draft.subtitle}</p> : null}
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
      {draft.summary ? <p className={`mt-6 text-lg font-medium leading-8 ${body}`}>{draft.summary}</p> : null}
      {draft.body ? <p className={`mt-5 whitespace-pre-wrap leading-8 ${body}`}>{draft.body}</p> : null}
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

  return (
    <>
      <article className={shell}>
        {layout === "split_media_text" && primaryAsset ? (
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
            <div className={theme === "internal" ? "p-4 sm:p-5" : "p-4 sm:p-6"}>
              <MediaFrame
                asset={primaryAsset}
                theme={theme}
                onViewLarger={isVideo(primaryAsset) ? () => setExpandedVideo(primaryAsset) : undefined}
              />
            </div>
            {textBlock}
          </div>
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
            {textBlock}
          </>
        )}
      </article>

      {extraAssets.length > 0 ? (
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
                  {expandedVideo.caption || expandedVideo.file_name}
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
