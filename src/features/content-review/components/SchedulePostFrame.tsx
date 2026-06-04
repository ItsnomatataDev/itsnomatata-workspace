import {
  FolderOpen,
  ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { useState } from "react";
import type { ContentReviewAsset, ContentReviewDraft } from "../services/contentReviewService";
import { contentReviewSlotAnchorId } from "../utils/assetDisplaySlots";
import {
  CONTENT_REVIEW_ASSET_DRAG_TYPE,
  readDraggedAssetId,
} from "../utils/contentStudioAssetOrdering";
import {
  CONTENT_CLIENT_MEDIA_DRAG_TYPE,
  readDraggedLibraryMediaId,
} from "../utils/contentStudioLibraryDrag";
import { postLabel } from "../utils/contentStudioTerms";
import {
  ContentReviewVideoPlayer,
  isContentReviewVideo,
} from "./ContentReviewVideo";
import type { SchedulePostRow } from "../utils/contentStudioSchedule";
import PostFrameAiSuggestions, { type PostFrameAiSuggestion } from "./PostFrameAiSuggestions";

const FRAME_AI_ACTIONS: Array<{
  label: string;
  instruction: string;
  tone?: string;
  platform?: string;
  analyze?: boolean;
}> = [
  { label: "Generate caption", instruction: "Generate a new caption" },
  { label: "Rewrite caption", instruction: "Rewrite this caption" },
  { label: "Make shorter", instruction: "Make this caption shorter" },
  { label: "More professional", instruction: "Make this caption more professional", tone: "professional" },
  { label: "Add hashtags", instruction: "Add relevant hashtags" },
  { label: "Add emojis", instruction: "Add tasteful emojis" },
  { label: "Instagram version", instruction: "Rewrite for Instagram", tone: "engaging", platform: "instagram" },
  { label: "Facebook version", instruction: "Rewrite for Facebook", tone: "friendly", platform: "facebook" },
  { label: "Suggest ideas", instruction: "Suggest three caption ideas and pick the best one" },
  {
    label: "Analyze image + caption",
    instruction: "Analyze the media mood and write a caption",
    analyze: true,
  },
];

function inputClass() {
  return "w-full rounded-xl border border-white/10 bg-black/60 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-400/70 disabled:opacity-50";
}

function MediaPreview({ asset }: { asset: ContentReviewAsset }) {
  return (
    <div className="relative aspect-4/5 max-h-[280px] w-full overflow-hidden rounded-xl border border-white/10 bg-black">
      {isContentReviewVideo(asset) ? (
        <ContentReviewVideoPlayer
          asset={asset}
          className="h-full w-full object-contain"
          controls
        />
      ) : (
        <img
          src={asset.file_url}
          alt={asset.file_name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      )}
    </div>
  );
}

export default function SchedulePostFrame({
  row,
  draft,
  isActive,
  saving,
  canUseLibrary,
  aiLoading,
  aiSuggestion,
  onSelect,
  onUpload,
  onOpenLibrary,
  onLibraryMediaDrop,
  onRemoveAsset,
  onUpdateCopy,
  onAiAction,
  onDismissAi,
  onApplyAiCaption,
  onApplyAiHashtags,
  onReplaceAiCaption,
}: {
  row: SchedulePostRow;
  draft: ContentReviewDraft;
  isActive: boolean;
  saving: boolean;
  canUseLibrary: boolean;
  aiLoading: boolean;
  aiSuggestion: PostFrameAiSuggestion | null;
  onSelect: () => void;
  onUpload: (files: FileList | null) => void;
  onOpenLibrary: () => void;
  onLibraryMediaDrop?: (mediaId: string) => void;
  onRemoveAsset: (asset: ContentReviewAsset) => void;
  onUpdateCopy: (field: "heading" | "caption", value: string, assetId: string | null) => void;
  onAiAction: (
    instruction: string,
    options?: { tone?: string; platform?: string; analyze?: boolean },
  ) => void;
  onDismissAi: () => void;
  onApplyAiCaption: (caption: string) => void;
  onApplyAiHashtags: (tags: string[]) => void;
  onReplaceAiCaption: (caption: string) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const primary = row.assets[0] ?? null;
  const heading = primary?.heading ?? "";
  const caption = primary?.caption ?? "";
  const approvalLabel =
    draft.status === "changes_requested"
      ? "Changes requested"
      : draft.status === "sent_to_client" || draft.status === "viewed"
        ? "With client"
        : draft.status === "approved"
          ? "Approved"
          : "In progress";

  return (
    <article
      id={contentReviewSlotAnchorId(row.slot)}
      className={`scroll-mt-6 overflow-hidden rounded-2xl border bg-black shadow-xl transition ${
        isActive
          ? "border-orange-500/50 ring-2 ring-orange-500/25"
          : "border-white/10 hover:border-white/20"
      }`}
      onClick={onSelect}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold text-white">{postLabel(row.slot)}</h3>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              row.hasMedia ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-white/45"
            }`}
          >
            {row.hasMedia ? "Media ✓" : "No media"}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
              row.hasCaption ? "bg-emerald-500/15 text-emerald-200" : "bg-white/10 text-white/45"
            }`}
          >
            {row.hasCaption ? "Caption ✓" : "No caption"}
          </span>
          <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-semibold text-orange-200">
            {approvalLabel}
          </span>
        </div>
      </header>

      <div className="grid gap-0 lg:grid-cols-2">
        {/* Media column */}
        <div
          className={`border-b border-white/10 p-4 lg:border-b-0 lg:border-r ${
            dragOver ? "bg-orange-500/10" : "bg-neutral-950/80"
          }`}
          onDragOver={(event) => {
            if (
              event.dataTransfer.types.includes(CONTENT_REVIEW_ASSET_DRAG_TYPE) ||
              event.dataTransfer.types.includes(CONTENT_CLIENT_MEDIA_DRAG_TYPE) ||
              event.dataTransfer.types.includes("Files")
            ) {
              event.preventDefault();
              setDragOver(true);
            }
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDragOver(false);
            if (event.dataTransfer.files?.length) {
              onUpload(event.dataTransfer.files);
              return;
            }
            const libraryId = readDraggedLibraryMediaId(event);
            if (libraryId && onLibraryMediaDrop) {
              onLibraryMediaDrop(libraryId);
            }
          }}
        >
          {primary ? (
            <div className="space-y-3" onClick={(event) => event.stopPropagation()}>
              <MediaPreview asset={primary} />
              <div className="flex flex-wrap gap-2">
                {canUseLibrary ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={onOpenLibrary}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/35 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100 hover:bg-orange-500/15 disabled:opacity-60"
                  >
                    <FolderOpen size={14} />
                    Choose from library
                  </button>
                ) : null}
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/5">
                  <Upload size={14} />
                  Replace media
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
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => onRemoveAsset(primary)}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-60"
                >
                  <Trash2 size={14} />
                  Remove
                </button>
              </div>
              {row.assets.length > 1 ? (
                <p className="text-[11px] text-white/40">
                  +{row.assets.length - 1} more in carousel (first image shown on client link)
                </p>
              ) : null}
            </div>
          ) : (
            <div
              className={`flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed px-4 py-8 text-center ${
                dragOver
                  ? "border-orange-400/60 bg-orange-500/10"
                  : "border-orange-500/25 bg-orange-500/5"
              }`}
            >
              <div className="flex gap-2 text-orange-300/80">
                <ImageIcon size={22} />
                <Video size={22} />
              </div>
              <p className="mt-3 text-sm font-medium text-white/80">Drop image or video here</p>
              <p className="mt-1 text-xs text-white/45">Or use the buttons below</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {canUseLibrary ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenLibrary();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-black hover:bg-orange-400 disabled:opacity-60"
                  >
                    <FolderOpen size={14} />
                    Media library
                  </button>
                ) : null}
                <label
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/5"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Upload size={14} />
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
          )}
        </div>

        {/* Text column */}
        <div
          className="space-y-3 bg-neutral-950/40 p-4"
          onClick={(event) => event.stopPropagation()}
        >
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
              Headline (optional)
            </span>
            <input
              type="text"
              value={heading}
              disabled={!primary || saving}
              placeholder={primary ? "Short title on this slide" : "Add media first"}
              className={inputClass()}
              onChange={(event) =>
                onUpdateCopy("heading", event.target.value, primary?.id ?? null)
              }
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">
              Caption
            </span>
            <textarea
              value={caption}
              disabled={!primary || saving}
              rows={5}
              placeholder="Write caption here…"
              className={inputClass()}
              onChange={(event) =>
                onUpdateCopy("caption", event.target.value, primary?.id ?? null)
              }
            />
          </label>

          <div className="rounded-xl border border-white/10 bg-black/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles size={14} className="text-orange-300" />
              <p className="text-[11px] font-semibold text-orange-100">AI caption tools</p>
              {aiLoading ? <Loader2 size={14} className="animate-spin text-orange-200" /> : null}
            </div>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {FRAME_AI_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={
                    aiLoading ||
                    saving ||
                    (action.analyze ? !primary : false)
                  }
                  onClick={() =>
                    onAiAction(action.instruction, {
                      tone: action.tone,
                      platform: action.platform,
                      analyze: action.analyze,
                    })
                  }
                  className="rounded-lg border border-white/10 px-2 py-1.5 text-left text-[10px] font-semibold text-white/75 hover:border-orange-500/30 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>

          {aiSuggestion ? (
            <PostFrameAiSuggestions
              suggestion={aiSuggestion}
              onApplyCaption={onApplyAiCaption}
              onApplyHashtags={onApplyAiHashtags}
              onReplaceCaption={onReplaceAiCaption}
              onDismiss={onDismissAi}
              applyCaptionLabel="Apply caption"
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}
