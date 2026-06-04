import { FolderOpen, GripVertical, Plus, Trash2, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ContentReviewAsset } from "../services/contentReviewService";
import { assetDisplaySlot, assetsInDisplaySlot } from "../utils/assetDisplaySlots";
import {
  CONTENT_REVIEW_ASSET_DRAG_TYPE,
  readDraggedAssetId,
  setDraggedAssetId,
} from "../utils/contentStudioAssetOrdering";
import {
  CONTENT_STUDIO_POSTS_PER_SCHEDULE,
  contentStudioCopy,
  postLabel,
} from "../utils/contentStudioTerms";
import {
  ContentReviewVideoThumb,
  isContentReviewVideo,
} from "./ContentReviewVideo";

function Thumb({ asset }: { asset: ContentReviewAsset }) {
  if (isContentReviewVideo(asset)) {
    return <ContentReviewVideoThumb />;
  }
  return (
    <img src={asset.file_url} alt={asset.file_name} loading="lazy" className="h-full w-full object-cover" />
  );
}

export default function PostMediaFilmstrip({
  assets,
  selectedAssetId,
  activeDisplaySlot = null,
  saving,
  canUseLibrary,
  onSelect,
  onSelectSlot,
  onReorder,
  onMoveToSlot,
  onRemove,
  onUpload,
  onUploadToSlot,
  onOpenLibrary,
}: {
  assets: ContentReviewAsset[];
  selectedAssetId: string | null;
  activeDisplaySlot?: number | null;
  saving: boolean;
  canUseLibrary: boolean;
  onSelect: (assetId: string) => void;
  onSelectSlot: (slot: number) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onMoveToSlot: (assetId: string, slot: number) => void;
  onRemove: (asset: ContentReviewAsset) => void;
  onUpload: (files: FileList | null) => void;
  onUploadToSlot: (slot: number, files: FileList | null) => void;
  onOpenLibrary: () => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null);

  const postSlots = useMemo(() => {
    return Array.from({ length: CONTENT_STUDIO_POSTS_PER_SCHEDULE }, (_, slot) => ({
      slot,
      assets: assetsInDisplaySlot(assets, slot),
    }));
  }, [assets]);

  useEffect(() => {
    if (activeDisplaySlot == null || !stripRef.current) return;
    const thumb = stripRef.current.querySelector<HTMLElement>(`[data-post-slot="${activeDisplaySlot}"]`);
    thumb?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeDisplaySlot, assets]);

  return (
    <div className="shrink-0 border-t border-white/10 bg-black px-3 py-3 sm:px-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
          {contentStudioCopy.editorFilmstrip}
        </p>
        <p className="text-[10px] text-white/35">Drag between posts · drop files on a post column</p>
        <div className="flex flex-wrap gap-2">
          {canUseLibrary ? (
            <button
              type="button"
              disabled={saving}
              onClick={onOpenLibrary}
              className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1.5 text-xs font-semibold text-orange-100 hover:bg-orange-500/15 disabled:opacity-60"
            >
              <FolderOpen size={13} />
              Library
            </button>
          ) : null}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-1.5 text-xs font-semibold text-white/80 hover:bg-white/5">
            <Upload size={13} />
            Upload to selected post
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              disabled={saving}
              onChange={(event) => {
                onUpload(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </div>
      <div ref={stripRef} className="flex gap-2 overflow-x-auto pb-1">
        {postSlots.map(({ slot, assets: slotAssets }) => {
          const isActivePost = activeDisplaySlot === slot;
          return (
            <div
              key={slot}
              data-post-slot={slot}
              onDragOver={(event) => {
                if (
                  event.dataTransfer.types.includes(CONTENT_REVIEW_ASSET_DRAG_TYPE) ||
                  event.dataTransfer.types.includes("Files")
                ) {
                  event.preventDefault();
                  setDragOverSlot(slot);
                }
              }}
              onDragLeave={() => setDragOverSlot((current) => (current === slot ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                setDragOverSlot(null);
                const draggedId = readDraggedAssetId(event);
                if (draggedId) {
                  onMoveToSlot(draggedId, slot);
                  return;
                }
                if (event.dataTransfer.files?.length) {
                  onUploadToSlot(slot, event.dataTransfer.files);
                }
              }}
              className={`flex min-w-[92px] shrink-0 flex-col gap-1 rounded-xl border p-1.5 transition ${
                isActivePost
                  ? "border-orange-500/50 bg-orange-500/10"
                  : dragOverSlot === slot
                    ? "border-orange-400/50 bg-orange-500/15"
                    : "border-white/10 bg-white/5"
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectSlot(slot)}
                className="w-full rounded-md px-1 py-0.5 text-left text-[10px] font-bold text-white/75 hover:bg-white/5"
              >
                {postLabel(slot)}
              </button>
              <div className="flex min-h-[72px] flex-col gap-1">
                {slotAssets.length === 0 ? (
                  <label className="flex flex-1 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-white/15 px-1 py-2 text-[9px] text-white/40 hover:border-orange-500/30">
                    <Plus size={14} />
                    Drop
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      disabled={saving}
                      onChange={(event) => {
                        onUploadToSlot(slot, event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </label>
                ) : (
                  slotAssets.map((asset) => (
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
                        if (draggedId) onReorder(draggedId, asset.id);
                      }}
                      className={`group relative ${
                        selectedAssetId === asset.id ? "ring-2 ring-orange-500 ring-offset-1 ring-offset-black" : ""
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(asset.id)}
                        className="block h-14 w-full overflow-hidden rounded-lg border border-white/15 bg-black/50"
                      >
                        <Thumb asset={asset} />
                      </button>
                      <GripVertical
                        size={10}
                        className="absolute bottom-0.5 left-0.5 text-white/40 opacity-0 group-hover:opacity-100"
                      />
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onRemove(asset)}
                        className="absolute right-0.5 top-0.5 rounded bg-black/75 p-0.5 text-red-300 opacity-0 group-hover:opacity-100 disabled:opacity-40"
                        aria-label="Remove"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
