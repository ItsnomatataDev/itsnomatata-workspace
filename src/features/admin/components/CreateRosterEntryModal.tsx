import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  getDutyCategoryLabel,
  getDutyEligibilityOverrides,
  type DutyCategory,
  type DutyDefinitionRow,
  type ProfileRosterUserRow,
  upsertDutyDefinition,
} from "../services/adminService";
import { APP_ROLES, ROLE_LABELS } from "../../../lib/constants/roles";

type CreateRosterEntryModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  officeId: string;
  userId: string;
  users: ProfileRosterUserRow[];
  duty?: DutyDefinitionRow | null;
  onCreated: (duty?: DutyDefinitionRow) => Promise<void> | void;
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

const CATEGORIES: Array<{ value: DutyCategory; description: string }> = [
  {
    value: "normal_rotation",
    description: "Rotates fairly across eligible employees each week.",
  },
  {
    value: "fixed_person",
    description: "Always owned by one employee until changed.",
  },
  {
    value: "friday_rotation",
    description: "Assigned on Fridays with its own rotation history.",
  },
  {
    value: "custom_rotation",
    description: "Rotates on a specific weekday you choose.",
  },
];

export default function CreateRosterEntryModal({
  open,
  onClose,
  organizationId,
  officeId,
  userId,
  users,
  duty,
  onCreated,
}: CreateRosterEntryModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<DutyCategory>("normal_rotation");
  const [dayOfWeek, setDayOfWeek] = useState(5);
  const [isActive, setIsActive] = useState(true);
  const [allowManagers, setAllowManagers] = useState(true);
  const [allowBosses, setAllowBosses] = useState(true);
  const [fixedUserId, setFixedUserId] = useState("");
  const [fixedStartsAt, setFixedStartsAt] = useState("");
  const [fixedEndsAt, setFixedEndsAt] = useState("");
  const [fixedDutyParticipatesInFridayRotation, setFixedDutyParticipatesInFridayRotation] =
    useState(true);
  const [includedRoles, setIncludedRoles] = useState<string[]>([]);
  const [excludedRoles, setExcludedRoles] = useState<string[]>([]);
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>([]);
  const [forcedUserIds, setForcedUserIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setName(duty?.name ?? "");
      setDescription(duty?.description ?? "");
      setCategory(duty?.category ?? "normal_rotation");
      setDayOfWeek(duty?.day_of_week ?? 5);
      setIsActive(duty?.is_active ?? true);
      setAllowManagers(duty?.allow_managers ?? true);
      setAllowBosses(duty?.allow_bosses ?? true);
      setFixedUserId(duty?.fixed_user_id ?? "");
      setFixedStartsAt(duty?.fixed_starts_at ?? "");
      setFixedEndsAt(duty?.fixed_ends_at ?? "");
      setFixedDutyParticipatesInFridayRotation(
        duty?.fixed_duty_participates_in_friday_rotation ?? true,
      );
      setIncludedRoles(duty?.included_roles ?? []);
      setExcludedRoles(duty?.excluded_roles ?? []);
      setExcludedUserIds([]);
      setForcedUserIds([]);
      setError("");

      if (duty?.id) {
        const overrides = await getDutyEligibilityOverrides([duty.id]);
        setExcludedUserIds(
          overrides.filter((item) => item.is_excluded).map((item) => item.user_id),
        );
        setForcedUserIds(
          overrides
            .filter((item) => item.is_forced_included)
            .map((item) => item.user_id),
        );
      }
    };

    void load();
  }, [duty, open]);

  const roleOptions = useMemo(
    () =>
      APP_ROLES.map((role) => ({
        value: role,
        label: ROLE_LABELS[role],
      })),
    [],
  );

  if (!open) return null;

  const toggleValue = (value: string, list: string[], setter: (next: string[]) => void) => {
    setter(
      list.includes(value)
        ? list.filter((item) => item !== value)
        : [...list, value],
    );
  };

  const toggleExcludedUser = (userId: string) => {
    setExcludedUserIds((current) => {
      const removing = current.includes(userId);
      if (removing) return current.filter((id) => id !== userId);
      setForcedUserIds((forced) => forced.filter((id) => id !== userId));
      return [...current, userId];
    });
  };

  const toggleForcedUser = (userId: string) => {
    setForcedUserIds((current) => {
      const removing = current.includes(userId);
      if (removing) return current.filter((id) => id !== userId);
      setExcludedUserIds((excluded) => excluded.filter((id) => id !== userId));
      return [...current, userId];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (category === "fixed_person" && !fixedUserId) {
      setError("Choose a fixed owner for this duty.");
      return;
    }

    try {
      setBusy(true);
      const savedDuty = await upsertDutyDefinition({
        id: duty?.id,
        organizationId,
        officeId,
        name,
        description,
        category,
        dayOfWeek,
        isActive,
        allowManagers,
        allowBosses,
        fixedUserId: fixedUserId || null,
        fixedStartsAt: fixedStartsAt || null,
        fixedEndsAt: fixedEndsAt || null,
        fixedDutyParticipatesInFridayRotation,
        includedRoles,
        excludedRoles,
        eligibilityOverrides: [
          ...excludedUserIds.map((id) => ({
            userId: id,
            isExcluded: true,
          })),
          ...forcedUserIds.map((id) => ({
            userId: id,
            isForcedIncluded: true,
          })),
        ],
        createdBy: userId,
      });

      await onCreated(savedDuty);
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
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {duty ? "Edit Duty" : "Create Duty"}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Configure duty behavior, eligibility, and rotation rules.
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

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-white/70">Duty name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm text-white/70">Status</label>
              <button
                type="button"
                onClick={() => setIsActive((current) => !current)}
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-sm ${
                  isActive
                    ? "border-orange-500/30 bg-orange-500/10 text-orange-100"
                    : "border-white/10 bg-white/5 text-white/45"
                }`}
              >
                <span>{isActive ? "Active" : "Inactive"}</span>
                <span className="text-xs">
                  {isActive ? "Included in roster generation" : "Hidden"}
                </span>
              </button>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="mb-3 text-sm font-semibold text-white">Duty category</p>
            <div className="grid gap-2 md:grid-cols-2">
              {CATEGORIES.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCategory(item.value)}
                  className={[
                    "rounded-2xl border px-4 py-3 text-left text-sm transition",
                    category === item.value
                      ? "border-orange-500 bg-orange-500/10 text-white"
                      : "border-white/10 bg-black text-white/60 hover:bg-white/5",
                  ].join(" ")}
                >
                  <span className="block font-medium">
                    {getDutyCategoryLabel(item.value)}
                  </span>
                  <span className="mt-1 block text-xs text-white/40">
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {category === "custom_rotation" || category === "friday_rotation" ? (
            <div>
              <label className="mb-2 block text-sm text-white/70">Day of week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                disabled={category === "friday_rotation"}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500 disabled:opacity-50"
              >
                {DAYS.map((day) => (
                  <option key={day.value} value={day.value}>
                    {day.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {category === "fixed_person" ? (
            <section className="space-y-4 rounded-2xl border border-white/10 bg-black/40 p-4">
              <div>
                <label className="mb-2 block text-sm text-white/70">Fixed owner</label>
                <select
                  value={fixedUserId}
                  onChange={(e) => setFixedUserId(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                >
                  <option value="">Select employee</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.full_name || user.email || "Unknown user"}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-white/40">
                  This employee stays on this duty and is removed from normal
                  weekly rotation duties.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-white/70">Starts</label>
                  <input
                    type="date"
                    value={fixedStartsAt}
                    onChange={(e) => setFixedStartsAt(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-white/70">Ends</label>
                  <input
                    type="date"
                    value={fixedEndsAt}
                    onChange={(e) => setFixedEndsAt(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setFixedDutyParticipatesInFridayRotation((current) => !current)
                }
                className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm ${
                  fixedDutyParticipatesInFridayRotation
                    ? "border-orange-500/30 bg-orange-500/10 text-white"
                    : "border-white/10 bg-black text-white/55"
                }`}
              >
                <span>Friday rotation participation</span>
                <span className="text-xs text-white/45">
                  {fixedDutyParticipatesInFridayRotation
                    ? "Owner may still be assigned Friday duties"
                    : "Owner excluded from all rotating duties"}
                </span>
              </button>
            </section>
          ) : null}

          <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
            <p className="mb-3 text-sm font-semibold text-white">Participation rules</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setAllowManagers((current) => !current)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm ${
                  allowManagers
                    ? "border-orange-500/30 bg-orange-500/10 text-white"
                    : "border-white/10 bg-black text-white/55"
                }`}
              >
                Managers {allowManagers ? "included" : "excluded"}
              </button>
              <button
                type="button"
                onClick={() => setAllowBosses((current) => !current)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm ${
                  allowBosses
                    ? "border-orange-500/30 bg-orange-500/10 text-white"
                    : "border-white/10 bg-black text-white/55"
                }`}
              >
                Bosses {allowBosses ? "included" : "excluded"}
              </button>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="mb-3 text-sm font-semibold text-white">Role inclusion</p>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {roleOptions.map((role) => (
                  <label
                    key={role.value}
                    className="flex items-center gap-2 text-sm text-white/75"
                  >
                    <input
                      type="checkbox"
                      checked={includedRoles.includes(role.value)}
                      onChange={() =>
                        toggleValue(role.value, includedRoles, setIncludedRoles)
                      }
                      className="accent-orange-500"
                    />
                    {role.label}
                  </label>
                ))}
              </div>
              <p className="mt-2 text-xs text-white/35">
                Leave empty to allow all roles that pass the other rules.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="mb-3 text-sm font-semibold text-white">Role exclusion</p>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {roleOptions.map((role) => (
                  <label
                    key={role.value}
                    className="flex items-center gap-2 text-sm text-white/75"
                  >
                    <input
                      type="checkbox"
                      checked={excludedRoles.includes(role.value)}
                      onChange={() =>
                        toggleValue(role.value, excludedRoles, setExcludedRoles)
                      }
                      className="accent-orange-500"
                    />
                    {role.label}
                  </label>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="mb-3 text-sm font-semibold text-white">Excluded employees</p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 text-sm text-white/75"
                  >
                    <input
                      type="checkbox"
                      checked={excludedUserIds.includes(user.id)}
                      onChange={() => toggleExcludedUser(user.id)}
                      className="accent-orange-500"
                    />
                    {user.full_name || user.email || "Unknown user"}
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="mb-3 text-sm font-semibold text-white">Forced inclusion</p>
              <div className="max-h-48 space-y-2 overflow-y-auto">
                {users.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 text-sm text-white/75"
                  >
                    <input
                      type="checkbox"
                      checked={forcedUserIds.includes(user.id)}
                      onChange={() => toggleForcedUser(user.id)}
                      className="accent-orange-500"
                    />
                    {user.full_name || user.email || "Unknown user"}
                  </label>
                ))}
              </div>
            </div>
          </section>

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
