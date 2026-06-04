import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import Sidebar from "../../components/dashboard/components/Sidebar";
import { useAuth } from "../../app/providers/AuthProvider";
import { EDITOR_ROLES } from "./constants";
import PlannerTopBar from "./components/PlannerTopBar";
import PlannerWeekCalendar from "./components/PlannerWeekCalendar";
import StatusAlertBanner from "./components/StatusAlertBanner";
import AssignmentCalendarCard from "./components/AssignmentCalendarCard";
import CreateSlotModal from "./components/modals/CreateSlotModal";
import AssignmentModal from "./components/modals/AssignmentModal";
import ManageLocationsModal from "./components/modals/ManageLocationsModal";
import ManageRolesModal from "./components/modals/ManageRolesModal";
import type {
  AdminAssignmentRow,
  AdminPlannerCalendar,
  AssignmentInput,
  CalendarViewMode,
  CompanyLocation,
  CompanyRole,
  ConflictResult,
} from "./types";
import {
  assignEmployeeToSlot,
  createAssignmentSlot,
  createLocationStatusEvent,
  deleteAssignment,
  detectAssignmentConflicts,
  getAdminPlannerCalendar,
  moveAssignment,
  updateAssignment,
  upsertCompanyLocation,
  upsertCompanyRole,
} from "./services/locationPlannerService";
import {
  buildDayRange,
  defaultWeekRange,
  rangeForView,
} from "./utils/calendarDates";

