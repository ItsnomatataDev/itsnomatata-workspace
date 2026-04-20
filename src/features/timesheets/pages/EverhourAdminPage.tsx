import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  Clock3,
  FolderKanban,
  Filter,
  Receipt,
  Search,
  Users,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getAdminTimeEntries,
  getAdminTimeSummary,
  type AdminTimeEntryRow,
  type TimeApprovalStatus,
  getCalendarTimeEntries,
  type CalendarTimeEntry,
} from "../../../lib/supabase/queries/adminTime";
import {
  approveTimeEntry,
  rejectTimeEntry,
} from "../../../lib/supabase/mutations/adminTime";
import {
  getProjects,
  type ProjectRow,
} from "../../../lib/supabase/queries/projects";
import TimeApprovalTable from "../components/TimeApprovalTable";
import TimeChartsPanel from "../components/TimeChartsPanel";
import EverhourProjectModal from "../components/EverhourProjectModal";
import EverhourCalendar, {
  type EverhourCalendarEvent,
} from "../components/EverhourCalendar";
import UserTimeDetailsModal from "../components/UserTimeDetailsModal";

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function startOfWeekIso() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function startOfMonthIso() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function getDisplayLabel(entry: AdminTimeEntryRow) {
  return entry.description || "No description";
}

export default function EverhourAdminPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;

  const [entries, setEntries] = useState<AdminTimeEntryRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [calendarData, setCalendarData] = useState<CalendarTimeEntry[]>([]);

  const [summary, setSummary] = useState({
    totalSeconds: 0,
    pendingCount: 0,
    approvedSeconds: 0,
    billableSeconds: 0,
    activeCount: 0,
    totalCost: 0,
  });

  const [approvalStatus, setApprovalStatus] = useState<
    TimeApprovalStatus | "all"
  >("all");
  const [isBillable, setIsBillable] = useState<boolean | "all">("all");
  const [searchValue, setSearchValue] = useState("");
  const [projectFilter, setProjectFilter] = useState<string | "all">("all");
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [selectedCalendarEvent, setSelectedCalendarEvent] =
    useState<EverhourCalendarEvent | null>(null);
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);

  const organizationId = profile?.organization_id ?? null;

  const canManage =
    profile?.primary_role === "admin" || profile?.primary_role === "manager";

  if (!auth?.user || !profile || !organizationId || !canManage) return null;

  const load = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [rows, summaryData, projectRows, calendarRows] = await Promise.all([
        getAdminTimeEntries({
          organizationId,
          approvalStatus,
          isBillable,
          projectId: projectFilter === "all" ? undefined : projectFilter,
          limit: 300,
        }),
        getAdminTimeSummary({
          organizationId,
        }),
        getProjects({
          organizationId,
          isActive: true,
          limit: 200,
        }),
        getCalendarTimeEntries({
          organizationId,
        }),
      ]);

      setEntries(rows);
      setSummary(summaryData);
      setProjects(projectRows);
      setCalendarData(calendarRows);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to load Everhour admin dashboard.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [organizationId, approvalStatus, isBillable, projectFilter]);

  useEffect(() => {
    if (!organizationId || !canManage) return;
    void load();
  }, [organizationId, canManage, load]);

  const todayIso = useMemo(() => startOfTodayIso(), []);
  const weekIso = useMemo(() => startOfWeekIso(), []);
  const monthIso = useMemo(() => startOfMonthIso(), []);

  const todayEntries = useMemo(
    () => entries.filter((entry) => entry.started_at >= todayIso),
    [entries, todayIso],
  );

  const weekEntries = useMemo(
    () => entries.filter((entry) => entry.started_at >= weekIso),
    [entries, weekIso],
  );

  const monthEntries = useMemo(
    () => entries.filter((entry) => entry.started_at >= monthIso),
    [entries, monthIso],
  );

  const todaySeconds = useMemo(
    () =>
      todayEntries.reduce(
        (sum, entry) => sum + Number(entry.duration_seconds ?? 0),
        0,
      ),
    [todayEntries],
  );

  const weekSeconds = useMemo(
    () =>
      weekEntries.reduce(
        (sum, entry) => sum + Number(entry.duration_seconds ?? 0),
        0,
      ),
    [weekEntries],
  );

  const monthSeconds = useMemo(
    () =>
      monthEntries.reduce(
        (sum, entry) => sum + Number(entry.duration_seconds ?? 0),
        0,
      ),
    [monthEntries],
  );

  const pendingEntries = useMemo(
    () => entries.filter((entry) => entry.approval_status === "pending"),
    [entries],
  );

  const topWorkItems = useMemo(() => {
    const map = new Map<string, number>();

    for (const entry of entries) {
      const label = getDisplayLabel(entry);
      map.set(
        label,
        (map.get(label) ?? 0) + Number(entry.duration_seconds ?? 0),
      );
    }

    return Array.from(map.entries())
      .map(([label, seconds]) => ({ label, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 8);
  }, [entries]);

  const billablePercent = useMemo(() => {
    if (!summary.totalSeconds) return 0;
    return Math.round((summary.billableSeconds / summary.totalSeconds) * 100);
  }, [summary.billableSeconds, summary.totalSeconds]);

  const dailyChartData = useMemo(() => {
    const byDay = new Map<
      string,
      {
        label: string;
        trackedHours: number;
        billableHours: number;
        cost: number;
      }
    >();

    for (const entry of entries) {
      const date = new Date(entry.started_at);
      const key = date.toISOString().slice(0, 10);
      const label = new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
      }).format(date);
      const trackedHours = Number(entry.duration_seconds ?? 0) / 3600;
      const billableHours = entry.is_billable ? trackedHours : 0;
      const cost = Number(entry.cost_amount ?? 0);
      const existing = byDay.get(key);

      if (existing) {
        existing.trackedHours += trackedHours;
        existing.billableHours += billableHours;
        existing.cost += cost;
      } else {
        byDay.set(key, { label, trackedHours, billableHours, cost });
      }
    }

    return Array.from(byDay.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([, value]) => ({
        ...value,
        trackedHours: Number(value.trackedHours.toFixed(1)),
        billableHours: Number(value.billableHours.toFixed(1)),
        cost: Number(value.cost.toFixed(2)),
      }));
  }, [entries]);

  const normalizedSearch = searchValue.trim().toLowerCase();

  const visibleEntries = useMemo(() => {
    if (!normalizedSearch && projectFilter === "all") return entries;

    return entries.filter((entry) => {
      const matchesSearch = normalizedSearch
        ? [
            entry.user_name,
            entry.user_email,
            entry.description,
            entry.project_name,
            entry.task_title,
            entry.client_name,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedSearch)
        : true;

      const matchesProject =
        projectFilter === "all" || entry.project_id === projectFilter;

      return matchesSearch && matchesProject;
    });
  }, [entries, normalizedSearch, projectFilter]);

  const projectSummary = useMemo(() => {
    const byProject = new Map<
      string,
      { id: string; name: string; seconds: number }
    >();

    for (const entry of entries) {
      const projectId = entry.project_id || "no-project";
      const projectName = entry.project_name || "Unassigned";
      const current = byProject.get(projectId) ?? {
        id: projectId,
        name: projectName,
        seconds: 0,
      };
      current.seconds += Number(entry.duration_seconds ?? 0);
      byProject.set(projectId, current);
    }

    return Array.from(byProject.values()).sort((a, b) => b.seconds - a.seconds);
  }, [entries]);

  const topProjects = useMemo(() => {
    return projectSummary.map((project) => {
      const projectRow = projects.find((p) => p.id === project.id);
      const metadata = projectRow?.metadata as {
        targetHours?: number | null;
        isBillable?: boolean | null;
        allowOverBudget?: boolean | null;
      } | null;

      return {
        ...project,
        targetHours:
          metadata?.targetHours !== undefined && metadata?.targetHours !== null
            ? metadata.targetHours
            : null,
        defaultBillable: metadata?.isBillable ?? null,
        allowOverBudget: metadata?.allowOverBudget ?? false,
      };
    });
  }, [projectSummary, projects]);

  const handleCalendarSelectEvent = (event: EverhourCalendarEvent) => {
    setSelectedCalendarEvent(event);
    setCalendarModalOpen(true);
  };

  const handleApprove = async (entryId: string) => {
    if (!auth?.user?.id || !canManage) return;

    try {
      setBusy(true);
      await approveTimeEntry({
        entryId,
        approvedBy: auth.user.id,
      });
      setSelectedIds((prev) => prev.filter((id) => id !== entryId));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to approve entry.");
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (entryId: string) => {
    if (!canManage) return;

    try {
      setBusy(true);
      await rejectTimeEntry({ entryId, approvedBy: auth?.user?.id ?? null });
      setSelectedIds((prev) => prev.filter((id) => id !== entryId));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject entry.");
    } finally {
      setBusy(false);
    }
  };

  function toggleSelect(entryId: string): void {
    throw new Error("Function not implemented.");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.18),transparent_20%),linear-gradient(180deg,#090909_0%,#050505_100%)] p-5 lg:p-8">
          <section className="overflow-hidden rounded-4xl border border-white/10 bg-[#0a0a0a]/95 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur">
            <div className="border-b border-white/10 px-6 py-6 lg:px-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-orange-500">
                    Everhour control center
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">
                    Time operations console
                  </h1>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    A calmer, denser review surface for tracked time, approvals,
                    billing pressure, and team visibility across the
                    organization.
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-white/70">
                  <span className="block text-xs uppercase tracking-[0.24em] text-white/45">
                    Approval health
                  </span>
                  <span className="mt-1 block font-semibold text-white">
                    {summary.pendingCount === 0
                      ? "Clear queue"
                      : `${summary.pendingCount} pending`}
                  </span>
                </div>
              </div>
            </div>

            {error ? (
              <div className="px-6 pt-6 lg:px-8">
                <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  {error}
                </div>
              </div>
            ) : null}

            <div className="grid gap-4 border-b border-white/10 px-6 py-6 md:grid-cols-2 xl:grid-cols-6 lg:px-8">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 text-white/55">
                  <Clock3 size={18} className="text-orange-500" />
                  <p className="text-sm font-medium">Today</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">
                  {formatDuration(todaySeconds)}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 text-white/55">
                  <Clock3 size={18} className="text-orange-500" />
                  <p className="text-sm font-medium">This week</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">
                  {formatDuration(weekSeconds)}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 text-white/55">
                  <Receipt size={18} className="text-orange-500" />
                  <p className="text-sm font-medium">This month</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">
                  {formatDuration(monthSeconds)}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 text-white/55">
                  <Activity size={18} className="text-orange-500" />
                  <p className="text-sm font-medium">Active timers</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">
                  {summary.activeCount}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 text-white/55">
                  <Users size={18} className="text-orange-500" />
                  <p className="text-sm font-medium">Pending approvals</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">
                  {summary.pendingCount}
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center gap-3 text-white/55">
                  <BadgeDollarSign size={18} className="text-orange-500" />
                  <p className="text-sm font-medium">Visible cost</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-white">
                  ${Number(summary.totalCost ?? 0).toFixed(2)}
                </p>
              </div>
            </div>

            <div className="px-6 py-6 lg:px-8">
              <section className="mb-6 rounded-[28px] border border-white/10 bg-white/5 p-6">
                <div className="mb-6">
                  <p className="text-sm text-white/45">Team calendar</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Time tracking overview
                  </h2>
                  <p className="mt-2 text-sm text-white/60">
                    Click on any user entry to see their time tracked per
                    project for that day.
                  </p>
                </div>
                <EverhourCalendar
                  calendarData={calendarData}
                  onSelectEvent={handleCalendarSelectEvent}
                />
              </section>
            </div>

            <div className="px-6 py-6 lg:px-8">
              <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-1 flex-col gap-3 md:flex-row">
                  <label className="relative min-w-0 flex-1">
                    <Search
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                    />
                    <input
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="Search member, task, project or client"
                      className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-orange-500 focus:bg-black"
                    />
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <div className="relative">
                      <Filter
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                      />
                      <select
                        value={approvalStatus}
                        onChange={(event) =>
                          setApprovalStatus(
                            event.target.value as TimeApprovalStatus | "all",
                          )
                        }
                        className="rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-4 text-sm text-white outline-none transition focus:border-orange-500 focus:bg-black"
                      >
                        <option value="all">All statuses</option>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    <select
                      value={String(isBillable)}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "all") setIsBillable("all");
                        else setIsBillable(value === "true");
                      }}
                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-500 focus:bg-black"
                    >
                      <option value="all">All billing</option>
                      <option value="true">Billable</option>
                      <option value="false">Non-billable</option>
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-white/70">
                  Reviewing{" "}
                  <span className="font-semibold text-white">
                    {visibleEntries.length}
                  </span>{" "}
                  entries
                </div>
              </div>

              <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_240px]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <label className="mb-2 block text-sm text-white/60">
                    Filter by project
                  </label>
                  <select
                    value={projectFilter}
                    onChange={(event) =>
                      setProjectFilter(event.target.value as string | "all")
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  >
                    <option value="all">All projects</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <button
                    type="button"
                    onClick={() => setProjectModalOpen(true)}
                    className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
                  >
                    Add project
                  </button>
                </div>
              </div>

              <div className="mb-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-white/45">Tracked work</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        Time patterns
                      </h2>
                    </div>
                    <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm font-medium text-orange-300">
                      Billable ratio {billablePercent}%
                    </div>
                  </div>

                  <TimeChartsPanel
                    dailyData={dailyChartData}
                    billableSeconds={summary.billableSeconds}
                    nonBillableSeconds={Math.max(
                      summary.totalSeconds - summary.billableSeconds,
                      0,
                    )}
                    totalCost={summary.totalCost}
                  />
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-white/45">Top workload</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        Most tracked work
                      </h2>
                    </div>
                  </div>

                  {topWorkItems.length === 0 ? (
                    <p className="mt-6 text-white/50">No tracked work yet.</p>
                  ) : (
                    <div className="mt-6 space-y-3">
                      {topWorkItems.map((item) => (
                        <div
                          key={item.label}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/40 px-4 py-4"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">
                              {item.label}
                            </p>
                          </div>
                          <div className="shrink-0 text-sm font-medium text-orange-400">
                            {formatDuration(item.seconds)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="mb-6 grid gap-6 xl:grid-cols-[1.5fr_0.7fr]">
                <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-white/45">Review queue</p>
                      <h2 className="mt-2 text-2xl font-semibold text-white">
                        Entries to review
                      </h2>
                    </div>
                    <div className="text-sm text-white/45">
                      Approve or reject directly from the table.
                    </div>
                  </div>

                  {loading ? (
                    <div className="rounded-3xl border border-dashed border-white/10 bg-black/30 p-8 text-sm text-white/50">
                      Loading time dashboard...
                    </div>
                  ) : (
                    <TimeApprovalTable
                      entries={visibleEntries}
                      selectedIds={selectedIds}
                      onToggleSelect={toggleSelect}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  )}
                </section>

                <section className="rounded-[28px] border border-white/10 bg-white/5 p-6">
                  <p className="text-sm text-white/45">Approval pressure</p>
                  <h2 className="mt-2 text-2xl font-semibold text-white">
                    Pending queue
                  </h2>

                  {pendingEntries.length === 0 ? (
                    <p className="mt-6 text-white/50">
                      No pending entries right now.
                    </p>
                  ) : (
                    <div className="mt-6 space-y-3">
                      {pendingEntries.slice(0, 8).map((entry) => (
                        <div
                          key={entry.id}
                          className="rounded-2xl border border-white/10 bg-black/40 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-medium text-white">
                                {entry.description || "No description"}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                {entry.user_name || entry.user_id}
                              </p>
                            </div>
                            <div className="text-sm font-medium text-orange-400">
                              {formatDuration(entry.duration_seconds ?? 0)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3 text-white/55">
                    <FolderKanban size={18} className="text-orange-500" />
                    <p className="text-sm font-medium">Approved time</p>
                  </div>
                  <p className="mt-4 text-3xl font-semibold text-white">
                    {formatDuration(summary.approvedSeconds)}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3 text-white/55">
                    <BadgeDollarSign size={18} className="text-orange-500" />
                    <p className="text-sm font-medium">Billable time</p>
                  </div>
                  <p className="mt-4 text-3xl font-semibold text-white">
                    {formatDuration(summary.billableSeconds)}
                  </p>
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center gap-3 text-white/55">
                    <Users size={18} className="text-orange-500" />
                    <p className="text-sm font-medium">Total tracked</p>
                  </div>
                  <p className="mt-4 text-3xl font-semibold text-white">
                    {formatDuration(summary.totalSeconds)}
                  </p>
                </div>
              </div>
            </div>
          </section>
          <EverhourProjectModal
            open={projectModalOpen}
            onClose={() => setProjectModalOpen(false)}
            organizationId={organizationId}
            createdBy={auth.user.id}
            onCreated={async () => {
              await load();
            }}
          />
          <UserTimeDetailsModal
            event={selectedCalendarEvent}
            isOpen={calendarModalOpen}
            onClose={() => setCalendarModalOpen(false)}
          />
        </main>
      </div>
    </div>
  );
}
