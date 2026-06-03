import { X } from "lucide-react";
import type { ContentStudioAnalyzeMediaOutput } from "../../../lib/api/contentStudioAi";

export type PostFrameAiSuggestion = ContentStudioAnalyzeMediaOutput & {
  generatedCaption?: string;
};

export default function PostFrameAiSuggestions({
  suggestion,
  onApplyCaption,
  onApplyHashtags,
  onReplaceCaption,
  onDismiss,
  applyCaptionLabel = "Apply caption",
}: {
  suggestion: PostFrameAiSuggestion;
  onApplyCaption: (caption: string) => void;
  onApplyHashtags: (tags: string[]) => void;
  onReplaceCaption: (caption: string) => void;
  onDismiss: () => void;
  applyCaptionLabel?: string;
}) {
  const caption =
    suggestion.suggestedCaption ?? suggestion.generatedCaption ?? "";

  return (
    <div className="space-y-2 rounded-xl border border-orange-500/30 bg-orange-500/8 p-3 text-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-orange-100">AI suggestions</p>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"
          aria-label="Dismiss suggestions"
        >
          <X size={14} />
        </button>
      </div>
      {suggestion.confidenceScore != null ? (
        <p className="text-white/45">
          Confidence: {Math.round(suggestion.confidenceScore * 100)}%
        </p>
      ) : null}
      {suggestion.mood ? (
        <p>
          <span className="text-white/45">Mood:</span> {suggestion.mood}
        </p>
      ) : null}
      {suggestion.sceneDescription ? (
        <p className="leading-relaxed text-white/75">
          <span className="text-white/45">Scene:</span> {suggestion.sceneDescription}
        </p>
      ) : null}
      {caption ? (
        <p className="whitespace-pre-wrap leading-relaxed text-white/90">{caption}</p>
      ) : null}
      {suggestion.shortAlternative ? (
        <p className="text-white/55">Short: {suggestion.shortAlternative}</p>
      ) : null}
      {suggestion.hashtags.length > 0 ? (
        <p className="text-white/70">{suggestion.hashtags.join(" ")}</p>
      ) : null}
      {suggestion.platformCaptions?.instagram ? (
        <p className="text-white/60">Instagram: {suggestion.platformCaptions.instagram}</p>
      ) : null}
      {suggestion.platformCaptions?.facebook ? (
        <p className="text-white/60">Facebook: {suggestion.platformCaptions.facebook}</p>
      ) : null}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {caption ? (
          <>
            <button
              type="button"
              onClick={() => onApplyCaption(caption)}
              className="rounded-lg bg-orange-500 px-2.5 py-1.5 text-[11px] font-bold text-black hover:bg-orange-400"
            >
              {applyCaptionLabel}
            </button>
            <button
              type="button"
              onClick={() => onReplaceCaption(caption)}
              className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-white/5"
            >
              Replace caption
            </button>
          </>
        ) : null}
        {suggestion.hashtags.length > 0 ? (
          <button
            type="button"
            onClick={() => onApplyHashtags(suggestion.hashtags)}
            className="rounded-lg border border-white/15 px-2.5 py-1.5 text-[11px] font-semibold text-white/85 hover:bg-white/5"
          >
            Apply hashtags
          </button>
        ) : null}
      </div>
      <p className="text-[10px] text-white/35">Suggestions only — use Save on the toolbar when ready.</p>
    </div>
  );
}
