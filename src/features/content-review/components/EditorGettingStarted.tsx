import { ChevronRight, X } from "lucide-react";
import type { ContentStudioEditorFocusTab } from "../utils/contentStudioEditorNav";
import { contentStudioCopy } from "../utils/contentStudioTerms";

const STEPS: Array<{
  id: ContentStudioEditorFocusTab;
  step: number;
  title: string;
  detail: string;
}> = [
  {
    id: "setup",
    step: 1,
    title: "Setup",
    detail: "Choose layout, client, and publish date",
  },
  {
    id: "media",
    step: 2,
    title: "Posts",
    detail: "Add images, then text beside each post",
  },
  {
    id: "write",
    step: 3,
    title: "Write",
    detail: "Story, social caption, and AI assist",
  },
];

export default function EditorGettingStarted({
  activeTab,
  postsWithMedia,
  hasCaption,
  onSelectTab,
  onDismiss,
}: {
  activeTab: ContentStudioEditorFocusTab;
  postsWithMedia: number;
  hasCaption: boolean;
  onSelectTab: (tab: ContentStudioEditorFocusTab) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="shrink-0 border-b border-orange-500/20 bg-linear-to-r from-orange-500/10 via-black to-black px-3 py-3 sm:px-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-orange-200">
            New here? Follow these steps
          </p>
          <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-white/50">
            {contentStudioCopy.editorWorkflow}
          </p>
          <ol className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:gap-2">
            {STEPS.map((item) => {
              const active = activeTab === item.id;
              const done =
                item.id === "setup"
                  ? true
                  : item.id === "media"
                    ? postsWithMedia > 0
                    : hasCaption;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onSelectTab(item.id)}
                    className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition sm:w-auto ${
                      active
                        ? "border-orange-500/50 bg-orange-500/15"
                        : "border-white/10 bg-black/40 hover:border-white/20"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                        done && !active
                          ? "bg-emerald-500/20 text-emerald-200"
                          : active
                            ? "bg-orange-500 text-black"
                            : "bg-white/10 text-white/70"
                      }`}
                    >
                      {item.step}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-white">{item.title}</span>
                      <span className="block text-[10px] text-white/45">{item.detail}</span>
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-white/30" />
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
          aria-label="Hide guide"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
