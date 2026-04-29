import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Filter,
  CircleDot,
  ChevronRight,
  Layers,
  ListTodo,
  TrendingUp,
  X,
  BarChart3,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useTeamTimesheetsRealtime } from "../../../lib/hooks/useTeamTimesheetsRealtime";
import { supabase } from "../../../lib/supabase/client";
import type { AdminTimeEntryRow } from "../../../lib/supabase/queries/adminTime";
import EverhourCalendar, {
  type EverhourCalendarEvent,
} from "../components/EverhourCalendar";
import {
  getZimbabweDateKey,
  startOfZimbabweWeek,
} from "../../../lib/utils/zimbabweCalendar";

// ── Types ──────────────────────────────────────────────────

type UserSummary = {
  id: string;
  name: string;
  email: string | null;
  totalSeconds: number;
  running: boolean;
  recentBoard: string | null;
  lastEntryAt: string;
  activeTimers: number;
  boardTotals: Record<string, number>;
  taskTotals: Record<string, number>;
  dailyHours: Record<string, number>;
  activeTaskName: string | null;
  activeTaskStartAt: string | null;
};

type CalendarDay = {
  date: Date;
  key: string;
  label: string;
  weekLabel: string;
};

// ── Helpers ────────────────────────────────────────────────

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatHours(hours: number) {
  if (!hours) return "—";
  return `${hours.toFixed(1)}h`;
}

function getDateKey(date: Date) {
  return getZimbabweDateKey(date);
}

function startOfWeekFn(date: Date, weekStart = 1) {
  return startOfZimbabweWeek(date, weekStart);
}

function buildTwoWeekDays(): CalendarDay[] {
  const today = new Date();
  const currentWeekStart = startOfWeekFn(today, 1);
  const previousWeekStart = new Date(currentWeekStart);
  previousWeekStart.setDate(previousWeekStart.getDate() - 7);
  const weeks = [previousWeekStart, currentWeekStart];

  return weeks.flatMap((start, weekIndex) =>
    Array.from({ length: 7 }, (_, dayIndex) => {
      const date = new Date(start);
      date.setDate(start.getDate() + dayIndex);
      return {
        date,
        key: getDateKey(date),
        label: date
          .toLocaleDateString("en-ZW", { weekday: "short" })
          .slice(0, 2),
        weekLabel: weekIndex === 0 ? "Last week" : "This week",
      };
    }),
  );
}

// Per-user deterministic color (matches calendar)
const USER_COLORS = [
  "#f97316",
  "#3b82f6",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];
function getUserAccent(userId: string) {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
}

// Live elapsed time for a running entry
function getLiveElapsedSeconds(startedAt: string): number {
  const startedMs = new Date(startedAt).getTime();
  const nowMs = Date.now();
  return Math.max(0, Math.floor((nowMs - startedMs) / 1000));
}

function LiveTimerDisplay({ startedAt }: { startedAt: string }) {
  const [elapsed, setElapsed] = useState(() =>
    getLiveElapsedSeconds(startedAt),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(getLiveElapsedSeconds(startedAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <span className="font-mono text-xs text-green-400 animate-pulse">
      {formatDuration(elapsed)}
    </span>
  );
}

// ── Sub-components ─────────────────────────────────────────

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-black/60 p-4">
      <p className="text-xs text-white/40">{label}</p>
      <p
        className="mt-1.5 text-2xl font-bold"
        style={{ color: accent ?? "white" }}
      >
        {value}
      </p>
    </div>
  );
}

