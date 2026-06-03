import type { ContentStudioImageAnalysis } from "../services/contentReviewService";

export default function ContentStudioImageAnalysisPanel({
  analysis,
  onApplyCaption,
  onApplyHashtags,
  applyCaptionLabel = "Use as social caption",
}: {
  analysis: ContentStudioImageAnalysis;
  onApplyCaption: (caption: string) => void;
  onApplyHashtags?: (tags: string[]) => void;
  applyCaptionLabel?: string;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-orange-500/25 bg-orange-500/8 p-3 text-sm">
      <p>
        <span className="text-white/50">Mood:</span> {analysis.mood}
      </p>
      <p>
        <span className="text-white/50">Scene:</span> {analysis.sceneDescription}
      </p>
      <p className="whitespace-pre-wrap text-white/85">
        <span className="text-white/50">Suggested caption:</span> {analysis.generatedCaption}
      </p>
      {analysis.hashtags.length > 0 ? (
        <p className="text-white/70">
          <span className="text-white/50">Hashtags:</span> {analysis.hashtags.join(" ")}
        </p>
      ) : null}
      {analysis.shortAlternative ? (
        <p className="text-xs text-white/55">Shorter option: {analysis.shortAlternative}</p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onApplyCaption(analysis.generatedCaption)}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-black hover:bg-orange-400"
        >
          {applyCaptionLabel}
        </button>
        {analysis.hashtags.length > 0 && onApplyHashtags ? (
          <button
            type="button"
            onClick={() => onApplyHashtags(analysis.hashtags)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/5"
          >
            Append hashtags
          </button>
        ) : null}
      </div>
    </div>
  );
}
