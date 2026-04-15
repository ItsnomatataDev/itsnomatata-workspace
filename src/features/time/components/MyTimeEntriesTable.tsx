import { Clock3, Pencil, TimerReset, Trash2 } from "lucide-react";
import type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";

function formatDateTime(value?: string | null) {
  if (!value) return "Running";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function MyTimeEntriesTable({
  entries,
  activeEntry,
  mutating,
  onResumeEntry,
  onDeleteEntry,
  onEditEntry,
}: {
  entries: TimeEntryItem[];
  activeEntry: TimeEntryItem | null;
  mutating: boolean;
  onResumeEntry: (entryId: string) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
  onEditEntry: (entry: TimeEntryItem) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="border border-white/10 bg-[#050505] p-6 text-white/60">
        No time entries recorded yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-white/10 bg-[#050505]">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-black/40 text-left text-white/45">
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Started</th>
            <th className="px-4 py-3">Ended</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Billing</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        {entries.map((entry) => {
          const isRunning = !entry.ended_at;
          const hasAnotherActiveEntry = activeEntry?.id
            ? activeEntry.id !== entry.id
            : false;

          return (
            <tr
              key={entry.id}
              className="border-b border-white/5 transition hover:bg-white/3"
            >
              <td className="px-4 py-4">
                <div>
                  <p className="font-medium text-white">
                    {entry.description || "No description"}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/40">
                    {entry.task_id ? <span>Task linked</span> : null}
                    {entry.project_id ? <span>• Project linked</span> : null}
                    {entry.client_id ? <span>• Client linked</span> : null}
                    {entry.campaign_id ? <span>• Campaign linked</span> : null}
                  </div>
                </div>
              </td>

              <td className="px-4 py-4 text-white/70">
                {formatDateTime(entry.started_at)}
              </td>

              <td className="px-4 py-4 text-white/70">
                {formatDateTime(entry.ended_at)}
              </td>

              <td className="px-4 py-4">
                <div className="inline-flex items-center gap-2 text-white">
                  <Clock3 size={14} className="text-orange-400" />
                  <span>{formatDuration(entry.duration_seconds ?? 0)}</span>
                </div>
              </td>

              <td className="px-4 py-4">
                <span
                  className={`inline-flex px-3 py-2 text-xs ${
                    entry.is_billable
                      ? "border border-orange-500/20 bg-orange-500/10 text-orange-300"
                      : "border border-white/10 bg-white/5 text-white/60"
                  }`}
                >
                  {entry.is_billable ? "Billable" : "Non-billable"}
                </span>
              </td>

              <td className="px-4 py-4 text-white/60">
                {entry.source || "manual"}
              </td>

              <td className="px-4 py-4">
                <div className="flex flex-wrap gap-2">
                  {!isRunning ? (
                    <button
                      type="button"
                      disabled={mutating || hasAnotherActiveEntry}
                      onClick={() => void onResumeEntry(entry.id)}
                      className="inline-flex items-center gap-1 border border-white/10 bg-white/10 px-3 py-2 text-xs text-white disabled:opacity-60"
                    >
                      <TimerReset size={13} />
                      Resume
                    </button>
                  ) : null}

                  <button
                    type="button"
                    disabled={mutating || isRunning}
                    onClick={() => onEditEntry(entry)}
                    className="inline-flex items-center gap-1 border border-white/10 bg-black px-3 py-2 text-xs text-white/80 disabled:opacity-60"
                  >
                    <Pencil size={13} />
                    Edit
                  </button>

                  <button
                    type="button"
                    disabled={mutating || isRunning}
                    onClick={() => void onDeleteEntry(entry.id)}
                    className="inline-flex items-center gap-1 border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 disabled:opacity-60"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </table>
    </div>
  );
}
