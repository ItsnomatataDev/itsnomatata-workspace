import type { ContentReviewDraft } from "../services/contentReviewService";
import type { SchedulePostRow } from "../utils/contentStudioSchedule";
import SchedulePostFrame from "./SchedulePostFrame";
import type { PostFrameAiSuggestion } from "./PostFrameAiSuggestions";

export default function SchedulePostFrameEditor({
  rows,
  draft,
  activeSlot,
  saving,
  canUseLibrary,
  aiLoadingSlot,
  aiBySlot,
  onSelectSlot,
  onUploadToSlot,
  onOpenLibrary,
  onAttachLibraryById,
  onRemoveAsset,
  onUpdateSlotCopy,
  onAiAction,
  onDismissAi,
  onApplyAiCaption,
  onApplyAiHashtags,
  onReplaceAiCaption,
}: {
  rows: SchedulePostRow[];
  draft: ContentReviewDraft;
  activeSlot: number | null;
  saving: boolean;
  canUseLibrary: boolean;
  aiLoadingSlot: number | null;
  aiBySlot: Record<number, PostFrameAiSuggestion | null>;
  onSelectSlot: (slot: number) => void;
  onUploadToSlot: (slot: number, files: FileList | null) => void;
  onOpenLibrary: (slot: number) => void;
  onAttachLibraryById: (slot: number, mediaId: string) => void;
  onRemoveAsset: (asset: import("../services/contentReviewService").ContentReviewAsset) => void;
  onUpdateSlotCopy: (
    slot: number,
    field: "heading" | "caption",
    value: string,
    assetId: string | null,
  ) => void;
  onAiAction: (
    slot: number,
    instruction: string,
    options?: { tone?: string; platform?: string; analyze?: boolean },
  ) => void;
  onDismissAi: (slot: number) => void;
  onApplyAiCaption: (slot: number, caption: string) => void;
  onApplyAiHashtags: (slot: number, tags: string[]) => void;
  onReplaceAiCaption: (slot: number, caption: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-8">
      <p className="text-center text-xs text-white/45">
        Edit each post below — this layout matches what clients see on the review link. Use Save on the
        toolbar when you are done.
      </p>
      {rows.map((row) => (
        <SchedulePostFrame
          key={row.slot}
          row={row}
          draft={draft}
          isActive={activeSlot === row.slot}
          saving={saving}
          canUseLibrary={canUseLibrary}
          aiLoading={aiLoadingSlot === row.slot}
          aiSuggestion={aiBySlot[row.slot] ?? null}
          onSelect={() => onSelectSlot(row.slot)}
          onUpload={(files) => onUploadToSlot(row.slot, files)}
          onOpenLibrary={() => onOpenLibrary(row.slot)}
          onLibraryMediaDrop={(mediaId) => onAttachLibraryById(row.slot, mediaId)}
          onRemoveAsset={onRemoveAsset}
          onUpdateCopy={(field, value, assetId) =>
            onUpdateSlotCopy(row.slot, field, value, assetId)
          }
          onAiAction={(instruction, options) => onAiAction(row.slot, instruction, options)}
          onDismissAi={() => onDismissAi(row.slot)}
          onApplyAiCaption={(caption) => onApplyAiCaption(row.slot, caption)}
          onApplyAiHashtags={(tags) => onApplyAiHashtags(row.slot, tags)}
          onReplaceAiCaption={(caption) => onReplaceAiCaption(row.slot, caption)}
        />
      ))}
    </div>
  );
}
