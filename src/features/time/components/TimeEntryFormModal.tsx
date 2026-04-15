import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";

type EntryDraft = {
  description: string;
  startedAt: string;
  endedAt: string;
  isBillable: boolean;
  taskId: string;
  projectId: string;
  clientId: string;
  campaignId: string;
};

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function TimeEntryFormModal({
  open,
  busy,
  title,
  initialEntry,
  onClose,
  onSaveManualEntry,
  onUpdateEntry,
}: {
  open: boolean;
  busy?: boolean;
  title: string;
  initialEntry?: TimeEntryItem | null;
  onClose: () => void;
  onSaveManualEntry: (values: EntryDraft) => Promise<void>;
  onUpdateEntry: (entryId: string, values: EntryDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<EntryDraft>({
    description: "",
    startedAt: "",
    endedAt: "",
    isBillable: false,
    taskId: "",
    projectId: "",
    clientId: "",
    campaignId: "",
  });

  useEffect(() => {
    if (initialEntry) {
      setDraft({
        description: initialEntry.description || "",
        startedAt: toLocalDateTimeInput(initialEntry.started_at),
        endedAt: toLocalDateTimeInput(initialEntry.ended_at),
        isBillable: Boolean(initialEntry.is_billable),
        taskId: initialEntry.task_id || "",
        projectId: initialEntry.project_id || "",
        clientId: initialEntry.client_id || "",
        campaignId: initialEntry.campaign_id || "",
      });
      return;
    }

    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

    setDraft({
      description: "",
      startedAt: toLocalDateTimeInput(thirtyMinutesAgo.toISOString()),
      endedAt: toLocalDateTimeInput(now.toISOString()),
      isBillable: false,
      taskId: "",
      projectId: "",
      clientId: "",
      campaignId: "",
    });
  }, [initialEntry, open]);

  if (!open) return null;

  const updateField = (field: keyof EntryDraft, value: string | boolean) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!draft.startedAt || !draft.endedAt) {
      alert("Start and end time are required.");
      return;
    }

    if (
      new Date(draft.endedAt).getTime() <= new Date(draft.startedAt).getTime()
    ) {
      alert("End time must be after start time.");
      return;
    }

    if (initialEntry?.id) {
      await onUpdateEntry(initialEntry.id, draft);
      return;
    }

    await onSaveManualEntry(draft);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-4">
      <div className="mx-auto w-full max-w-3xl border border-white/10 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-white/45">
              Create or edit time the Everhour way
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="border border-white/10 bg-black p-2 text-white/70"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          <div>
            <label className="mb-2 block text-sm text-white/70">
              Description
            </label>
            <input
              value={draft.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Worked on timesheet review, landing page updates..."
              className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Started at
              </label>
              <input
                type="datetime-local"
                value={draft.startedAt}
                onChange={(e) => updateField("startedAt", e.target.value)}
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">
                Ended at
              </label>
              <input
                type="datetime-local"
                value={draft.endedAt}
                onChange={(e) => updateField("endedAt", e.target.value)}
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Task ID
              </label>
              <input
                value={draft.taskId}
                onChange={(e) => updateField("taskId", e.target.value)}
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">
                Project ID
              </label>
              <input
                value={draft.projectId}
                onChange={(e) => updateField("projectId", e.target.value)}
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">
                Client ID
              </label>
              <input
                value={draft.clientId}
                onChange={(e) => updateField("clientId", e.target.value)}
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none"
                placeholder="Optional"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">
                Campaign ID
              </label>
              <input
                value={draft.campaignId}
                onChange={(e) => updateField("campaignId", e.target.value)}
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none"
                placeholder="Optional"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 border border-white/10 bg-black px-4 py-3 text-sm text-white">
            <input
              type="checkbox"
              checked={draft.isBillable}
              onChange={(e) => updateField("isBillable", e.target.checked)}
              className="h-4 w-4"
            />
            Mark this entry as billable
          </label>

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="border border-white/10 bg-black px-4 py-3 text-sm text-white/80"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={busy}
              className="border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
            >
              {busy ? "Saving..." : initialEntry ? "Save changes" : "Add entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
