import { Clock3, Play, Square } from "lucide-react";

export default function TimeTrackerCard({
  activeTimeEntry,
  todayMinutes,
  busy,
  onStart,
  onStop,
}: {
  activeTimeEntry: any;
  todayMinutes: number;
  busy: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
          <Clock3 size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Time Tracking</h2>
          <p className="text-sm text-white/50">Track work against real tasks</p>
        </div>
      </div>

      <p className="mt-5 text-3xl font-bold text-white">{todayMinutes} min</p>
      <p className="mt-1 text-sm text-white/50">Tracked today</p>

      <div className="mt-5">
        {activeTimeEntry ? (
          <button
            onClick={onStop}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 font-semibold text-black"
          >
            <Square size={16} />
            Stop timer
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black"
          >
            <Play size={16} />
            Start timer
          </button>
        )}
      </div>
    </div>
  );
}
