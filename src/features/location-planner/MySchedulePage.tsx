import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/dashboard/components/Sidebar";
import { useAuth } from "../../app/providers/AuthProvider";
import PlannerTopBar from "./components/PlannerTopBar";
import StatusAlertBanner from "./components/StatusAlertBanner";
import type { CalendarViewMode, EmployeePlannerCalendar } from "./types";
import { getEmployeeCalendarAssignments } from "./services/locationPlannerService";
import {
  assignmentOnDay,
  buildDayRange,
  defaultWeekRange,
  formatDayLabel,
  formatTimeRange,
  rangeForView,
} from "./utils/calendarDates";

export default function MySchedulePage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;
  const viewerId = auth?.user?.id ?? null;

  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(defaultWeekRange().start);
  const [range, setRange] = useState(defaultWeekRange());
  const [locationFilter, setLocationFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [data, setData] = useState<EmployeePlannerCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const days = useMemo(() => buildDayRange(range.start, range.end), [range]);

  const visibleLocations = useMemo(() => {
    const list = data?.locations ?? [];
    if (departmentFilter === "all") return list;
    return list.filter(
      (loc) => loc.type === "department" || loc.type === "team" || loc.id === departmentFilter,
    );
  }, [data?.locations, departmentFilter]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      const next = await getEmployeeCalendarAssignments({
        organizationId,
        startDate: range.start,
        endDate: range.end,
        locationId: locationFilter === "all" ? null : locationFilter,
      });
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load schedule.");
    } finally {
      setLoading(false);
    }
  }, [locationFilter, organizationId, range.end, range.start]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setRange(rangeForView(anchorDate, viewMode));
  }, [anchorDate, viewMode]);

  const myAssignments = useMemo(
    () => (data?.assignments ?? []).filter((row) => row.is_mine),
    [data?.assignments],
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile?.primary_role} />
        <main className="min-w-0 flex-1 bg-gray-100 text-gray-900">
          <div className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8">
            <PlannerTopBar
              title="My Schedule"
              subtitle="View where everyone is working."
              rangeStart={range.start}
              rangeEnd={range.end}
              viewMode={viewMode}
              locationFilter={locationFilter}
              locations={(data?.locations ?? []).map((l) => ({ id: l.id, name: l.name }))}
              onRangeStartChange={(v) => {
                setAnchorDate(v);
                setRange((r) => ({ ...r, start: v }));
              }}
              onRangeEndChange={(v) => setRange((r) => ({ ...r, end: v }))}
              onViewModeChange={(mode) => {
                setViewMode(mode);
                setRange(rangeForView(anchorDate, mode));
              }}
              onLocationFilterChange={setLocationFilter}
            />

            <div className="mb-4 flex flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <span className="font-medium">Team / department</span>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500"
                >
                  <option value="all">All</option>
                  {(data?.locations ?? [])
                    .filter((loc) => loc.type === "department" || loc.type === "team")
                    .map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                </select>
              </label>
            </div>

            {error ? (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            ) : null}

            {myAssignments.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-orange-300 bg-orange-50 px-4 py-3">
                <p className="text-sm font-semibold text-orange-800">Your assignments this period</p>
                <ul className="mt-2 space-y-1 text-sm text-gray-800">
                  {myAssignments.map((row) => (
                    <li key={row.assignment.id}>
                      <span className="font-medium">{row.location_name}</span> · {row.role_name ?? "Role"} ·{" "}
                      {formatDayLabel(row.assignment.start_date)} – {formatTimeRange(row.assignment.start_time, row.assignment.end_time)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <StatusAlertBanner events={data?.status_events ?? []} />

            {loading || !data ? (
              <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center text-gray-500">Loading schedule…</div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="sticky left-0 min-w-[180px] bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase text-gray-500">Location</th>
                      {days.map((day) => (
                        <th key={day} className="min-w-[110px] px-2 py-3 text-center text-xs font-semibold text-gray-700">{formatDayLabel(day)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleLocations.map((location) => {
                      const closed = location.status === "closed";
                      return (
                        <tr key={location.id} className="border-b border-gray-100">
                          <td className={["sticky left-0 px-3 py-3", closed ? "bg-gray-900 text-orange-300" : "bg-gray-50"].join(" ")}>
                            <p className="font-semibold">{location.name}</p>
                            <span className="text-[11px] uppercase">{location.status}</span>
                          </td>
                          {days.map((day) => {
                            const cellAssignments = data.assignments.filter(
                              (row) =>
                                row.assignment.location_id === location.id &&
                                assignmentOnDay(row.assignment.start_date, row.assignment.end_date, day),
                            );
                            return (
                              <td key={day} className={["align-top border-l border-gray-200 p-1.5", closed ? "bg-gray-900/80" : "bg-white"].join(" ")}>
                                {cellAssignments.map((row) => {
                                  const isMine = row.employee_id === viewerId || row.is_mine;
                                  return (
                                    <div
                                      key={row.assignment.id}
                                      className={[
                                        "mb-1 rounded-lg border px-2 py-1 text-[10px]",
                                        isMine
                                          ? "border-orange-400 bg-orange-100 font-semibold text-orange-950"
                                          : "border-gray-200 bg-gray-50 text-gray-600",
                                      ].join(" ")}
                                    >
                                      <p>{row.employee_name}</p>
                                      <p>{row.role_name ?? "Temporary role"}</p>
                                      <p>{formatTimeRange(row.assignment.start_time, row.assignment.end_time)}</p>
                                    </div>
                                  );
                                })}
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
