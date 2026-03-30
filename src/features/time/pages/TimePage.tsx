import { Clock3, Play, Square } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useDashboard } from "../../../lib/hooks/useDashboard";

export default function TimePage() {
  const auth = useAuth();

  if (!auth?.user || !auth?.profile) return null;

  const { user, profile } = auth;

  const { stats, activeTimer, loading, startTimer, stopTimer } = useDashboard({
    userId: user.id,
    organizationId: profile.organization_id,
    role: profile.primary_role,
  });

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
                    {stats?.todayMinutes ?? 0} minutes
                  </p>
                </div>
              </div>

              <div className="mt-6">
                {activeTimer ? (
                  <button
                    onClick={stopTimer}
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 font-semibold text-black"
                  >
                    <Square size={16} />
                    Stop Timer
                  </button>
                ) : (
                  <button
                    onClick={() => startTimer(null, "General work")}
                    className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-semibold text-black"
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
