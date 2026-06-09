import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import {
  createDutyRosterWithSetup,
  getCurrentDutyWeekStart,
  setDutyRosterDuties,
  setDutyRosterMembers,
  updateDutyRoster,
  type DutyDefinitionRow,
  type DutyRosterDutyRow,
  type DutyRosterMemberRow,
  type DutyRosterRow,
  type ProfileRosterUserRow,
} from "../services/adminService";
import type { CompanyOffice } from "../../../lib/offices";
import UserAvatar from "../../../components/common/UserAvatar";

type CreateRosterModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  office: CompanyOffice;
  userId: string;
  users: ProfileRosterUserRow[];
  duties: DutyDefinitionRow[];
  roster?: DutyRosterRow | null;
  rosterMembers?: DutyRosterMemberRow[];
  rosterDuties?: DutyRosterDutyRow[];
  onCreated: () => Promise<void> | void;
};

export default function CreateRosterModal({
  open,
  onClose,
  organizationId,
  office,
  userId,
  users,
  duties,
  roster,
  rosterMembers = [],
  rosterDuties = [],
  onCreated,
}: CreateRosterModalProps) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedDuties, setSelectedDuties] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const initializedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) {
      initializedRef.current = null;
      return;
    }

    const initKey = roster?.id ?? "new";
    if (initializedRef.current === initKey) return;
    initializedRef.current = initKey;

    const nextUsers = roster
      ? rosterMembers.map((member) => member.user_id)
      : users.map((item) => item.id);
    const nextDuties = rosterDuties.map((item) => item.duty_id);
    setTitle(roster?.title ?? `${office.name} Duty Roster`);
    setDepartment(roster?.department ?? office.name);
    setWeekStart(roster?.week_start ?? getCurrentDutyWeekStart());
    setNotes(roster?.notes ?? "");
    setSelectedUsers(nextUsers);
    setSelectedDuties(nextDuties);
    setError("");
  }, [open, office.name, roster?.id, rosterDuties, rosterMembers, users]);

  if (!open) return null;

  const toggleUser = (targetUserId: string) => {
    setSelectedUsers((current) =>
      current.includes(targetUserId)
        ? current.filter((id) => id !== targetUserId)
        : [...current, targetUserId],
    );
  };

  const toggleDuty = (dutyId: string) => {
    setSelectedDuties((current) => {
      const next = current.includes(dutyId)
        ? current.filter((id) => id !== dutyId)
        : [...current, dutyId];

      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (selectedUsers.length === 0) {
      setError("Select at least one employee for the rotation pool.");
      return;
    }

    if (selectedDuties.length === 0) {
      setError("Assign at least one duty to this roster.");
      return;
    }

    const rosterDutiesPayload = selectedDuties.map((dutyId) => ({
      dutyId,
      assignedUserId: null,
    }));

    try {
      setBusy(true);

      if (roster) {
        await updateDutyRoster({
          rosterId: roster.id,
          title: title.trim(),
          department: department.trim() || null,
          notes: notes.trim() || null,
        });
        await Promise.all([
          setDutyRosterMembers(roster.id, selectedUsers),
          setDutyRosterDuties(roster.id, rosterDutiesPayload),
        ]);
      } else {
        await createDutyRosterWithSetup({
          organizationId,
          office,
          title: title.trim(),
          department: department.trim() || undefined,
          weekStart,
          notes,
          createdBy: userId,
          userIds: selectedUsers,
          duties: rosterDutiesPayload,
        });
      }

      await onCreated();
      onClose();
    } catch (err: any) {
      console.error("SAVE ROSTER ERROR:", err);
      setError(err?.message || "Failed to save roster.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 py-6">
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-4 shadow-2xl sm:p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              {roster ? "Edit Duty Roster" : "Create Duty Roster"}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Choose your team, assign week-one duties, then let rotation handle
              the rest.
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
              <label className="mb-2 block text-sm text-white/70">Title</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">
                Week Start
              </label>
              <input
                type="date"
                value={weekStart}
                onChange={(e) => setWeekStart(e.target.value)}
                required
                disabled={Boolean(roster)}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">Office</label>
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-200">
                {office.name}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="Optional roster notes"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  Rotation Pool
                </p>
                <span className="text-xs text-white/35">
                  {selectedUsers.length} selected
                </span>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {users.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/8 bg-white/4 px-3 py-2 hover:bg-white/8"
                  >
                    <input
                      type="checkbox"
                      checked={selectedUsers.includes(item.id)}
                      onChange={() => toggleUser(item.id)}
                      className="h-4 w-4 accent-orange-500"
                    />
                    <UserAvatar
                      person={item}
                      size="md"
                      className="h-7 w-7 bg-orange-500/15 text-orange-200"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-white">
                        {item.full_name || item.email || "Unknown user"}
                      </span>
                      <span className="block truncate text-xs text-white/35">
                        {item.primary_role || "Team member"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold text-white">
                  Roster Duties
                </p>
                <span className="text-xs text-white/35">
                  {selectedDuties.length} selected
                </span>
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {duties.map((duty) => (
                  <label
                    key={duty.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/8 bg-white/4 px-3 py-2 hover:bg-white/8"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDuties.includes(duty.id)}
                      onChange={() => toggleDuty(duty.id)}
                      className="mt-1 h-4 w-4 accent-orange-500"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {duty.name}
                      </span>
                      <span className="block text-xs text-white/35">
                        {duty.category.replaceAll("_", " ")}
                        {duty.is_active ? "" : " • inactive"}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? "Saving..." : roster ? "Save Roster" : "Create Roster"}
          </button>
        </form>
      </div>
    </div>
  );
}