function BoardBar({
  name,
  seconds,
  targetSeconds,
  dailyHours,
  calendarDays,
  accent,
}: {
  name: string;
  seconds: number;
  targetSeconds: number;
  dailyHours: Record<string, number>;
  calendarDays: CalendarDay[];
  accent: string;
}) {
  const rawPct = targetSeconds ? (seconds / targetSeconds) * 100 : 0;
  const pct = Math.max(0, Math.min(rawPct, 100));
  const thisWeek = calendarDays.slice(7);

  return (
    <div className="rounded-2xl border border-white/8 bg-black/50 p-4 transition hover:border-white/15">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <span className="font-semibold text-white leading-tight">{name}</span>
        </div>
        <div className="text-right shrink-0">
          <span className="text-sm font-mono font-semibold text-white/80">
            {formatDuration(seconds)}
          </span>
          <span className="ml-1 text-xs text-white/35">
            ({pct >= 10 ? pct.toFixed(0) : pct.toFixed(1)}%)
          </span>
        </div>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            minWidth: seconds > 0 ? "4px" : undefined,
            backgroundColor: accent,
            boxShadow: `0 0 8px ${accent}60`,
          }}
        />
      </div>

      {/* This-week daily mini chart */}
      <div className="mt-3 grid grid-cols-7 gap-1">
        {thisWeek.map((day) => {
          const h = dailyHours[day.key] ?? 0;
          const barH = Math.min(Math.round((h / 10) * 24), 24);
          return (
            <div
              key={day.key}
              className="flex flex-col items-center gap-1"
              title={`${day.label}: ${formatHours(h)}`}
            >
              <div className="flex h-6 w-full items-end justify-center">
                <div
                  className="w-full max-w-2.5 rounded-sm transition-all duration-300"
                  style={{
                    height: h > 0 ? `${barH}px` : "2px",
                    backgroundColor: h > 0 ? accent : "rgba(255,255,255,0.08)",
                    opacity: h > 0 ? 0.85 : 1,
                  }}
                />
              </div>
              <span className="text-[9px] text-white/25 uppercase">
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskRow({
  rank,
  name,
  seconds,
  accent,
}: {
  rank: number;
  name: string;
  seconds: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/6 bg-black/40 px-3 py-2.5 transition hover:border-white/12">
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
        style={{ backgroundColor: `${accent}20`, color: accent }}
      >
        {rank}
      </span>
      <span className="flex-1 truncate text-sm text-white/80">{name}</span>
      <span className="shrink-0 font-mono text-sm font-semibold text-white/60">
        {formatDuration(seconds)}
      </span>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────

export default function TeamTimesheetsPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"grid" | "calendar">("grid");
  const [allMembers, setAllMembers] = useState<any[]>([]);
  const [calendarDateRange, setCalendarDateRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  const { entries, loading, error, refetch } = useTeamTimesheetsRealtime({
    organizationId: profile?.organization_id ?? "",
    refreshIntervalMs: 2000,
  });

  useEffect(() => {
    if (!profile?.organization_id) return;

    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("organization_id", profile.organization_id);

      if (!error && data) {
        setAllMembers(data);
      }
    };

    fetchMembers();
  }, [profile?.organization_id]);

  useEffect(() => {
    if (activeTab !== "calendar") return;
    const interval = setInterval(() => {
      refetch();
    }, 2000);
    return () => clearInterval(interval);
  }, [activeTab, refetch]);

  const handleCalendarDateRangeChange = (startDate: Date, endDate: Date) => {
    setCalendarDateRange({ start: startDate, end: endDate });

  };

  const calendarDays = useMemo(() => buildTwoWeekDays(), []);
  const calendarKeys = useMemo(
    () => calendarDays.map((d) => d.key),
    [calendarDays],
  );
  const calendarKeySet = useMemo(() => new Set(calendarKeys), [calendarKeys]);


  const users = useMemo(() => {
    const map = new Map<string, UserSummary>();

    for (const member of allMembers) {
      map.set(member.id,{
        id: member.id,
        name: member.full_name || "Unknown",
        email: member.email || null,
        totalSeconds: 0,
        running: false,
        recentBoard: null,
        lastEntryAt: "1970-01-01T00:00:00.000Z",
        activeTimers: 0,
        boardTotals: {},
        taskTotals: {},
        dailyHours: Object.fromEntries(calendarKeys.map((k) => [k, 0])),
        activeTaskName: null,
        activeTaskStartAt: null,
      });
    }

    for (const entry of entries) {
      const userId = entry.user_id;
      const current = map.get(userId);
      if (!current) continue;
      const entryIsRunning = !entry.ended_at || entry.is_running;

      const dur = Number(entry.duration_seconds ?? 0);
      current.totalSeconds += dur;
      if (entryIsRunning) current.activeTimers += 1;
      if (entry.started_at > current.lastEntryAt) {
        current.lastEntryAt = entry.started_at;
        current.recentBoard = entry.board_name || current.recentBoard;
      }
      current.running = current.running || entryIsRunning;
      if (
        entryIsRunning &&
        (!current.activeTaskStartAt || entry.started_at > current.activeTaskStartAt)
      ) {
        current.activeTaskName =
          entry.task_title || entry.description || "Untitled work";
        current.activeTaskStartAt = entry.started_at;
      }

      if (entry.board_name) {
        current.boardTotals[entry.board_name] =
          (current.boardTotals[entry.board_name] || 0) + dur;
      }

      const taskKey = entry.task_title || entry.description || "Untitled work";
      current.taskTotals[taskKey] = (current.taskTotals[taskKey] || 0) + dur;

      const dayKey = entry.started_at ? getZimbabweDateKey(entry.started_at) : null;
      if (dayKey && calendarKeySet.has(dayKey)) {
        current.dailyHours[dayKey] += dur / 3600;
      }

      map.set(userId, current);
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.activeTimers !== a.activeTimers)
        return b.activeTimers - a.activeTimers;
      return b.totalSeconds - a.totalSeconds;
    });
  }, [entries, calendarKeySet, calendarKeys, allMembers]);

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const selectedUserEntries = useMemo(
    () =>
      selectedUserId ? entries.filter((e) => e.user_id === selectedUserId) : [],
    [entries, selectedUserId],
  );


  const selectedUserBoardDetails = useMemo(() => {
    const map = new Map<
      string,
      { seconds: number; dailyHours: Record<string, number> }
    >();

    for (const entry of selectedUserEntries) {
      const board = entry.board_name;
      if (!board) continue;
      const cur = map.get(board) ?? { seconds: 0, dailyHours: {} };
      const dur = Number(entry.duration_seconds ?? 0);
      cur.seconds += dur;
      const dayKey = entry.started_at ? getZimbabweDateKey(entry.started_at) : null;
      if (dayKey) {
        cur.dailyHours[dayKey] = (cur.dailyHours[dayKey] || 0) + dur / 3600;
      }
      map.set(board, cur);
    }

    return Array.from(map.entries())
      .map(([board, val]) => ({
        board,
        seconds: val.seconds,
        dailyHours: val.dailyHours,
      }))
      .sort((a, b) => b.seconds - a.seconds);
  }, [selectedUserEntries]);

  // Task details for selected user (card-level)
  const selectedUserTaskDetails = useMemo(() => {
    const map = new Map<
      string,
      { seconds: number; board: string | null; isRunning: boolean }
    >();

    for (const entry of selectedUserEntries) {
      const key = entry.task_title || entry.description || "Untitled work";
      const cur = map.get(key) ?? {
        seconds: 0,
        board: entry.board_name || null,
        isRunning: false,
      };
      cur.seconds += Number(entry.duration_seconds ?? 0);
      cur.isRunning = cur.isRunning || !entry.ended_at || entry.is_running;
      map.set(key, cur);
    }

    return Array.from(map.entries())
      .map(([task, val]) => ({ task, ...val }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 10);
  }, [selectedUserEntries]);

  const selectedUserPeriodSeconds = useMemo(() => {
    if (!selectedUser) return 0;
    return (
      Object.values(selectedUser.dailyHours).reduce((sum, h) => sum + h, 0) *
      3600
    );
  }, [selectedUser]);

  const selectedUserBoardTargetSeconds = useMemo(() => {
    if (!selectedUser) return 8 * 3600;
    const workedDays = Object.values(selectedUser.dailyHours).filter(
      (hours) => hours > 0,
    ).length;
    return Math.max(workedDays, 1) * 8 * 3600;
  }, [selectedUser]);

  const calendarTotals = useMemo(
    () =>
      calendarDays.map((day) =>
        users.reduce((sum, u) => sum + (u.dailyHours[day.key] ?? 0), 0),
      ),
    [users, calendarDays],
  );

  const totalTeamSeconds = useMemo(
    () => entries.reduce((sum, e) => sum + Number(e.duration_seconds ?? 0), 0),
    [entries],
  );

  const activeUsers = useMemo(
    () => users.filter((u) => u.running).length,
    [users],
  );

  const handleCalendarEvent = (event: EverhourCalendarEvent) => {
    setSelectedUserId(event.resource.userId);
  };

  if (!auth?.user || !profile) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          {/* ── Page header ── */}
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-orange-500">
                Team timesheet
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-white">
                Team Timesheets
              </h1>
              <p className="mt-2 text-sm leading-6 text-white/50">
                Two-week team hours at a glance. Click any user or calendar
                event to inspect their breakdown.
              </p>
            </div>
            <div className="flex gap-1.5 rounded-2xl border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setActiveTab("grid")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === "grid"
                    ? "bg-orange-500 text-white shadow"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <BarChart3 size={13} />
                Grid
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("calendar")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition ${
                  activeTab === "calendar"
                    ? "bg-orange-500 text-white shadow"
                    : "text-white/50 hover:text-white"
                }`}
              >
                <CalendarDays size={13} />
                Calendar
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="space-y-4">
              {/* Roster */}
              <div className="rounded-3xl border border-white/10 bg-[#080808] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.35em] text-orange-400/70">
                      Roster
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-white">
                      Everyone
                    </h2>
                  </div>
                  <Filter size={16} className="text-white/30" />
                </div>

                <div className="space-y-1.5">
                  {loading && (
                    <div className="rounded-2xl border border-white/8 bg-black/50 p-4 text-sm text-white/40">
                      Loading...
                    </div>
                  )}
                  {!loading && users.length === 0 && (
                    <div className="rounded-2xl border border-white/8 bg-black/50 p-4 text-sm text-white/40">
                      No time entries found.
                    </div>
                  )}
                  {users.map((u) => {
                    const active = selectedUserId === u.id;
                    const accent = getUserAccent(u.id);
                    const periodH = Object.values(u.dailyHours).reduce(
                      (s, h) => s + h,
                      0,
                    );

                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUserId(active ? null : u.id)}
                        className={`group flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition-all ${
                          active
                            ? "border-orange-400/30 bg-orange-500/8"
                            : "border-white/8 bg-black/40 hover:border-white/15 hover:bg-white/3"
                        }`}
                      >
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white"
                          style={{
                            backgroundColor: `${accent}25`,
                            color: accent,
                          }}
                        >
                          {u.name.charAt(0).toUpperCase()}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-white">
                            {u.name}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-white/35">
                            {u.activeTaskName ||
                              u.recentBoard ||
                              "No active task"}
                          </p>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className="text-xs font-mono font-semibold"
                            style={{ color: accent }}
                          >
                            {formatHours(periodH)}
                          </span>
                          {u.running && u.activeTaskStartAt ? (
                            <div className="flex items-center gap-1 text-[10px] text-green-400">
                              <CircleDot size={9} className="animate-pulse" />
                              <LiveTimerDisplay startedAt={u.activeTaskStartAt} />
                            </div>
                          ) : u.running ? (
                            <span className="flex items-center gap-1 text-[10px] text-green-400">
                              <CircleDot size={9} className="animate-pulse" />
                              live
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-[#080808] p-5">
                <p className="text-[10px] uppercase tracking-[0.35em] text-orange-400/70">
                  Summary
                </p>
                <h2 className="mt-1 mb-4 text-base font-semibold text-white">
                  Team totals
                </h2>
                <div className="space-y-2">
                  <StatPill
                    label="Total tracked (2 weeks)"
                    value={formatDuration(totalTeamSeconds)}
                  />
                  <StatPill
                    label="Active right now"
                    value={String(activeUsers)}
                    accent="#4ade80"
                  />
                  <StatPill
                    label="Team members"
                    value={String(users.length)}
                    accent="#f97316"
                  />
                </div>
              </div>
              <div className="rounded-3xl border border-white/10 bg-[#080808] p-5">
                <div className="mb-4 flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-green-500/20">
                    <CircleDot
                      size={12}
                      className="text-green-400 animate-pulse"
                    />
                  </div>
                  <p className="text-[10px] uppercase tracking-[0.35em] text-green-400/70">
                    Active now
                  </p>
                  <span className="ml-auto rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] text-green-400">
                    {activeUsers}
                  </span>
                </div>
                <div className="space-y-2">
                  {users.filter((u) => u.running).length === 0 ? (
                    <div className="rounded-2xl border border-white/8 bg-black/40 p-4 text-center text-sm text-white/35">
                      No active timers
                    </div>
                  ) : (
                    users
                      .filter((u) => u.running)
                      .map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center gap-3 rounded-xl border border-green-500/20 bg-green-500/5 p-3"
                        >
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                            style={{
                              backgroundColor: `${getUserAccent(u.id)}25`,
                              color: getUserAccent(u.id),
                            }}
                          >
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">
                              {u.name}
                            </p>
                            <p className="truncate text-xs text-white/40">
                              {u.activeTaskName ||
                                u.recentBoard ||
                                "No active task"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {u.activeTaskStartAt && (
                              <LiveTimerDisplay startedAt={u.activeTaskStartAt} />
                            )}
                            <span className="flex items-center gap-1 text-[10px] text-green-400">
                              <CircleDot size={8} className="animate-pulse" />
                              tracking
                            </span>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </aside>

            <section className="space-y-4">
              {activeTab === "grid" && (
                <div className="rounded-3xl border border-white/10 bg-[#080808] p-5">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.35em] text-orange-400/70">
                        Team calendar
                      </p>
                      <h2 className="mt-1 text-base font-semibold text-white">
                        Two-week view
                      </h2>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-175 rounded-2xl border border-white/8 bg-black/60 overflow-hidden">
                      <div className="grid grid-cols-[180px_repeat(14,minmax(40px,1fr))] border-b border-white/8">
                        <div />
                        <div className="col-span-7 border-l border-white/8 px-2 py-2 text-[10px] uppercase tracking-widest text-white/30">
                          Last week
                        </div>
                        <div className="col-span-7 border-l border-white/8 px-2 py-2 text-[10px] uppercase tracking-widest text-white/30">
                          This week
                        </div>
                      </div>
                      <div className="grid grid-cols-[180px_repeat(14,minmax(40px,1fr))] border-b border-white/8">
                        <div className="px-3 py-2 text-[10px] uppercase tracking-widest text-white/25">
                          Member
                        </div>
                        {calendarDays.map((day) => (
                          <div
                            key={day.key}
                            className="border-l border-white/6 px-1 py-2 text-center text-[10px] uppercase tracking-wide text-white/30"
                          >
                            {day.label}
                          </div>
                        ))}
                      </div>
                      {users.map((u) => {
                        const accent = getUserAccent(u.id);
                        const isActive = selectedUserId === u.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() =>
                              setSelectedUserId(isActive ? null : u.id)
                            }
                            className={`grid w-full cursor-pointer grid-cols-[180px_repeat(14,minmax(40px,1fr))] border-t border-white/6 text-left transition-all ${
                              isActive ? "bg-orange-500/6" : "hover:bg-white/3"
                            }`}
                          >
                            <div className="flex items-center gap-2 border-r border-white/6 px-3 py-2.5">
                              <div
                                className="h-2 w-2 shrink-0 rounded-full"
                                style={{ backgroundColor: accent }}
                              />
                              <span className="truncate text-sm font-medium text-white/80">
                                {u.name.split(" ")[0]}
                              </span>
                              {u.running && (
                                <CircleDot
                                  size={10}
                                  className="shrink-0 animate-pulse text-green-400"
                                />
                              )}
                            </div>
                            {calendarDays.map((day) => {
                              const h = u.dailyHours[day.key] ?? 0;
                              const isBelowTarget = h > 0 && h < 8;
                              const intensity =
                                h > 8 ? 0.3 : h > 5 ? 0.18 : h > 2 ? 0.1 : 0;
                              return (
                                <div
                                  key={`${u.id}-${day.key}`}
                                  className="border-l border-white/5 px-1 py-2.5 text-center font-mono text-xs transition"
                                  style={{
                                    backgroundColor: isBelowTarget
                                      ? "rgba(239,68,68,0.15)"
                                      : h > 0
                                        ? `${accent}${Math.round(
                                            intensity * 255,
                                          )
                                            .toString(16)
                                            .padStart(2, "0")}`
                                        : "transparent",
                                    color: isBelowTarget
                                      ? "#ef4444"
                                      : h > 0
                                        ? accent
                                        : "rgba(255,255,255,0.18)",
                                    fontWeight: h > 0 ? 600 : 400,
                                  }}
                                >
                                  {h > 0 ? `${h.toFixed(1)}` : "—"}
                                </div>
                              );
                            })}
                          </button>
                        );
                      })}

                      {/* Totals row */}
                      <div className="grid grid-cols-[180px_repeat(14,minmax(40px,1fr))] border-t border-white/10 bg-black/40">
                        <div className="px-3 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-white/40">
                          Total
                        </div>
                        {calendarDays.map((day, i) => (
                          <div
                            key={`total-${day.key}`}
                            className="border-l border-white/6 px-1 py-2.5 text-center font-mono text-xs text-orange-400/70"
                          >
                            {calendarTotals[i] > 0
                              ? `${calendarTotals[i].toFixed(1)}`
                              : "—"}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Calendar view */}
              {activeTab === "calendar" && (
                <div className="rounded-3xl border border-white/10 bg-[#080808] p-5">
                  <div className="mb-5">
                    <p className="text-[10px] uppercase tracking-[0.35em] text-orange-400/70">
                      Monthly calendar
                    </p>
                    <h2 className="mt-1 text-base font-semibold text-white">
                      Time entries by user
                    </h2>
                    <p className="mt-1 text-xs text-white/35">
                      Each event shows a team member and their hours for that
                      day. Click to select.
                    </p>
                  </div>
                  <EverhourCalendar
                    entries={entries}
                    selectedUserId={selectedUserId}
                    onSelectEvent={handleCalendarEvent}
                    onSelectUser={setSelectedUserId}
                    onDateRangeChange={handleCalendarDateRangeChange}
                  />
                </div>
              )}

              {/* ── Detail panel ── */}
              {selectedUser ? (
                <div className="rounded-3xl border border-white/10 bg-[#080808] p-5">
                  {/* User header */}
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-bold text-white"
                        style={{
                          backgroundColor: `${getUserAccent(selectedUser.id)}20`,
                          color: getUserAccent(selectedUser.id),
                        }}
                      >
                        {selectedUser.name.charAt(0)}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">
                          {selectedUser.name}
                        </h2>
                        <p className="text-xs text-white/40">
                          {selectedUser.activeTaskName ??
                            selectedUser.email ??
                            selectedUser.recentBoard ??
                            "No board"}
                        </p>
                        {selectedUser.running && selectedUser.activeTaskStartAt ? (
                          <div className="mt-2">
                            <LiveTimerDisplay startedAt={selectedUser.activeTaskStartAt} />
                          </div>
                        ) : null}
                      </div>
                      {selectedUser.running && (
                        <span className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-2.5 py-1 text-xs font-medium text-green-400">
                          <CircleDot size={10} className="animate-pulse" />
                          Tracking now
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedUserId(null)}
                      className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Stats row */}
                  <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatPill
                      label="14-day total"
                      value={formatDuration(selectedUserPeriodSeconds)}
                    />
                    <StatPill
                      label="Active timers"
                      value={String(selectedUser.activeTimers)}
                      accent={selectedUser.running ? "#4ade80" : undefined}
                    />
                    <StatPill
                      label="Avg daily"
                      value={formatHours(selectedUserPeriodSeconds / 14 / 3600)}
                      accent={getUserAccent(selectedUser.id)}
                    />
                    <StatPill
                      label="Boards"
                      value={String(selectedUserBoardDetails.length)}
                    />
                  </div>

                  {/* Boards + Tasks two-column */}
                  <div className="grid gap-5 lg:grid-cols-2">
                    {/* Boards */}
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <Layers size={14} className="text-orange-400" />
                        <h3 className="text-sm font-semibold text-white">
                          Boards
                        </h3>
                        <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/40">
                          {selectedUserBoardDetails.length}
                        </span>
                      </div>

                      <div className="space-y-2.5">
                        {selectedUserBoardDetails.length === 0 ? (
                          <div className="rounded-2xl border border-white/8 bg-black/40 p-4 text-center text-sm text-white/35">
                            No board data
                          </div>
                        ) : (
                          selectedUserBoardDetails.map((b) => (
                            <BoardBar
                              key={b.board}
                              name={b.board}
                              seconds={b.seconds}
                              targetSeconds={selectedUserBoardTargetSeconds}
                              dailyHours={b.dailyHours}
                              calendarDays={calendarDays}
                              accent={getUserAccent(selectedUser.id)}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    {/* Tasks / Cards */}
                    <div>
                      <div className="mb-3 flex items-center gap-2">
                        <ListTodo size={14} className="text-orange-400" />
                        <h3 className="text-sm font-semibold text-white">
                          Tasks &amp; cards
                        </h3>
                        <span className="ml-auto rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/40">
                          top {Math.min(selectedUserTaskDetails.length, 10)}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        {selectedUserTaskDetails.length === 0 ? (
                          <div className="rounded-2xl border border-white/8 bg-black/40 p-4 text-center text-sm text-white/35">
                            No task data
                          </div>
                        ) : (
                          selectedUserTaskDetails.map((t, i) => (
                            <div
                              key={t.task}
                              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                                t.isRunning
                                  ? "border-green-500/20 bg-green-500/5"
                                  : "border-white/6 bg-black/40 hover:border-white/12"
                              }`}
                            >
                              <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold"
                                style={{
                                  backgroundColor: `${getUserAccent(selectedUser.id)}20`,
                                  color: getUserAccent(selectedUser.id),
                                }}
                              >
                                {i + 1}
                              </span>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-white/80">
                                  {t.task}
                                </p>
                                {t.board && (
                                  <p className="mt-0.5 truncate text-[10px] text-white/30">
                                    {t.board}
                                  </p>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                {t.isRunning && (
                                  <span className="flex items-center gap-1 text-[10px] text-green-400">
                                    <CircleDot
                                      size={9}
                                      className="animate-pulse"
                                    />
                                    live
                                  </span>
                                )}
                                <span className="font-mono text-xs font-semibold text-white/60">
                                  {formatDuration(t.seconds)}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-48 items-center justify-center rounded-3xl border-2 border-dashed border-white/8 bg-black/30">
                  <div className="text-center">
                    <TrendingUp
                      size={28}
                      className="mx-auto mb-3 text-white/15"
                    />
                    <p className="text-sm text-white/30">
                      Select a team member to see their full breakdown
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
