import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  SunMedium,
  Users,
} from "lucide-react";
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
  getHarareDateKey,
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

  const todayKey = getHarareDateKey();
  const isCurrentWeek = todayKey >= weekStart && todayKey <= weekEnd;

  const myAvailabilityByDay = useMemo(
    () =>
      days.reduce<Record<string, PlannerAvailability[]>>((acc, day) => {
        acc[day] = (availabilityByDay[day] ?? []).filter((item) => item.user_id === viewerId);
        return acc;
      }, {}),
    [availabilityByDay, days, viewerId],
  );

  const myAssignmentsByDay = useMemo(
    () =>
      days.reduce<Record<string, EmployeeAssignmentRow[]>>((acc, day) => {
        acc[day] = (assignmentsByDay[day] ?? []).filter(
          (row) => row.is_mine || row.employee_id === viewerId,
        );
        return acc;
      }, {}),
    [assignmentsByDay, days, viewerId],
  );

  const assignedDays = days.filter((day) => (myAssignmentsByDay[day] ?? []).length > 0).length;
  const unavailableDays = days.filter((day) => (myAvailabilityByDay[day] ?? []).length > 0).length;
  const freeDays = Math.max(0, days.length - assignedDays - unavailableDays);
  const todayAssignments = myAssignmentsByDay[todayKey] ?? [];
  const todayAvailability = myAvailabilityByDay[todayKey] ?? [];
  const todayTeamAssignments = assignmentsByDay[todayKey] ?? [];
  const nextAssignment = myAssignments
    .filter((row) => row.assignment.end_date >= todayKey)
    .sort((a, b) => a.assignment.start_date.localeCompare(b.assignment.start_date))[0];

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
                My Schedule is available to employees and scheduling admins with workforce planning access.
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
        <main className="min-w-0 flex-1 bg-black">
          <div className="mx-auto max-w-[1760px] px-4 py-5 sm:px-6 lg:px-8">
            <header className="mb-5 rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-orange-600">
                    My Schedule
                  </p>
                  <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                    {isCurrentWeek ? "This week" : `${formatDayLabel(weekStart)} to ${formatDayLabel(weekEnd)}`}
                  </h1>
                  <p className="mt-1 text-sm text-white/50">
                    Today is {formatDayLabel(todayKey)}
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
                  <select
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                    className="h-10 rounded-xl border border-white/10 bg-neutral-950 px-3 text-sm text-white outline-none focus:border-orange-400"
                  >
                    <option value="all">All locations</option>
                    {(data?.locations ?? []).map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-[40px_minmax(0,1fr)_40px] overflow-hidden rounded-xl border border-white/10 bg-neutral-950 sm:flex">
                    <button
                      type="button"
                      onClick={() => setWeekStart((date) => addDays(date, -7))}
                      aria-label="Previous week"
                      className="flex h-10 items-center justify-center border-r border-white/10 text-white/70 hover:bg-white/10"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <label className="flex h-10 min-w-0 items-center justify-center gap-2 px-3 text-sm text-white/70 sm:min-w-[220px]">
                      <CalendarDays size={16} className="shrink-0 text-orange-500" />
                      <input
                        type="date"
                        value={weekStart}
                        onChange={(event) => setWeekStart(event.target.value)}
                        className="min-w-0 bg-transparent text-white outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setWeekStart((date) => addDays(date, 7))}
                      aria-label="Next week"
                      className="flex h-10 items-center justify-center border-l border-white/10 text-white/70 hover:bg-white/10"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWeekStart(getHarareWeekStart())}
                    className="h-10 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    Today
                  </button>
                </div>
              </div>
            </header>

            {error ? (
              <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </p>
            ) : null}

            {loading || !data ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-16 text-center text-white/45">
                Loading schedule...
              </div>
            ) : (
              <div className="space-y-5">
                <section className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl shadow-black/30">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Today
                        </p>
                        <h2 className="mt-1 text-xl font-bold text-white">
                          {formatDayLabel(todayKey)}
                        </h2>
                      </div>
                      <span
                        className={[
                          "rounded-full px-3 py-1 text-xs font-semibold",
                          todayAssignments.length > 0
                            ? "bg-emerald-50 text-emerald-700"
                            : todayAvailability.length > 0
                              ? "bg-violet-50 text-violet-700"
                            : "bg-white/10 text-white/65",
                        ].join(" ")}
                      >
                        {todayAssignments.length > 0
                          ? "Assigned"
                          : todayAvailability.length > 0
                            ? "Unavailable"
                            : "Free"}
                      </span>
                    </div>

                    {todayAssignments.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {todayAssignments.map((row) => (
                          <article
                            key={row.assignment.id}
                            className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-emerald-50">
                                  {row.role_name ?? "Role"}
                                </p>
                                <p className="mt-1 text-sm text-emerald-200/80">
                                  {row.location_name}
                                </p>
                              </div>
                              <BriefcaseBusiness size={18} className="text-emerald-300" />
                            </div>
                            <div className="mt-4 grid gap-2 text-sm text-emerald-100/80 sm:grid-cols-2">
                              <p className="flex items-center gap-2">
                                <Clock3 size={15} />
                                {formatTimeRange(row.assignment.start_time, row.assignment.end_time)}
                              </p>
                              <p className="flex items-center gap-2">
                                <MapPin size={15} />
                                {row.location_name}
                              </p>
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : todayAvailability.length > 0 ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {todayAvailability.map((item) => (
                          <article
                            key={`${item.kind}-${item.id}-today`}
                            className="rounded-xl border border-violet-300/25 bg-violet-500/10 p-4"
                          >
                            <p className="font-semibold text-violet-50">
                              {formatAvailabilityKind(item)}
                            </p>
                            <p className="mt-1 text-sm text-violet-100/75">
                              {formatAvailabilityRange(item)}
                              {item.source === "weekly" ? " · repeats weekly" : ""}
                            </p>
                            {item.reason ? (
                              <p className="mt-3 text-sm text-violet-100/70">{item.reason}</p>
                            ) : null}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.04] px-4 py-10 text-center">
                        <SunMedium size={28} className="mx-auto text-white/25" />
                        <p className="mt-2 text-sm font-semibold text-white/80">Free today</p>
                        {nextAssignment ? (
                          <p className="mt-1 text-sm text-white/45">
                            Next: {formatDayLabel(nextAssignment.assignment.start_date)} at {nextAssignment.location_name}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-white/40">
                          Team today
                        </p>
                        <p className="mt-1 text-lg font-bold text-white">
                          {todayTeamAssignments.length} assigned
                        </p>
                      </div>
                      <Users size={20} className="text-orange-300" />
                    </div>
                    {todayTeamAssignments.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/40">
                        No team assignments today
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {todayTeamAssignments.slice(0, 8).map((row) => {
                          const isMine = row.is_mine || row.employee_id === viewerId;
                          return (
                            <div
                              key={`today-team-${row.assignment.id}`}
                              className={[
                                "rounded-xl border p-3 text-sm",
                                isMine
                                  ? "border-orange-300/35 bg-orange-500/15"
                                  : "border-white/10 bg-black/30",
                              ].join(" ")}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-semibold text-white">
                                    {row.employee_name || "Employee"}
                                  </p>
                                  <p className="mt-1 truncate text-xs text-white/50">
                                    {row.role_name ?? "Role"}
                                  </p>
                                </div>
                                {isMine ? (
                                  <span className="rounded-full bg-orange-400 px-2 py-0.5 text-[10px] font-bold uppercase text-black">
                                    You
                                  </span>
                                ) : null}
                              </div>
                              <div className="mt-3 grid gap-1 text-xs text-white/60">
                                <p className="flex items-center gap-1.5">
                                  <MapPin size={12} className="text-orange-300" />
                                  {row.location_name}
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <Clock3 size={12} className="text-orange-300" />
                                  {formatTimeRange(row.assignment.start_time, row.assignment.end_time)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    {[
                      { label: "Assigned days", value: assignedDays, Icon: CalendarCheck, tone: "text-emerald-600 bg-emerald-50" },
                      { label: "Free days", value: freeDays, Icon: SunMedium, tone: "text-gray-600 bg-gray-100" },
                      { label: "Off / leave days", value: unavailableDays, Icon: Clock3, tone: "text-violet-600 bg-violet-50" },
                      { label: "Team assignments", value: data.assignments.length, Icon: Users, tone: "text-orange-600 bg-orange-50" },
                    ].map(({ label, value, Icon, tone }) => (
                      <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium text-white/50">{label}</p>
                          <span className={`rounded-xl p-2 ${tone}`}>
                            <Icon size={17} />
                          </span>
                        </div>
                        <p className="mt-2 text-3xl font-bold text-white">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <StatusAlertBanner events={data.status_events ?? []} />

                <section className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/30">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">Week calendar</p>
                      <p className="mt-1 text-xs text-white/45">
                        {activeLocations} active locations
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs font-medium">
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">Assigned</span>
                      <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Off / leave</span>
                      <span className="rounded-full bg-white/10 px-2.5 py-1 text-white/65">Free</span>
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-7">
                    {days.map((day) => {
                      const dayAssignments = assignmentsByDay[day] ?? [];
                      const mineForDay = myAssignmentsByDay[day] ?? [];
                      const otherAssignments = dayAssignments.filter(
                        (row) => !(row.is_mine || row.employee_id === viewerId),
                      );
                      const myUnavailable = myAvailabilityByDay[day] ?? [];
                      const dayAvailability = availabilityByDay[day] ?? [];
                      const isToday = day === todayKey;
                      const dayStatus =
                        mineForDay.length > 0
                          ? "assigned"
                          : myUnavailable.length > 0
                            ? "unavailable"
                            : "free";

                      return (
                        <section
                          key={day}
                          className={[
                            "min-h-[250px] rounded-xl border p-3 transition",
                            isToday ? "border-orange-300/60 ring-2 ring-orange-400/20" : "border-white/10",
                            dayStatus === "assigned"
                              ? "bg-emerald-500/10"
                              : dayStatus === "unavailable"
                                ? "bg-violet-500/10"
                                : "bg-white/[0.04]",
                          ].join(" ")}
                        >
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold text-white">{formatDayLabel(day)}</p>
                              <p className="mt-0.5 text-[11px] text-white/45">
                                {mineForDay.length > 0
                                  ? `${mineForDay.length} for you`
                                  : myUnavailable.length > 0
                                    ? "Unavailable"
                                    : "Free"}
                              </p>
                            </div>
                            <span
                              className={[
                                "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                                dayStatus === "assigned"
                                  ? "bg-emerald-400/15 text-emerald-200"
                                  : dayStatus === "unavailable"
                                    ? "bg-violet-400/15 text-violet-200"
                                    : "bg-white/10 text-white/55",
                              ].join(" ")}
                            >
                              {dayStatus}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {myUnavailable.map((item) => (
                              <div
                                key={`${item.kind}-${item.id}-${day}`}
                                className="rounded-lg border border-violet-300/25 bg-violet-500/10 p-2 text-xs"
                              >
                                <p className="font-semibold text-violet-50">
                                  {formatAvailabilityKind(item)}
                                </p>
                                <p className="mt-1 text-violet-100/70">
                                  {formatDayCount(item.day_count)}
                                  {item.source === "weekly" ? " · weekly" : ""}
                                </p>
                              </div>
                            ))}

                            {mineForDay.map((row) => (
                              <div
                                key={row.assignment.id}
                                className="rounded-lg border border-emerald-300/25 bg-emerald-500/10 p-2 text-xs shadow-sm"
                              >
                                <p className="font-semibold text-emerald-50">
                                  {row.role_name ?? "Role"}
                                </p>
                                <p className="mt-1 flex items-center gap-1 text-emerald-100/75">
                                  <MapPin size={11} />
                                  {row.location_name}
                                </p>
                                <p className="mt-1 flex items-center gap-1 text-emerald-100/75">
                                  <Clock3 size={11} />
                                  {formatTimeRange(row.assignment.start_time, row.assignment.end_time)}
                                </p>
                              </div>
                            ))}

                            {mineForDay.length === 0 && myUnavailable.length === 0 ? (
                              <div className="rounded-lg border border-dashed border-white/10 bg-black/20 px-2 py-6 text-center text-xs text-white/35">
                                Free
                              </div>
                            ) : null}

                            {otherAssignments.length > 0 ? (
                              <div className="rounded-lg border border-white/10 bg-black/25 p-2">
                                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-white/35">
                                  Team assigned
                                </p>
                                <div className="space-y-1.5">
                                  {otherAssignments.slice(0, 4).map((row) => (
                                    <div
                                      key={`team-${day}-${row.assignment.id}`}
                                      className="rounded-md bg-white/[0.06] px-2 py-1.5 text-[11px]"
                                    >
                                      <p className="truncate font-semibold text-white/85">
                                        {row.employee_name || "Employee"}
                                      </p>
                                      <p className="mt-0.5 truncate text-white/45">
                                        {row.role_name ?? "Role"} · {row.location_name}
                                      </p>
                                      <p className="mt-0.5 text-white/35">
                                        {formatTimeRange(row.assignment.start_time, row.assignment.end_time)}
                                      </p>
                                    </div>
                                  ))}
                                  {otherAssignments.length > 4 ? (
                                    <p className="px-1 text-[11px] font-medium text-white/40">
                                      +{otherAssignments.length - 4} more
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            ) : null}

                            {dayAvailability.length > myUnavailable.length ? (
                              <div className="rounded-lg bg-white/[0.06] px-2 py-1.5 text-[11px] font-medium text-white/45">
                                {dayAvailability.length} team off / leave
                              </div>
                            ) : null}
                          </div>
                        </section>
                      );
                    })}
                  </div>
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
