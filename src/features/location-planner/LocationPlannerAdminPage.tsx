import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import Sidebar from "../../components/dashboard/components/Sidebar";
import { useAuth } from "../../app/providers/AuthProvider";
import { EDITOR_ROLES } from "./constants";
import StatusAlertBanner from "./components/StatusAlertBanner";
import LocationsBoard from "./components/LocationsBoard";
import UnassignedEmployeesBoard from "./components/UnassignedEmployeesBoard";
import AssignmentDatePanel from "./components/AssignmentDatePanel";
import SimpleAssignmentCard from "./components/SimpleAssignmentCard";
import CreateSlotModal from "./components/modals/CreateSlotModal";
import AssignmentModal from "./components/modals/AssignmentModal";
import ManageLocationsModal from "./components/modals/ManageLocationsModal";
import ManageRolesModal from "./components/modals/ManageRolesModal";
import TlbOffDaysPanel from "./components/TlbOffDaysPanel";
import { getOfficeCapabilities } from "../../lib/offices";
import type {
  AdminAssignmentRow,
  AdminPlannerCalendar,
  AssignmentInput,
  CompanyLocation,
  CompanyRole,
  ConflictResult,
  PlannerAvailability,
  TlbEmployeeOffDay,
} from "./types";
import type {
  PlannerAssignmentCardModel,
  PlannerEmployeeCardModel,
  PlannerLocationColumn,
  PlannerWorkStream,
} from "./components/plannerBoardTypes";
import {
  assignEmployeeToSlot,
  createTlbEmployeeOffDay,
  createTlbEmployeeWeeklyOffDay,
  createAssignmentSlot,
  createLocationStatusEvent,
  deleteAssignment,
  deleteAssignmentSlot,
  deleteCompanyLocation,
  deleteTlbEmployeeOffDay,
  deleteTlbEmployeeWeeklyOffDay,
  detectAssignmentConflicts,
  getAdminPlannerCalendar,
  listTlbEmployeeOffDayHistory,
  moveAssignment,
  updateAssignment,
  upsertCompanyLocation,
  upsertCompanyRole,
} from "./services/locationPlannerService";
import {
  addDays,
  assignmentOnDay,
  getHarareDateKey,
  startOfWeekDateKey,
} from "./utils/calendarDates";
import { formatAvailabilitySummary } from "./utils/availabilityLabels";

function mapAssignment(row: AdminAssignmentRow): PlannerAssignmentCardModel {
  return {
    id: row.assignment.id,
    employeeId: row.assignment.employee_id,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    roleName: row.role_name,
    locationName: row.location_name,
    locationId: row.assignment.location_id,
    slotId: row.assignment.slot_id,
    temporaryRoleId: row.assignment.temporary_role_id,
    startDate: row.assignment.start_date,
    endDate: row.assignment.end_date,
    startTime: row.assignment.start_time,
    endTime: row.assignment.end_time,
    status: row.assignment.status,
  };
}

