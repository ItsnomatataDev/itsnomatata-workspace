import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { CompanyLocation, CompanyRole, CreateSlotInput, SlotPriority } from "../../types";

const inputClass =
  "mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500";

type Props = {
  open: boolean;
  onClose: () => void;
  locations: CompanyLocation[];
  roles: CompanyRole[];
  defaultLocationId?: string;
  defaultStart?: string;
  defaultEnd?: string;
  saving?: boolean;
  onSave: (input: CreateSlotInput) => Promise<void>;
  onCreateRole?: (role: Partial<CompanyRole> & { name: string }) => Promise<CompanyRole>;
};

export default function CreateSlotModal({
  open,
  onClose,
  locations,
  roles,
  defaultLocationId,
  defaultStart = "",
  defaultEnd = "",
  saving,
  onSave,
  onCreateRole,
}: Props) {
  const [locationId, setLocationId] = useState(defaultLocationId ?? locations[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [temporaryRoleId, setTemporaryRoleId] = useState(roles[0]?.id ?? "");
  const [roleMode, setRoleMode] = useState<"existing" | "new">("existing");
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleCategory, setNewRoleCategory] = useState("");
  const [newRoleDescription, setNewRoleDescription] = useState("");
  const [newRoleSkills, setNewRoleSkills] = useState("");
  const [requiredCount, setRequiredCount] = useState(1);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [notes, setNotes] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [priority, setPriority] = useState<SlotPriority>("normal");

  useEffect(() => {
    if (!open) return;
    setLocationId(defaultLocationId ?? locations[0]?.id ?? "");
    setStartDate(defaultStart);
    setEndDate(defaultEnd);
    setTemporaryRoleId(roles[0]?.id ?? "");
    setRoleMode(roles.length > 0 ? "existing" : "new");
    setNewRoleName("");
    setNewRoleCategory("");
    setNewRoleDescription("");
    setNewRoleSkills("");
  }, [defaultEnd, defaultLocationId, defaultStart, locations, open, roles]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Create Role Slot</h2>
          <button type="button" onClick={onClose} className="text-gray-500">
            <X size={20} />
          </button>
        </div>
        <form
          className="space-y-4 p-5"
          onSubmit={async (event) => {
            event.preventDefault();
            let selectedRoleId = temporaryRoleId || null;
            let selectedRoleName = roles.find((role) => role.id === temporaryRoleId)?.name ?? "";
            let selectedRoleSkills = requiredSkills
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);

            if (roleMode === "new") {
              if (!onCreateRole) return;
              const createdRole = await onCreateRole({
                name: newRoleName.trim(),
                category: newRoleCategory.trim() || null,
                description: newRoleDescription.trim() || null,
                required_skills: newRoleSkills
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                is_temporary: true,
                is_active: true,
              });
              selectedRoleId = createdRole.id;
              selectedRoleName = createdRole.name;
              selectedRoleSkills = createdRole.required_skills ?? [];
            }

            await onSave({
              location_id: locationId,
              title: title.trim() || selectedRoleName || "Role slot",
              temporary_role_id: selectedRoleId,
              required_count: Math.max(1, requiredCount),
              start_date: startDate,
              end_date: endDate,
              start_time: startTime,
              end_time: endTime,
              notes,
              required_skills: selectedRoleSkills,
              priority,
            });
          }}
        >
          <label className="block text-xs font-semibold uppercase text-gray-500">
            Destination location
            <select className={inputClass} value={locationId} onChange={(e) => setLocationId(e.target.value)}>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>{loc.name}</option>
              ))}
            </select>
          </label>
          <div className="rounded-2xl border border-orange-100 bg-orange-50 p-3">
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-xl bg-white p-1">
              <button
                type="button"
                onClick={() => setRoleMode("existing")}
                disabled={roles.length === 0}
                className={[
                  "rounded-lg px-3 py-2 text-xs font-semibold",
                  roleMode === "existing" ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                Existing role
              </button>
              <button
                type="button"
                onClick={() => setRoleMode("new")}
                className={[
                  "rounded-lg px-3 py-2 text-xs font-semibold",
                  roleMode === "new" ? "bg-gray-950 text-white" : "text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                New role
              </button>
            </div>

            {roleMode === "existing" ? (
              <label className="block text-xs font-semibold uppercase text-gray-500">
                Role inside this location
                <select
                  className={inputClass}
                  value={temporaryRoleId}
                  onChange={(e) => setTemporaryRoleId(e.target.value)}
                  required
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="space-y-3">
                <label className="block text-xs font-semibold uppercase text-gray-500">
                  New role name
                  <input
                    className={inputClass}
                    value={newRoleName}
                    onChange={(e) => setNewRoleName(e.target.value)}
                    placeholder="e.g. Cashier, Kitchen, Supervisor"
                    required={roleMode === "new"}
                  />
                </label>
                <input
                  className={inputClass}
                  value={newRoleCategory}
                  onChange={(e) => setNewRoleCategory(e.target.value)}
                  placeholder="Category optional"
                />
                <input
                  className={inputClass}
                  value={newRoleSkills}
                  onChange={(e) => setNewRoleSkills(e.target.value)}
                  placeholder="Required skills, comma-separated"
                />
                <textarea
                  className={`${inputClass} min-h-[64px]`}
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  placeholder="Role description optional"
                />
              </div>
            )}
          </div>
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
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-semibold uppercase text-gray-500">
              Start date
              <input type="date" className={inputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </label>
            <label className="block text-xs font-semibold uppercase text-gray-500">
              End date
              <input type="date" className={inputClass} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </label>
          </div>
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
            <button type="submit" disabled={saving} className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60">
              {saving ? "Saving…" : "Create role slot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
