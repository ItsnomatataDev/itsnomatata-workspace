import { useEffect, useMemo, useState } from "react";
import { MapPin, Pencil, Plus, X } from "lucide-react";
import type { AssignmentSlot, CompanyLocation, CompanyRole } from "../../types";

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500";

type Props = {
  open: boolean;
  onClose: () => void;
  roles: CompanyRole[];
  locations: CompanyLocation[];
  slots: AssignmentSlot[];
  onSave: (role: Partial<CompanyRole> & { name: string }) => Promise<void>;
};

export default function ManageRolesModal({
  open,
  onClose,
  roles,
  locations,
  slots,
  onSave,
}: Props) {
  const [editing, setEditing] = useState<Partial<CompanyRole> | null>(null);
  const [skillsText, setSkillsText] = useState("");
  const locationById = useMemo(
    () => new Map(locations.map((location) => [location.id, location])),
    [locations],
  );
  const roleUsage = useMemo(() => {
    const usage = new Map<string, { locationNames: string[]; requirementCount: number }>();
    for (const role of roles) {
      if (!role.location_id) continue;
      const locationName = locationById.get(role.location_id)?.name;
      if (!locationName) continue;
      usage.set(role.id, {
        locationNames: [locationName],
        requirementCount: 0,
      });
    }
    for (const slot of slots) {
      if (!slot.temporary_role_id) continue;
      const current = usage.get(slot.temporary_role_id) ?? {
        locationNames: [],
        requirementCount: 0,
      };
      const locationName = locationById.get(slot.location_id)?.name;
      if (locationName && !current.locationNames.includes(locationName)) {
        current.locationNames.push(locationName);
      }
      current.requirementCount += 1;
      usage.set(slot.temporary_role_id, current);
    }
    return usage;
  }, [locationById, roles, slots]);

  useEffect(() => {
    if (!open) return;
    setSkillsText(editing?.required_skills?.join(", ") ?? "");
  }, [editing, open]);

  if (!open) return null;

  const form = editing ?? {
    name: "",
    category: "",
    description: "",
    location_id: locations[0]?.id ?? null,
    required_skills: [],
    is_temporary: false,
    is_active: true,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white text-gray-950 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">Manage Roles</h2>
            <p className="mt-1 text-xs text-gray-500">
              Roles are reusable. Location names below show where each role is used in shift requirements.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-700 hover:text-gray-950"><X size={20} /></button>
        </div>
        <div className="grid min-h-0 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
          <div className="border-b border-gray-200 p-4 lg:border-b-0 lg:border-r">
            <button
              type="button"
              onClick={() =>
                setEditing({
                  name: "",
                  category: "",
                  description: "",
                  location_id: locations[0]?.id ?? null,
                  required_skills: [],
                  is_temporary: false,
                  is_active: true,
                })
              }
              className="mb-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white"
            >
              <Plus size={14} className="inline" /> Add role
            </button>
            <ul className="max-h-[58vh] space-y-2 overflow-y-auto pr-1">
              {roles.map((role) => (
                <li key={role.id} className="rounded-xl border border-gray-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setEditing(role)}
                    className="flex w-full items-start justify-between gap-3 px-3 py-3 text-left text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block font-semibold text-gray-950">{role.name}</span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {role.category || "No category"}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {(roleUsage.get(role.id)?.locationNames ?? []).length > 0 ? (
                          roleUsage.get(role.id)?.locationNames.map((locationName) => (
                            <span
                              key={locationName}
                              className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-800"
                            >
                              <MapPin size={11} />
                              {locationName}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-500">
                            Not linked to a location yet
                          </span>
                        )}
                      </span>
                      <span className="mt-2 block text-[11px] text-gray-400">
                        {roleUsage.get(role.id)?.requirementCount ?? 0} shift requirement
                        {(roleUsage.get(role.id)?.requirementCount ?? 0) === 1 ? "" : "s"}
                      </span>
                    </span>
                    <Pencil size={14} className="mt-1 shrink-0 text-gray-400" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <form
            className="space-y-3 p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await onSave({
                ...form,
                name: String(form.name).trim(),
                location_id: form.location_id || null,
                required_skills: skillsText.split(",").map((s) => s.trim()).filter(Boolean),
              });
              setEditing(null);
            }}
          >
            <input
              className={inputClass}
              placeholder="Role name"
              value={form.name ?? ""}
              onChange={(e) => setEditing({ ...form, name: e.target.value })}
              required
            />
            <input
              className={inputClass}
              placeholder="Category"
              value={form.category ?? ""}
              onChange={(e) => setEditing({ ...form, category: e.target.value })}
            />
            <label className="block text-xs font-semibold uppercase text-gray-600">
              Location
              <select
                className={`${inputClass} mt-1`}
                value={form.location_id ?? ""}
                onChange={(e) => setEditing({ ...form, location_id: e.target.value || null })}
                required
              >
                <option value="" disabled>Choose a location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </label>
            <textarea
              className={`${inputClass} min-h-[72px]`}
              placeholder="Description"
              value={form.description ?? ""}
              onChange={(e) => setEditing({ ...form, description: e.target.value })}
            />
            <input
              className={inputClass}
              placeholder="Required skills"
              value={skillsText}
              onChange={(e) => setSkillsText(e.target.value)}
            />
            <button type="submit" className="w-full rounded-xl bg-gray-900 py-2 text-sm font-semibold text-white">Save role</button>
          </form>
        </div>
      </div>
    </div>
  );
}
