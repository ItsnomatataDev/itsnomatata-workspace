import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, X } from "lucide-react";
import {
  DEFAULT_ASSIGNMENT_END_TIME,
  DEFAULT_ASSIGNMENT_START_TIME,
  PERMANENT_SLOT_END_DATE,
  PERMANENT_SLOT_START_DATE,
} from "../../constants";
import type { CompanyLocation, CompanyRole, CreateSlotInput, SlotPriority } from "../../types";

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500";

type Props = {
  open: boolean;
  onClose: () => void;
  locations: CompanyLocation[];
  roles: CompanyRole[];
  defaultLocationId?: string;
  saving?: boolean;
  onSave: (input: CreateSlotInput) => Promise<void>;
};

export default function CreateSlotModal({
  open,
  onClose,
  locations,
  roles,
  defaultLocationId,
  saving,
  onSave,
}: Props) {
  const activeRoles = useMemo(
    () => roles.filter((role) => role.is_active && role.location_id),
    [roles],
  );
  const [locationId, setLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [temporaryRoleId, setTemporaryRoleId] = useState(activeRoles[0]?.id ?? "");
  const [requiredCount, setRequiredCount] = useState(1);
  const [notes, setNotes] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [priority, setPriority] = useState<SlotPriority>("normal");

  useEffect(() => {
    if (!open) return;
    setLocationId(defaultLocationId ?? locations[0]?.id ?? "");
    setTemporaryRoleId(activeRoles[0]?.id ?? "");
    setTitle("");
    setRequiredSkills("");
  }, [activeRoles, defaultLocationId, locations, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white text-gray-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Add Headcount Requirement</h2>
          <button type="button" onClick={onClose} className="text-gray-700 hover:text-gray-950">
            <X size={20} />
          </button>
        </div>
        <form
          className="space-y-4 p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const selectedRole = activeRoles.find((role) => role.id === temporaryRoleId);
            if (!selectedRole) return;
            const selectedRoleSkills = [
              ...(selectedRole.required_skills ?? []),
              ...requiredSkills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            ].filter((skill, index, all) => all.indexOf(skill) === index);

            await onSave({
              location_id: selectedRole.location_id ?? locationId,
              title: title.trim() || selectedRole.name,
              temporary_role_id: selectedRole.id,
              required_count: Math.max(1, requiredCount),
              start_date: PERMANENT_SLOT_START_DATE,
              end_date: PERMANENT_SLOT_END_DATE,
              start_time: DEFAULT_ASSIGNMENT_START_TIME,
              end_time: DEFAULT_ASSIGNMENT_END_TIME,
              notes,
              required_skills: selectedRoleSkills,
              priority,
            });
          }}
        >
          {activeRoles.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <BriefcaseBusiness size={18} className="mb-2" />
              Create at least one permanent role linked to a location in Manage Roles first.
            </div>
          ) : (
            <label className="block text-xs font-semibold uppercase text-gray-500">
              Permanent role
              <select
                className={inputClass}
                value={temporaryRoleId}
                onChange={(e) => {
                  const roleId = e.target.value;
                  setTemporaryRoleId(roleId);
                  const role = activeRoles.find((item) => item.id === roleId);
                  if (role?.location_id) setLocationId(role.location_id);
                }}
                required
              >
                {activeRoles.map((role) => {
                  const locationName =
                    locations.find((loc) => loc.id === role.location_id)?.name ??
                    "No location";
                  return (
                    <option key={role.id} value={role.id}>
                      {role.name} · {locationName}
                    </option>
                  );
                })}
              </select>
            </label>
          )}
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Display title optional
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to the selected role name"
            />
          </label>
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Employees needed
            <input type="number" min={1} className={inputClass} value={requiredCount} onChange={(e) => setRequiredCount(Number(e.target.value))} />
          </label>
          <p className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
            Roles stay linked to their location permanently. Employee assignments are planned per day
            ({DEFAULT_ASSIGNMENT_START_TIME}–{DEFAULT_ASSIGNMENT_END_TIME}) from the planner date picker.
          </p>
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Extra required skills
            <input className={inputClass} value={requiredSkills} onChange={(e) => setRequiredSkills(e.target.value)} placeholder="Comma-separated" />
          </label>
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Priority
            <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as SlotPriority)}>
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Notes
            <textarea className={`${inputClass} min-h-[80px]`} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600">Cancel</button>
            <button type="submit" disabled={saving || activeRoles.length === 0} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
              {saving ? "Saving…" : "Save requirement"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
