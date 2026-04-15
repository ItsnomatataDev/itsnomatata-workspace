import { useEffect, useMemo, useState } from "react";
import { Clock3, Play, TimerReset, Trash2 } from "lucide-react";
import type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function TaskTimeHistoryPanel({
  entries,
  activeEntry,
  loading,
  mutating,
  onStartTimer,
  onStopTimer,
  onResumeEntry,
  onDeleteEntry,
}: {
  entries: TimeEntryItem[];
  activeEntry: TimeEntryItem | null;
  loading: boolean;
  mutating: boolean;
  onStartTimer: () => Promise<void>;
  onStopTimer: () => Promise<void>;
  onResumeEntry: (entryId: string) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
}) {
  const [liveSeconds, setLiveSeconds] = useState(0);

  useEffect(() => {
    if (!activeEntry?.started_at) {
      setLiveSeconds(0);
      return;
    }

    const updateLiveTime = () => {
      const startedAtMs = new Date(activeEntry.started_at).getTime();
      const nowMs = Date.now();
      const diffSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
      setLiveSeconds(diffSeconds);
    };

    updateLiveTime();
    const interval = window.setInterval(updateLiveTime, 1000);
    return () => window.clearInterval(interval);
  }, [activeEntry]);

  const totalTrackedSeconds = useMemo(() => {
    return entries.reduce(
      (sum, entry) => sum + Number(entry.duration_seconds ?? 0),
      0,
    );
  }, [entries]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-orange-400">
            <Clock3 size={16} />
            <p className="font-medium">Task Time History</p>
          </div>
          <p className="mt-2 text-sm text-white/45">
            Total tracked on this card
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {formatDuration(totalTrackedSeconds)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {activeEntry ? (
            <button
              type="button"
              onClick={() => void onStopTimer()}
              disabled={mutating}
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
            >
              Stop timer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void onStartTimer()}
              disabled={mutating}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
            >
              <Play size={15} />
              Start timer
            </button>
          )}
        </div>
      </div>

      {activeEntry ? (
        <div className="mt-4 rounded-xl border border-orange-500/20 bg-orange-500/10 p-4">
          <p className="text-sm text-orange-300">Timer running on this task</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {formatDuration(liveSeconds)}
          </p>
          <p className="mt-1 text-xs text-white/60">
            Started {formatDateTime(activeEntry.started_at)}
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 text-white/60">Loading task time entries...</div>
      ) : entries.length === 0 ? (
        <div className="mt-6 text-white/50">
          No time entries recorded on this task yet.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex flex-col gap-3 rounded-xl border border-white/10 bg-[#050505] p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-white">
                  {entry.description || "No description"}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {formatDateTime(entry.started_at)} →{" "}
                  {formatDateTime(entry.ended_at)}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  {entry.is_billable ? "Billable" : "Non-billable"} •{" "}
                  {entry.source || "—"}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-xs text-orange-300">
                  {entry.ended_at
                    ? formatDuration(entry.duration_seconds ?? 0)
                    : "Running"}
                </span>

                {entry.ended_at ? (
                  <button
                    type="button"
                    onClick={() => void onResumeEntry(entry.id)}
                    disabled={mutating || Boolean(activeEntry)}
                    className="inline-flex items-center gap-1 rounded-xl bg-white/10 px-3 py-2 text-xs text-white disabled:opacity-60"
                  >
                    <TimerReset size={13} />
                    Resume
                  </button>
                ) : null}

                {entry.ended_at ? (
                  <button
                    type="button"
                    onClick={() => void onDeleteEntry(entry.id)}
                    disabled={mutating}
                    className="inline-flex items-center gap-1 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300 disabled:opacity-60"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
