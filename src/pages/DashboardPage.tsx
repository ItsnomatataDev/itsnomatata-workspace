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
  CheckCircle2,
  TimerReset,
  Pause,
  Play,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../app/providers/AuthProvider";
import Sidebar from "../components/dashboard/components/Sidebar";
import TimeTrackerCard from "../components/dashboard/components/TimeTrackerCard";
import AttendanceClockCard from "../features/attendance/components/AttendanceClockCard";
import { useDashboard } from "../lib/hooks/useDashboard";
import { getAdminTimeSummary } from "../lib/supabase/queries/adminTime";
import { canManageAllOffices } from "../lib/offices";

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
  const navigate = useNavigate();
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
    taskTodaySeconds,
    announcements,
    weather,
    roleNews,
    roleNewsTopic,
    activeTimer,
    activeSessionSeconds,
    startTimer,
    stopTimer,
    busy,
  } = useDashboard({
    userId: user?.id ?? undefined,
    organizationId: profile?.organization_id ?? null,
    officeId: (profile?.office_id as string | null | undefined) ?? null,
    includeAllOffices: canManageAllOffices(profile),
    role: profile?.primary_role ?? null,
    cityLabel,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    enabled: !!user?.id && !!profile?.organization_id,
  });

  const runningTaskTitle = useMemo(() => {
    if (!activeTimer?.task_id) return null;
    return tasks.find((task) => task.id === activeTimer.task_id)?.title ?? null;
  }, [activeTimer?.task_id, tasks]);

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

    void fetchAdminSummary();

    const interval = window.setInterval(fetchAdminSummary, 60000);
    return () => window.clearInterval(interval);
  }, [organizationId, isAdminView]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Loading workspace...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        No authenticated user found.
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Loading profile...
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Your account is not linked to an organization yet.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
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

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
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
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-white/60 sm:px-6">
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
                  value={formatDuration(stats?.todaySeconds ?? 0)}
                  icon={Clock3}
                  subtitle="Completed, manual, and active"
                />
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-semibold">My Tasks</h2>
                      <p className="mt-1 text-sm text-white/50">
                        Click a task to open its card details
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
                        const totalTaskTime = taskTodaySeconds[task.id] || 0;

                        const getDueDateUrgency = () => {
                          if (!task.due_date || task.status === "done") {
                            return null;
                          }

                          const dueDate = new Date(task.due_date);
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);

                          const diffDays = Math.ceil(
                            (dueDate.getTime() - today.getTime()) /
                              (1000 * 60 * 60 * 24),
                          );

                          if (diffDays < 0) {
                            return {
                              level: "overdue",
                              text: `${Math.abs(diffDays)}d overdue`,
                              color: "text-red-500",
                              bg: "bg-red-500/10",
                              border: "border-red-500/30",
                              pulse: true,
                            };
                          }

                          if (diffDays === 0) {
                            return {
                              level: "today",
                              text: "Due today",
                              color: "text-red-400",
                              bg: "bg-red-500/10",
                              border: "border-red-500/30",
                              pulse: true,
                            };
                          }

                          if (diffDays === 1) {
                            return {
                              level: "tomorrow",
                              text: "Due tomorrow",
                              color: "text-orange-400",
                              bg: "bg-orange-500/10",
                              border: "border-orange-500/30",
                              pulse: false,
                            };
                          }

                          if (diffDays <= 3) {
                            return {
                              level: "soon",
                              text: `Due in ${diffDays}d`,
                              color: "text-yellow-400",
                              bg: "bg-yellow-500/10",
                              border: "border-yellow-500/30",
                              pulse: false,
                            };
                          }

                          return null;
                        };

                        const dueUrgency = getDueDateUrgency();

                        return (
                          <div
                            key={task.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              const cardTask = task as typeof task & {
                                client_id?: string | null;
                                board_id?: string | null;
                                project_id?: string | null;
                              };

                              const boardId =
                                cardTask.client_id ??
                                cardTask.board_id ??
                                cardTask.project_id ??
                                null;

                              if (!boardId) return;

                              navigate(`/boards/${boardId}?cardId=${task.id}`);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();

                                const cardTask = task as typeof task & {
                                  client_id?: string | null;
                                  board_id?: string | null;
                                  project_id?: string | null;
                                };

                                const boardId =
                                  cardTask.client_id ??
                                  cardTask.board_id ??
                                  cardTask.project_id ??
                                  null;

                                if (!boardId) return;

                                navigate(
                                  `/boards/${boardId}?cardId=${task.id}`,
                                );
                              }
                            }}
                            className={`group flex cursor-pointer flex-col gap-3 rounded-2xl border px-4 py-4 transition-all hover:border-orange-500/30 hover:bg-black/60 hover:shadow-lg hover:shadow-orange-500/5 md:flex-row md:items-center md:justify-between ${
                              dueUrgency?.pulse
                                ? "border-red-500/50 bg-red-500/5 animate-pulse"
                                : "border-white/10 bg-black/40"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
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
                                  <p className="truncate font-medium text-white transition group-hover:text-orange-200">
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
                                          className={`font-semibold ${dueUrgency.color} ${
                                            dueUrgency.pulse
                                              ? "animate-pulse"
                                              : ""
                                          }`}
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

                                    {totalTaskTime > 0 ? (
                                      <>
                                        <span>·</span>

                                        <span className="text-orange-400">
                                          Task today: {formatDuration(totalTaskTime)}
                                        </span>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {isTrackingThisTask ? (
                                <div
                                  className="flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <div className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />

                                  <span className="font-mono text-sm font-semibold text-orange-400">
                                    {formatDuration(activeSessionSeconds)}
                                  </span>

                                  <button
                                    type="button"
                                    disabled={busy}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void stopTimer();
                                    }}
                                    className="ml-1 rounded-lg p-1 text-orange-400 transition hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                    title="Stop timer"
                                  >
                                    <Pause size={14} />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busy || !!activeTimer}
                                  onClick={(event) => {
                                    event.stopPropagation();

                                    void startTimer(
                                      task.id,
                                      `Working on ${task.title}`,
                                    );
                                  }}
                                  className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                                  title={
                                    !!activeTimer
                                      ? "Another timer is running"
                                      : "Start timer"
                                  }
                                >
                                  <Play size={14} className="mr-1 inline" />
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
                  <AttendanceClockCard
                    organizationId={organizationId}
                    userId={user.id}
                  />

                  <TimeTrackerCard
                    activeTimeEntry={activeTimer}
                    todaySeconds={stats?.todaySeconds ?? 0}
                    activeSessionSeconds={activeSessionSeconds}
                    runningTaskTitle={runningTaskTitle}
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
                          {formatDuration(activeSessionSeconds)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-white/50">Today total</span>
                        <span className="font-medium text-white">
                          {formatDuration(stats?.todaySeconds ?? 0)}
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
