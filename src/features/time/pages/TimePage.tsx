import { useEffect, useMemo, useState } from "react";
import { Clock3, Play, Square } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useDashboard } from "../../../lib/hooks/useDashboard";

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, totalSeconds || 0);

  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function TimePage() {
  const auth = useAuth();

  if (!auth?.user || !auth?.profile) return null;

  const { user, profile } = auth;

  const { stats, activeTimer, loading, startTimer, stopTimer, busy } =
    useDashboard({
      userId: user.id,
      organizationId: profile.organization_id,
      role: profile.primary_role,
    });

  const [liveSeconds, setLiveSeconds] = useState(0);

  useEffect(() => {
    if (!activeTimer?.started_at) {
      setLiveSeconds(0);
      return;
    }

    const updateLiveTime = () => {
      const startedAtMs = new Date(activeTimer.started_at).getTime();
      const nowMs = Date.now();
      const diffSeconds = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));

      setLiveSeconds(diffSeconds);
    };

    updateLiveTime();

    const interval = window.setInterval(updateLiveTime, 1000);

    return () => window.clearInterval(interval);
  }, [activeTimer]);

const completedTodaySeconds = useMemo(() => {
  return stats?.todaySeconds ?? 0;
}, [stats]);

  const totalDisplaySeconds = useMemo(() => {
    return completedTodaySeconds + liveSeconds;
  }, [completedTodaySeconds, liveSeconds]);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Time Tracking
            </p>
            <h1 className="mt-2 text-3xl font-bold">Time Workspace</h1>
            <p className="mt-2 text-sm text-white/50">
              Role: {profile.primary_role}
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading time data...
            </div>
          ) : (
            <div className="max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/15 p-3 text-orange-500">
                  <Clock3 size={20} />
                </div>

                <div>
                  <h2 className="text-xl font-semibold">Tracked Today</h2>
                  <p className="text-sm text-white/50">
                    {formatDuration(totalDisplaySeconds)}
                  </p>
                </div>
              </div>

              <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-5">
                <p className="text-xs uppercase tracking-[0.25em] text-white/40">
                  Summary
                </p>

                <div className="mt-3">
                  <p className="text-4xl font-bold text-white">
                    {formatDuration(totalDisplaySeconds)}
                  </p>
                  <p className="mt-2 text-sm text-white/50">
                    Total tracked today in hours, minutes and seconds
                  </p>
                </div>

                {activeTimer ? (
                  <div className="mt-4">
                    <p className="text-sm text-orange-400">
                      Running now: {formatDuration(liveSeconds)}
                    </p>
                    {activeTimer.description ? (
                      <p className="mt-1 text-sm text-white/50">
                        Task: {activeTimer.description}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-white/40">
                    No active timer running
                  </p>
                )}
              </div>

              <div className="mt-6">
                {activeTimer ? (
                  <button
                    type="button"
                    onClick={stopTimer}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Square size={16} />
                    Stop Timer
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => startTimer(null, "General work")}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Play size={16} />
                    Start Timer
                  </button>
                )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