export default function LocationPlannerAdminPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;
  const canEdit = EDITOR_ROLES.has(String(profile?.primary_role ?? ""));

  const [viewMode, setViewMode] = useState<CalendarViewMode>("week");
  const [anchorDate, setAnchorDate] = useState(defaultWeekRange().start);
  const [range, setRange] = useState(defaultWeekRange());
  const [locationFilter, setLocationFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [data, setData] = useState<AdminPlannerCalendar | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<ConflictResult | null>(null);

  const [createSlotOpen, setCreateSlotOpen] = useState(false);
  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [assignmentModalMode, setAssignmentModalMode] = useState<"create" | "edit">("edit");
  const [locationsOpen, setLocationsOpen] = useState(false);
  const [rolesOpen, setRolesOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const days = useMemo(() => buildDayRange(range.start, range.end), [range]);

  const selectedRow = useMemo(
    () => data?.assignments.find((r) => r.assignment.id === selectedAssignmentId) ?? null,
    [data?.assignments, selectedAssignmentId],
  );

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      const next = await getAdminPlannerCalendar({
        organizationId,
        startDate: range.start,
        endDate: range.end,
        locationId: locationFilter === "all" ? null : locationFilter,
        roleId: roleFilter === "all" ? null : roleFilter,
        employeeId: employeeFilter === "all" ? null : employeeFilter,
      });
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load planner.");
    } finally {
      setLoading(false);
    }
  }, [employeeFilter, locationFilter, organizationId, range.end, range.start, roleFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setRange(rangeForView(anchorDate, viewMode));
  }, [anchorDate, viewMode]);

  const handleDragEnd = async (event: DragEndEvent) => {
    if (!canEdit || !organizationId) return;
    const assignmentId = String(event.active.data.current?.assignmentId ?? "");
    const over = event.over?.data.current;
    if (!assignmentId || !over || over.type !== "cell") return;

    try {
      setSaving(true);
      await moveAssignment({
        organizationId,
        assignmentId,
        input: {
          location_id: String(over.locationId),
          start_date: String(over.dayKey),
          end_date: String(over.dayKey),
        },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move assignment.");
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

  const handleCheckConflicts = async (draft: AssignmentInput, assignmentId?: string) => {
    if (!organizationId) return;
    const result = await detectAssignmentConflicts({
      organizationId,
      employeeId: draft.employee_id,
      locationId: draft.location_id ?? data?.locations[0]?.id ?? "",
      slotId: draft.slot_id,
      startDate: draft.start_date ?? range.start,
      endDate: draft.end_date ?? range.end,
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

  const dragRow = selectedRow;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile?.primary_role} />
        <main className="min-w-0 flex-1 bg-gray-100 text-gray-900">
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
              <PlannerTopBar
                title="Location Planner"
                subtitle="Move employees across locations, roles, and dates."
                rangeStart={range.start}
                rangeEnd={range.end}
                viewMode={viewMode}
                locationFilter={locationFilter}
                roleFilter={roleFilter}
                employeeFilter={employeeFilter}
                locations={(data?.locations ?? []).map((l) => ({ id: l.id, name: l.name }))}
                roles={(data?.roles ?? []).map((r) => ({ id: r.id, name: r.name }))}
                employees={(data?.employees ?? []).map((e) => ({
                  id: e.id,
                  name: e.full_name || e.email || "Employee",
                }))}
                showAdminActions={canEdit}
                onRangeStartChange={(v) => setRange((r) => ({ ...r, start: v }))}
                onRangeEndChange={(v) => setRange((r) => ({ ...r, end: v }))}
                onViewModeChange={setViewMode}
                onLocationFilterChange={setLocationFilter}
                onRoleFilterChange={setRoleFilter}
                onEmployeeFilterChange={setEmployeeFilter}
                onCreateSlot={() => canEdit && setCreateSlotOpen(true)}
                onManageLocations={() => canEdit && setLocationsOpen(true)}
                onManageRoles={() => canEdit && setRolesOpen(true)}
              />

              {canEdit && data && data.locations.length > 0 ? (
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedAssignmentId(null);
                      setAssignmentModalMode("create");
                      setAssignmentModalOpen(true);
                    }}
                    className="rounded-xl border border-orange-400 bg-white px-4 py-2 text-sm font-semibold text-orange-600 hover:bg-orange-50"
                  >
                    Assign employee
                  </button>
                </div>
              ) : null}

              {!canEdit ? (
                <p className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
                  View-only. Admins can create slots and move assignments on the calendar.
                </p>
              ) : null}

              {error ? (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
              ) : null}

              <StatusAlertBanner events={data?.status_events ?? []} />

              {loading || !data ? (
                <div className="rounded-2xl border border-gray-200 bg-white px-6 py-16 text-center text-gray-500">
                  Loading calendar…
                </div>
              ) : data.locations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
                  <p className="text-lg font-semibold">No locations yet</p>
                  <p className="mt-2 text-sm text-gray-600">Add your first location to start planning.</p>
                  {canEdit ? (
                    <button type="button" onClick={() => setLocationsOpen(true)} className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white">
                      Manage Locations
                    </button>
                  ) : null}
                </div>
              ) : (
                <PlannerWeekCalendar
                  days={days}
                  locations={data.locations}
                  assignments={data.assignments}
                  slots={data.slots}
                  statusEvents={data.status_events}
                  selectedAssignmentId={selectedAssignmentId}
                  canEdit={canEdit}
                  onSelectAssignment={(id) => {
                    setSelectedAssignmentId(id);
                    setAssignmentModalMode("edit");
                    setAssignmentModalOpen(true);
                  }}
                />
              )}

              {saving ? <p className="mt-3 text-xs text-gray-500">Saving changes…</p> : null}
            </div>

            <DragOverlay>
              {dragRow ? (
                <div className="w-56 rounded-lg border-2 border-orange-500 bg-white p-2 shadow-lg">
                  <AssignmentCalendarCard row={dragRow} />
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
            onClose={() => setCreateSlotOpen(false)}
            locations={data.locations}
            roles={data.roles}
            defaultStart={range.start}
            defaultEnd={range.end}
            saving={saving}
            onSave={async (input) => {
              await createAssignmentSlot({ organizationId, input });
              setCreateSlotOpen(false);
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
