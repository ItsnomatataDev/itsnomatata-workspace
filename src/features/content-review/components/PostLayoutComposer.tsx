import { GripVertical, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useMemo } from "react";
import {
  uploadContentReviewAsset,
  type ContentClient,
  type ContentClientMedia,
  type ContentReviewAsset,
  type ContentReviewDraft,
} from "../services/contentReviewService";
import ContentClientMediaLibrary from "./ContentClientMediaLibrary";
import {
  ContentReviewVideoThumb,
  isContentReviewVideo,
} from "./ContentReviewVideo";

function MediaThumb({ asset }: { asset: ContentReviewAsset }) {
  if (isContentReviewVideo(asset)) {
    return <ContentReviewVideoThumb />;
  }
  return (
    <img
      src={asset.file_url}
      alt={asset.file_name}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
    />
  );
}

export default function PostLayoutComposer({
  draft,
  client,
  organizationId,
  officeId,
  userId,
  assets,
  saving,
  onAssetsChange,
  onAttachLibraryMedia,
  onReorder,
  onRemove,
  onMessage,
  onError,
}: {
  draft: ContentReviewDraft;
  client: ContentClient | null;
  organizationId: string;
  officeId: string;
  userId: string | null;
  assets: ContentReviewAsset[];
  saving: boolean;
  onAssetsChange: (assets: ContentReviewAsset[]) => void;
  onAttachLibraryMedia: (media: ContentClientMedia) => Promise<void>;
  onReorder: (draggedId: string, targetId: string) => Promise<void>;
  onRemove: (asset: ContentReviewAsset) => Promise<void>;
  onMessage: (message: string) => void;
  onError: (message: string) => void;
}) {
  const orderedAssets = useMemo(() => {
    return [...assets]
      .filter((asset) => asset.is_selected !== false)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [assets]);

  async function handleDirectUpload(files: FileList | null) {
    if (!files || !userId) return;
    try {
      let order = assets.length;
      const added: ContentReviewAsset[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadContentReviewAsset({
          draft,
          file,
          uploadedBy: userId,
          sortOrder: order,
          displaySlot: order,
        });
        added.push(uploaded);
        order += 1;
      }
      onAssetsChange([...assets, ...added]);
      onMessage(`${added.length} file(s) added to this post. Drag to reorder.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to upload media.");
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Post layout</h3>
            <p className="mt-1 text-xs text-white/45">
              Drag images into order. Story text and social caption live in the fields above — not under each image.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/5">
            <Upload size={14} />
            Upload to post
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              disabled={saving || !userId}
              onChange={(event) => {
                void handleDirectUpload(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        {orderedAssets.length === 0 ? (
          <div
            className="mt-4 rounded-xl border border-dashed border-orange-500/25 bg-orange-500/5 px-4 py-8 text-center text-sm text-white/55"
            onDragOver={(event) => event.preventDefault()}
          >
            <Plus className="mx-auto text-orange-300/60" size={22} />
            <p className="mt-2">Drop media here or pick from the client library below.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {orderedAssets.map((asset, index) => (
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
                  if (draggedId) void onReorder(draggedId, asset.id);
                }}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/35 p-2"
              >
                <GripVertical className="shrink-0 text-white/30" size={18} />
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-white/10">
                  <MediaThumb asset={asset} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white/80">{asset.file_name}</p>
                  <p className="text-[11px] text-white/40">
                    Block {index + 1} · {asset.asset_type}
                    {asset.library_media_id ? " · from library" : ""}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void onRemove(asset)}
                  className="rounded-lg border border-red-500/25 p-2 text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                  aria-label="Remove from post"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
        {saving ? (
          <p className="mt-2 inline-flex items-center gap-2 text-xs text-white/45">
            <Loader2 size={12} className="animate-spin" />
            Saving layout...
          </p>
        ) : null}
      </div>

      {client ? (
        <ContentClientMediaLibrary
          client={client}
          organizationId={organizationId}
          officeId={officeId}
          userId={userId}
          selectable
          compact
          onSelect={(media) => void onAttachLibraryMedia(media)}
          onUploaded={() => onMessage("Client library updated.")}
        />
      ) : (
        <p className="rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-white/45">
          Assign a client to this post to use the shared media library.
        </p>
      )}
    </div>
  );
}
