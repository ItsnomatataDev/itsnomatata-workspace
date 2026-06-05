import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import Sidebar from "../../components/dashboard/components/Sidebar";
import { useAuth } from "../../app/providers/AuthProvider";
import StatusAlertBanner from "./components/StatusAlertBanner";
import type { EmployeePlannerCalendar } from "./types";
import { getEmployeeCalendarAssignments } from "./services/locationPlannerService";
import {
  addDays,
  assignmentOnDay,
  buildDayRange,
  defaultWeekRange,
  formatDayLabel,
  formatTimeRange,
  startOfWeek,
  toDateKey,
} from "./utils/calendarDates";

export default function MySchedulePage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;
  const viewerId = auth?.user?.id ?? null;

  const initialRange = defaultWeekRange();
  const [weekStart, setWeekStart] = useState(initialRange.start);
  const [locationFilter, setLocationFilter] = useState("all");
  const [data, setData] = useState<EmployeePlannerCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const days = useMemo(() => buildDayRange(weekStart, weekEnd), [weekEnd, weekStart]);

  const load = useCallback(async () => {
    if (!organizationId) return;
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
  }, [locationFilter, organizationId, weekEnd, weekStart]);

  useEffect(() => {
    void load();
  }, [load]);

  const myAssignments = useMemo(
    () => (data?.assignments ?? []).filter((row) => row.is_mine || row.employee_id === viewerId),
    [data?.assignments, viewerId],
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile?.primary_role} />
        <main className="min-w-0 flex-1 bg-gray-100 text-gray-900">
          <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
            <header className="mb-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-500">
                    Team Schedule
                  </p>
                  <h1 className="mt-2 text-3xl font-bold text-gray-950">
                    Assignment Calendar
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-gray-500">
                    Read-only view of where everyone is assigned for each date.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={locationFilter}
                    onChange={(event) => setLocationFilter(event.target.value)}
                    className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500"
                  >
                    <option value="all">All locations</option>
                    {(data?.locations ?? []).map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  <div className="inline-flex overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <button
                      type="button"
                      onClick={() => setWeekStart((date) => addDays(date, -7))}
                      className="px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Prev week
                    </button>
                    <label className="flex items-center gap-2 border-x border-gray-200 px-3 py-2 text-sm text-gray-700">
                      <CalendarDays size={16} className="text-orange-500" />
                      Week of
                      <input
                        type="date"
                        value={weekStart}
                        onChange={(event) => setWeekStart(event.target.value)}
                        className="bg-transparent text-gray-950 outline-none"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setWeekStart(toDateKey(startOfWeek(new Date())))}
                      className="px-3 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50"
                    >
                      This week
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekStart((date) => addDays(date, 7))}
                      className="border-l border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                    >
                      Next week
                    </button>
                  </div>
                </div>
              </div>
            </header>

            {error ? (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </p>
            ) : null}

            {myAssignments.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-3">
                <p className="text-sm font-semibold text-orange-800">
                  Your assignments this week: {myAssignments.length}
                </p>
              </div>
            ) : null}

            <StatusAlertBanner events={data?.status_events ?? []} />

            {loading || !data ? (
              <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center text-gray-500">
                Loading schedule...
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="sticky left-0 z-10 min-w-[190px] bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Location
                      </th>
                      {days.map((day) => (
                        <th
                          key={day}
                          className="min-w-[150px] px-3 py-3 text-center text-xs font-semibold text-gray-700"
                        >
                          {formatDayLabel(day)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.locations.map((location) => {
                      const closed = location.status === "closed";
                      return (
                        <tr key={location.id} className="border-b border-gray-100">
                          <td
                            className={[
                              "sticky left-0 z-10 px-3 py-3 align-top",
                              closed ? "bg-gray-950 text-orange-300" : "bg-gray-50",
                            ].join(" ")}
                          >
                            <p className="font-semibold">{location.name}</p>
                            <p className="mt-1 text-[11px] uppercase opacity-70">
                              {location.status}
                            </p>
                          </td>
                          {days.map((day) => {
                            const assignments = data.assignments.filter(
                              (row) =>
                                row.assignment.location_id === location.id &&
                                assignmentOnDay(
                                  row.assignment.start_date,
                                  row.assignment.end_date,
                                  day,
                                ),
                            );

                            return (
                              <td
                                key={`${location.id}-${day}`}
                                className={[
                                  "align-top border-l border-gray-200 p-2",
                                  closed ? "bg-gray-950/90" : "bg-white",
                                ].join(" ")}
                              >
                                {assignments.length === 0 ? (
                                  <p className={closed ? "text-xs text-white/30" : "text-xs text-gray-300"}>
                                    No assignments
                                  </p>
                                ) : (
                                  <div className="space-y-2">
                                    {assignments.map((row) => {
                                      const isMine = row.is_mine || row.employee_id === viewerId;
                                      return (
                                        <div
                                          key={row.assignment.id}
                                          className={[
                                            "rounded-xl border px-2 py-2 text-xs",
                                            isMine
                                              ? "border-orange-300 bg-orange-50 text-orange-950"
                                              : "border-gray-200 bg-gray-50 text-gray-700",
                                          ].join(" ")}
                                        >
                                          <p className="font-semibold">
                                            {row.employee_name || "Employee"}
                                          </p>
                                          <p className="mt-0.5 text-[11px] opacity-75">
                                            {row.role_name ?? "Work assignment"}
                                          </p>
                                          <p className="mt-1 text-[10px] opacity-65">
                                            {formatTimeRange(
                                              row.assignment.start_time,
                                              row.assignment.end_time,
                                            )}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
