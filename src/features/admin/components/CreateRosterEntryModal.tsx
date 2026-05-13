import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  upsertDutyDefinition,
  type DutyDefinitionRow,
  type DutyType,
} from "../services/adminService";

type CreateRosterEntryModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  officeId: string;
  userId: string;
  duty?: DutyDefinitionRow | null;
  onCreated: () => Promise<void> | void;
};

const DAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 7, label: "Sunday" },
];

export default function CreateRosterEntryModal({
  open,
  onClose,
  organizationId,
  officeId,
  userId,
  duty,
  onCreated,
}: CreateRosterEntryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dutyType, setDutyType] = useState<DutyType>("weekly_rotating");
  const [dayOfWeek, setDayOfWeek] = useState(5);
  const [isActive, setIsActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setName(duty?.name ?? "");
    setDescription(duty?.description ?? "");
    setDutyType(duty?.duty_type ?? "weekly_rotating");
    setDayOfWeek(duty?.day_of_week ?? 5);
    setIsActive(duty?.is_active ?? true);
    setError("");
  }, [duty, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setBusy(true);
      await upsertDutyDefinition({
        id: duty?.id,
        organizationId,
        officeId,
        name,
        description,
        dutyType,
        dayOfWeek,
        isActive,
        createdBy: userId,
      });

      await onCreated();
      onClose();
    } catch (err: any) {
      console.error("SAVE DUTY ERROR:", err);
      setError(err?.message || "Failed to save duty.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-6">
      <div className="max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {duty ? "Edit Duty" : "Create Duty"}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Define reusable duties for the ITsNomatata rotation.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-white/70">
              Duty Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Washing, Plates, Kitchen, Fat Friday"
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="What should the assigned person handle?"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDutyType("weekly_rotating")}
              className={[
                "rounded-2xl border px-4 py-3 text-left text-sm transition",
                dutyType === "weekly_rotating"
                  ? "border-orange-500 bg-orange-500/10 text-white"
                  : "border-white/10 bg-black text-white/60 hover:bg-white/5",
              ].join(" ")}
            >
              Weekly rotating
            </button>
            <button
              type="button"
              onClick={() => setDutyType("single_day")}
              className={[
                "rounded-2xl border px-4 py-3 text-left text-sm transition",
                dutyType === "single_day"
                  ? "border-orange-500 bg-orange-500/10 text-white"
                  : "border-white/10 bg-black text-white/60 hover:bg-white/5",
              ].join(" ")}
            >
              Single-day
            </button>
          </div>

          {dutyType === "single_day" ? (
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Day of Week
              </label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              >
                {DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => setIsActive((current) => !current)}
            className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
              isActive
                ? "border-green-500/20 bg-green-500/10 text-green-300"
                : "border-white/10 bg-white/5 text-white/45"
            }`}
          >
            <span>{isActive ? "Active" : "Inactive"}</span>
            <span className="text-xs">
              {isActive ? "Shown in roster setup" : "Hidden from rotation"}
            </span>
          </button>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? "Saving..." : duty ? "Save Duty" : "Create Duty"}
          </button>
        </form>
      </div>
    </div>
  );
}
