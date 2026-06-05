import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock3, MapPin, Sparkles, SunMedium, Users } from "lucide-react";
import Sidebar from "../../components/dashboard/components/Sidebar";
import { useAuth } from "../../app/providers/AuthProvider";
import StatusAlertBanner from "./components/StatusAlertBanner";
import type {
  EmployeeAssignmentRow,
  EmployeePlannerCalendar,
  PlannerAvailability,
} from "./types";
import { getEmployeeCalendarAssignments } from "./services/locationPlannerService";
import { getOfficeCapabilities } from "../../lib/offices";
import {
  addDays,
  assignmentOnDay,
  buildDayRange,
  formatDayLabel,
  formatTimeRange,
  getHarareWeekStart,
} from "./utils/calendarDates";
import {
  formatAvailabilityKind,
  formatAvailabilityRange,
  formatDayCount,
} from "./utils/availabilityLabels";

const SCHEDULE_ADMIN_ROLES = new Set(["admin", "org_admin", "super_admin", "superadmin"]);

export default function MySchedulePage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;
  const viewerId = auth?.user?.id ?? null;
  const officeCapabilities = getOfficeCapabilities(profile?.office);
  const canViewSchedule =
    officeCapabilities.isThreeLittleBirds ||
    (officeCapabilities.locationPlanner &&
      SCHEDULE_ADMIN_ROLES.has(String(profile?.primary_role ?? "")));

  const [weekStart, setWeekStart] = useState(getHarareWeekStart());
  const [locationFilter, setLocationFilter] = useState("all");
  const [data, setData] = useState<EmployeePlannerCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(() => buildDayRange(weekStart, weekEnd), [weekEnd, weekStart]);

  const load = useCallback(async () => {
    if (!organizationId || !canViewSchedule) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError("");
      const next = await getEmployeeCalendarAssignments({
        organizationId,
        startDate: weekStart,
        endDate: weekEnd,
        locationId: locationFilter === "all" ? null : locationFilter,
      });
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  }, [canViewSchedule, locationFilter, organizationId, weekEnd, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const myAssignments = useMemo(
    () => (data?.assignments ?? []).filter((row) => row.is_mine || row.employee_id === viewerId),
    [data?.assignments, viewerId],
  );

  const assignmentsByDay = useMemo(
    () =>
      days.reduce<Record<string, EmployeeAssignmentRow[]>>((acc, day) => {
        acc[day] = (data?.assignments ?? []).filter((row) =>
          assignmentOnDay(row.assignment.start_date, row.assignment.end_date, day),
        );
        return acc;
      }, {}),
    [data?.assignments, days],
  );

  const availabilityByDay = useMemo(
    () =>
      days.reduce<Record<string, PlannerAvailability[]>>((acc, day) => {
        acc[day] = (data?.availability ?? []).filter((item) =>
          assignmentOnDay(item.start_date, item.end_date, day),
        );
        return acc;
      }, {}),
    [data?.availability, days],
  );

  const activeLocations = useMemo(
    () =>
      (data?.locations ?? []).filter((location) =>
        data?.assignments.some((row) => row.assignment.location_id === location.id),
      ).length,
    [data?.assignments, data?.locations],
  );

  if (!canViewSchedule) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar role={profile?.primary_role} />
          <main className="flex min-w-0 flex-1 items-center justify-center bg-neutral-950 px-4 py-10">
            <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl">
              <CalendarDays size={36} className="mx-auto text-orange-400" />
              <h1 className="mt-4 text-2xl font-bold">Schedule access is limited</h1>
              <p className="mt-2 text-sm text-white/55">
                My Schedule is available to Three Little Birds staff and IT's Nomatata office admins.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile?.primary_role} />
        <main className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.16),transparent_32%),#09090b] text-white">
          <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
            <header className="mb-6 overflow-hidden rounded-3xl border border-white/10 bg-white/6 shadow-2xl backdrop-blur">
              <div className="flex flex-wrap items-start justify-between gap-4 p-6">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full border border-orange-400/25 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-orange-200">
                    <Sparkles size={13} />
                    Three Little Birds
                  </p>
                  <h1 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                    My Schedule
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-white/55">
                    A clean weekly view of where TLB staff are assigned, with your own shifts highlighted.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                    className="rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-sm text-white outline-none focus:border-orange-400"
                  >
                    <option value="all">All locations</option>
                    {(data?.locations ?? []).map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  <div className="inline-flex overflow-hidden rounded-xl border border-white/10 bg-black/50">
                    <button
                      type="button"
                      onClick={() => setWeekStart((date) => addDays(date, -7))}
                      className="px-3 py-2 text-sm font-semibold text-white/65 hover:bg-white/10"
                    >
                      Prev week
                    </button>
                    <label className="flex items-center gap-2 border-x border-white/10 px-3 py-2 text-sm text-white/75">
                      <CalendarDays size={16} className="text-orange-300" />
                      Week of
                      <input
                        type="date"
                        value={weekStart}
                        onChange={(event) => setWeekStart(event.target.value)}
                        className="bg-transparent text-white outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setWeekStart(getHarareWeekStart())}
                      className="px-3 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/10"
                    >
                      This week
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekStart((date) => addDays(date, 7))}
                      className="border-l border-white/10 px-3 py-2 text-sm font-semibold text-white/65 hover:bg-white/10"
                    >
                      Next week
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid border-t border-white/10 bg-black/20 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: "My shifts", value: myAssignments.length, Icon: CalendarDays },
                  { label: "Team assignments", value: data?.assignments.length ?? 0, Icon: Users },
                  { label: "Active locations", value: activeLocations, Icon: MapPin },
                  { label: "Leave / off days", value: data?.availability.length ?? 0, Icon: SunMedium },
                ].map(({ label, value, Icon }) => (
                  <div key={label} className="border-white/10 px-6 py-4 sm:border-r last:border-r-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/35">{label}</p>
                      <Icon size={17} className="text-orange-300" />
                    </div>
                    <p className="mt-2 text-2xl font-bold">{value}</p>
                  </div>
                ))}
              </div>
            </header>

            {error ? (
              <p className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            {myAssignments.length > 0 ? (
              <div className="mb-5 rounded-2xl border border-orange-400/25 bg-orange-500/10 p-4">
                <p className="text-sm font-semibold text-orange-100">Your assignments this week</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {myAssignments.slice(0, 6).map((row) => (
                    <div key={row.assignment.id} className="rounded-xl border border-white/10 bg-black/35 p-3">
                      <p className="font-semibold">{row.location_name}</p>
                      <p className="mt-1 text-xs text-white/55">{formatDayLabel(row.assignment.start_date)}</p>
                      <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[11px] text-orange-100">
                        <Clock3 size={12} />
                        {formatTimeRange(row.assignment.start_time, row.assignment.end_time)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <StatusAlertBanner events={data?.status_events ?? []} />

            {loading || !data ? (
              <div className="rounded-2xl border border-white/10 bg-white/6 px-6 py-16 text-center text-white/45">
                Loading schedule...
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-7">
                {days.map((day) => {
                  const dayAssignments = assignmentsByDay[day] ?? [];
                  const dayAvailability = availabilityByDay[day] ?? [];
                  const dayItemCount = dayAssignments.length + dayAvailability.length;
                  return (
                    <section
                      key={day}
                      className="min-h-[260px] rounded-3xl border border-white/10 bg-white/6 p-4 shadow-xl"
                    >
                      <div className="mb-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-bold">{formatDayLabel(day)}</p>
                          <p className="mt-1 text-xs text-white/40">
                            {dayAssignments.length} assigned · {dayAvailability.length} off
                          </p>
                        </div>
                        <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-bold text-orange-200">
                          {dayItemCount}
                        </span>
                      </div>

                      {dayItemCount === 0 ? (
                        <div className="rounded-2xl border border-dashed border-white/10 px-3 py-10 text-center text-xs text-white/35">
                          No assignments or off days
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {dayAvailability.map((item) => (
                            <div
                              key={`${item.kind}-${item.id}-${day}`}
                              className={[
                                "rounded-2xl border p-3 text-xs",
                                item.kind === "leave"
                                  ? "border-sky-300/40 bg-sky-500/10 text-sky-50"
                                  : "border-purple-300/40 bg-purple-500/10 text-purple-50",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="font-semibold">
                                    {item.employee_name || item.employee_email || "Employee"}
                                  </p>
                                  <p className="mt-1 text-white/55">
                                    {formatAvailabilityKind(item)} · {formatDayCount(item.day_count)}
                                    {item.source === "weekly" ? " · repeats weekly" : ""}
                                  </p>
                                  <p className="mt-1 text-white/45">
                                    {formatAvailabilityRange(item)}
                                    {item.reason ? ` · ${item.reason}` : ""}
                                  </p>
                                </div>
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold uppercase">
                                  {item.kind === "leave" ? "Leave" : "Off"}
                                </span>
                              </div>
                            </div>
                          ))}
                          {dayAssignments.map((row) => {
                            const isMine = row.is_mine || row.employee_id === viewerId;
                            return (
                              <div
                                key={row.assignment.id}
                                className={[
                                  "rounded-2xl border p-3 text-xs transition",
                                  isMine
                                    ? "border-orange-300/60 bg-orange-500/15 text-orange-50 shadow-lg shadow-orange-950/20"
                                    : "border-white/10 bg-black/35 text-white/75",
                                ].join(" ")}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold">{row.employee_name || "Employee"}</p>
                                    <p className="mt-1 text-white/45">{row.role_name ?? "Work assignment"}</p>
                                  </div>
                                  {isMine ? (
                                    <span className="rounded-full bg-orange-400 px-2 py-0.5 text-[9px] font-bold uppercase text-black">
                                      Mine
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-3 space-y-1.5">
                                  <p className="flex items-center gap-1.5 text-white/60">
                                    <MapPin size={12} className="text-orange-300" />
                                    {row.location_name}
                                  </p>
                                  <p className="flex items-center gap-1.5 text-white/60">
                                    <Clock3 size={12} className="text-orange-300" />
                                    {formatTimeRange(row.assignment.start_time, row.assignment.end_time)}
                                  </p>
                                  <p className="flex items-center gap-1.5 text-white/60">
                                    <CalendarDays size={12} className="text-orange-300" />
                                    {row.assignment.start_date === row.assignment.end_date
                                      ? "1 day assignment"
                                      : `${formatDayLabel(row.assignment.start_date)} - ${formatDayLabel(row.assignment.end_date)}`}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
