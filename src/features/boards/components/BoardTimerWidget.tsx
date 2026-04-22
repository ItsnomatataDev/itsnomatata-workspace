import { useState, useEffect } from "react";
import { Play, Square, Clock3, CircleDot } from "lucide-react";
import { startTimeEntry, stopTimeEntry, getActiveTimeEntry } from "../../../lib/supabase/mutations/timeEntries";
import { useAuth } from "../../../app/providers/AuthProvider";

interface BoardTimerWidgetProps {
  taskId?: string;
  boardId?: string;
  taskTitle?: string;
  className?: string;
}

export default function BoardTimerWidget({
  taskId,
  boardId,
  taskTitle,
  className = "",
}: BoardTimerWidgetProps) {
  const auth = useAuth();
  const [isTracking, setIsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [activeEntry, setActiveEntry] = useState<any>(null);

  const organizationId = auth?.profile?.organization_id;
  const userId = auth?.user?.id;

  // Load active timer on mount
  useEffect(() => {
    if (!organizationId || !userId) return;

    const loadActiveTimer = async () => {
      try {
        const active = await getActiveTimeEntry({ organizationId, userId });
        const isRelevant = active && (
          (taskId && active.task_id === taskId) ||
          (boardId && active.client_id === boardId)
        );
        
        if (isRelevant) {
          setActiveEntry(active);
          setIsTracking(true);
        }
      } catch (error) {
        console.error("Failed to load active timer:", error);
      }
    };

    loadActiveTimer();
  }, [organizationId, userId, taskId, boardId]);

  // Live timer update
  useEffect(() => {
    if (!isTracking || !activeEntry?.started_at) return;

    const updateLiveTime = () => {
      const startedAtMs = new Date(activeEntry.started_at).getTime();
      const nowMs = Date.now();
      const diffSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
      setLiveSeconds(diffSeconds);
    };

    updateLiveTime();
    const interval = window.setInterval(updateLiveTime, 1000);

    return () => window.clearInterval(interval);
  }, [isTracking, activeEntry?.started_at]);

  const formatTime = (seconds: number) => {
    const total = Math.max(0, Math.floor(seconds));
    const hrs = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;
    return `${hrs.toString().padStart(2, "0")}:${mins
      .toString()
      .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleToggleTimer = async () => {
    if (!organizationId || !userId) return;

    setLoading(true);
    try {
      if (isTracking && activeEntry) {
        // Stop timer
        await stopTimeEntry(activeEntry.id);
        setIsTracking(false);
        setActiveEntry(null);
        setLiveSeconds(0);
      } else {
        // Start timer
        const newEntry = await startTimeEntry({
          organizationId,
          userId,
          taskId: taskId || null,
          clientId: boardId || null,
          description: taskTitle || "Timer session",
          isBillable: false,
          source: "board",
        });
        
        setActiveEntry(newEntry);
        setIsTracking(true);
      }
    } catch (error) {
      console.error("Failed to toggle timer:", error);
    } finally {
      setLoading(false);
    }
  };

  if (isTracking) {
    return (
      <div className={`flex items-center gap-2 text-xs ${className}`}>
        <CircleDot size={8} className="text-green-400 animate-pulse fill-green-400" />
        <span className="font-mono text-green-400">
          {formatTime(liveSeconds)}
        </span>
        <button
          onClick={handleToggleTimer}
          disabled={loading}
          className="flex items-center gap-1 rounded bg-red-500/20 px-2 py-1 text-red-400 hover:bg-red-500/30 transition"
        >
          {loading ? (
            <div className="w-3 h-3 border border-red-400 border-t-transparent animate-spin" />
          ) : (
            <Square size={10} />
          )}
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleToggleTimer}
      disabled={loading}
      className={`flex items-center gap-2 text-xs text-white/50 hover:text-white/80 transition ${className}`}
    >
      {loading ? (
        <div className="w-3 h-3 border border-white/50 border-t-transparent animate-spin" />
      ) : (
        <Play size={10} />
      )}
      <span>Start</span>
    </button>
  );
}
