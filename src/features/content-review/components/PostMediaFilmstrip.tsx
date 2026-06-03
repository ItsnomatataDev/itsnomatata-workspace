import { FolderOpen, GripVertical, Plus, Trash2, Upload } from "lucide-react";
import type { ContentReviewAsset } from "../services/contentReviewService";

function Thumb({ asset }: { asset: ContentReviewAsset }) {
  const isVideo = asset.asset_type === "video" || asset.mime_type?.startsWith("video/");
  if (isVideo) {
    return <video src={asset.file_url} className="h-full w-full object-cover" muted playsInline />;
  }
  return (
    <img src={asset.file_url} alt={asset.file_name} loading="lazy" className="h-full w-full object-cover" />
  );
}

export default function PostMediaFilmstrip({
  assets,
  selectedAssetId,
  saving,
  canUseLibrary,
  onSelect,
  onReorder,
  onRemove,
  onUpload,
  onOpenLibrary,
}: {
  assets: ContentReviewAsset[];
  selectedAssetId: string | null;
  saving: boolean;
  canUseLibrary: boolean;
  onSelect: (assetId: string) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onRemove: (asset: ContentReviewAsset) => void;
  onUpload: (files: FileList | null) => void;
  onOpenLibrary: () => void;
}) {
  return (
    <div className="shrink-0 border-t border-white/10 bg-black px-3 py-3 sm:px-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Post sequence</p>
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
            Upload
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {assets.length === 0 ? (
          <button
            type="button"
            onClick={canUseLibrary ? onOpenLibrary : undefined}
            className="flex h-20 w-28 shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-orange-500/30 bg-orange-500/5 text-xs text-white/50"
          >
            <Plus size={18} className="text-orange-300/70" />
            <span className="mt-1">Add media</span>
          </button>
        ) : (
          assets.map((asset, index) => (
            <div
              key={asset.id}
              draggable
              onDragStart={(event) => event.dataTransfer.setData("text/plain", asset.id)}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes("text/plain")) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                const draggedId = event.dataTransfer.getData("text/plain");
                if (draggedId) onReorder(draggedId, asset.id);
              }}
              className={`group relative shrink-0 ${selectedAssetId === asset.id ? "ring-2 ring-orange-500 ring-offset-2 ring-offset-black" : ""}`}
            >
              <button
                type="button"
                onClick={() => onSelect(asset.id)}
                className="block h-20 w-20 overflow-hidden rounded-xl border border-white/15 bg-black/50"
              >
                <Thumb asset={asset} />
              </button>
              <span className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-white/80">
                {index + 1}
              </span>
              <GripVertical
                size={12}
                className="absolute bottom-1 left-1 text-white/40 opacity-0 transition group-hover:opacity-100"
              />
              <button
                type="button"
                disabled={saving}
                onClick={() => onRemove(asset)}
                className="absolute right-1 top-1 rounded bg-black/75 p-1 text-red-300 opacity-0 transition hover:bg-red-500/20 group-hover:opacity-100 disabled:opacity-40"
                aria-label="Remove"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
