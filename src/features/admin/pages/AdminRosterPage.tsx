import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Users } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import CreateRosterModal from "../components/CreateRosterModal";
import CreateRosterEntryModal from "../components/CreateRosterEntryModal";
import RosterTable from "../components/RosterTable";
import {
  getDutyRosters,
  getDutyRosterEntries,
  getOrganizationUsersForRoster,
  type DutyRosterRow,
  type DutyRosterEntryRow,
  type ProfileRosterUserRow,
} from "../services/adminService";

export default function AdminRosterPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;
  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rosters, setRosters] = useState<DutyRosterRow[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [entries, setEntries] = useState<DutyRosterEntryRow[]>([]);
  const [users, setUsers] = useState<ProfileRosterUserRow[]>([]);
  const [createRosterOpen, setCreateRosterOpen] = useState(false);
  const [createEntryOpen, setCreateEntryOpen] = useState(false);

  const selectedRoster = useMemo(
    () => rosters.find((item) => item.id === selectedRosterId) ?? null,
    [rosters, selectedRosterId],
  );

  const loadPage = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [rostersData, usersData] = await Promise.all([
        getDutyRosters(organizationId),
        getOrganizationUsersForRoster(organizationId),
      ]);

      setRosters(rostersData);
      setUsers(usersData);

      const rosterIdToUse = selectedRosterId || rostersData[0]?.id || "";
      setSelectedRosterId(rosterIdToUse);

      if (rosterIdToUse) {
        const entriesData = await getDutyRosterEntries(rosterIdToUse);
        setEntries(entriesData);
      } else {
        setEntries([]);
      }
    } catch (err: any) {
      console.error("ADMIN ROSTER LOAD ERROR:", err);
      setError(err?.message || "Failed to load duty roster.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, selectedRosterId]);

  useEffect(() => {
    if (!organizationId) return;
    void loadPage();
  }, [organizationId, loadPage]);

  const handleRosterChange = async (rosterId: string) => {
    try {
      setSelectedRosterId(rosterId);
      setLoading(true);
      setError("");

      const entriesData = await getDutyRosterEntries(rosterId);
      setEntries(entriesData);
    } catch (err: any) {
      console.error("ROSTER CHANGE LOAD ERROR:", err);
      setError(err?.message || "Failed to load selected roster.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading duty roster...
      </div>
    );
  }

  if (!user || !profile || !organizationId || !userId) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Missing admin workspace context.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Admin Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">Duty Roster</h1>
              <p className="mt-2 text-sm text-white/50">
                Create weekly rosters and assign employee shifts.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setCreateEntryOpen(true)}
                disabled={!selectedRosterId}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-50"
              >
                <Users size={16} />
                Add Shift
              </button>

              <button
                onClick={() => setCreateRosterOpen(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
              >
                <Plus size={16} />
                New Roster
              </button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading roster data...
            </div>
          ) : error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : (
            <>
              <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Rosters</p>
                    <CalendarClock size={18} className="text-orange-500" />
                  </div>
                  <p className="mt-4 text-3xl font-bold text-white">
                    {rosters.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Employees</p>
                    <Users size={18} className="text-orange-500" />
                  </div>
                  <p className="mt-4 text-3xl font-bold text-white">
                    {users.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Entries</p>
                    <CalendarClock size={18} className="text-orange-500" />
                  </div>
                  <p className="mt-4 text-3xl font-bold text-white">
                    {entries.length}
                  </p>
                </div>
              </section>

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <label className="mb-2 block text-sm text-white/70">
                  Select Roster
                </label>
                <select
                  value={selectedRosterId}
                  onChange={(e) => void handleRosterChange(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                >
                  <option value="">Select roster</option>
                  {rosters.map((roster) => (
                    <option key={roster.id} value={roster.id}>
                      {roster.title} — {roster.week_start}
                    </option>
                  ))}
                </select>

                {selectedRoster ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                    <p className="font-medium text-white">
                      {selectedRoster.title}
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      Department: {selectedRoster.department || "General"} •
                      Week start: {selectedRoster.week_start}
                    </p>
                  </div>
                ) : null}
              </section>

              <section>
                <RosterTable entries={entries} users={users} />
              </section>
            </>
          )}
        </main>
      </div>

      <CreateRosterModal
        open={createRosterOpen}
        onClose={() => setCreateRosterOpen(false)}
        organizationId={organizationId}
        userId={userId}
        onCreated={loadPage}
      />

      <CreateRosterEntryModal
        open={createEntryOpen}
        onClose={() => setCreateEntryOpen(false)}
        rosterId={selectedRosterId}
        users={users}
        onCreated={async () => {
          if (selectedRosterId) {
            const entriesData = await getDutyRosterEntries(selectedRosterId);
            setEntries(entriesData);
          }
        }}
      />
    </div>
  );
}
