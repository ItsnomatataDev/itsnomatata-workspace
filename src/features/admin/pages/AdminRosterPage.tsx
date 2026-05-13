import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CalendarClock,
  Edit2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import CreateRosterModal from "../components/CreateRosterModal";
import CreateRosterEntryModal from "../components/CreateRosterEntryModal";
import RosterTable from "../components/RosterTable";
import {
  canManageITDutyRoster,
  deleteDutyRosterSafely,
  getCurrentDutyWeekStart,
  getDutyAssignmentsForWeek,
  getDutyDefinitions,
  getDutyRosterDuties,
  getDutyRosterMembers,
  getDutyRosters,
  getITsNomatataOffice,
  getOrganizationUsersForRoster,
  getUpcomingDutyWeekStarts,
  updateDutyRoster,
  type DutyDefinitionRow,
  type DutyRosterDutyRow,
  type DutyRosterMemberRow,
  type DutyRosterRow,
  type ProfileRosterUserRow,
} from "../services/adminService";
import type { CompanyOffice } from "../../../lib/offices";

export default function AdminRosterPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;
  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [office, setOffice] = useState<CompanyOffice | null>(null);
  const [rosters, setRosters] = useState<DutyRosterRow[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [users, setUsers] = useState<ProfileRosterUserRow[]>([]);
  const [duties, setDuties] = useState<DutyDefinitionRow[]>([]);
  const [rosterMembers, setRosterMembers] = useState<DutyRosterMemberRow[]>([]);
  const [rosterDuties, setRosterDuties] = useState<DutyRosterDutyRow[]>([]);
  const [createRosterOpen, setCreateRosterOpen] = useState(false);
  const [dutyModalOpen, setDutyModalOpen] = useState(false);
  const [editingDuty, setEditingDuty] = useState<DutyDefinitionRow | null>(null);
  const [editingRoster, setEditingRoster] = useState<DutyRosterRow | null>(null);
  const [previewWeek, setPreviewWeek] = useState(getCurrentDutyWeekStart());

  const canManage = canManageITDutyRoster(profile);

  const selectedRoster = useMemo(
    () => rosters.find((item) => item.id === selectedRosterId) ?? null,
    [rosters, selectedRosterId],
  );

  const loadRosterSetup = useCallback(async (rosterId: string) => {
    if (!rosterId) {
      setRosterMembers([]);
      setRosterDuties([]);
      return;
    }

    const [membersData, rosterDutiesData] = await Promise.all([
      getDutyRosterMembers(rosterId),
      getDutyRosterDuties(rosterId),
    ]);
    setRosterMembers(membersData);
    setRosterDuties(rosterDutiesData);
  }, []);

  const loadPage = useCallback(async (preferredRosterId?: string) => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const officeData = await getITsNomatataOffice(organizationId);
      setOffice(officeData);

      if (!officeData || !canManageITDutyRoster(profile)) {
        setRosters([]);
        setUsers([]);
        setDuties([]);
        return;
      }

      const [rostersData, usersData, dutiesData] = await Promise.all([
        getDutyRosters(organizationId, officeData.id),
        getOrganizationUsersForRoster(organizationId, officeData.id),
        getDutyDefinitions(organizationId, officeData.id),
      ]);

      setRosters(rostersData);
      setUsers(usersData);
      setDuties(dutiesData);

      const rosterIdToUse =
        preferredRosterId && rostersData.some((item) => item.id === preferredRosterId)
          ? preferredRosterId
          : rostersData[0]?.id || "";
      setSelectedRosterId(rosterIdToUse);
      await loadRosterSetup(rosterIdToUse);
    } catch (err: any) {
      console.error("ADMIN ROSTER LOAD ERROR:", err);
      setError(err?.message || "Failed to load duty roster.");
    } finally {
      setLoading(false);
    }
  }, [canManage, loadRosterSetup, organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    void loadPage();
  }, [organizationId, loadPage]);

  const handleRosterChange = async (rosterId: string) => {
    try {
      setSelectedRosterId(rosterId);
      await loadRosterSetup(rosterId);
    } catch (err: any) {
      setError(err?.message || "Failed to load selected roster.");
    }
  };

  const activeDuties = useMemo(
    () => duties.filter((duty) => duty.is_active),
    [duties],
  );

  const previewAssignments = useMemo(() => {
    if (!selectedRoster) return [];
    return getDutyAssignmentsForWeek({
      roster: selectedRoster,
      weekStart: previewWeek,
      rosterMembers,
      rosterDuties,
      duties,
    });
  }, [duties, previewWeek, rosterDuties, rosterMembers, selectedRoster]);

  const upcomingWeeks = useMemo(() => getUpcomingDutyWeekStarts(5), []);

  const handleArchiveToggle = async () => {
    if (!selectedRoster) return;
    const nextStatus = selectedRoster.status === "active" ? "paused" : "active";
    await updateDutyRoster({
      rosterId: selectedRoster.id,
      status: nextStatus,
      actorUserId: userId,
    });
    await loadPage(selectedRoster.id);
  };

  const handleDelete = async () => {
    if (!selectedRoster) return;
    const confirmed = window.confirm(
      `Delete "${selectedRoster.title}"?\n\nThis only removes the roster setup and roster entries. Users, profiles, attendance, leave, and other system data are not deleted.`,
    );
    if (!confirmed) return;
    await deleteDutyRosterSafely(selectedRoster.id);
    setSelectedRosterId("");
    await loadPage();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Loading duty roster...
      </div>
    );
  }

  if (!user || !profile || !organizationId || !userId) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Missing admin workspace context.
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar role={profile.primary_role} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Duty Roster
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">
                ITsNomatata office only
              </h1>
              <p className="mt-3 text-white/55">
                Duty roster is only available for the ITsNomatata office.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Admin Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">Duty Roster</h1>
              <p className="mt-2 text-sm text-white/50">
                Manage ITsNomatata weekly rotating duties and Friday specials.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setEditingDuty(null);
                  setDutyModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/5"
              >
                <Plus size={16} />
                New Duty
              </button>
              <button
                onClick={() => {
                  setEditingRoster(null);
                  setCreateRosterOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
              >
                <Plus size={16} />
                New Roster
              </button>
            </div>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-white/60 sm:px-6">
              Loading roster data...
            </div>
          ) : error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : (
            <>
              <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/60">Office</p>
                  <p className="mt-3 text-2xl font-bold text-white">
                    {office?.name ?? "ITsNomatata"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/60">Rosters</p>
                  <p className="mt-3 text-3xl font-bold text-white">
                    {rosters.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/60">Duties</p>
                  <p className="mt-3 text-3xl font-bold text-white">
                    {activeDuties.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/60">Rotation users</p>
                  <p className="mt-3 text-3xl font-bold text-white">
                    {users.length}
                  </p>
                </div>
              </section>

              <section className="mb-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-white">
                        Roster Control
                      </h2>
                      <p className="mt-1 text-sm text-white/45">
                        Assign users and duties, then preview stable rotations.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={!selectedRoster}
                        onClick={() => {
                          setEditingRoster(selectedRoster);
                          setCreateRosterOpen(true);
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
                      >
                        <Edit2 size={14} />
                        Edit
                      </button>
                      <button
                        disabled={!selectedRoster}
                        onClick={handleArchiveToggle}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/70 hover:bg-white/5 disabled:opacity-40"
                      >
                        <Archive size={14} />
                        {selectedRoster?.status === "active" ? "Pause" : "Activate"}
                      </button>
                      <button
                        disabled={!selectedRoster}
                        onClick={handleDelete}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>

                  <label className="mb-2 block text-sm text-white/70">
                    Select roster
                  </label>
                  <select
                    value={selectedRosterId}
                    onChange={(e) => void handleRosterChange(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  >
                    <option value="">Select roster</option>
                    {rosters.map((roster) => (
                      <option key={roster.id} value={roster.id}>
                        {roster.title} - {roster.week_start} -{" "}
                        {roster.status ?? "active"}
                      </option>
                    ))}
                  </select>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <p className="text-xs uppercase tracking-widest text-white/35">
                        Selected users
                      </p>
                      <p className="mt-2 text-2xl font-bold">
                        {rosterMembers.length}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <p className="text-xs uppercase tracking-widest text-white/35">
                        Selected duties
                      </p>
                      <p className="mt-2 text-2xl font-bold">
                        {rosterDuties.length}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="font-semibold text-white">Duties</h2>
                      <p className="mt-1 text-sm text-white/45">
                        Weekly and single-day duty definitions.
                      </p>
                    </div>
                    <CalendarClock size={18} className="text-orange-400" />
                  </div>
                  <div className="space-y-2">
                    {duties.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-white/10 p-4 text-sm text-white/45">
                        Create duties like Washing, Plates, Kitchen, Cleaning,
                        or Fat Friday.
                      </p>
                    ) : (
                      duties.map((duty) => (
                        <button
                          key={duty.id}
                          onClick={() => {
                            setEditingDuty(duty);
                            setDutyModalOpen(true);
                          }}
                          className="flex w-full items-center justify-between rounded-xl border border-white/8 bg-black/30 px-3 py-3 text-left hover:bg-white/5"
                        >
                          <span>
                            <span className="block text-sm font-medium text-white">
                              {duty.name}
                            </span>
                            <span className="block text-xs text-white/35">
                              {duty.duty_type === "single_day"
                                ? "Single-day"
                                : "Weekly rotating"}
                              {duty.is_active ? "" : " - inactive"}
                            </span>
                          </span>
                          <Edit2 size={14} className="text-white/35" />
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </section>

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="font-semibold text-white">
                      Preview Duties
                    </h2>
                    <p className="mt-1 text-sm text-white/45">
                      Same week, same assignment. Upcoming weeks rotate forward.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {upcomingWeeks.map((week) => (
                      <button
                        key={week}
                        onClick={() => setPreviewWeek(week)}
                        className={[
                          "rounded-xl border px-3 py-2 text-xs font-medium",
                          previewWeek === week
                            ? "border-orange-500 bg-orange-500 text-black"
                            : "border-white/10 bg-black text-white/60 hover:bg-white/5",
                        ].join(" ")}
                      >
                        {week}
                      </button>
                    ))}
                  </div>
                </div>
                <RosterTable
                  assignments={previewAssignments}
                  users={users}
                  currentUserId={userId}
                />
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Users size={18} className="text-orange-400" />
                  <h2 className="font-semibold text-white">
                    ITsNomatata Users
                  </h2>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {users.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/8 bg-black/30 px-3 py-3"
                    >
                      <p className="text-sm font-medium text-white">
                        {item.full_name || item.email || "Unknown user"}
                      </p>
                      <p className="text-xs text-white/35">
                        {item.primary_role || "Team member"}
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </main>
      </div>

      {office ? (
        <CreateRosterModal
          open={createRosterOpen}
          onClose={() => setCreateRosterOpen(false)}
          organizationId={organizationId}
          office={office}
          userId={userId}
          users={users}
          duties={activeDuties}
          roster={editingRoster}
          rosterMembers={editingRoster ? rosterMembers : []}
          rosterDuties={editingRoster ? rosterDuties : []}
          onCreated={() => loadPage(editingRoster?.id)}
        />
      ) : null}

      {office ? (
        <CreateRosterEntryModal
          open={dutyModalOpen}
          onClose={() => setDutyModalOpen(false)}
          organizationId={organizationId}
          officeId={office.id}
          userId={userId}
          duty={editingDuty}
          onCreated={() => loadPage(selectedRosterId)}
        />
      ) : null}
    </div>
  );
}
