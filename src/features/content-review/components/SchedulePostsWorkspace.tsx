import { GripVertical, ImageIcon, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import type { ContentReviewAsset, ContentReviewLayout } from "../services/contentReviewService";
import { assetsInDisplaySlot } from "../utils/assetDisplaySlots";
import {
  CONTENT_REVIEW_ASSET_DRAG_TYPE,
  readDraggedAssetId,
  setDraggedAssetId,
} from "../utils/contentStudioAssetOrdering";
import type { SchedulePostRow } from "../utils/contentStudioSchedule";
import { contentStudioCopy, postLabel } from "../utils/contentStudioTerms";
import ContentStudioLayoutWireframe from "./ContentStudioLayoutWireframe";
import { CONTENT_STUDIO_LAYOUT_OPTIONS } from "../utils/contentStudioLayouts";
import {
  ContentReviewVideoThumb,
  isContentReviewVideo,
} from "./ContentReviewVideo";

function MediaThumb({ asset }: { asset: ContentReviewAsset }) {
  if (isContentReviewVideo(asset)) {
    return <ContentReviewVideoThumb />;
  }
  return (
    <img src={asset.file_url} alt={asset.file_name} loading="lazy" className="h-full w-full object-cover" />
  );
}

export default function SchedulePostsWorkspace({
  rows,
  layoutType,
  activeSlot,
  saving,
  canUseLibrary,
  onSelectSlot,
  onUploadToSlot,
  onOpenLibrary,
  onReorderAssets,
  onMoveAssetToSlot,
  onRemoveAsset,
  onSelectAsset,
  onGoToSetup,
}: {
  rows: SchedulePostRow[];
  layoutType: ContentReviewLayout;
  activeSlot: number | null;
  saving: boolean;
  canUseLibrary: boolean;
  onSelectSlot: (slot: number) => void;
  onUploadToSlot: (slot: number, files: FileList | null) => void;
  onOpenLibrary: () => void;
  onReorderAssets: (draggedId: string, targetId: string) => void;
  onMoveAssetToSlot: (assetId: string, slot: number) => void;
  onRemoveAsset: (asset: ContentReviewAsset) => void;
  onSelectAsset: (assetId: string) => void;
  onGoToSetup?: () => void;
}) {
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const layoutMeta = useMemo(
    () => CONTENT_STUDIO_LAYOUT_OPTIONS.find((entry) => entry.value === layoutType),
    [layoutType],
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">Posts & media</h2>
        <p className="mt-1 text-xs text-white/45">{contentStudioCopy.editorMediaHint}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
        <div className="w-16 shrink-0">
          <ContentStudioLayoutWireframe layout={layoutType} compact active />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-white/45">Client link layout</p>
          <p className="text-xs font-semibold text-white">{layoutMeta?.label ?? layoutType}</p>
        </div>
        {onGoToSetup ? (
          <button
            type="button"
            onClick={onGoToSetup}
            className="shrink-0 rounded-lg border border-orange-500/30 px-2.5 py-1 text-[11px] font-semibold text-orange-200 hover:bg-orange-500/10"
          >
            Change in Setup
          </button>
        ) : null}
      </div>

      <p className="text-[11px] leading-relaxed text-white/45">
        {contentStudioCopy.hierarchyLine} Drag images between posts or reorder inside a post.{" "}
        Select a post to manage images here. Headline and caption for the selected post are in the panel at the top of this sidebar.
      </p>

      <div className="space-y-2">
        {rows.map((row) => {
          const isActive = activeSlot === row.slot;
          const primary = row.assets[0] ?? null;

          return (
            <article
              key={row.slot}
              className={`rounded-xl border transition ${
                isActive
                  ? "border-orange-500/40 bg-orange-500/5 ring-1 ring-orange-500/20"
                  : dragOverSlot === row.slot
                    ? "border-orange-400/50 bg-orange-500/10"
                    : "border-white/10 bg-black/30"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectSlot(row.slot)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
              >
                <span className="text-sm font-semibold text-white">{row.label}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
                  {row.hasMedia ? `${row.assetCount} image${row.assetCount === 1 ? "" : "s"}` : "Empty"}
                  {row.hasCaption ? " · copy" : ""}
                </span>
              </button>

              <div className="border-t border-white/10 p-3"
                onDragOver={(event) => {
                  if (
                    event.dataTransfer.types.includes(CONTENT_REVIEW_ASSET_DRAG_TYPE) ||
                    event.dataTransfer.types.includes("Files")
                  ) {
                    event.preventDefault();
                    setDragOverSlot(row.slot);
                  }
                }}
                onDragLeave={() => setDragOverSlot((current) => (current === row.slot ? null : current))}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOverSlot(null);
                  const draggedId = readDraggedAssetId(event);
                  if (draggedId) {
                    onMoveAssetToSlot(draggedId, row.slot);
                    return;
                  }
                  if (event.dataTransfer.files?.length) {
                    onUploadToSlot(row.slot, event.dataTransfer.files);
                  }
                }}
              >
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">Images</p>
                  {row.assets.length === 0 ? (
                    <label
                      className={`flex min-h-[88px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-3 py-4 text-center text-xs text-white/50 ${
                        dragOverSlot === row.slot
                          ? "border-orange-400/60 bg-orange-500/10"
                          : "border-orange-500/25 bg-orange-500/5"
                      }`}
                    >
                      <Upload size={18} className="text-orange-300/80" />
                      <span className="mt-2">Drop images here or tap to upload</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        className="hidden"
                        disabled={saving}
                        onChange={(event) => {
                          onUploadToSlot(row.slot, event.target.files);
                          event.target.value = "";
                        }}
                      />
                    </label>
                  ) : (
                    <div className="space-y-1.5">
                      {row.assets.map((asset) => (
                        <div
                          key={asset.id}
                          draggable
                          onDragStart={(event) => setDraggedAssetId(event, asset.id)}
                          onDragOver={(event) => {
                            if (event.dataTransfer.types.includes(CONTENT_REVIEW_ASSET_DRAG_TYPE)) {
                              event.preventDefault();
                            }
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const draggedId = readDraggedAssetId(event);
                            if (draggedId) onReorderAssets(draggedId, asset.id);
                          }}
                          className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/50 p-1.5"
                        >
                          <GripVertical size={14} className="shrink-0 text-white/30" />
                          <button
                            type="button"
                            onClick={() => onSelectAsset(asset.id)}
                            className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-white/10"
                          >
                            <MediaThumb asset={asset} />
                          </button>
                          <p className="min-w-0 flex-1 truncate text-[11px] text-white/70">{asset.file_name}</p>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => onRemoveAsset(asset)}
                            className="rounded p-1 text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                            aria-label="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 px-2 py-1 text-[11px] font-semibold text-white/70 hover:bg-white/5">
                        <Plus size={12} />
                        Add more
                        <input
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          className="hidden"
                          disabled={saving}
                          onChange={(event) => {
                            onUploadToSlot(row.slot, event.target.files);
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  )}
                  {canUseLibrary ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        onSelectSlot(row.slot);
                        onOpenLibrary();
                      }}
                      className="text-[11px] font-semibold text-orange-200 hover:text-orange-100 disabled:opacity-50"
                    >
                      Pick from client library
                    </button>
                  ) : null}
                </div>

                {isActive ? (
                  <p className="mt-2 flex items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-2.5 py-2 text-[11px] text-orange-100/90">
                    <ImageIcon size={14} className="mt-0.5 shrink-0" />
                    {primary
                      ? "Edit headline and caption for this post in the selected post panel at the top of the sidebar."
                      : "Upload an image above, then add text in the selected post panel at the top of the sidebar."}
                  </p>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
      {saving ? (
        <p className="inline-flex items-center gap-2 text-xs text-white/45">
          <Loader2 size={12} className="animate-spin" />
          Saving…
        </p>
      ) : null}
    </div>
  );
}
