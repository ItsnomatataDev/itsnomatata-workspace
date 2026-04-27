import { useEffect, useMemo, useState } from "react";
import {
  CheckSquare,
  ClipboardList,
  Bell,
  ShieldCheck,
  Clock3,
  CloudSun,
  Newspaper,
  Sparkles,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  TimerReset,
  Pause,
  Play,
} from "lucide-react";
import { useAuth } from "../app/providers/AuthProvider";
import Sidebar from "../components/dashboard/components/Sidebar";
import TimeTrackerCard from "../components/dashboard/components/TimeTrackerCard";
import { useDashboard } from "../lib/hooks/useDashboard";
import { supabase } from "../lib/supabase/client";
import { getAdminTimeSummary } from "../lib/supabase/queries/adminTime";

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number }>;
  subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{title}</p>
        <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
          <Icon size={18} />
        </div>
      </div>

      <p className="mt-4 text-3xl font-bold text-white">{value}</p>

      {subtitle ? (
        <p className="mt-2 text-xs text-white/40">{subtitle}</p>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;

  const [coords, setCoords] = useState<{
    latitude: number | null;
    longitude: number | null;
  }>({
    latitude: null,
    longitude: null,
  });

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (position) => {
        setCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setCoords({ latitude: null, longitude: null });
      },
    );
  }, []);

  const cityLabel =
    typeof profile?.department === "string" &&
    profile.department.trim().length > 0
      ? profile.department
      : "Your city";

  const {
    loading,
    error,
    stats,
    tasks,
    announcements,
    weather,
    roleNews,
    roleNewsTopic,
    activeTimer,
    startTimer,
    stopTimer,
    busy,
  } = useDashboard({
    userId: user?.id ?? undefined,
    organizationId: profile?.organization_id ?? null,
    role: profile?.primary_role ?? null,
    cityLabel,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    enabled: !!user?.id && !!profile?.organization_id,
  });

  const [liveSeconds, setLiveSeconds] = useState(0);
  const [taskTimeMap, setTaskTimeMap] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!activeTimer?.started_at) {
      setLiveSeconds(0);
      return;
    }

    const tick = () => {
      const startedAtMs = new Date(activeTimer.started_at).getTime();
      const nowMs = Date.now();
      const diff = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
      setLiveSeconds(diff);
    };

    tick();
    const interval = window.setInterval(tick, 1000);

    return () => window.clearInterval(interval);
  }, [activeTimer]);

  // Fetch time tracked for each task
  useEffect(() => {
    if (!user?.id || !profile?.organization_id || tasks.length === 0) return;

    const fetchTaskTimes = async () => {
      const taskIds = tasks.map((t) => t.id);
      const startOfToday = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate(),
      ).toISOString();

      const { data: timeEntries } = await supabase
        .from("time_entries")
        .select("task_id, duration_seconds")
        .eq("user_id", user.id)
        .in("task_id", taskIds)
        .gte("started_at", startOfToday);

      const timeMap: Record<string, number> = {};
      (timeEntries || []).forEach((entry: any) => {
        const taskId = entry.task_id;
        const seconds = entry.duration_seconds || 0;
        timeMap[taskId] = (timeMap[taskId] || 0) + seconds;
      });

      setTaskTimeMap(timeMap);
    };

    fetchTaskTimes();
  }, [user?.id, profile?.organization_id, tasks]);

  const completedTodaySeconds = useMemo(() => {
    return stats?.todaySeconds ?? 0;
  }, [stats]);

  const totalTodayDisplaySeconds = useMemo(() => {
    return completedTodaySeconds + liveSeconds;
  }, [completedTodaySeconds, liveSeconds]);

  const organizationId = profile?.organization_id ?? null;
  const isAdminView =
    profile?.primary_role === "admin" || profile?.primary_role === "manager";

  const [adminSummary, setAdminSummary] = useState<{
    totalSeconds: number;
    activeCount: number;
    totalCost: number;
  } | null>(null);

  useEffect(() => {
    if (!organizationId || !isAdminView) {
      setAdminSummary(null);
      return;
    }

    const fetchAdminSummary = async () => {
      try {
        const summary = await getAdminTimeSummary({
          organizationId,
        });
        setAdminSummary(summary);
      } catch (err) {
        console.warn("Failed to load admin time summary:", err);
      }
    };

    fetchAdminSummary();
    const interval = setInterval(fetchAdminSummary, 10000);
    return () => clearInterval(interval);
  }, [organizationId, isAdminView]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        No authenticated user found.
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading profile...
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Your account is not linked to an organization yet.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar
          role={profile.primary_role}
          counts={
            profile.primary_role === "it"
              ? {
                  projects: stats?.myProjects ?? 0,
                }
              : undefined
          }
        />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                {String(profile.primary_role || "").replaceAll("_", " ")}
              </p>
              <h1 className="mt-2 text-3xl font-bold">
                Welcome back, {profile.full_name || "User"}
              </h1>
              <p className="mt-2 text-sm text-white/50">
                Real-time workspace dashboard for tasks, approvals, time
                tracking, announcements and operations.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading dashboard...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <StatCard
                  title="Open Tasks"
                  value={stats?.openTasks ?? 0}
                  icon={ClipboardList}
                />
                <StatCard
                  title="In Progress"
                  value={stats?.inProgressTasks ?? 0}
                  icon={CheckSquare}
                />
                <StatCard
                  title="Review"
                  value={stats?.reviewTasks ?? 0}
                  icon={ShieldCheck}
                />
                <StatCard
                  title="Unread Alerts"
                  value={stats?.unreadNotifications ?? 0}
                  icon={Bell}
                />
                <StatCard
                  title="Tracked Today"
                  value={formatDuration(totalTodayDisplaySeconds)}
                  icon={Clock3}
                  subtitle="Hours : Minutes : Seconds"
                />
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">My Tasks</h2>
                      <p className="mt-1 text-sm text-white/50">
                        Track work directly against real tasks
                      </p>
                    </div>

                    <span className="text-sm text-white/50">
                      {profile.primary_role}
                    </span>
                  </div>

                  <div className="mt-4 space-y-3">
                    {tasks.length === 0 ? (
                      <p className="text-sm text-white/50">
                        No assigned tasks found.
                      </p>
                    ) : (
                      tasks.map((task) => {
                        const isTrackingThisTask =
                          activeTimer?.task_id === task.id;
                        const taskTime = taskTimeMap[task.id] || 0;
                        const totalTaskTime = isTrackingThisTask
                          ? taskTime + liveSeconds
                          : taskTime;

                        const getDueDateUrgency = () => {
                          if (!task.due_date || task.status === "done")
                            return null;
                          const dueDate = new Date(task.due_date);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const diffDays = Math.ceil(
                            (dueDate.getTime() - today.getTime()) /
                              (1000 * 60 * 60 * 24),
                          );

                          if (diffDays < 0)
                            return {
                              level: "overdue",
                              text: `${Math.abs(diffDays)}d overdue`,
                              color: "text-red-500",
                              bg: "bg-red-500/10",
                              border: "border-red-500/30",
                              pulse: true,
                            };
                          if (diffDays === 0)
                            return {
                              level: "today",
                              text: "Due today",
                              color: "text-red-400",
                              bg: "bg-red-500/10",
                              border: "border-red-500/30",
                              pulse: true,
                            };
                          if (diffDays === 1)
                            return {
                              level: "tomorrow",
                              text: "Due tomorrow",
                              color: "text-orange-400",
                              bg: "bg-orange-500/10",
                              border: "border-orange-500/30",
                              pulse: false,
                            };
                          if (diffDays <= 3)
                            return {
                              level: "soon",
                              text: `Due in ${diffDays}d`,
                              color: "text-yellow-400",
                              bg: "bg-yellow-500/10",
                              border: "border-yellow-500/30",
                              pulse: false,
                            };
                          return null;
                        };

                        const dueUrgency = getDueDateUrgency();

                        return (
                          <div
                            key={task.id}
                            className={`group flex flex-col gap-3 rounded-xl border px-4 py-4 transition-all hover:border-white/20 hover:bg-black/50 md:flex-row md:items-center md:justify-between ${
                              dueUrgency?.pulse
                                ? "border-red-500/50 bg-red-500/5 animate-pulse"
                                : "border-white/10 bg-black/40"
                            }`}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start gap-3">
                                <div
                                  className={`mt-1 h-2 w-2 shrink-0 rounded-full ${
                                    task.priority === "urgent"
                                      ? "bg-red-500"
                                      : task.priority === "high"
                                        ? "bg-orange-500"
                                        : task.priority === "medium"
                                          ? "bg-yellow-500"
                                          : "bg-white/30"
                                  }`}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-white truncate">
                                    {task.title}
                                  </p>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/45">
                                    <span className="uppercase tracking-wide">
                                      {task.status.replaceAll("_", " ")}
                                    </span>
                                    <span>·</span>
                                    <span className="capitalize">
                                      {task.priority}
                                    </span>
                                    {dueUrgency ? (
                                      <>
                                        <span>·</span>
                                        <span
                                          className={`font-semibold ${dueUrgency.color} ${dueUrgency.pulse ? "animate-pulse" : ""}`}
                                        >
                                          {dueUrgency.text}
                                        </span>
                                      </>
                                    ) : task.due_date ? (
                                      <>
                                        <span>·</span>
                                        <span>
                                          Due:{" "}
                                          {new Date(
                                            task.due_date,
                                          ).toLocaleDateString()}
                                        </span>
                                      </>
                                    ) : null}
                                    {totalTaskTime > 0 && (
                                      <>
                                        <span>·</span>
                                        <span className="text-orange-400">
                                          {formatDuration(totalTaskTime)} today
                                        </span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isTrackingThisTask ? (
                                <div className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2">
                                  <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
                                  <span className="text-sm font-mono font-semibold text-orange-400">
                                    {formatDuration(liveSeconds)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => void stopTimer()}
                                    className="ml-1 rounded-lg p-1 text-orange-400 hover:bg-orange-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    title="Stop timer"
                                  >
                                    <Pause size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy || !!activeTimer}
                                  onClick={() =>
                                    void startTimer(
                                      task.id,
                                      `Working on ${task.title}`,
                                    )
                                  }
                                  className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60 hover:bg-orange-400 transition"
                                  title={
                                    !!activeTimer
                                      ? "Another timer is running"
                                      : "Start timer"
                                  }
                                >
                                  <Play size={14} className="inline mr-1" />
                                  Track
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <TimeTrackerCard
                    activeTimeEntry={activeTimer}
                    todaySeconds={stats?.todaySeconds ?? 0}
                    busy={busy}
                    onStart={() => void startTimer(null, "General work")}
                    onStop={() => void stopTimer()}
                  />

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                        <TimerReset size={18} />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">
                          Active Session
                        </h2>
                        <p className="text-sm text-white/50">
                          Current timer state
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Status</span>
                        <span className="font-medium text-white">
                          {activeTimer ? "Running" : "Stopped"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Current session</span>
                        <span className="font-medium text-orange-400">
                          {formatDuration(liveSeconds)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Today total</span>
                        <span className="font-medium text-white">
                          {formatDuration(totalTodayDisplaySeconds)}
                        </span>
                      </div>

                      {activeTimer?.description ? (
                        <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white/70">
                          {activeTimer.description}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                        <CloudSun size={18} />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">Weather</h2>
                        <p className="text-sm text-white/50">
                          {weather?.cityLabel || "Your city"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <p className="text-3xl font-bold">
                        {weather?.temperature != null
                          ? `${weather.temperature}°`
                          : "--"}
                      </p>
                      <p className="mt-1 text-sm text-white/50">
                        Wind:{" "}
                        {weather?.windspeed != null
                          ? `${weather.windspeed} km/h`
                          : "--"}
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                      <Newspaper size={18} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">Role Updates</h2>
                      <p className="text-sm text-white/50">
                        Topic: {roleNewsTopic}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {announcements.length === 0 ? (
                      <p className="text-sm text-white/50">
                        No internal announcements yet.
                      </p>
                    ) : (
                      announcements.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                        >
                          <p className="font-medium">{item.title}</p>
                          <p className="mt-2 text-sm text-white/65">
                            {item.content}
                          </p>
                        </div>
                      ))
                    )}
                  </div>

                  {roleNews.length > 0 ? (
                    <div className="mt-5 space-y-3 border-t border-white/10 pt-5">
                      {roleNews.slice(0, 3).map((item, index) => (
                        <div
                          key={`${item.title}-${index}`}
                          className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                        >
                          <p className="font-medium text-white">{item.title}</p>
                          {item.description ? (
                            <p className="mt-2 text-sm text-white/60">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-linear-to-br from-orange-500/10 to-white/5 p-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-orange-500 p-2 text-black">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold">AI Assistant</h2>
                      <p className="text-sm text-white/50">
                        Prepared for n8n AI actions
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3 text-sm text-white/75">
                    <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                      Summarize my urgent tasks
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                      Show blockers for my role
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/40 px-4 py-3">
                      Recommend next priority actions
                    </div>
                  </div>

                  <button
                    type="button"
                    className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-orange-500"
                  >
                    Open assistant <ArrowRight size={16} />
                  </button>
                </div>
              </section>

              {isAdminView ? (
                <section className="mt-6 grid gap-6 xl:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                        <Clock3 size={18} />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">
                          Team Time Visibility
                        </h2>
                        <p className="text-sm text-white/50">
                          Live team time tracking overview.
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-center">
                        <p className="text-xs text-white/40">
                          Team tracked today
                        </p>
                        <p className="mt-2 text-xl font-bold text-white">
                          {adminSummary
                            ? formatDuration(adminSummary.totalSeconds)
                            : "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-center">
                        <p className="text-xs text-white/40">Active timers</p>
                        <p className="mt-2 text-xl font-bold text-green-400">
                          {adminSummary?.activeCount ?? "—"}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-center">
                        <p className="text-xs text-white/40">Total cost</p>
                        <p className="mt-2 text-xl font-bold text-white">
                          ${adminSummary?.totalCost?.toFixed(2) ?? "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                        <CheckCircle2 size={18} />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">Admin Summary</h2>
                        <p className="text-sm text-white/50">Oversight panel</p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 text-sm text-white/70">
                      <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                        <a
                          href="/timesheets/team"
                          className="text-orange-400 hover:underline"
                        >
                          Monitor team time records →
                        </a>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                        <a
                          href="/timesheets/everhouradmin"
                          className="text-orange-400 hover:underline"
                        >
                          Review task-linked work logs →
                        </a>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                        <a
                          href="/timesheets/reports"
                          className="text-orange-400 hover:underline"
                        >
                          Prepare employee timesheets →
                        </a>
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
