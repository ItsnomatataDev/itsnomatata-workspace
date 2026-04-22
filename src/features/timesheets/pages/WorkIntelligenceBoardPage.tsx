import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleDot, Filter, LineChart, Sparkles } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  approveTimeEntry,
  bulkApproveTimeEntries,
  rejectTimeEntry,
} from "../../../lib/supabase/mutations/adminTime";
import {
  getAdminTimeEntries,
  getAdminTimeSummary,
  type AdminTimeEntryRow,
  type TimeApprovalStatus,
} from "../../../lib/supabase/queries/adminTime";

type WorkBoardPeriod = "day" | "week" | "month" | "quarter";

type UserSummary = {
  id: string;
  name: string;
  email: string | null;
  totalSeconds: number;
  activeTimers: number;
  recentProject: string;
  running: boolean;
  lastStartedAt: string;
};

type ProjectSummary = {
  id: string;
  name: string;
  totalSeconds: number;
  activeUsers: number;
  entries: AdminTimeEntryRow[];
  trend: number[];
};

const periodOptions: Record<WorkBoardPeriod, string> = {
  day: "Today",
  week: "Last 7 days",
  month: "Last 30 days",
  quarter: "Last 90 days",
};

function toDateRange(period: WorkBoardPeriod) {
  const end = new Date();
  const from = new Date();

  if (period === "week") {
    from.setDate(end.getDate() - 7);
  } else if (period === "month") {
    from.setMonth(end.getMonth() - 1);
  } else if (period === "quarter") {
    from.setMonth(end.getMonth() - 3);
  }

  return {
    from: from.toISOString(),
    to: end.toISOString(),
  };
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function percentage(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function buildTrend(values: number[]) {
  const max = Math.max(...values, 1);
  return values.map((value) => Math.round((value / max) * 100));
}

export default function WorkIntelligenceBoardPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;

  const [entries, setEntries] = useState<AdminTimeEntryRow[]>([]);
  const [summary, setSummary] = useState({
    totalSeconds: 0,
    pendingCount: 0,
    approvedSeconds: 0,
    billableSeconds: 0,
    activeCount: 0,
    totalCost: 0,
  });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [reviewSelection, setReviewSelection] = useState<string[]>([]);
  const [commentMap, setCommentMap] = useState<Record<string, string>>({});
  const [approvalStatus, setApprovalStatus] = useState<
    TimeApprovalStatus | "all"
  >("all");
  const [period, setPeriod] = useState<WorkBoardPeriod>("week");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const organizationId = profile?.organization_id ?? null;
  const canManage =
    profile?.primary_role === "admin" || profile?.primary_role === "manager";

  const dateRange = useMemo(() => toDateRange(period), [period]);

  const loadEntries = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [rows, summaryData] = await Promise.all([
        getAdminTimeEntries({
          organizationId,
          approvalStatus,
          from: dateRange.from,
          to: dateRange.to,
          limit: 300,
        }),
        getAdminTimeSummary({
          organizationId,
          from: dateRange.from,
          to: dateRange.to,
        }),
      ]);

      setEntries(rows);
      setSummary(summaryData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load work intelligence data.",
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId, approvalStatus, dateRange.from, dateRange.to]);

  useEffect(() => {
    if (!organizationId || !canManage) return;
    void loadEntries();
  }, [organizationId, canManage, loadEntries]);

  const users = useMemo(() => {
    const map = new Map<string, UserSummary>();
    for (const entry of entries) {
      const userId = entry.user_id;
      const current = map.get(userId) ?? {
        id: userId,
        name: entry.user_name || entry.full_name || "Unknown user",
        email: entry.user_email || null,
        totalSeconds: 0,
        activeTimers: 0,
        recentProject: entry.project_name || "Unassigned",
        running: false,
        lastStartedAt: "1970-01-01T00:00:00.000Z",
      };
      current.totalSeconds += Number(entry.duration_seconds ?? 0);
      if (entry.is_running) current.activeTimers += 1;
      if (entry.started_at > current.lastStartedAt) {
        current.lastStartedAt = entry.started_at;
        current.recentProject = entry.project_name || current.recentProject;
      }
      current.running = current.running || entry.is_running;
      map.set(userId, current);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (b.activeTimers !== a.activeTimers)
        return b.activeTimers - a.activeTimers;
      return b.totalSeconds - a.totalSeconds;
    });
  }, [entries]);

  const projects = useMemo(() => {
    const map = new Map<string, ProjectSummary>();
    const lastSixDays = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (5 - index));
      return date.toISOString().slice(0, 10);
    });

    for (const entry of entries) {
      const projectId = entry.project_id || "unassigned";
      const current = map.get(projectId) ?? {
        id: projectId,
        name: entry.project_name || "Unassigned",
        totalSeconds: 0,
        activeUsers: 0,
        entries: [] as AdminTimeEntryRow[],
        trend: Array(6).fill(0),
      };
      current.totalSeconds += Number(entry.duration_seconds ?? 0);
      current.entries.push(entry);
      map.set(projectId, current);
    }

    for (const project of map.values()) {
      const userSet = new Set<string>();
      for (const entry of project.entries) {
        if (entry.is_running) userSet.add(entry.user_id);
        const entryDate = entry.started_at.slice(0, 10);
        const trendIndex = lastSixDays.indexOf(entryDate);
        if (trendIndex >= 0) {
          project.trend[trendIndex] +=
            Number(entry.duration_seconds ?? 0) / 3600;
        }
      }
      project.activeUsers = userSet.size;
      project.trend = buildTrend(project.trend);
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalSeconds - a.totalSeconds,
    );
  }, [entries]);

  const selectedUser = useMemo(
    () => users.find((item) => item.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const selectedProject = useMemo(
    () => projects.find((item) => item.id === selectedProjectId) ?? null,
    [projects, selectedProjectId],
  );

  const selectedUserCalendar = useMemo(() => {
    if (!selectedUserId)
      return [] as Array<{
        dayLabel: string;
        dateKey: string;
        hours: number;
      }>;

    const today = new Date();
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(today.getDate() - (6 - index));
      const dateKey = date.toISOString().slice(0, 10);
      return {
        dayLabel: date
          .toLocaleDateString(undefined, {
            weekday: "short",
          })
          .slice(0, 2),
        dateKey,
        hours: 0,
      };
    });

    const dayMap = new Map(days.map((day) => [day.dateKey, day]));
    for (const entry of entries) {
      if (entry.user_id !== selectedUserId) continue;
      const dateKey = entry.started_at.slice(0, 10);
      const day = dayMap.get(dateKey);
      if (day) {
        day.hours += Number(entry.duration_seconds ?? 0) / 3600;
      }
    }

    return days;
  }, [entries, selectedUserId]);

  const pendingEntries = useMemo(
    () => entries.filter((entry) => entry.approval_status === "pending"),
    [entries],
  );

  const topMembers = useMemo(() => {
    return users.slice(0, 5);
  }, [users]);

  const topProjects = useMemo(() => projects.slice(0, 5), [projects]);

  const reviewCount = reviewSelection.length;

  const handleToggleReview = (entryId: string) => {
    setReviewSelection((prev) =>
      prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : [...prev, entryId],
    );
  };

  const handleBatchApprove = async () => {
    if (!user?.id || reviewSelection.length === 0) return;

    try {
      setBusy(true);
      await bulkApproveTimeEntries({
        entryIds: reviewSelection,
        approvedBy: user.id,
      });
      setReviewSelection([]);
      await loadEntries();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to approve selected entries.",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (entryId: string) => {
    if (!user?.id) return;
    try {
      setBusy(true);
      await approveTimeEntry({ entryId, approvedBy: user.id });
      setReviewSelection((prev) => prev.filter((id) => id !== entryId));
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approval failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (entryId: string) => {
    try {
      setBusy(true);
      await rejectTimeEntry({ entryId, approvedBy: user?.id ?? null });
      setReviewSelection((prev) => prev.filter((id) => id !== entryId));
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed.");
    } finally {
      setBusy(false);
    }
  };

  if (!auth?.user || !profile || !organizationId || !canManage) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-3xl">
              <p className="text-xs uppercase tracking-[0.35em] text-orange-400/80">
                Work Intelligence Board
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white">
                Operations command center
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/60">
                Monitor live activity, review time approvals, and surface team
                work patterns with visual intelligence instead of a spreadsheet.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                {entries.length} work blocks
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">
                {pendingEntries.length} pending reviews
              </div>
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-3xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-300">
              {error}
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_360px]">
            <section className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-black/80 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-orange-300/80">
                      Team pulse
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Live user list
                    </h2>
                  </div>
                  <Filter size={18} className="text-orange-300" />
                </div>

                <div className="mt-6 space-y-3">
                  {users.length === 0 ? (
                    <div className="rounded-3xl border border-white/10 bg-black/70 p-4 text-sm text-white/60">
                      No activity found for this period.
                    </div>
                  ) : (
                    users.map((userItem) => {
                      const selected = selectedUserId === userItem.id;
                      return (
                        <button
                          key={userItem.id}
                          type="button"
                          onClick={() => setSelectedUserId(userItem.id)}
                          className={
                            "flex w-full items-center justify-between gap-4 rounded-3xl border px-4 py-4 text-left transition " +
                            (selected
                              ? "border-orange-400/40 bg-orange-500/10"
                              : "border-white/10 bg-black/80 hover:border-orange-300/20 hover:bg-white/5")
                          }
                        >
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {userItem.name}
                            </p>
                            <p className="mt-1 text-sm text-white/60">
                              {userItem.recentProject}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="rounded-full bg-black/80 px-3 py-1 text-xs text-white/70">
                              {formatDuration(userItem.totalSeconds)}
                            </span>
                            <span className="inline-flex items-center gap-2 text-xs text-white/60">
                              <CircleDot
                                size={12}
                                className={
                                  userItem.running
                                    ? "text-orange-400"
                                    : "text-white/60"
                                }
                              />
                              {userItem.activeTimers} active
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/80 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-orange-300/80">
                      Approval stream
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Review queue
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleBatchApprove}
                    disabled={!reviewCount || busy}
                    className="rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                  >
                    Approve {reviewCount} selected
                  </button>
                </div>

                <div className="mt-6 space-y-3">
                  {pendingEntries.slice(0, 5).map((entry) => {
                    const selected = reviewSelection.includes(entry.id);
                    return (
                      <div
                        key={entry.id}
                        className={
                          "rounded-3xl border px-4 py-4 transition " +
                          (selected
                            ? "border-orange-500/30 bg-orange-500/10"
                            : "border-white/10 bg-black/80")
                        }
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                              <span className="rounded-full bg-white/5 px-2 py-1">
                                {entry.user_name || "Unknown"}
                              </span>
                              <span className="rounded-full bg-white/5 px-2 py-1">
                                {entry.project_name || "No project"}
                              </span>
                              <span className="rounded-full bg-white/5 px-2 py-1">
                                {entry.task_title || "No task"}
                              </span>
                            </div>
                            <p className="text-sm font-medium text-white">
                              {entry.description || "Untitled work item"}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
                              <span>
                                {formatDuration(entry.duration_seconds)}
                              </span>
                              <span>
                                {new Date(entry.started_at).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                              <span>
                                {entry.is_billable
                                  ? "Billable"
                                  : "Non-billable"}
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleReview(entry.id)}
                              className="rounded-2xl border border-white/10 bg-black/80 px-3 py-2 text-xs text-white/80"
                            >
                              {selected ? "Deselect" : "Select"}
                            </button>
                            <span className="text-xs text-orange-300">
                              {entry.approval_status}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleApprove(entry.id)}
                              className="rounded-2xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(entry.id)}
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80"
                            >
                              Reject
                            </button>
                          </div>
                          <div className="w-full max-w-sm">
                            <input
                              value={commentMap[entry.id] ?? ""}
                              onChange={(event) =>
                                setCommentMap((prev) => ({
                                  ...prev,
                                  [entry.id]: event.target.value,
                                }))
                              }
                              placeholder="Add note..."
                              className="w-full rounded-2xl border border-white/10 bg-black/80 px-3 py-2 text-sm text-white/80 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            <section className="space-y-6">
              <div className="rounded-4xl border border-white/10 bg-black/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                      Operations pulse
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">
                      Live activity stream
                    </h2>
                  </div>
                  <div className="rounded-2xl bg-black/80 px-3 py-2 text-sm text-white/70">
                    {periodOptions[period]}
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl bg-black/80 p-4">
                    <p className="text-xs text-white/60">Tracked time</p>
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {formatDuration(summary.totalSeconds)}
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                      {percentage(summary.totalSeconds, summary.totalSeconds)}%
                      of visible work
                    </p>
                  </div>
                  <div className="rounded-3xl bg-black/80 p-4">
                    <p className="text-xs text-white/60">Pending approvals</p>
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {summary.pendingCount}
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                      {summary.activeCount} active timers
                    </p>
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-3xl border border-white/10 bg-black/80 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-white">
                          Project heatmap
                        </p>
                        <p className="mt-1 text-sm text-white/60">
                          Most active project blocks in the current window.
                        </p>
                      </div>
                      <Sparkles size={18} className="text-orange-300" />
                    </div>
                    <div className="mt-4 grid gap-3">
                      {projects.slice(0, 4).map((project) => {
                        const value = percentage(
                          project.totalSeconds,
                          summary.totalSeconds,
                        );
                        return (
                          <div key={project.id} className="space-y-2">
                            <div className="flex items-center justify-between text-sm text-white/70">
                              <span>{project.name}</span>
                              <span>
                                {formatDuration(project.totalSeconds)}
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-white/5">
                              <div
                                className="h-full rounded-full bg-orange-400"
                                style={{ width: `${value}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-white/10 bg-black/80 p-4">
                    <p className="text-sm font-medium text-white">
                      Recent work block flow
                    </p>
                    <div className="mt-4 space-y-3">
                      {entries.slice(0, 5).map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-3xl border border-white/10 bg-black/80 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">
                                {entry.user_name || "Unknown"}
                              </p>
                              <p className="mt-1 text-sm text-white/60">
                                {entry.project_name || "No project"}
                              </p>
                            </div>
                            <span className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70">
                              {formatDuration(entry.duration_seconds)}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
                            <span>{entry.task_title || "Task unknown"}</span>
                            <span>•</span>
                            <span>
                              {new Date(entry.started_at).toLocaleTimeString(
                                [],
                                { hour: "2-digit", minute: "2-digit" },
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/80 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                      Project intelligence
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      High-impact projects
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProjectId(null)}
                    className="rounded-2xl border border-white/10 px-3 py-2 text-xs text-white/70"
                  >
                    Clear selection
                  </button>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {projects.slice(0, 4).map((project) => {
                    const selected = selectedProjectId === project.id;
                    return (
                      <button
                        type="button"
                        key={project.id}
                        onClick={() => setSelectedProjectId(project.id)}
                        className={
                          "rounded-3xl border p-4 text-left transition " +
                          (selected
                            ? "border-orange-400/40 bg-orange-500/10"
                            : "border-white/10 bg-black/80 hover:border-orange-300/20 hover:bg-black/80")
                        }
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm text-white/60">
                              {project.name}
                            </p>
                            <p className="mt-3 text-lg font-semibold text-white">
                              {formatDuration(project.totalSeconds)}
                            </p>
                          </div>
                          <div className="rounded-full bg-white/5 px-3 py-2 text-xs text-white/70">
                            {project.activeUsers} active
                          </div>
                        </div>
                        <div className="mt-4 space-y-2">
                          <div className="flex items-center justify-between text-xs text-white/60">
                            <span>Progress</span>
                            <span>
                              {percentage(
                                project.totalSeconds,
                                project.totalSeconds,
                              )}
                              %
                            </span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-white/5">
                            <div
                              className="h-full rounded-full bg-orange-400"
                              style={{ width: "100%" }}
                            />
                          </div>
                          <div className="mt-4 flex items-center gap-2">
                            {project.trend.map((value, index) => (
                              <div
                                key={`${project.id}-${index}`}
                                className="h-7 w-full rounded-full bg-white/5"
                              >
                                <div
                                  className="h-full rounded-full bg-orange-400"
                                  style={{ width: `${value}%` }}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            <aside className="space-y-6">
              <div className="rounded-3xl border border-white/10 bg-black/80 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                      Command analytics
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Snapshot metrics
                    </h2>
                  </div>
                  <div className="rounded-full bg-white/5 px-3 py-2 text-xs text-white/70">
                    {periodOptions[period]}
                  </div>
                </div>

                <div className="mt-6 space-y-4">
                  <div className="rounded-3xl bg-black/70 p-4">
                    <div className="text-sm text-white/60">Tracked hours</div>
                    <div className="mt-3 text-3xl font-semibold text-white">
                      {formatDuration(summary.totalSeconds)}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-black/70 p-4">
                    <div className="text-sm text-white/60">Billable mix</div>
                    <div className="mt-3 flex items-center gap-3">
                      <div className="rounded-full bg-orange-500/10 px-3 py-1 text-xs text-orange-300">
                        {percentage(
                          summary.billableSeconds,
                          summary.totalSeconds,
                        )}
                        % billable
                      </div>
                      <div className="rounded-full bg-white/5 px-3 py-1 text-xs text-white/70">
                        ${summary.totalCost.toFixed(2)} cost
                      </div>
                    </div>
                  </div>

                  <div className="rounded-3xl bg-black/70 p-4">
                    <div className="text-sm text-white/60">Execution heat</div>
                    <div className="mt-4 grid gap-3">
                      <div className="rounded-3xl bg-black/80 p-4">
                        <div className="flex items-center justify-between text-sm text-white/60">
                          <span>Top member</span>
                          <span>{topMembers[0]?.name ?? "—"}</span>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-orange-400"
                            style={{
                              width: `${topMembers[0] ? percentage(topMembers[0].totalSeconds, summary.totalSeconds) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                      <div className="rounded-3xl bg-black/80 p-4">
                        <div className="flex items-center justify-between text-sm text-white/60">
                          <span>Top project</span>
                          <span>{topProjects[0]?.name ?? "—"}</span>
                        </div>
                        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full rounded-full bg-orange-400"
                            style={{
                              width: `${topProjects[0] ? percentage(topProjects[0].totalSeconds, summary.totalSeconds) : 0}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/80 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                      Leaderboards
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      Rising contributors
                    </h2>
                  </div>
                  <LineChart size={20} className="text-orange-300" />
                </div>

                <div className="mt-6 space-y-3">
                  {topMembers.map((member, index) => (
                    <div
                      key={member.id}
                      className="rounded-3xl bg-black/80 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {member.name}
                          </p>
                          <p className="text-xs text-white/60">
                            {member.email || "No email"}
                          </p>
                        </div>
                        <span className="text-sm font-semibold text-white/80">
                          {formatDuration(member.totalSeconds)}
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                        <div
                          className="h-full rounded-full bg-orange-400"
                          style={{
                            width: `${percentage(member.totalSeconds, summary.totalSeconds)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {selectedProject ? (
                <div className="rounded-3xl border border-orange-400/20 bg-black/80 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-orange-300">
                        Project analytics
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-white">
                        {selectedProject.name}
                      </h2>
                    </div>
                    <div className="rounded-full bg-white/5 px-3 py-2 text-xs text-white/70">
                      {selectedProject.activeUsers} active
                    </div>
                  </div>
                  <div className="mt-5 space-y-4">
                    <div className="rounded-3xl bg-black/80 p-4">
                      <p className="text-sm text-white/60">Total tracked</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {formatDuration(selectedProject.totalSeconds)}
                      </p>
                    </div>
                    <div className="rounded-3xl bg-black/80 p-4">
                      <p className="text-sm text-white/60">Trend</p>
                      <div className="mt-4 flex items-end gap-2">
                        {selectedProject.trend.map((value, index) => (
                          <div
                            key={index}
                            className="h-14 w-full rounded-2xl bg-white/5"
                          >
                            <div
                              className="h-full rounded-2xl bg-orange-400"
                              style={{ height: `${value}%` }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-3xl bg-black/80 p-4">
                      <p className="text-sm text-white/60">Task composition</p>
                      <div className="mt-4 space-y-3">
                        {selectedProject.entries.slice(0, 4).map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-3xl bg-black/80 p-3"
                          >
                            <p className="text-sm text-white">
                              {entry.task_title || "Untitled"}
                            </p>
                            <p className="mt-1 text-xs text-white/60">
                              {formatDuration(entry.duration_seconds)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </aside>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-3xl border border-white/10 bg-black/80 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                    Filters
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    Period & approval status
                  </h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPeriod("day")}
                    className={`rounded-full px-4 py-2 text-sm ${period === "day" ? "bg-orange-500 text-black" : "bg-white/5 text-white/70"}`}
                  >
                    Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod("week")}
                    className={`rounded-full px-4 py-2 text-sm ${period === "week" ? "bg-orange-500 text-black" : "bg-white/5 text-white/70"}`}
                  >
                    Week
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod("month")}
                    className={`rounded-full px-4 py-2 text-sm ${period === "month" ? "bg-orange-500 text-black" : "bg-white/5 text-white/70"}`}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setPeriod("quarter")}
                    className={`rounded-full px-4 py-2 text-sm ${period === "quarter" ? "bg-orange-500 text-black" : "bg-white/5 text-white/70"}`}
                  >
                    Quarter
                  </button>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setApprovalStatus("all")}
                  className={`rounded-full px-4 py-2 text-sm ${approvalStatus === "all" ? "bg-orange-500 text-black" : "bg-white/5 text-white/70"}`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalStatus("pending")}
                  className={`rounded-full px-4 py-2 text-sm ${approvalStatus === "pending" ? "bg-orange-500 text-black" : "bg-white/5 text-white/70"}`}
                >
                  Pending
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalStatus("approved")}
                  className={`rounded-full px-4 py-2 text-sm ${approvalStatus === "approved" ? "bg-orange-500 text-black" : "bg-white/5 text-white/70"}`}
                >
                  Approved
                </button>
                <button
                  type="button"
                  onClick={() => setApprovalStatus("rejected")}
                  className={`rounded-full px-4 py-2 text-sm ${approvalStatus === "rejected" ? "bg-orange-500 text-black" : "bg-white/5 text-white/70"}`}
                >
                  Rejected
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-black/80 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-white/60">
                    Insight panel
                  </p>
                  <h2 className="mt-2 text-lg font-semibold text-white">
                    {selectedUser ? "User insight" : "Select a user"}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(null)}
                  className="rounded-full bg-white/5 px-3 py-2 text-xs text-white/70"
                >
                  Clear
                </button>
              </div>

              {selectedUser ? (
                <div className="mt-6 space-y-5">
                  <div className="rounded-3xl bg-black/80 p-4 border border-white/10">
                    <p className="text-sm text-white/60">Total time watched</p>
                    <p className="mt-3 text-3xl font-semibold text-white">
                      {formatDuration(selectedUser.totalSeconds)}
                    </p>
                    <p className="mt-2 text-sm text-white/60">
                      {selectedUser.running
                        ? "Currently running work"
                        : "No active timer"}
                    </p>
                  </div>

                  <div className="rounded-3xl bg-black/80 p-4 border border-white/10">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm uppercase tracking-[0.3em] text-white/60">
                          Team timesheet
                        </p>
                        <p className="mt-2 text-lg font-semibold text-white">
                          Weekly calendar
                        </p>
                      </div>
                      <div className="rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold text-orange-300">
                        {selectedUserCalendar
                          .reduce((sum, day) => sum + day.hours, 0)
                          .toFixed(1)}
                        h total
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-7 gap-2">
                      {selectedUserCalendar.map((day) => {
                        const intensity = Math.min(
                          100,
                          Math.round((day.hours / 8) * 100),
                        );
                        return (
                          <div
                            key={day.dateKey}
                            className="rounded-3xl border border-white/10 bg-white/5 p-3 text-center"
                          >
                            <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                              {day.dayLabel}
                            </div>
                            <div className="mt-2 text-sm font-semibold text-white">
                              {day.hours > 0 ? `${day.hours.toFixed(1)}h` : "-"}
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-white/10">
                              <div
                                className="h-full rounded-full bg-orange-500"
                                style={{ width: `${intensity}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-black/80 p-4 border border-white/10">
                    <p className="text-sm text-white/60">Project breakdown</p>
                    <div className="mt-4 space-y-3">
                      {entries
                        .filter((entry) => entry.user_id === selectedUser.id)
                        .reduce(
                          (acc, entry) => {
                            const key = entry.project_name || "Unassigned";
                            const existing = acc.find(
                              (item) => item.project === key,
                            );
                            if (existing) {
                              existing.seconds += entry.duration_seconds;
                            } else {
                              acc.push({
                                project: key,
                                seconds: entry.duration_seconds,
                              });
                            }
                            return acc;
                          },
                          [] as Array<{ project: string; seconds: number }>,
                        )
                        .sort((a, b) => b.seconds - a.seconds)
                        .slice(0, 4)
                        .map((item) => (
                          <div
                            key={item.project}
                            className="rounded-3xl bg-black/80 p-3"
                          >
                            <div className="flex items-center justify-between gap-2 text-sm text-white/70">
                              <span>{item.project}</span>
                              <span>{formatDuration(item.seconds)}</span>
                            </div>
                            <div className="mt-3 h-2 rounded-full bg-white/5">
                              <div
                                className="h-full rounded-full bg-orange-400"
                                style={{
                                  width: `${percentage(item.seconds, selectedUser.totalSeconds)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="rounded-3xl bg-black/80 p-4">
                    <p className="text-sm text-white/60">Task timeline</p>
                    <div className="mt-4 space-y-3">
                      {entries
                        .filter((entry) => entry.user_id === selectedUser.id)
                        .slice(0, 5)
                        .map((entry) => (
                          <div
                            key={entry.id}
                            className="rounded-3xl bg-black/80 p-3"
                          >
                            <div className="flex items-center justify-between gap-3 text-sm text-white/80">
                              <span>{entry.task_title || "No task"}</span>
                              <span>
                                {formatDuration(entry.duration_seconds)}
                              </span>
                            </div>
                            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                              <div
                                className="h-full rounded-full bg-orange-400"
                                style={{
                                  width: `${percentage(entry.duration_seconds, selectedUser.totalSeconds)}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-3xl border border-dashed border-white/10 bg-black/70 p-8 text-sm text-white/60">
                  Pick a user from the left column to inspect work pattern.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
