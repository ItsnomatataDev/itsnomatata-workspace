import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Clock3, Coffee, UserCheck } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { getAttendanceReport } from "../services/attendanceService";
import type { AttendanceReportRow } from "../types/attendance";
import {
  getZimbabweDateKey,
  getZimbabweMonthRangeIso,
  makeZimbabweLocalIso,
} from "../../../lib/utils/zimbabweCalendar";
import { formatDurationHms } from "../../../lib/utils/timeMath";

function formatMaybeDate(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusPill({ row }: { row: AttendanceReportRow }) {
  const label = row.status === "on_leave"
    ? "On Leave"
    : row.status === "on_break"
      ? "On break"
    : row.status === "active"
      ? "Clocked in"
      : row.status === "completed"
        ? "Clocked out"
        : row.status === "missed_clock_out"
          ? "Missed clock out"
          : "Offline";

  const color = row.status === "on_leave"
    ? "bg-sky-500/15 text-sky-300"
    : row.status === "on_break"
      ? "bg-amber-500/15 text-amber-300"
    : row.status === "active"
      ? "bg-green-500/15 text-green-300"
      : row.status === "missed_clock_out"
        ? "bg-red-500/15 text-red-300"
        : "bg-white/10 text-white/60";

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {label}
    </span>
  );
}

export default function AdminAttendancePage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;
  const [date, setDate] = useState(getZimbabweDateKey(new Date()));
  const [mode, setMode] = useState<"daily" | "weekly" | "monthly">("daily");
  const [rows, setRows] = useState<AttendanceReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => {
    if (mode === "monthly") return getZimbabweMonthRangeIso(makeZimbabweLocalIso(date, "12:00:00"));

    const startDate = new Date(makeZimbabweLocalIso(date, "00:00:00"));
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + (mode === "weekly" ? 7 : 1));
    return {
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      label: mode === "weekly" ? "Selected week" : date,
    };
  }, [date, mode]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      setRows(
        await getAttendanceReport({
          organizationId,
          from: range.start,
          to: range.end,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attendance.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, range.end, range.start]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(interval);
  }, [load]);

  if (!profile || !organizationId) {
    return <div className="min-h-screen bg-black p-6 text-white">Loading...</div>;
  }

  const clockedIn = rows.filter((row) => row.status === "active").length;
  const onBreak = rows.filter((row) => row.status === "on_break").length;
  const onLeave = rows.filter((row) => row.status === "on_leave").length;
  const late = rows.filter((row) => row.is_late).length;
  const missed = rows.filter((row) => row.missed_clock_out).length;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />
        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Admin
              </p>
              <h1 className="mt-2 text-3xl font-bold">Attendance</h1>
              <p className="mt-2 text-sm text-white/50">
                Presence time compared with task-tracked work time.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as typeof mode)}
                className="rounded-2xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="rounded-2xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <section className="mb-6 grid gap-4 md:grid-cols-5">
            {[
              { label: "Clocked in", value: clockedIn, Icon: UserCheck },
              { label: "On break", value: onBreak, Icon: Coffee },
              { label: "On leave", value: onLeave, Icon: CalendarDays },
              { label: "Late", value: late, Icon: Clock3 },
              { label: "Missed", value: missed, Icon: Activity },
            ].map(({ label, value, Icon }) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-white/55">{label}</p>
                  <Icon size={18} className="text-orange-400" />
                </div>
                <p className="mt-4 text-3xl font-bold">{value}</p>
              </div>
            ))}
          </section>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
              {error}
            </div>
          ) : null}

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-white/10 text-xs uppercase tracking-[0.18em] text-white/40">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Clock in</th>
                    <th className="px-4 py-3">Clock out</th>
                    <th className="px-4 py-3">Work time</th>
                    <th className="px-4 py-3">Break</th>
                    <th className="px-4 py-3">Task tracked</th>
                    <th className="px-4 py-3">Untracked</th>
                    <th className="px-4 py-3">Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-white/50">
                        Loading attendance...
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-white/50">
                        No attendance rows found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.user_id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3">
                          <p className="font-medium">{row.full_name || "Unnamed"}</p>
                          <p className="text-xs text-white/40">{row.email}</p>
                        </td>
                        <td className="px-4 py-3"><StatusPill row={row} /></td>
                        <td className="px-4 py-3">{formatMaybeDate(row.clock_in_at)}</td>
                        <td className="px-4 py-3">{formatMaybeDate(row.clock_out_at)}</td>
                        <td className="px-4 py-3 font-mono">{formatDurationHms(row.work_seconds)}</td>
                        <td className="px-4 py-3 font-mono">{formatDurationHms(row.break_seconds)}</td>
                        <td className="px-4 py-3 font-mono">{formatDurationHms(row.task_tracked_seconds)}</td>
                        <td className="px-4 py-3 font-mono text-orange-300">{formatDurationHms(row.untracked_seconds)}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {row.is_late ? (
                              <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-300">
                                Late
                              </span>
                            ) : null}
                            {row.missed_clock_out ? (
                              <span className="rounded-full bg-red-500/15 px-2 py-1 text-xs text-red-300">
                                Missed
                              </span>
                            ) : null}
                            {row.break_seconds > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-xs text-white/50">
                                <Coffee size={11} /> Break
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
