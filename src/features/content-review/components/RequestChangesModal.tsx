import { useMemo, useState } from "react";
import type { ContentReviewAsset } from "../services/contentReviewService";

type RequestChangesModalProps = {
  open: boolean;
  title?: string;
  assets: ContentReviewAsset[];
  onClose: () => void;
  onSubmit: (compiledSuggestion: string) => Promise<void> | void;
  submitting?: boolean;
};

type SectionSuggestion = {
  sectionKey: string;
  label: string;
  value: string;
};

function inputClassName() {
  return "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition focus:border-orange-500";
}

export default function RequestChangesModal({
  open,
  title,
  assets,
  onClose,
  onSubmit,
  submitting = false,
}: RequestChangesModalProps) {
  const assetSections = useMemo(
    () =>
      assets.map((asset, index) => ({
        sectionKey: `asset-${asset.id}`,
        label:
          asset.heading?.trim() ||
          asset.caption?.trim() ||
          asset.file_name ||
          `Media section ${index + 1}`,
      })),
    [assets],
  );

  const initialSections: SectionSuggestion[] = useMemo(
    () => [
      { sectionKey: "title", label: "Title", value: "" },
      { sectionKey: "subtitle", label: "Subtitle", value: "" },
      { sectionKey: "summary", label: "Summary", value: "" },
      { sectionKey: "body", label: "Body content", value: "" },
      { sectionKey: "cta", label: "Call to action", value: "" },
      ...assetSections.map((section) => ({
        sectionKey: section.sectionKey,
        label: `Media: ${section.label}`,
        value: "",
      })),
      { sectionKey: "general", label: "General notes", value: "" },
    ],
    [assetSections],
  );

  const [sections, setSections] = useState<SectionSuggestion[]>(initialSections);
  const [error, setError] = useState("");

  if (!open) return null;

  const updateSection = (sectionKey: string, value: string) => {
    setSections((current) =>
      current.map((section) =>
        section.sectionKey === sectionKey ? { ...section, value } : section,
      ),
    );
  };

  const handleClose = () => {
    if (submitting) return;
    setSections(initialSections);
    setError("");
    onClose();
  };

  const handleSubmit = async () => {
    const filled = sections.filter((section) => section.value.trim().length > 0);
    if (filled.length === 0) {
      setError("Add at least one section suggestion.");
      return;
    }

    const compiledSuggestion = [
      `Change request for: ${title || "Post"}`,
      "",
      ...filled.map(
        (section) => `- ${section.label}: ${section.value.trim()}`,
      ),
    ].join("\n");

    await onSubmit(compiledSuggestion);
    setSections(initialSections);
    setError("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl">
        <div className="border-b border-neutral-200 px-5 py-4">
          <h3 className="text-lg font-bold text-neutral-950">Request changes</h3>
          <p className="mt-1 text-sm text-neutral-600">
            Add suggestions per section so the creator knows exactly what to update.
          </p>
        </div>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto px-5 py-4">
          {sections.map((section) => (
            <label key={section.sectionKey} className="block space-y-1.5">
              <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
                {section.label}
              </span>
              <textarea
                rows={2}
                value={section.value}
                onChange={(event) => updateSection(section.sectionKey, event.target.value)}
                placeholder={`Suggestion for ${section.label.toLowerCase()}`}
                className={inputClassName()}
              />
            </label>
          ))}
          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-200 px-5 py-4">
          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-xl border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit change request"}
          </button>
        </div>
      </div>
    </div>
  );
}
