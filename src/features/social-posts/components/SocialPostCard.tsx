import { ArrowRight, Clock3, Trash2, Wand2 } from "lucide-react";
import type { SocialQueueItem } from "../../../lib/hooks/useSocialPosts";
import PlatformBadge from "./PlatformBadge";

const STATUS_STYLES: Record<SocialQueueItem["status"], string> = {
  draft: "bg-white/10 text-white/70",
  review: "bg-amber-500/15 text-amber-200",
  approval: "bg-orange-500/15 text-orange-200",
  scheduled: "bg-sky-500/15 text-sky-200",
  published: "bg-emerald-500/15 text-emerald-200",
};

const PRIORITY_STYLES: Record<SocialQueueItem["priority"], string> = {
  low: "text-white/55",
  medium: "text-amber-200",
  high: "text-red-300",
};

export default function SocialPostCard({
  item,
  busy = false,
  onAdvanceStatus,
  onUseAi,
  onDelete,
}: {
  item: SocialQueueItem;
  busy?: boolean;
  onAdvanceStatus?: (item: SocialQueueItem) => void;
  onUseAi?: (item: SocialQueueItem) => void;
  onDelete?: (item: SocialQueueItem) => void;
}) {
  const progress = Math.min((item.spentHours / item.estimatedHours) * 100, 100);
  const isFinal = item.status === "published";

  return (
    <article className="rounded-3xl border border-white/10 bg-black/35 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <PlatformBadge platform={item.platform} />
        <span
          className={[
            "rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em]",
            STATUS_STYLES[item.status],
          ].join(" ")}
        >
          {item.status}
        </span>
        <span
          className={[
            "ml-auto text-xs font-medium uppercase tracking-[0.14em]",
            PRIORITY_STYLES[item.priority],
          ].join(" ")}
        >
          {item.priority} priority
        </span>
      </div>

      <h3 className="mt-4 text-lg font-semibold text-white">{item.title}</h3>
      <p className="mt-2 text-sm text-white/55">
        {item.clientName} · {item.campaignName}
      </p>

      <div className="mt-4 grid gap-3 text-sm text-white/70 md:grid-cols-2">
        <div className="rounded-2xl bg-white/5 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/35">
            Owner
          </p>
          <p className="mt-1 text-white">{item.ownerLabel}</p>
        </div>
        <div className="rounded-2xl bg-white/5 px-3 py-3">
          <p className="text-xs uppercase tracking-[0.14em] text-white/35">
            Scheduled
          </p>
          <p className="mt-1 text-white">
            {new Date(item.scheduledFor).toLocaleDateString()} at{" "}
            {new Date(item.scheduledFor).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl bg-white/5 px-3 py-3">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-white/35">
          <span>Time budget</span>
          <span>
            {item.spentHours}h / {item.estimatedHours}h
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-orange-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-orange-500/15 bg-orange-500/8 px-3 py-3 text-sm text-orange-100/90">
        <Clock3 size={16} className="mt-0.5 shrink-0 text-orange-300" />
        <p>{item.aiAngle}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {onUseAi ? (
          <button
            type="button"
            onClick={() => onUseAi(item)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100 transition hover:bg-orange-500/15 disabled:opacity-50"
          >
            <Wand2 size={14} />
            AI prompt
          </button>
        ) : null}

        {onAdvanceStatus && item.source === "supabase" ? (
          <button
            type="button"
            onClick={() => onAdvanceStatus(item)}
            disabled={busy || isFinal}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2 text-xs font-semibold text-white transition hover:border-orange-500/30 disabled:opacity-50"
          >
            <ArrowRight size={14} />
            {isFinal ? "Published" : "Advance stage"}
          </button>
        ) : null}

        {onDelete && item.source === "supabase" ? (
          <button
            type="button"
            onClick={() => onDelete(item)}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-200 transition hover:bg-red-500/15 disabled:opacity-50"
          >
            <Trash2 size={14} />
            Remove
          </button>
        ) : null}
      </div>
    </article>
  );
}
