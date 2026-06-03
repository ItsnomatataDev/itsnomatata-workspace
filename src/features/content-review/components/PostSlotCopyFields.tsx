import type { ContentReviewAsset, ContentReviewLayout } from "../services/contentReviewService";
import { contentStudioCopy, postLabel } from "../utils/contentStudioTerms";

function inputClass() {
  return "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-400/70 disabled:opacity-50";
}

export default function PostSlotCopyFields({
  slot,
  layoutType,
  primary,
  saving,
  unifiedScheduleCopy,
  compact = false,
  embed = false,
  onUpdate,
}: {
  slot: number;
  layoutType: ContentReviewLayout;
  primary: ContentReviewAsset | null;
  saving: boolean;
  unifiedScheduleCopy: boolean;
  compact?: boolean;
  /** Inside EditorSelectedPostPanel — skip outer title block. */
  embed?: boolean;
  onUpdate: (field: "heading" | "caption", value: string) => void;
}) {
  const heading = primary?.heading ?? "";
  const caption = primary?.caption ?? "";
  const splitLayout = layoutType === "split_media_text";
  const hasMedia = Boolean(primary);

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {!compact && !embed ? (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
            Text for {postLabel(slot)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-white/45">
            {splitLayout
              ? contentStudioCopy.editorPostCopySplitHint
              : contentStudioCopy.editorPostCopyHint}
          </p>
        </div>
      ) : null}
      {embed && hasMedia ? (
        <p className="text-[10px] leading-snug text-white/40">
          {splitLayout ? contentStudioCopy.editorPostCopySplitHint : contentStudioCopy.editorPostCopyHint}
        </p>
      ) : null}

      {!hasMedia ? (
        <p className="text-xs text-white/45">{contentStudioCopy.editorPostCopyNoMedia}</p>
      ) : (
        <>
          {unifiedScheduleCopy && !heading.trim() && !caption.trim() ? (
            <p className="text-[11px] text-white/40">{contentStudioCopy.editorPostCopyUnifiedNote}</p>
          ) : null}
          <label className="block space-y-1">
            <span className="text-[10px] text-white/40">Headline (optional)</span>
            <input
              type="text"
              value={heading}
              disabled={saving}
              placeholder="Short title on this slide"
              className={inputClass()}
              onChange={(event) => onUpdate("heading", event.target.value)}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] text-white/40">
              {splitLayout ? "Text beside image" : "Post caption"}
            </span>
            <textarea
              value={caption}
              disabled={saving}
              rows={compact ? 2 : 3}
              placeholder={
                splitLayout
                  ? "Write the copy that appears next to this image on the client link"
                  : "Caption for this post / slide"
              }
              className={inputClass()}
              onChange={(event) => onUpdate("caption", event.target.value)}
            />
          </label>
        </>
      )}
    </div>
  );
}
