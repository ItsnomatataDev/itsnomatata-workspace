import { useEffect, useMemo, useState } from "react";
import {
  Clock3,
  PauseCircle,
  PlayCircle,
  Plus,
  Radio,
  TimerReset,
} from "lucide-react";
import type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(Number(totalSeconds || 0)));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function TimerWidget({
  activeEntry,
  mutating,
  onStartQuickTimer,
  onStopTimer,
  onOpenManualEntry,
}: {
  activeEntry: TimeEntryItem | null;
  mutating: boolean;
  onStartQuickTimer: () => Promise<void>;
  onStopTimer: () => Promise<void>;
  onOpenManualEntry: () => void;
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

  const subtitle = useMemo(() => {
    if (!activeEntry) {
      return "No active timer running";
    }

    const parts = [
      activeEntry.description || "Working time",
      activeEntry.is_billable ? "Billable" : "Non-billable",
      activeEntry.source || "timer",
    ];

    return parts.filter(Boolean).join(" • ");
  }, [activeEntry]);

  return (
    <section className="border border-white/10 bg-[#050505] p-5">
      <div className="mb-5 flex items-center gap-3">
        <div className="border border-orange-500/20 bg-orange-500/10 p-2 text-orange-400">
          {activeEntry ? <Radio size={18} /> : <Clock3 size={18} />}
        </div>

        <div>
          <h3 className="text-lg font-semibold text-white">Live Timer</h3>
          <p className="text-sm text-white/45">
            Track your work the Everhour way
          </p>
        </div>
      </div>

      <div className="border border-white/10 bg-black/40 p-5">
        <p className="text-sm text-white/45">
          {activeEntry ? "Currently tracking" : "Ready to start"}
        </p>

        <p className="mt-3 text-4xl font-bold tracking-wide text-white">
          {formatDuration(liveSeconds)}
        </p>

        <p className="mt-3 text-sm text-white/55">{subtitle}</p>

        {activeEntry?.started_at ? (
          <p className="mt-2 text-xs text-white/35">
            Started {new Date(activeEntry.started_at).toLocaleString()}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        {activeEntry ? (
          <button
            type="button"
            disabled={mutating}
            onClick={() => void onStopTimer()}
            className="inline-flex items-center gap-2 border border-white/10 bg-white px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
          >
            <PauseCircle size={16} />
            Stop timer
          </button>
        ) : (
          <button
            type="button"
            disabled={mutating}
            onClick={() => void onStartQuickTimer()}
            className="inline-flex items-center gap-2 border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
          >
            <PlayCircle size={16} />
            Start quick timer
          </button>
        )}

        <button
          type="button"
          onClick={onOpenManualEntry}
          className="inline-flex items-center gap-2 border border-white/10 bg-black px-4 py-3 text-sm font-medium text-white/80"
        >
          <Plus size={16} />
          Add manual entry
        </button>

        {!activeEntry ? (
          <div className="inline-flex items-center gap-2 border border-white/10 bg-black px-4 py-3 text-xs text-white/45">
            <TimerReset size={14} />
            One active timer per user
          </div>
        ) : null}
      </div>
    </section>
  );
}
