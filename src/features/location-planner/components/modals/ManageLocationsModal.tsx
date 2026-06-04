import { useEffect, useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { LOCATION_STATUS_LABELS, LOCATION_TYPE_LABELS } from "../../constants";
import type { CompanyLocation, LocationStatus, LocationType } from "../../types";

const inputClass =
  "w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500";

type Props = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  locations: CompanyLocation[];
  onSave: (location: Partial<CompanyLocation> & {
    name: string;
    type: LocationType;
    status: LocationStatus;
  }, restriction?: {
    title: string;
    start_date: string;
    end_date: string;
    reason?: string;
  }) => Promise<void>;
};

export default function ManageLocationsModal({
  open,
  onClose,
  organizationId,
  locations,
  onSave,
}: Props) {
  const [editing, setEditing] = useState<Partial<CompanyLocation> | null>(null);
  const [restrictionStart, setRestrictionStart] = useState("");
  const [restrictionEnd, setRestrictionEnd] = useState("");
  const [alertTitle, setAlertTitle] = useState("");

  useEffect(() => {
    if (!open) setEditing(null);
  }, [open]);

  if (!open) return null;

  const form = editing ?? {
    name: "",
    type: "department" as LocationType,
    status: "open" as LocationStatus,
    capacity: 8,
    notes: "",
    is_active: true,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-semibold">Manage Locations</h2>
          <button type="button" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="grid min-h-0 flex-1 lg:grid-cols-2">
          <div className="overflow-y-auto border-b border-gray-200 p-4 lg:border-b-0 lg:border-r">
            <button
              type="button"
              onClick={() => setEditing({ name: "", type: "department", status: "open", capacity: 8, is_active: true })}
              className="mb-3 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white"
            >
              <Plus size={14} /> Add location
            </button>
            <ul className="space-y-2">
              {locations.map((loc) => (
                <li key={loc.id}>
                  <button type="button" onClick={() => setEditing(loc)} className="flex w-full items-center justify-between rounded-xl border border-gray-200 px-3 py-2 text-left text-sm hover:border-orange-400">
                    <span>
                      <span className="font-semibold">{loc.name}</span>
                      <span className="block text-xs text-gray-500">{LOCATION_TYPE_LABELS[loc.type]} · {LOCATION_STATUS_LABELS[loc.status]}</span>
                    </span>
                    <Pencil size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <form
            className="space-y-3 overflow-y-auto p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              await onSave(
                {
                  id: form.id,
                  organization_id: form.organization_id ?? organizationId,
                  name: String(form.name).trim(),
                  type: form.type as LocationType,
                  status: form.status as LocationStatus,
                  capacity: Number(form.capacity) || null,
                  notes: form.notes ?? null,
                  is_active: form.is_active ?? true,
                },
                form.status !== "open" && restrictionStart && restrictionEnd
                  ? {
                      title: alertTitle || `${form.name} restriction`,
                      start_date: restrictionStart,
                      end_date: restrictionEnd,
                      reason: form.notes ?? undefined,
                    }
                  : undefined,
              );
              setEditing(null);
              onClose();
            }}
          >
            <input className={inputClass} placeholder="Location name" value={form.name ?? ""} onChange={(e) => setEditing({ ...form, name: e.target.value })} required />
            <select className={inputClass} value={form.type} onChange={(e) => setEditing({ ...form, type: e.target.value as LocationType })}>
              {Object.entries(LOCATION_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select className={inputClass} value={form.status} onChange={(e) => setEditing({ ...form, status: e.target.value as LocationStatus })}>
              {Object.entries(LOCATION_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input type="number" min={1} className={inputClass} placeholder="Capacity" value={form.capacity ?? 8} onChange={(e) => setEditing({ ...form, capacity: Number(e.target.value) })} />
            {(form.status === "closed" || form.status === "limited") && (
              <>
                <input className={inputClass} placeholder="Alert title" value={alertTitle} onChange={(e) => setAlertTitle(e.target.value)} />
                <div className="grid grid-cols-2 gap-2">
                  <input type="date" className={inputClass} value={restrictionStart} onChange={(e) => setRestrictionStart(e.target.value)} />
                  <input type="date" className={inputClass} value={restrictionEnd} onChange={(e) => setRestrictionEnd(e.target.value)} />
                </div>
              </>
            )}
            <textarea className={`${inputClass} min-h-[72px]`} placeholder="Notes" value={form.notes ?? ""} onChange={(e) => setEditing({ ...form, notes: e.target.value })} />
            <button type="submit" className="w-full rounded-xl bg-gray-900 py-2 text-sm font-semibold text-white">Save location</button>
          </form>
        </div>
      </div>
    </div>
  );
}
