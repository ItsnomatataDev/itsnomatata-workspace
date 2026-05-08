import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  Bot,
  CalendarDays,
  Camera,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileImage,
  Megaphone,
  Package,
  Sparkles,
  Users,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getMediaDashboardData,
  getMediaInitials,
  type MediaAsset,
  type MediaDashboardData,
  type MediaSocialPost,
  type MediaTask,
  type MediaWorkload,
} from "../services/mediaDashboardService";
import { formatDurationHms } from "../../../lib/utils/timeMath";
import { getZimbabweDateKey } from "../../../lib/utils/zimbabweCalendar";
import { OFFICE_SLUGS } from "../../../lib/offices";

const PIPELINE_STATUSES = ["backlog", "todo", "in_progress", "review", "approved", "done"];

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const color = normalized.includes("late") || normalized.includes("overdue") || normalized.includes("failed")
    ? "border-red-500/20 bg-red-500/10 text-red-300"
    : normalized.includes("review") || normalized.includes("approval")
      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
      : normalized.includes("done") || normalized.includes("published") || normalized.includes("approved")
        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
        : "border-white/10 bg-white/5 text-white/65";

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold capitalize ${color}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}

function EmptyState({ children }: { children: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-black/30 p-5 text-sm text-white/45">
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  Icon,
  helper,
}: {
  label: string;
  value: string | number;
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  helper?: string;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-white/55">{label}</p>
        <div className="rounded-2xl bg-orange-500/15 p-2 text-orange-400">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
      {helper ? <p className="mt-2 text-xs text-white/35">{helper}</p> : null}
    </div>
  );
}

function TaskCard({ task }: { task: MediaTask }) {
  const route = task.client_id
    ? `/boards/${task.client_id}?cardId=${task.id}`
    : `/tasks/${task.id}`;

  return (
    <Link
      to={route}
      className="block rounded-2xl border border-white/10 bg-neutral-950 p-4 transition hover:border-orange-500/35 hover:bg-white/[0.06]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="line-clamp-2 font-semibold text-white">{task.title}</p>
          <p className="mt-1 text-xs text-white/40">
            {task.client_name || "No board"}{task.campaign_name ? ` • ${task.campaign_name}` : ""}
          </p>
        </div>
        <ExternalLink size={15} className="shrink-0 text-white/25" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StatusBadge value={task.status} />
        <span className="rounded-full bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-300">
          {task.priority}
        </span>
        {task.due_date ? (
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-xs text-white/55">
            Due {new Date(task.due_date).toLocaleDateString()}
          </span>
        ) : null}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex -space-x-2">
          {task.assignees.slice(0, 4).map((assignee) => (
            <div
              key={assignee.id}
              title={assignee.full_name || assignee.email || "Assignee"}
              className="flex h-7 w-7 items-center justify-center rounded-full border border-orange-500/30 bg-orange-500/20 text-[10px] font-bold text-orange-200 ring-2 ring-neutral-950"
            >
              {getMediaInitials(assignee.full_name, assignee.email)}
            </div>
          ))}
          {task.assignees.length === 0 ? (
            <span className="text-xs text-white/30">Unassigned</span>
          ) : null}
        </div>
        <span className="font-mono text-xs text-white/45">
          {formatDurationHms(Number(task.tracked_seconds_cache ?? 0))}
        </span>
      </div>
    </Link>
  );
}

function AssetPreview({ asset }: { asset: MediaAsset }) {
  const isImage = asset.mime_type?.startsWith("image/");
  const isVideo = asset.mime_type?.startsWith("video/");

  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950 p-3">
      <div className="aspect-video overflow-hidden rounded-2xl bg-black">
        {isImage && asset.file_url ? (
          <img src={asset.file_url} alt={asset.file_name} className="h-full w-full object-cover" />
        ) : isVideo && asset.file_url ? (
          <video src={asset.file_url} className="h-full w-full object-cover" muted />
        ) : (
          <div className="flex h-full items-center justify-center text-white/25">
            <FileImage size={28} />
          </div>
        )}
      </div>
      <p className="mt-3 truncate text-sm font-semibold text-white">{asset.file_name}</p>
      <p className="mt-1 text-xs text-white/40">
        {asset.asset_type || asset.mime_type || "File"}{asset.client_name ? ` • ${asset.client_name}` : ""}
      </p>
      {asset.file_url ? (
        <a
          href={asset.file_url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-orange-300 hover:text-orange-200"
        >
          Open asset <ExternalLink size={12} />
        </a>
      ) : null}
    </div>
  );
}

function SocialPostRow({ post }: { post: MediaSocialPost }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-neutral-950 p-4">
      <div className="min-w-0">
        <p className="truncate font-semibold text-white">{post.title}</p>
        <p className="mt-1 text-xs text-white/40">
          {post.platform}{post.client_name ? ` • ${post.client_name}` : ""}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <StatusBadge value={post.status} />
        <p className="mt-2 text-xs text-white/40">
          {post.scheduled_for ? new Date(post.scheduled_for).toLocaleString() : "No schedule"}
        </p>
      </div>
    </div>
  );
}

