import { Image, Loader2, Trash2, Upload } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  CONTENT_REVIEW_UPLOAD_LIMIT_BYTES,
  deleteContentClientMedia,
  formatContentReviewFileSize,
  listContentClientMedia,
  uploadContentClientMedia,
  type ContentClient,
  type ContentClientMedia,
} from "../services/contentReviewService";
import { setDraggedLibraryMediaId } from "../utils/contentStudioLibraryDrag";

function MediaThumb({ media }: { media: ContentClientMedia }) {
  const isVideo = media.asset_type === "video" || media.mime_type?.startsWith("video/");
  if (isVideo) {
    return (
      <video
        src={media.file_url}
        className="h-full w-full object-cover"
        muted
        playsInline
      />
    );
  }
  return (
    <img
      src={media.file_url}
      alt={media.label ?? media.file_name}
      loading="lazy"
      decoding="async"
      className="h-full w-full object-cover"
    />
  );
}

export default function ContentClientMediaLibrary({
  client,
  organizationId,
  officeId,
  userId,
  selectable = false,
  selectedIds = [],
  onSelect,
  onUploaded,
  onDeleted,
  compact = false,
  syncFromPostsOnLoad = false,
  draggableToPosts = false,
}: {
  client: ContentClient;
  organizationId: string;
  officeId: string;
  userId: string | null;
  selectable?: boolean;
  selectedIds?: string[];
  onSelect?: (media: ContentClientMedia) => void;
  onUploaded?: () => void;
  onDeleted?: () => void;
  compact?: boolean;
  /** Syncs post media into the library (slower). Use on the dedicated Media tab. */
  syncFromPostsOnLoad?: boolean;
  draggableToPosts?: boolean;
}) {
  const [items, setItems] = useState<ContentClientMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setItems(
        await listContentClientMedia({
          organizationId,
          officeId,
          clientId: client.id,
          uploadedBy: userId,
          syncFromPosts: syncFromPostsOnLoad,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client media.");
    } finally {
      setLoading(false);
    }
  }, [client.id, officeId, organizationId, syncFromPostsOnLoad, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUpload(files: FileList | null) {
    if (!files || !userId) return;
    try {
      setSaving(true);
      setError("");
      for (const file of Array.from(files)) {
        await uploadContentClientMedia({
          client,
          file,
          uploadedBy: userId,
        });
      }
      setItems(
        await listContentClientMedia({
          organizationId,
          officeId,
          clientId: client.id,
          uploadedBy: userId,
          syncFromPosts: true,
        }),
      );
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload media.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(media: ContentClientMedia) {
    const confirmed = window.confirm(`Remove "${media.file_name}" from the client library? Posts already using it will keep their copy.`);
    if (!confirmed) return;
    try {
      setSaving(true);
      await deleteContentClientMedia(media);
      await load();
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete media.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`rounded-xl border border-white/10 bg-white/5 ${compact ? "p-3" : "p-4"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className={`font-semibold ${compact ? "text-sm" : "text-base"}`}>Client media library</h3>
          <p className="mt-1 text-xs text-white/45">
            One entry per file. Post uploads are synced here automatically without creating duplicates.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-black hover:bg-orange-400">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          Upload
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            disabled={saving || !userId}
            onChange={(event) => {
              void handleUpload(event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-white/35">
        Max {formatContentReviewFileSize(CONTENT_REVIEW_UPLOAD_LIMIT_BYTES)} per file after compression.
      </p>
      {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-white/50">
          <Loader2 size={16} className="animate-spin" />
          Loading library...
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 bg-black/30 px-4 py-8 text-center">
          <Image className="text-white/25" size={28} />
          <p className="mt-2 text-sm text-white/50">No media for this client yet.</p>
          <p className="mt-1 text-xs text-white/35">Upload here or add media to a post — it will show up here automatically.</p>
        </div>
      ) : (
        <div className={`mt-4 grid gap-2 ${compact ? "grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4"}`}>
          {items.map((media) => {
            const selected = selectedIds.includes(media.id);
            return (
              <div
                key={media.id}
                draggable={draggableToPosts}
                onDragStart={
                  draggableToPosts
                    ? (event) => {
                        setDraggedLibraryMediaId(media.id, event);
                      }
                    : undefined
                }
                className={`group relative overflow-hidden rounded-xl border bg-black/40 ${
                  selected ? "border-orange-500 ring-1 ring-orange-500/40" : "border-white/10"
                } ${draggableToPosts ? "cursor-grab active:cursor-grabbing" : ""}`}
              >
                <div className="aspect-square">
                  <MediaThumb media={media} />
                </div>
                <div className="border-t border-white/10 px-2 py-1.5">
                  <p className="truncate text-[10px] font-medium text-white/75">{media.file_name}</p>
                  {media.label ? <p className="truncate text-[9px] text-white/40">{media.label}</p> : null}
                </div>
                <div className="absolute inset-x-0 top-0 flex justify-between gap-1 p-1 opacity-0 transition group-hover:opacity-100">
                  {selectable && onSelect ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onSelect(media)}
                      className="flex-1 rounded-lg bg-orange-500 px-2 py-1 text-[10px] font-bold text-black"
                    >
                      Add to post
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDelete(media)}
                    className="rounded-lg border border-red-500/30 bg-black/70 p-1 text-red-200"
                    aria-label="Delete from library"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
