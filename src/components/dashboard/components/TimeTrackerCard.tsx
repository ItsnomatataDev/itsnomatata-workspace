import { Clock3, Play, Square } from "lucide-react";

type ActiveTimeEntry = {
  id: string;
  started_at: string;
  task_id?: string | null;
  description?: string | null;
} | null;

type TimeTrackerCardProps = {
  activeTimeEntry: ActiveTimeEntry;
  todaySeconds: number;
  activeSessionSeconds: number;
  runningTaskTitle?: string | null;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
};

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds);

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function TimeTrackerCard({
  activeTimeEntry,
  todaySeconds,
  activeSessionSeconds,
  runningTaskTitle,
  busy,
  onStart,
  onStop,
}: TimeTrackerCardProps) {
  return (
    <div className="rounded-5xl border border-white/10 bg-white/10 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
          <Clock3 size={18} />
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white">Time Tracking</h2>
          <p className="text-sm text-white/50">Track work against real tasks</p>
        </div>
      </div>

      <p className="mt-5 text-3xl font-bold text-white">
        {formatDuration(todaySeconds)}
      </p>
      <p className="mt-1 text-sm text-white/50">Tracked today</p>

      {activeTimeEntry ? (
        <div className="mt-3 space-y-2 rounded-2xl border border-orange-500/20 bg-orange-500/10 px-3 py-3">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white/55">Active session</span>
            <span className="font-mono font-semibold text-orange-300">
              {formatDuration(activeSessionSeconds)}
            </span>
          </div>
          {runningTaskTitle || activeTimeEntry.description ? (
            <p className="text-xs text-white/60 truncate">
              {runningTaskTitle || activeTimeEntry.description}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-sm text-white/40">No active timer</p>
      )}

      <div className="mt-5">
        {activeTimeEntry ? (
          <button
            type="button"
            onClick={onStop}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Square size={16} />
            Stop timer
          </button>
        ) : (
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Play size={16} />
            Start timer
          </button>
        )}
      </div>
    </div>
  );
}
