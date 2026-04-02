import { useEffect, useMemo, useState } from "react";
import { Clock3, Play, Square } from "lucide-react";

type ActiveTimeEntry = {
  id: string;
  started_at: string;
} | null;

type TimeTrackerCardProps = {
  activeTimeEntry: ActiveTimeEntry;
  todaySeconds: number;
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
  busy,
  onStart,
  onStop,
}: TimeTrackerCardProps) {
  const [liveSeconds, setLiveSeconds] = useState(0);

  useEffect(() => {
    if (!activeTimeEntry?.started_at) {
      setLiveSeconds(0);
      return;
    }

    const updateTimer = () => {
      const startedAt = new Date(activeTimeEntry.started_at).getTime();
      const now = Date.now();
      const diff = Math.floor((now - startedAt) / 1000);
      setLiveSeconds(Math.max(0, diff));
    };

    updateTimer();

    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [activeTimeEntry]);

  const totalTodayDisplaySeconds = useMemo(() => {
    return todaySeconds + liveSeconds;
  }, [todaySeconds, liveSeconds]);

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
        {formatDuration(totalTodayDisplaySeconds)}
      </p>
      <p className="mt-1 text-sm text-white/50">Tracked today</p>

      {activeTimeEntry ? (
        <p className="mt-2 text-sm text-orange-400">
          Running now: {formatDuration(liveSeconds)}
        </p>
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