export default function LocationPlannerAdminPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;
  const officeCapabilities = getOfficeCapabilities(profile?.office);
  const canEdit =
    officeCapabilities.locationPlanner && EDITOR_ROLES.has(String(profile?.primary_role ?? ""));
  const canUsePlanner = canEdit;

  const initialDate = getHarareDateKey();
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [calendarOpen, setCalendarOpen] = useState(true);
  const [locationFilter, setLocationFilter] = useState("all");
  const [data, setData] = useState<AdminPlannerCalendar | null>(null);
  const [offDayHistory, setOffDayHistory] = useState<TlbEmployeeOffDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [activeDrag, setActiveDrag] = useState<{
    type: "assignment" | "employee";
    id: string;
  } | null>(null);
  const [conflicts, setConflicts] = useState<ConflictResult | null>(null);

  const [createSlotOpen, setCreateSlotOpen] = useState(false);
  const [createSlotLocationId, setCreateSlotLocationId] = useState<string | undefined>();
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentModalMode, setAssignmentModalMode] = useState<"create" | "edit">("edit");
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const range = useMemo(
    () => {
      const weekStart = startOfWeekDateKey(selectedDate);
      return { start: weekStart, end: addDays(weekStart, 6) };
    },
    [selectedDate],
  );

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      const [next, history] = await Promise.all([
        getAdminPlannerCalendar({
          organizationId,
          startDate: range.start,
          endDate: range.end,
          locationId: locationFilter === "all" ? null : locationFilter,
        }),
        listTlbEmployeeOffDayHistory({ organizationId }),
      ]);
      setData(next);
      setOffDayHistory(history);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load planner.");
    } finally {
      setLoading(false);
    }
  }, [locationFilter, organizationId, range.end, range.start]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedRow = useMemo(
    () => data?.assignments.find((r) => r.assignment.id === selectedAssignmentId) ?? null,
    [data?.assignments, selectedAssignmentId],
  );

  const assignmentCards = useMemo(
    () =>
      (data?.assignments ?? [])
        .filter((row) =>
          assignmentOnDay(
            row.assignment.start_date,
            row.assignment.end_date,
            selectedDate,
          ),
        )
        .map(mapAssignment),
    [data?.assignments, selectedDate],
  );

  const assignmentsById = useMemo(
    () => new Map(assignmentCards.map((assignment) => [assignment.id, assignment])),
    [assignmentCards],
  );

  const employeesById = useMemo(
    () => new Map((data?.employees ?? []).map((employee) => [employee.id, employee])),
    [data?.employees],
  );

  const workStreams = useMemo<PlannerWorkStream[]>(() => {
    const slots = data?.slots ?? [];
    const slotStreams = slots
      .filter(
        (slot) =>
          slot.status === "open" &&
          assignmentOnDay(slot.start_date, slot.end_date, selectedDate),
      )
      .map((slot) => {
        const location = data?.locations.find((item) => item.id === slot.location_id);
        const role = data?.roles.find((item) => item.id === slot.temporary_role_id);
        return {
          id: `slot-${slot.id}`,
          title: slot.title,
          subtitle: `${role?.name ?? "Role"} · ${location?.name ?? "No location"} · ${slot.required_count} needed`,
          locationId: slot.location_id,
          slotId: slot.id,
          temporaryRoleId: slot.temporary_role_id,
          startDate: slot.start_date,
          endDate: slot.end_date,
          startTime: slot.start_time,
          endTime: slot.end_time,
          requiredCount: slot.required_count,
          assignments: assignmentCards.filter(
            (assignment) => assignment.slotId === slot.id,
          ),
        };
      });

    const streamAssignmentIds = new Set(
      slotStreams.flatMap((stream) =>
        stream.assignments.map((assignment) => assignment.id),
      ),
    );
    const ungrouped = assignmentCards.filter(
      (assignment) => !streamAssignmentIds.has(assignment.id),
    );
    const roleStreams = Array.from(
      ungrouped.reduce<Map<string, PlannerAssignmentCardModel[]>>((acc, assignment) => {
        const key = [
          assignment.locationId,
          assignment.temporaryRoleId ?? assignment.roleName ?? "General",
        ].join(":");
        acc.set(key, [...(acc.get(key) ?? []), assignment]);
        return acc;
      }, new Map()),
    ).map(([key, assignments]) => ({
      id: `role-${key}`,
      title: assignments[0]?.roleName ?? "General Work",
      subtitle: "Assignments without a named role slot",
      locationId: assignments[0]?.locationId ?? null,
      slotId: null,
      temporaryRoleId: assignments[0]?.temporaryRoleId ?? null,
      startDate: selectedDate,
      endDate: selectedDate,
      startTime: null,
      endTime: null,
      requiredCount: null,
      assignments,
    }));

    return [...slotStreams, ...roleStreams];
  }, [assignmentCards, data?.locations, data?.roles, data?.slots, selectedDate]);

  const locationColumns = useMemo<PlannerLocationColumn[]>(
    () =>
      (data?.locations ?? []).map((location) => ({
        id: location.id,
        name: location.name,
        status: location.status,
        capacity: location.capacity,
        assignments: assignmentCards.filter(
          (assignment) => assignment.locationId === location.id,
        ),
        slots: workStreams.filter((stream) => stream.locationId === location.id),
      })),
    [assignmentCards, data?.locations, workStreams],
  );

  const unassignedEmployees = useMemo<PlannerEmployeeCardModel[]>(() => {
    const assignedIds = new Set(assignmentCards.map((assignment) => assignment.employeeId));
    const availabilityByEmployee = new Map<string, PlannerAvailability>();
    (data?.availability ?? [])
      .filter((item) => assignmentOnDay(item.start_date, item.end_date, selectedDate))
      .forEach((item) => {
        const current = availabilityByEmployee.get(item.user_id);
        if (!current || item.kind === "leave" || item.start_date < current.start_date) {
          availabilityByEmployee.set(item.user_id, item);
        }
      });
    return (data?.employees ?? [])
      .filter((employee) => !assignedIds.has(employee.id))
      .map((employee) => {
        const availability = availabilityByEmployee.get(employee.id);
        return {
          id: employee.id,
          name: employee.full_name ?? employee.email ?? "Employee",
          email: employee.email,
          primaryRole: employee.primary_role,
          department: employee.department,
          skills: employee.skills,
          availabilityKind: availability?.kind ?? null,
          availabilityLabel: availability ? formatAvailabilitySummary(availability) : null,
        };
      });
  }, [assignmentCards, data?.availability, data?.employees, selectedDate]);

  const unavailableToday = useMemo(
    () =>
      (data?.availability ?? []).filter((item) =>
        assignmentOnDay(item.start_date, item.end_date, selectedDate),
      ),
    [data?.availability, selectedDate],
  );

  const activeAssignment =
    activeDrag?.type === "assignment" ? assignmentsById.get(activeDrag.id) : null;
  const activeEmployee =
    activeDrag?.type === "employee" ? employeesById.get(activeDrag.id) : null;

  const handleDragStart = (event: DragStartEvent) => {
    const type = event.active.data.current?.type;
    if (type === "assignment") {
      setActiveDrag({
        type,
        id: String(event.active.data.current?.assignmentId ?? ""),
      });
    }
    if (type === "employee") {
      setActiveDrag({
        type,
        id: String(event.active.data.current?.employeeId ?? ""),
      });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDrag(null);
    if (!canEdit || !organizationId) return;

    const active = event.active.data.current;
    const over = event.over?.data.current;
    if (!active || !over) return;

    const overType = String(over.type ?? "");
    if (overType === "unassign") {
      if (active.type !== "assignment") return;
      try {
        setSaving(true);
        await deleteAssignment({
          organizationId,
          assignmentId: String(active.assignmentId),
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove assignment.");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (overType !== "stream" && overType !== "location") return;

    const input = {
      location_id: String(over.locationId ?? ""),
      slot_id: over.slotId ? String(over.slotId) : null,
      temporary_role_id: over.temporaryRoleId ? String(over.temporaryRoleId) : null,
      start_date: String(over.startDate ?? selectedDate),
      end_date: String(over.endDate ?? selectedDate),
      start_time: over.startTime ? String(over.startTime) : null,
      end_time: over.endTime ? String(over.endTime) : null,
    };

    if (!input.location_id) return;

    try {
      setSaving(true);
      if (active.type === "assignment") {
        await moveAssignment({
          organizationId,
          assignmentId: String(active.assignmentId),
          input,
        });
      }

      if (active.type === "employee") {
        await assignEmployeeToSlot({
          organizationId,
          input: {
            employee_id: String(active.employeeId),
            ...input,
            status: "draft",
          },
        });
      }

      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocation = async (
    location: Partial<CompanyLocation> & {
      name: string;
      type: CompanyLocation["type"];
      status: CompanyLocation["status"];
    },
    restriction?: { title: string; start_date: string; end_date: string; reason?: string },
  ) => {
    if (!organizationId) return;
    setSaving(true);
    try {
      const saved = await upsertCompanyLocation({
        ...location,
        organization_id: organizationId,
      });
      if (restriction && saved.status !== "open") {
        await createLocationStatusEvent({
          organization_id: organizationId,
          location_id: saved.id,
          title: restriction.title,
          status: saved.status,
          start_date: restriction.start_date,
          end_date: restriction.end_date,
          reason: restriction.reason ?? null,
          created_by: auth?.user?.id ?? null,
        });
      }
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!organizationId) return;
    setSaving(true);
    try {
      await deleteCompanyLocation({ organizationId, locationId });
      setLocationsOpen(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete location.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async (role: Partial<CompanyRole> & { name: string }) => {
    if (!organizationId) return;
    setSaving(true);
    try {
      await upsertCompanyRole({ ...role, organization_id: organizationId });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleCheckConflicts = async (draft: AssignmentInput, assignmentId?: string) => {
    if (!organizationId) return;
    const result = await detectAssignmentConflicts({
      organizationId,
      employeeId: draft.employee_id,
      locationId: draft.location_id ?? data?.locations[0]?.id ?? "",
      slotId: draft.slot_id,
      startDate: draft.start_date ?? selectedDate,
      endDate: draft.end_date ?? selectedDate,
      startTime: draft.start_time,
      endTime: draft.end_time,
      excludeAssignmentId: assignmentId,
    });
    setConflicts(result);
  };

  const handleSaveAssignment = async (draft: AssignmentInput, assignmentId?: string) => {
    if (!organizationId) return;
    setSaving(true);
    try {
      if (assignmentId) {
        await updateAssignment({
          organizationId,
          assignmentId,
          input: {
            location_id: draft.location_id,
            temporary_role_id: draft.temporary_role_id,
            start_date: draft.start_date,
            end_date: draft.end_date,
            start_time: draft.start_time,
            end_time: draft.end_time,
            status: draft.status,
            notes: draft.notes,
          },
        });
      } else {
        await assignEmployeeToSlot({ organizationId, input: draft });
      }
      setAssignmentModalOpen(false);
      setConflicts(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!organizationId || !slotId) return;
    const confirmed = window.confirm(
      "Delete this role slot? Existing assignments will stay on the location but will no longer belong to this role slot.",
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteAssignmentSlot({ organizationId, slotId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete role slot.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateOffDay = async (input: {
    userId: string;
    offDate: string;
    reason?: string | null;
  }) => {
    if (!organizationId) {
      setError("Organization is not set on your profile.");
      return;
    }

    setSaving(true);
    try {
      await createTlbEmployeeOffDay({
        organizationId,
        userId: input.userId,
        offDate: input.offDate,
        reason: input.reason,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add off day.");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateWeeklyOffDay = async (input: {
    userId: string;
    startDate: string;
    reason?: string | null;
  }) => {
    if (!organizationId) {
      setError("Organization is not set on your profile.");
      return;
    }

    setSaving(true);
    try {
      await createTlbEmployeeWeeklyOffDay({
        organizationId,
        userId: input.userId,
        startDate: input.startDate,
        reason: input.reason,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add weekly off day.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOffDay = async (offDayId: string) => {
    if (!organizationId) return;
    setSaving(true);
    try {
      await deleteTlbEmployeeOffDay({ organizationId, offDayId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove off day.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWeeklyOffDay = async (ruleId: string) => {
    if (!organizationId) return;
    setSaving(true);
    try {
      await deleteTlbEmployeeWeeklyOffDay({ organizationId, ruleId });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove weekly off day.");
    } finally {
      setSaving(false);
    }
  };

  if (!canUsePlanner) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar role={profile?.primary_role} />
          <main className="flex-1 bg-gray-100 px-4 py-6 text-gray-900 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-500">
                Three Little Birds only
              </p>
              <h1 className="mt-3 text-2xl font-bold text-gray-950">Location Planner is not available here</h1>
              <p className="mt-2 text-sm text-gray-500">
                This planner is available to IT's Nomatata office admins, and it manages Three Little Birds staff availability.
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
        <main className="min-w-0 flex-1 bg-gray-100 text-gray-900">
          <DndContext
            sensors={sensors}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <header className="mb-6 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-500">
                      Admin Planner
                    </p>
                    <h1 className="mt-2 text-3xl font-bold text-gray-950">
                      Location Planner
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-gray-500">
                      Drag employees into role slots inside each location for the selected date.
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
                        onClick={() => setSelectedDate((date) => addDays(date, -1))}
                        className="px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Prev
                      </button>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(event) => setSelectedDate(event.target.value)}
                        className="border-x border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:bg-orange-50"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedDate(getHarareDateKey())}
                        className="px-3 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedDate((date) => addDays(date, 1))}
                        className="border-l border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
                      >
                        Next
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen((open) => !open)}
                      className={[
                        "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold",
                        calendarOpen
                          ? "border-orange-400 bg-orange-50 text-orange-700"
                          : "border-gray-200 bg-white text-gray-700",
                      ].join(" ")}
                    >
                      <CalendarDays size={16} />
                      Calendar
                    </button>
                    {canEdit ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setCreateSlotLocationId(undefined);
                            setCreateSlotOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600"
                        >
                          <Plus size={16} />
                          Role Slot
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocationsOpen(true)}
                          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:border-orange-200"
                        >
                          <MapPin size={16} />
                          Locations
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </header>

              {!canEdit ? (
                <p className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                  View-only. Admins can drag employees and assignments across the planner.
                </p>
              ) : null}

              {error ? (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </p>
              ) : null}

              {unavailableToday.length > 0 ? (
                <div className="mb-4 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3">
                  <p className="text-sm font-semibold text-sky-900">
                    {unavailableToday.length} TLB staff unavailable today
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {unavailableToday.map((item) => (
                      <span
                        key={`${item.kind}-${item.id}`}
                        className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-sky-700 shadow-sm"
                      >
                        {item.employee_name || item.employee_email || "Employee"} ·{" "}
                        {formatAvailabilitySummary(item)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <StatusAlertBanner events={data?.status_events ?? []} />

              {loading || !data ? (
                <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center text-gray-500">
                  Loading planner...
                </div>
              ) : (
                <>
                  <div
                    className={[
                      "mt-5 grid gap-5",
                      calendarOpen
                        ? "xl:grid-cols-[minmax(0,1fr)_360px_360px]"
                        : "xl:grid-cols-[minmax(0,1fr)_360px]",
                    ].join(" ")}
                  >
                    <section>
                      <div className="mb-4 rounded-2xl border border-gray-200 bg-white px-4 py-3">
                        <p className="text-sm font-semibold text-gray-950">
                          Locations and role slots
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          Create role slots inside locations, then drag available employees into the right role.
                        </p>
                      </div>
                      <LocationsBoard
                        locations={locationColumns}
                        selectedDate={selectedDate}
                        canEdit={canEdit}
                        selectedAssignmentId={selectedAssignmentId}
                        onCreateSlot={(locationId) => {
                          setCreateSlotLocationId(locationId);
                          setCreateSlotOpen(true);
                        }}
                        onDeleteSlot={handleDeleteSlot}
                        onSelectAssignment={(id) => {
                          setSelectedAssignmentId(id);
                          setAssignmentModalMode("edit");
                          setAssignmentModalOpen(true);
                        }}
                      />
                    </section>
                    <UnassignedEmployeesBoard
                      employees={unassignedEmployees}
                      canEdit={canEdit}
                      compact
                      title="Available employees"
                      description="Free staff are ready to drag. Off-day and leave staff are grouped below."
                    />
                    {calendarOpen ? (
                      <div className="space-y-5">
                        <AssignmentDatePanel
                          selectedDate={selectedDate}
                          assignments={assignmentCards}
                          onDateChange={setSelectedDate}
                          selectedAssignmentId={selectedAssignmentId}
                          canEdit={canEdit}
                          onSelectAssignment={(id) => {
                            setSelectedAssignmentId(id);
                            setAssignmentModalMode("edit");
                            setAssignmentModalOpen(true);
                          }}
                        />
                        <TlbOffDaysPanel
                          selectedDate={selectedDate}
                          employees={data.employees}
                          availability={data.availability ?? []}
                          offDayHistory={offDayHistory}
                          saving={saving}
                          onCreateOffDay={handleCreateOffDay}
                          onCreateWeeklyOffDay={handleCreateWeeklyOffDay}
                          onDeleteOffDay={handleDeleteOffDay}
                          onDeleteWeeklyOffDay={handleDeleteWeeklyOffDay}
                        />
                      </div>
                    ) : null}
                  </div>
                </>
              )}

              {saving ? <p className="mt-3 text-xs text-gray-500">Saving changes...</p> : null}
            </div>

            <DragOverlay>
              {activeAssignment ? (
                <div className="w-64">
                  <SimpleAssignmentCard assignment={activeAssignment} />
                </div>
              ) : activeEmployee ? (
                <div className="w-64 rounded-2xl border border-orange-300 bg-white p-4 text-gray-950 shadow-lg">
                  <p className="font-semibold">
                    {activeEmployee.full_name || activeEmployee.email || "Employee"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {activeEmployee.primary_role ?? "No role"}
                  </p>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </main>
      </div>

      {data && organizationId ? (
        <>
          <CreateSlotModal
            open={createSlotOpen}
            onClose={() => {
              setCreateSlotOpen(false);
              setCreateSlotLocationId(undefined);
            }}
            locations={data.locations}
            roles={data.roles}
            defaultLocationId={createSlotLocationId}
            defaultStart={selectedDate}
            defaultEnd={selectedDate}
            saving={saving}
            onCreateRole={async (role) =>
              upsertCompanyRole({ ...role, organization_id: organizationId })
            }
            onSave={async (input) => {
              await createAssignmentSlot({ organizationId, input });
              setCreateSlotOpen(false);
              setCreateSlotLocationId(undefined);
              await load();
            }}
          />
          <AssignmentModal
            open={assignmentModalOpen}
            mode={assignmentModalMode}
            onClose={() => {
              setAssignmentModalOpen(false);
              setConflicts(null);
            }}
            employees={data.employees}
            locations={data.locations}
            roles={data.roles}
            initial={selectedRow}
            conflicts={conflicts}
            saving={saving}
            onCheckConflicts={handleCheckConflicts}
            onSave={handleSaveAssignment}
            onDelete={
              selectedRow
                ? async (id) => {
                    await deleteAssignment({ organizationId, assignmentId: id });
                    setAssignmentModalOpen(false);
                    await load();
                  }
                : undefined
            }
          />
          <ManageLocationsModal
            open={locationsOpen}
            onClose={() => setLocationsOpen(false)}
            organizationId={organizationId}
            locations={data.locations}
            onSave={handleSaveLocation}
            onDelete={handleDeleteLocation}
          />
          <ManageRolesModal
            open={rolesOpen}
            onClose={() => setRolesOpen(false)}
            roles={data.roles}
            onSave={handleSaveRole}
          />
        </>
      ) : null}
    </div>
  );
}
