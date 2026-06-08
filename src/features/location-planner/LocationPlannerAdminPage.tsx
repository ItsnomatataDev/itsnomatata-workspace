import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { CalendarDays, MapPin, Plus, Settings2, UserPlus } from "lucide-react";
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
import { Briefcase, ChevronLeft, ChevronRight, Users } from "lucide-react";
function normalizePlannerTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "";
}

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
    officeCapabilities.locationPlanner &&
    EDITOR_ROLES.has(String(profile?.primary_role ?? ""));
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
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<
    string | null
  >(null);
  const [activeDrag, setActiveDrag] = useState<{
    type: "assignment" | "employee";
    id: string;
  } | null>(null);
  const [conflicts, setConflicts] = useState<ConflictResult | null>(null);

  const [createSlotOpen, setCreateSlotOpen] = useState(false);
  const [createSlotLocationId, setCreateSlotLocationId] = useState<
    string | undefined
  >();
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentModalMode, setAssignmentModalMode] = useState<
    "create" | "edit"
  >("edit");
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const range = useMemo(() => {
    const weekStart = startOfWeekDateKey(selectedDate);
    return { start: weekStart, end: addDays(weekStart, 6) };
  }, [selectedDate]);

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
    () =>
      data?.assignments.find((r) => r.assignment.id === selectedAssignmentId) ??
      null,
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
    () =>
      new Map(assignmentCards.map((assignment) => [assignment.id, assignment])),
    [assignmentCards],
  );

  const employeesById = useMemo(
    () =>
      new Map(
        (data?.employees ?? []).map((employee) => [employee.id, employee]),
      ),
    [data?.employees],
  );

  const workStreams = useMemo<PlannerWorkStream[]>(() => {
    const slots = data?.slots ?? [];
    const streamKey = (input: {
      locationId: string | null;
      temporaryRoleId?: string | null;
      roleName?: string | null;
      startDate: string;
      endDate: string;
      startTime?: string | null;
      endTime?: string | null;
    }) =>
      [
        input.locationId ?? "",
        input.temporaryRoleId ?? input.roleName ?? "General",
        input.startDate,
        input.endDate,
        input.startTime ?? "",
        input.endTime ?? "",
      ].join(":");
    const assignmentMatchesSlot = (
      assignment: PlannerAssignmentCardModel,
      slot: AdminPlannerCalendar["slots"][number],
    ) =>
      !assignment.slotId &&
      assignment.locationId === slot.location_id &&
      assignment.temporaryRoleId === slot.temporary_role_id &&
      assignmentOnDay(assignment.startDate, assignment.endDate, selectedDate) &&
      assignmentOnDay(slot.start_date, slot.end_date, selectedDate) &&
      normalizePlannerTime(assignment.startTime) ===
        normalizePlannerTime(slot.start_time) &&
      normalizePlannerTime(assignment.endTime) ===
        normalizePlannerTime(slot.end_time);

    const slotStreams = slots
      .filter(
        (slot) =>
          slot.status === "open" &&
          assignmentOnDay(slot.start_date, slot.end_date, selectedDate),
      )
      .map((slot) => {
        const location = data?.locations.find(
          (item) => item.id === slot.location_id,
        );
        const role = data?.roles.find(
          (item) => item.id === slot.temporary_role_id,
        );
        const matchingLooseAssignments = assignmentCards.filter((assignment) =>
          assignmentMatchesSlot(assignment, slot),
        );
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
          assignments: [
            ...assignmentCards.filter(
              (assignment) => assignment.slotId === slot.id,
            ),
            ...matchingLooseAssignments,
          ],
        };
      });

    const permanentRoleStreams = (data?.roles ?? [])
      .filter((role) => role.is_active && role.location_id)
      .map((role) => {
        const location = data?.locations.find(
          (item) => item.id === role.location_id,
        );
        return {
          id: `role-${role.id}-${role.location_id}`,
          title: role.name,
          subtitle: `${location?.name ?? "No location"} · permanent role`,
          locationId: role.location_id,
          slotId: null,
          temporaryRoleId: role.id,
          startDate: selectedDate,
          endDate: selectedDate,
          startTime: null,
          endTime: null,
          requiredCount: null,
          assignments: assignmentCards.filter(
            (assignment) =>
              !assignment.slotId &&
              assignment.locationId === role.location_id &&
              assignment.temporaryRoleId === role.id &&
              assignmentOnDay(
                assignment.startDate,
                assignment.endDate,
                selectedDate,
              ),
          ),
        };
      });

    const streamAssignmentIds = new Set(
      [...slotStreams, ...permanentRoleStreams].flatMap((stream) =>
        stream.assignments.map((assignment) => assignment.id),
      ),
    );
    const ungrouped = assignmentCards.filter(
      (assignment) => !streamAssignmentIds.has(assignment.id),
    );
    const roleStreams = Array.from(
      ungrouped.reduce<Map<string, PlannerAssignmentCardModel[]>>(
        (acc, assignment) => {
          const key = streamKey(assignment);
          acc.set(key, [...(acc.get(key) ?? []), assignment]);
          return acc;
        },
        new Map(),
      ),
    ).map(([key, assignments]) => ({
      id: `role-${key}`,
      title: assignments[0]?.roleName ?? "General Work",
      subtitle: "Assignments without a linked permanent role",
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

    return [...slotStreams, ...permanentRoleStreams, ...roleStreams];
  }, [
    assignmentCards,
    data?.locations,
    data?.roles,
    data?.slots,
    selectedDate,
  ]);

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
        slots: workStreams.filter(
          (stream) => stream.locationId === location.id,
        ),
      })),
    [assignmentCards, data?.locations, workStreams],
  );

  const unassignedEmployees = useMemo<PlannerEmployeeCardModel[]>(() => {
    const assignedIds = new Set(
      assignmentCards.map((assignment) => assignment.employeeId),
    );
    const availabilityByEmployee = new Map<string, PlannerAvailability>();
    (data?.availability ?? [])
      .filter((item) =>
        assignmentOnDay(item.start_date, item.end_date, selectedDate),
      )
      .forEach((item) => {
        const current = availabilityByEmployee.get(item.user_id);
        if (
          !current ||
          item.kind === "leave" ||
          item.start_date < current.start_date
        ) {
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
          availabilityLabel: availability
            ? formatAvailabilitySummary(availability)
            : null,
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
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(range.start, index);
        const count = (data?.assignments ?? []).filter((row) =>
          assignmentOnDay(
            row.assignment.start_date,
            row.assignment.end_date,
            date,
          ),
        ).length;

        return {
          date,
          count,
          label: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
            weekday: "short",
          }),
          day: new Date(`${date}T00:00:00`).getDate(),
        };
      }),
    [data?.assignments, range.start],
  );

  const openSlotsToday = useMemo(
    () =>
      (data?.slots ?? []).filter(
        (slot) =>
          slot.status === "open" &&
          assignmentOnDay(slot.start_date, slot.end_date, selectedDate),
      ),
    [data?.slots, selectedDate],
  );

  const activeLocationsCount = useMemo(
    () =>
      (data?.locations ?? []).filter((location) => location.status !== "closed")
        .length,
    [data?.locations],
  );
  const activeAssignment =
    activeDrag?.type === "assignment"
      ? assignmentsById.get(activeDrag.id)
      : null;
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
        setError(
          err instanceof Error ? err.message : "Failed to remove assignment.",
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    if (overType !== "stream" && overType !== "location") return;

    const targetStream = over.streamId
      ? (workStreams.find((stream) => stream.id === String(over.streamId)) ??
        null)
      : null;
    const targetSlotId = over.slotId
      ? String(over.slotId)
      : (targetStream?.slotId ?? null);
    const targetSlot = targetSlotId
      ? (data?.slots.find((slot) => slot.id === targetSlotId) ?? null)
      : null;

    const input = {
      location_id: String(
        targetSlot?.location_id ??
          targetStream?.locationId ??
          over.locationId ??
          "",
      ),
      slot_id: targetSlot?.id ?? targetStream?.slotId ?? null,
      temporary_role_id:
        targetSlot?.temporary_role_id ??
        targetStream?.temporaryRoleId ??
        (over.temporaryRoleId ? String(over.temporaryRoleId) : null),
      start_date: selectedDate,
      end_date: selectedDate,
      start_time:
        targetSlot?.start_time ??
        targetStream?.startTime ??
        (over.startTime ? String(over.startTime) : null),
      end_time:
        targetSlot?.end_time ??
        targetStream?.endTime ??
        (over.endTime ? String(over.endTime) : null),
    };

    if (!input.location_id) return;

    try {
      setSaving(true);
      if (active.type === "assignment") {
        await updateAssignment({
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
      setError(
        err instanceof Error ? err.message : "Failed to save assignment.",
      );
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
    restriction?: {
      title: string;
      start_date: string;
      end_date: string;
      reason?: string;
    },
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
      setError(
        err instanceof Error ? err.message : "Failed to delete location.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSaveRole = async (
    role: Partial<CompanyRole> & { name: string },
  ) => {
    if (!organizationId) return;
    setSaving(true);
    try {
      await upsertCompanyRole({ ...role, organization_id: organizationId });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const handleCheckConflicts = async (
    draft: AssignmentInput,
    assignmentId?: string,
  ) => {
    if (!organizationId) return;
    const result = await detectAssignmentConflicts({
      organizationId,
      employeeId: draft.employee_id,
      locationId: draft.location_id ?? data?.locations[0]?.id ?? "",
      slotId: draft.slot_id,
      startDate: draft.start_date ?? selectedDate,
      endDate: draft.start_date ?? selectedDate,
      startTime: draft.start_time,
      endTime: draft.end_time,
      excludeAssignmentId: assignmentId,
    });
    setConflicts(result);
  };

  const handleSaveAssignment = async (
    draft: AssignmentInput,
    assignmentId?: string,
  ) => {
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
            end_date: draft.start_date,
            start_time: draft.start_time,
            end_time: draft.end_time,
            status: draft.status,
            notes: draft.notes,
          },
        });
      } else {
        await assignEmployeeToSlot({
          organizationId,
          input: {
            ...draft,
            end_date: draft.start_date,
          },
        });
      }
      setAssignmentModalOpen(false);
      setConflicts(null);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save assignment.",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSlot = async (slotId: string) => {
    if (!organizationId || !slotId) return;
    const confirmed = window.confirm(
      "Delete this shift requirement? Existing assignments will stay on the location but will no longer belong to this requirement.",
    );
    if (!confirmed) return;

    setSaving(true);
    try {
      await deleteAssignmentSlot({ organizationId, slotId });
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete shift requirement.",
      );
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
      setError(
        err instanceof Error ? err.message : "Failed to add weekly off day.",
      );
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
      setError(
        err instanceof Error ? err.message : "Failed to remove off day.",
      );
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
      setError(
        err instanceof Error ? err.message : "Failed to remove weekly off day.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!canUsePlanner) {
    return (
      <main className="min-h-screen bg-[#050505] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-4xl border border-white/10 bg-white/4 p-8 shadow-2xl shadow-black/40">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-orange-400">
            Scheduling
          </p>
          <h1 className="mt-3 text-3xl font-bold text-white">
            Workforce Planner is not available here
          </h1>
          <p className="mt-2 text-sm text-white/50">
            Your organization does not currently have access to workforce
            scheduling.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile?.primary_role} />
        <main className="min-w-0 flex-1 bg-black text-white">
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="mx-auto max-w-450 px-4 py-6 sm:px-6 lg:px-8">
              <header className="mb-6 rounded-3xl border border-white/10 bg-white/6 p-5 shadow-2xl shadow-black/30">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-orange-300">
                      Scheduling
                    </p>
                    <h1 className="mt-2 text-3xl font-bold text-white">
                      Workforce Planner
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm text-white/50">
                      Plan daily shift requirements by location, then assign
                      available employees into the right roles.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={locationFilter}
                      onChange={(event) =>
                        setLocationFilter(event.target.value)
                      }
                      className="rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                    >
                      <option value="all">All locations</option>
                      {(data?.locations ?? []).map((location) => (
                        <option key={location.id} value={location.id}>
                          {location.name}
                        </option>
                      ))}
                    </select>
                    <div className="inline-flex overflow-hidden rounded-xl border border-white/10 bg-neutral-950">
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDate((date) => addDays(date, -1))
                        }
                        className="px-3 py-2 text-sm font-semibold text-white/65 hover:bg-white/10"
                      >
                        Prev
                      </button>
                      <input
                        type="date"
                        value={selectedDate}
                        onChange={(event) =>
                          setSelectedDate(event.target.value)
                        }
                        className="border-x border-white/10 bg-transparent px-3 py-2 text-sm text-white outline-none focus:bg-orange-500/10"
                      />
                      <button
                        type="button"
                        onClick={() => setSelectedDate(getHarareDateKey())}
                        className="px-3 py-2 text-sm font-semibold text-orange-200 hover:bg-orange-500/10"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedDate((date) => addDays(date, 1))
                        }
                        className="border-l border-white/10 px-3 py-2 text-sm font-semibold text-white/65 hover:bg-white/10"
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
                          ? "border-orange-400 bg-orange-500/15 text-orange-100"
                          : "border-white/10 bg-neutral-950 text-white/70",
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
                          Shift Requirement
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedAssignmentId(null);
                            setConflicts(null);
                            setAssignmentModalMode("create");
                            setAssignmentModalOpen(true);
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-orange-300/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-100 hover:bg-orange-500/15"
                        >
                          <UserPlus size={16} />
                          Manual Assignment
                        </button>
                        <button
                          type="button"
                          onClick={() => setLocationsOpen(true)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white/70 hover:border-orange-300"
                        >
                          <MapPin size={16} />
                          Locations
                        </button>
                        <button
                          type="button"
                          onClick={() => setRolesOpen(true)}
                          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white/70 hover:border-orange-300"
                        >
                          <Settings2 size={16} />
                          Roles
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </header>

              {!canEdit ? (
                <p className="mb-4 rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm text-white/60">
                  View-only. Scheduling admins can drag employees and
                  assignments across the planner.
                </p>
              ) : null}

              {error ? (
                <p className="mb-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {error}
                </p>
              ) : null}

              {unavailableToday.length > 0 ? (
                <div className="mb-4 rounded-2xl border border-sky-300/25 bg-sky-500/10 px-4 py-3">
                  <p className="text-sm font-semibold text-sky-100">
                    {unavailableToday.length} employee
                    {unavailableToday.length === 1 ? "" : "s"} unavailable today
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {unavailableToday.map((item) => (
                      <span
                        key={`${item.kind}-${item.id}`}
                        className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-sky-100 shadow-sm"
                      >
                        {item.employee_name ||
                          item.employee_email ||
                          "Employee"}{" "}
                        · {formatAvailabilitySummary(item)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <StatusAlertBanner events={data?.status_events ?? []} />

              {loading || !data ? (
                <div className="rounded-2xl border border-white/10 bg-white/6 px-6 py-16 text-center text-white/45">
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
                      <div className="mb-4 rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                        <p className="text-sm font-semibold text-white">
                          Locations and shift requirements
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          Create daily requirements inside locations, then drag
                          available employees into each role.
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
                      description="Available employees are ready to assign. Off-day and leave employees are grouped below."
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

              {saving ? (
                <p className="mt-3 text-xs text-white/45">Saving changes...</p>
              ) : null}
            </div>

            <DragOverlay>
              {activeAssignment ? (
                <div className="w-64">
                  <SimpleAssignmentCard
                    assignment={activeAssignment}
                    tone="light"
                  />
                </div>
              ) : activeEmployee ? (
                <div className="w-64 rounded-2xl border border-orange-300 bg-white p-4 text-gray-950 shadow-lg">
                  <p className="font-semibold">
                    {activeEmployee.full_name ||
                      activeEmployee.email ||
                      "Employee"}
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
            defaultDate={selectedDate}
            defaultLocationId={locationFilter === "all" ? null : locationFilter}
            conflicts={conflicts}
            saving={saving}
            onCheckConflicts={handleCheckConflicts}
            onSave={handleSaveAssignment}
            onDelete={
              selectedRow
                ? async (id) => {
                    await deleteAssignment({
                      organizationId,
                      assignmentId: id,
                    });
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
            locations={data.locations}
            slots={data.slots}
            onSave={handleSaveRole}
          />
        </>
      ) : null}
    </div>
  );
}
