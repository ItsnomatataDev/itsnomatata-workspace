import { useMemo, useState } from "react";
import { Search, UserMinus, UserPlus, Users } from "lucide-react";
import type { ProfileRosterUserRow } from "../services/adminService";

type RosterParticipantsStepProps = {
  users: ProfileRosterUserRow[];
  participantIds: string[];
  onParticipantIdsChange: (next: string[]) => void;
  onSave: () => Promise<void>;
  saving?: boolean;
  dirty?: boolean;
};

export default function RosterParticipantsStep({
  users,
  participantIds,
  onParticipantIdsChange,
  onSave,
  saving = false,
  dirty = false,
}: RosterParticipantsStepProps) {
  const [search, setSearch] = useState("");
  const participantSet = useMemo(() => new Set(participantIds), [participantIds]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((user) => {
      const name = String(user.full_name ?? "").toLowerCase();
      const email = String(user.email ?? "").toLowerCase();
      return name.includes(query) || email.includes(query);
    });
  }, [search, users]);

  const inRoster = filteredUsers.filter((user) => participantSet.has(user.id));
  const outOfRoster = filteredUsers.filter((user) => !participantSet.has(user.id));

  const addToRoster = (userId: string) => {
    if (participantSet.has(userId)) return;
    onParticipantIdsChange([...participantIds, userId]);
  };

  const removeFromRoster = (userId: string) => {
    onParticipantIdsChange(participantIds.filter((id) => id !== userId));
  };

  const selectAll = () => onParticipantIdsChange(users.map((user) => user.id));
  const unselectAll = () => onParticipantIdsChange([]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-4">
          <p className="text-xs uppercase tracking-wider text-white/35">
            Total office employees
          </p>
          <p className="mt-2 text-3xl font-bold text-white">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
          <p className="text-xs uppercase tracking-wider text-orange-100/70">
            Selected for roster
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {participantIds.length}
          </p>
        </div>
        <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-4">
          <p className="text-xs uppercase tracking-wider text-white/35">
            Excluded from roster
          </p>
          <p className="mt-2 text-3xl font-bold text-white">
            {Math.max(0, users.length - participantIds.length)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={selectAll}
          className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-white/75 hover:bg-white/5"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={unselectAll}
          className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-white/75 hover:bg-white/5"
        >
          Unselect all
        </button>
        <button
          type="button"
          disabled={!dirty || saving || participantIds.length === 0}
          onClick={() => void onSave()}
          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save participants"}
        </button>
      </div>

      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search employees..."
          className="w-full rounded-2xl border border-white/[0.08] bg-[#0f0f0f] py-3 pl-11 pr-4 text-white outline-none focus:border-orange-500"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users size={16} className="text-orange-400" />
            <h3 className="font-semibold text-white">In this roster</h3>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {inRoster.length === 0 ? (
              <p className="text-sm text-white/45">
                No participants selected yet. Add employees from the list on the
                right.
              </p>
            ) : (
              inRoster.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {user.full_name || user.email || "Unknown user"}
                    </p>
                    <p className="text-xs text-white/40">
                      {user.primary_role || "Team member"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromRoster(user.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/[0.08] px-2 py-1 text-xs text-white/70 hover:bg-white/5"
                  >
                    <UserMinus size={14} />
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-4">
          <div className="mb-3 flex items-center gap-2">
            <Users size={16} className="text-white/35" />
            <h3 className="font-semibold text-white">Office employees</h3>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {outOfRoster.length === 0 ? (
              <p className="text-sm text-white/45">Everyone is already in this roster.</p>
            ) : (
              outOfRoster.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#050505] px-3 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {user.full_name || user.email || "Unknown user"}
                    </p>
                    <p className="text-xs text-white/40">
                      {user.primary_role || "Team member"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => addToRoster(user.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs text-orange-100 hover:bg-orange-500/20"
                  >
                    <UserPlus size={14} />
                    Add
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <p className="text-xs text-white/35">
        Removing someone from the roster stops future assignments for them.
        Past assignment history is kept, and they can be added back later.
      </p>
    </div>
  );
}
