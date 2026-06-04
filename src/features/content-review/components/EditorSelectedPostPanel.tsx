import type { ContentReviewAsset, ContentReviewLayout } from "../services/contentReviewService";
import { postLabel } from "../utils/contentStudioTerms";
import PostSlotCopyFields from "./PostSlotCopyFields";
import {
  ContentReviewVideoThumb,
  isContentReviewVideo,
} from "./ContentReviewVideo";

function PostThumb({ asset }: { asset: ContentReviewAsset }) {
  return (
    <div className="h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black">
      {isContentReviewVideo(asset) ? (
        <ContentReviewVideoThumb />
      ) : (
        <img
          src={asset.file_url}
          alt={asset.file_name}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export default function EditorSelectedPostPanel({
  slot,
  layoutType,
  primary,
  saving,
  unifiedScheduleCopy,
  onUpdate,
}: {
  slot: number;
  layoutType: ContentReviewLayout;
  primary: ContentReviewAsset | null;
  saving: boolean;
  unifiedScheduleCopy: boolean;
  onUpdate: (field: "heading" | "caption", value: string) => void;
}) {
  const hasCopy = Boolean(primary?.heading?.trim() || primary?.caption?.trim());

  return (
    <section className="shrink-0 border-b border-white/10 bg-linear-to-b from-orange-500/8 to-black px-4 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-bold text-black">
            {postLabel(slot)}
          </span>
          <span className="truncate text-xs text-white/50">
            {primary ? "Text beside this image" : "No image yet"}
          </span>
        </div>
        {hasCopy ? (
          <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
            Has copy
          </span>
        ) : null}
      </div>

      <div className="flex gap-3">
        {primary ? (
          <PostThumb asset={primary} />
        ) : (
          <div className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl border border-dashed border-white/15 bg-white/5 px-1 text-center text-[10px] leading-tight text-white/35">
            Add image in filmstrip
          </div>
        )}
        <div className="min-w-0 flex-1">
          <PostSlotCopyFields
            slot={slot}
            layoutType={layoutType}
            primary={primary}
            saving={saving}
            unifiedScheduleCopy={unifiedScheduleCopy}
            compact
            embed
            onUpdate={onUpdate}
          />
        </div>
      </div>
    </section>
  );
}
