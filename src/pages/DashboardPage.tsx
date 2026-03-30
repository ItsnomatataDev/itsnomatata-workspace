import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "../app/providers/AuthProvider";
import Sidebar from "../components/dashboard/components/Siderbar";
import { useDashboard } from "../lib/hooks/useDashboard";

function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number }>;
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
  } = useDashboard({
    userId: user?.id,
    organizationId: profile?.organization_id ?? null,
    role: profile?.primary_role ?? null,
    cityLabel: profile?.department || "Your city",
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    enabled: !!user?.id && !!profile?.organization_id,
  });

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

  if (!profile.organization_id) {
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
                Real-time role dashboard powered by your workspace data.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                AI Workspace
              </p>
              <p className="mt-1 text-sm text-white/70">
                Ready for n8n assistant integration
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
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
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
                  value={`${stats?.todayMinutes ?? 0}m`}
                  icon={Clock3}
                />
                <StatCard
                  title="My Projects"
                  value={stats?.myProjects ?? 0}
                  icon={BriefcaseBusiness}
                />
              </section>

              <section className="mt-6 grid gap-6 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">My Tasks</h2>
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
                      tasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                        >
                          <div>
                            <p className="font-medium text-white">
                              {task.title}
                            </p>
                            <p className="mt-1 text-xs uppercase tracking-wide text-white/45">
                              {task.status.replaceAll("_", " ")} ·{" "}
                              {task.priority}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              void startTimer(
                                task.id,
                                `Working on ${task.title}`,
                              )
                            }
                            className="rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-black"
                          >
                            Track time
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                        <Clock3 size={18} />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">Time Tracking</h2>
                        <p className="text-sm text-white/50">
                          Role: {profile.primary_role}
                        </p>
                      </div>
                    </div>

                    <p className="mt-5 text-3xl font-bold text-white">
                      {stats?.todayMinutes ?? 0} min
                    </p>
                    <p className="mt-1 text-sm text-white/50">Tracked today</p>

                    <div className="mt-5">
                      {activeTimer ? (
                        <button
                          onClick={() => void stopTimer()}
                          className="rounded-xl bg-white px-4 py-3 font-semibold text-black"
                        >
                          Stop Timer
                        </button>
                      ) : (
                        <button
                          onClick={() => void startTimer(null, "General work")}
                          className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black"
                        >
                          Start Timer
                        </button>
                      )}
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
                        No internal announcements yet. Connect your external
                        news feed through n8n next.
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

                  <button className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-orange-500">
                    Open assistant <ArrowRight size={16} />
                  </button>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