function WorkloadRow({ item }: { item: MediaWorkload }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-500/20 text-sm font-bold text-orange-200">
          {getMediaInitials(item.profile.full_name, item.profile.email)}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{item.profile.full_name || item.profile.email || "Team member"}</p>
          <p className="text-xs text-white/40">{item.profile.primary_role || item.profile.department || "Media"}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-white/5 p-2">
          <p className="text-white/35">Open</p>
          <p className="mt-1 font-bold text-white">{item.openTasks}</p>
        </div>
        <div className="rounded-xl bg-white/5 p-2">
          <p className="text-white/35">Overdue</p>
          <p className="mt-1 font-bold text-red-300">{item.overdueTasks}</p>
        </div>
        <div className="rounded-xl bg-white/5 p-2">
          <p className="text-white/35">Week</p>
          <p className="mt-1 font-bold text-orange-300">{formatDurationHms(item.trackedSecondsThisWeek)}</p>
        </div>
      </div>
    </div>
  );
}

export default function MediaDashboardPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const [data, setData] = useState<MediaDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [calendarView, setCalendarView] = useState<"today" | "week" | "month">("week");

  const load = useCallback(async () => {
    if (!profile?.organization_id || !profile.id) return;
    try {
      setLoading(true);
      setError("");
      setData(await getMediaDashboardData({
        id: profile.id,
        organization_id: profile.organization_id,
        office_id: profile.office_id,
        primary_role: profile.primary_role,
        office: profile.office as { is_primary?: boolean | null } | null,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load media dashboard.");
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleCalendar = useMemo(() => {
    if (!data) return [];
    const now = new Date();
    const today = getZimbabweDateKey(now);
    const end = new Date(now);
    end.setDate(now.getDate() + (calendarView === "today" ? 1 : calendarView === "week" ? 7 : 31));
    return data.contentCalendar.filter((item) => {
      const date = "due_date" in item ? item.due_date : item.scheduled_for;
      if (!date) return false;
      if (calendarView === "today") return getZimbabweDateKey(date) === today;
      const time = new Date(date).getTime();
      return time >= now.getTime() && time <= end.getTime();
    });
  }, [calendarView, data]);

  const aiAllowed = profile?.office && "slug" in profile.office
    ? profile.office.slug !== OFFICE_SLUGS.threeLittleBirds
    : true;

  if (!profile) {
    return <div className="min-h-screen bg-black p-6 text-white">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">Media Operations</p>
              <h1 className="mt-2 text-3xl font-bold">Media Team Dashboard</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                Creative production, publishing, assets, gear, approvals, and workload using live workspace data.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10"
            >
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">Loading real media workspace data...</div>
          ) : error ? (
            <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-red-200">{error}</div>
          ) : data ? (
            <div className="space-y-8">
              {data.sectionErrors.length > 0 ? (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  Some optional media modules could not be loaded. Available sections still use live data.
                </div>
              ) : null}

              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard label="Active campaigns" value={data.kpis.activeCampaigns} Icon={Megaphone} />
                <KpiCard label="Due today" value={data.kpis.dueTodayTasks} Icon={CalendarDays} />
                <KpiCard label="Overdue media tasks" value={data.kpis.overdueTasks} Icon={AlertTriangle} />
                <KpiCard label="Assets this month" value={data.kpis.assetsUploadedThisMonth} Icon={FileImage} />
                <KpiCard label="Pending approvals" value={data.kpis.pendingApprovals} Icon={CheckCircle2} />
                <KpiCard label="Scheduled posts" value={data.kpis.scheduledSocialPosts} Icon={Megaphone} />
                <KpiCard label="Published posts" value={data.kpis.publishedSocialPosts} Icon={Sparkles} />
                <KpiCard label="Team hours this week" value={formatDurationHms(data.kpis.trackedSecondsThisWeek)} Icon={Clock3} />
              </section>

              <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Today’s Shoots / Production Tasks</h2>
                    <Camera size={18} className="text-orange-400" />
                  </div>
                  {data.productionTasks.length === 0 ? (
                    <EmptyState>No media production tasks are due or active right now.</EmptyState>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {data.productionTasks.map((task) => <TaskCard key={task.id} task={task} />)}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h2 className="mb-4 text-lg font-semibold">Approval Queue</h2>
                  {data.approvalQueue.length === 0 ? (
                    <EmptyState>No real tasks are currently in review or approval.</EmptyState>
                  ) : (
                    <div className="space-y-3">
                      {data.approvalQueue.slice(0, 6).map((task) => <TaskCard key={task.id} task={task} />)}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="mb-4 text-lg font-semibold">Creative Production Pipeline</h2>
                <div className="grid gap-4 xl:grid-cols-6">
                  {PIPELINE_STATUSES.map((status) => {
                    const tasks = data.pipelineTasks.filter((task) => task.status === status).slice(0, 5);
                    return (
                      <div key={status} className="rounded-2xl border border-white/10 bg-black/30 p-3">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-sm font-semibold capitalize">{status.replaceAll("_", " ")}</p>
                          <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/50">
                            {data.pipelineTasks.filter((task) => task.status === status).length}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {tasks.length === 0 ? (
                            <p className="text-xs text-white/30">No cards</p>
                          ) : tasks.map((task) => (
                            <Link key={task.id} to={task.client_id ? `/boards/${task.client_id}?cardId=${task.id}` : `/tasks/${task.id}`} className="block rounded-xl bg-white/5 p-3 text-xs text-white/70 hover:bg-white/10">
                              <span className="line-clamp-2">{task.title}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-lg font-semibold">Content Calendar</h2>
                    <div className="flex rounded-2xl border border-white/10 bg-black p-1">
                      {(["today", "week", "month"] as const).map((view) => (
                        <button
                          key={view}
                          type="button"
                          onClick={() => setCalendarView(view)}
                          className={`rounded-xl px-3 py-1.5 text-xs font-semibold capitalize ${
                            calendarView === view ? "bg-orange-500 text-black" : "text-white/50 hover:text-white"
                          }`}
                        >
                          {view}
                        </button>
                      ))}
                    </div>
                  </div>
                  {visibleCalendar.length === 0 ? (
                    <EmptyState>No scheduled posts or dated media tasks for this view.</EmptyState>
                  ) : (
                    <div className="space-y-3">
                      {visibleCalendar.slice(0, 10).map((item) => {
                        const title = "title" in item ? item.title : "Scheduled item";
                        const date = "due_date" in item ? item.due_date : item.scheduled_for;
                        const key = `${"id" in item ? item.id : title}-${date}`;
                        return (
                          <div key={key} className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
                            <p className="font-semibold">{title}</p>
                            <p className="mt-1 text-xs text-white/40">{date ? new Date(date).toLocaleString() : "No date"}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h2 className="mb-4 text-lg font-semibold">Publishing Center</h2>
                  {data.socialPosts.length === 0 ? (
                    <EmptyState>No social posts were found. Create scheduled or published posts to populate this area.</EmptyState>
                  ) : (
                    <div className="space-y-3">
                      {data.socialPosts.slice(0, 8).map((post) => <SocialPostRow key={post.id} post={post} />)}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <h2 className="mb-4 text-lg font-semibold">Media Asset Library Preview</h2>
                {data.assets.length === 0 ? (
                  <EmptyState>No content assets are available yet.</EmptyState>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {data.assets.slice(0, 8).map((asset) => <AssetPreview key={asset.id} asset={asset} />)}
                  </div>
                )}
              </section>

              <section className="grid gap-6 xl:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Team Workload</h2>
                    <Users size={18} className="text-orange-400" />
                  </div>
                  {data.workload.length === 0 ? (
                    <EmptyState>No active media team members were found.</EmptyState>
                  ) : (
                    <div className="grid gap-3 md:grid-cols-2">
                      {data.workload.map((item) => <WorkloadRow key={item.profile.id} item={item} />)}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Equipment / Gear</h2>
                    <Package size={18} className="text-orange-400" />
                  </div>
                  {data.gear.length === 0 ? (
                    <EmptyState>No camera, audio, lighting, drone, lens, or tripod assets were found.</EmptyState>
                  ) : (
                    <div className="space-y-3">
                      {data.gear.map((gear) => (
                        <div key={gear.category} className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold">{gear.category}</p>
                            <span className="text-sm text-white/50">{gear.total}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                            <span className="rounded-xl bg-emerald-500/10 p-2 text-emerald-300">Available {gear.available}</span>
                            <span className="rounded-xl bg-white/5 p-2 text-white/55">Assigned {gear.assigned}</span>
                            <span className="rounded-xl bg-amber-500/10 p-2 text-amber-300">Maint. {gear.maintenance}</span>
                            <span className="rounded-xl bg-red-500/10 p-2 text-red-300">Issue {gear.damagedOrLost}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-2">
                {aiAllowed ? (
                  <Link to="/ai-workspace" className="rounded-3xl border border-orange-500/20 bg-orange-500/10 p-5 transition hover:bg-orange-500/15">
                    <div className="flex items-start gap-4">
                      <div className="rounded-2xl bg-orange-500/20 p-3 text-orange-300">
                        <Bot size={24} />
                      </div>
                      <div>
                        <h2 className="text-lg font-semibold">AI Creative Assistant</h2>
                        <p className="mt-2 text-sm text-white/55">
                          Jump to the AI workspace for briefs, captions, campaign ideas, and production support.
                        </p>
                      </div>
                    </div>
                  </Link>
                ) : null}

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h2 className="mb-4 text-lg font-semibold">Notifications / Recent Activity</h2>
                  {data.notifications.length === 0 ? (
                    <EmptyState>No recent notifications are available for your account.</EmptyState>
                  ) : (
                    <div className="space-y-3">
                      {data.notifications.map((item) => (
                        <Link key={item.id} to={item.action_url || "/notifications"} className="block rounded-2xl border border-white/10 bg-neutral-950 p-4 hover:bg-white/[0.06]">
                          <p className="font-semibold">{item.title}</p>
                          {item.message ? <p className="mt-1 line-clamp-2 text-sm text-white/45">{item.message}</p> : null}
                          <p className="mt-2 text-xs text-white/30">{new Date(item.created_at).toLocaleString()}</p>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}
