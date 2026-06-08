import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type {
  AdminAssignmentRow,
  AssignmentInput,
  AssignmentStatus,
  CompanyLocation,
  CompanyRole,
  ConflictResult,
  PlannerEmployee,
} from "../../types";

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500";

type Props = {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  employees: PlannerEmployee[];
  locations: CompanyLocation[];
  roles: CompanyRole[];
  initial?: AdminAssignmentRow | null;
  defaultDate?: string;
  defaultLocationId?: string | null;
  conflicts?: ConflictResult | null;
  saving?: boolean;
  onSave: (input: AssignmentInput, assignmentId?: string) => Promise<void>;
  onDelete?: (assignmentId: string) => Promise<void>;
  onCheckConflicts?: (draft: AssignmentInput, assignmentId?: string) => Promise<void>;
};

export default function AssignmentModal({
  open,
  onClose,
  mode,
  employees,
  locations,
  roles,
  initial,
  defaultDate = "",
  defaultLocationId,
  conflicts,
  saving,
  onSave,
  onDelete,
  onCheckConflicts,
}: Props) {
  const [employeeId, setEmployeeId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [temporaryRoleId, setTemporaryRoleId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState<AssignmentStatus>("draft");
  const [notes, setNotes] = useState("");
  const availableRoles = useMemo(
    () => roles.filter((role) => !role.location_id || role.location_id === locationId),
    [locationId, roles],
  );

  useEffect(() => {
    if (!open) return;
    const a = initial?.assignment;
    setEmployeeId(a?.employee_id ?? employees[0]?.id ?? "");
    setLocationId(a?.location_id ?? defaultLocationId ?? locations[0]?.id ?? "");
    const matchingRoles = roles.filter((role) =>
      !role.location_id || role.location_id === (a?.location_id ?? defaultLocationId ?? locations[0]?.id),
    );
    setTemporaryRoleId(a?.temporary_role_id ?? matchingRoles[0]?.id ?? "");
    setStartDate(a?.start_date ?? defaultDate);
    setStartTime(a?.start_time?.slice(0, 5) ?? "09:00");
    setEndTime(a?.end_time?.slice(0, 5) ?? "17:00");
    setStatus(a?.status ?? "draft");
    setNotes(a?.notes ?? "");
  }, [defaultDate, defaultLocationId, employees, initial, locations, open, roles]);

  useEffect(() => {
    if (!open) return;
    if (temporaryRoleId && availableRoles.some((role) => role.id === temporaryRoleId)) return;
    setTemporaryRoleId(availableRoles[0]?.id ?? "");
  }, [availableRoles, open, temporaryRoleId]);

  if (!open) return null;

  const draft: AssignmentInput = {
    employee_id: employeeId,
    location_id: locationId,
    temporary_role_id: temporaryRoleId || null,
    start_date: startDate,
    end_date: startDate,
    start_time: startTime,
    end_time: endTime,
    status,
    notes,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white text-gray-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {mode === "create" ? "New assignment" : "Edit assignment"}
          </h2>
          <button type="button" onClick={onClose} className="text-gray-700 hover:text-gray-950"><X size={20} /></button>
        </div>
        <form
          className="space-y-4 p-5"
          onSubmit={async (e) => {
            e.preventDefault();
            await onSave(draft, initial?.assignment.id);
          }}
        >
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Employee
            <select className={inputClass} value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} disabled={mode === "edit"}>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.full_name || emp.email || emp.id}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Location for this manual role
            <select className={inputClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Manual role
            <select className={inputClass} value={temporaryRoleId} onChange={(e) => setTemporaryRoleId(e.target.value)}>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Assignment date
            <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold uppercase text-gray-500">
              Shift start
              <input type="time" className={inputClass} value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="block text-xs font-semibold uppercase text-gray-500">
              Shift end
              <input type="time" className={inputClass} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </label>
          </div>
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Status
            <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus)}>
              <option value="draft">Draft</option>
              <option value="confirmed">Confirmed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Notes
            <textarea className={`${inputClass} min-h-[72px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          {conflicts && !conflicts.ok ? (
            <div className="rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 text-sm text-orange-900">
              <p className="font-semibold">Conflicts detected</p>
              <ul className="mt-1 list-disc pl-4 text-xs">
                {conflicts.conflicts.map((c) => (
                  <li key={c.code}>{c.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap justify-between gap-2">
            {mode === "edit" && onDelete && initial ? (
              <button
                type="button"
                className="rounded-xl border border-red-200 px-4 py-2 text-sm text-red-600"
                onClick={() => void onDelete(initial.assignment.id)}
              >
                Delete
              </button>
            ) : <span />}
            <div className="flex gap-2">
              {onCheckConflicts ? (
                <button
                  type="button"
                  className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:border-orange-400"
                  onClick={() => void onCheckConflicts(draft, initial?.assignment.id)}
                >
                  Check conflicts
                </button>
              ) : null}
              <button type="button" onClick={onClose} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-900 hover:border-orange-400">Cancel</button>
              <button type="submit" disabled={saving} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
