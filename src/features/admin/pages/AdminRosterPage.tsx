import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Plus,
  Trash2,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getCompanyOffices } from "../../../lib/supabase/queries/offices";
import CreateRosterModal from "../components/CreateRosterModal";
import CreateRosterEntryModal from "../components/CreateRosterEntryModal";
import RosterDutiesStep from "../components/RosterDutiesStep";
import RosterParticipantsStep from "../components/RosterParticipantsStep";
import RosterSimplePreview from "../components/RosterSimplePreview";
import {
  canManageDutyRoster,
  createDutyRoster,
  deleteDutyRosterSafely,
  getCurrentDutyWeekStart,
  getDutyAssignmentsForWeek,
  getDutyDefinitions,
  getDutyRosterDuties,
  getDutyRosterMembers,
  getDutyRosters,
  getOrganizationUsersForRoster,
  DUTY_ROSTER_ROTATION_WEEKS,
  generateRosterRotation,
  setDutyRosterDuties,
  setDutyRosterMembers,
  updateDutyRoster,
  type DutyAssignmentPreview,
  type DutyDefinitionRow,
  type DutyRosterDutyRow,
  type DutyRosterMemberRow,
  type DutyRosterRow,
  type ProfileRosterUserRow,
} from "../services/adminService";
import type { CompanyOffice } from "../../../lib/offices";

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const WIZARD_STEPS = [
  { id: 1, label: "Choose participants" },
  { id: 2, label: "Duties & generate" },
  { id: 3, label: "Review schedule" },
] as const;

export default function AdminRosterPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;
  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? null;
  const profileOfficeId = profile?.office_id ?? null;
  const primaryRole = profile?.primary_role ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [office, setOffice] = useState<CompanyOffice | null>(null);
  const [rosters, setRosters] = useState<DutyRosterRow[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [users, setUsers] = useState<ProfileRosterUserRow[]>([]);
  const [duties, setDuties] = useState<DutyDefinitionRow[]>([]);
  const [rosterMembers, setRosterMembers] = useState<DutyRosterMemberRow[]>([]);
  const [rosterDuties, setRosterDuties] = useState<DutyRosterDutyRow[]>([]);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [draftParticipantIds, setDraftParticipantIds] = useState<string[]>([]);
  const [draftDutyIds, setDraftDutyIds] = useState<string[]>([]);
  const [participantsDirty, setParticipantsDirty] = useState(false);
  const [dutiesDirty, setDutiesDirty] = useState(false);
  const [savingParticipants, setSavingParticipants] = useState(false);
  const [savingDuties, setSavingDuties] = useState(false);
  const [generatingRotation, setGeneratingRotation] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [createRosterOpen, setCreateRosterOpen] = useState(false);
  const [dutyModalOpen, setDutyModalOpen] = useState(false);
  const [editingDuty, setEditingDuty] = useState<DutyDefinitionRow | null>(null);
  const [assignmentDraft, setAssignmentDraft] = useState<
    Record<string, string | null>
  >({});
  const [monthWeekAssignments, setMonthWeekAssignments] = useState<
    Array<{ weekStart: string; assignments: DutyAssignmentPreview[] }>
  >([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const currentWeek = getCurrentDutyWeekStart();
  const monthWeekStarts = useMemo(
    () =>
      Array.from({ length: DUTY_ROSTER_ROTATION_WEEKS }, (_, index) =>
        addDays(currentWeek, index * 7),
      ),
    [currentWeek],
  );

  const canManage = useMemo(
    () =>
      canManageDutyRoster({
        primary_role: primaryRole,
        office_id: profileOfficeId,
      }),
    [primaryRole, profileOfficeId],
  );

  const selectedRoster = useMemo(
    () => rosters.find((item) => item.id === selectedRosterId) ?? null,
    [rosters, selectedRosterId],
  );

  const syncDraftsFromRoster = useCallback(
    (members: DutyRosterMemberRow[], rosterDutyRows: DutyRosterDutyRow[]) => {
      setDraftParticipantIds(members.map((item) => item.user_id));
      setDraftDutyIds(rosterDutyRows.map((item) => item.duty_id));
      setAssignmentDraft(
        Object.fromEntries(
          rosterDutyRows.map((item) => [item.duty_id, item.assigned_user_id]),
        ),
      );
      setParticipantsDirty(false);
      setDutiesDirty(false);
    },
    [],
  );

  const refreshDutyDefinitions = useCallback(
    async (activateDutyId?: string) => {
      const officeId = office?.id ?? profileOfficeId;
      if (!organizationId || !officeId) return;

      const dutiesData = await getDutyDefinitions(organizationId, officeId);
      setDuties(dutiesData);

      if (activateDutyId) {
        setDraftDutyIds((current) =>
          current.includes(activateDutyId)
            ? current
            : [...current, activateDutyId],
        );
        setDutiesDirty(true);
      }
    },
    [office?.id, organizationId, profileOfficeId],
  );

  const loadRosterSetup = useCallback(
    async (rosterId: string) => {
      if (!rosterId) {
        setRosterMembers([]);
        setRosterDuties([]);
        setDraftParticipantIds([]);
        setDraftDutyIds([]);
        return;
      }

      const [membersData, rosterDutiesData] = await Promise.all([
        getDutyRosterMembers(rosterId),
        getDutyRosterDuties(rosterId),
      ]);
      setRosterMembers(membersData);
      setRosterDuties(rosterDutiesData);
      syncDraftsFromRoster(membersData, rosterDutiesData);
    },
    [syncDraftsFromRoster],
  );

  const loadPage = useCallback(
    async (preferredRosterId?: string) => {
      if (!organizationId || !profileOfficeId) return;

      try {
        setLoading(true);
        setError("");

        const offices = await getCompanyOffices(organizationId);
        const officeData =
          offices.find((item) => item.id === profileOfficeId) ?? offices[0] ?? null;
        setOffice(officeData);

        if (
          !officeData ||
          !canManageDutyRoster({
            primary_role: primaryRole,
            office_id: profileOfficeId,
          })
        ) {
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
          preferredRosterId &&
          rostersData.some((item) => item.id === preferredRosterId)
            ? preferredRosterId
            : rostersData[0]?.id || "";
        setSelectedRosterId(rosterIdToUse);
        await loadRosterSetup(rosterIdToUse);
      } catch (err: any) {
        setError(err?.message || "Failed to load duty roster.");
      } finally {
        setLoading(false);
      }
    },
    [loadRosterSetup, organizationId, primaryRole, profileOfficeId],
  );

  useEffect(() => {
    if (!organizationId || !profileOfficeId || authLoading) return;
    void loadPage();
  }, [authLoading, loadPage, organizationId, profileOfficeId]);

  const buildRosterRows = useCallback(() => {
    if (!selectedRoster) {
      return {
        rosterMemberRows: [] as DutyRosterMemberRow[],
        rosterDutyRows: [] as DutyRosterDutyRow[],
      };
    }

    const rosterMemberRows = draftParticipantIds.map((userId, index) => ({
      id: `${selectedRoster.id}:${userId}`,
      roster_id: selectedRoster.id,
      user_id: userId,
      sort_order: index,
      created_at: new Date().toISOString(),
    }));
    const rosterDutyRows = draftDutyIds.map((dutyId, index) => {
      const existing = rosterDuties.find((item) => item.duty_id === dutyId);
      return {
        id: existing?.id ?? `${selectedRoster.id}:${dutyId}`,
        roster_id: selectedRoster.id,
        duty_id: dutyId,
        rotation_offset: index,
        sort_order: index,
        assigned_user_id:
          assignmentDraft[dutyId] ?? existing?.assigned_user_id ?? null,
        created_at: existing?.created_at ?? new Date().toISOString(),
      } satisfies DutyRosterDutyRow;
    });

    return { rosterMemberRows, rosterDutyRows };
  }, [
    assignmentDraft,
    draftDutyIds,
    draftParticipantIds,
    rosterDuties,
    selectedRoster,
  ]);

  const loadPreviews = useCallback(async () => {
    if (
      !selectedRoster ||
      draftDutyIds.length === 0 ||
      draftParticipantIds.length === 0
    ) {
      setMonthWeekAssignments([]);
      return;
    }

    const { rosterMemberRows, rosterDutyRows } = buildRosterRows();

    try {
      setPreviewLoading(true);
      const weekAssignments = await Promise.all(
        monthWeekStarts.map((weekStart) =>
          getDutyAssignmentsForWeek({
            roster: selectedRoster,
            weekStart,
            rosterMembers: rosterMemberRows,
            rosterDuties: rosterDutyRows,
            duties,
            users,
            persist: false,
          }),
        ),
      );
      setMonthWeekAssignments(
        monthWeekStarts.map((weekStart, index) => ({
          weekStart,
          assignments: weekAssignments[index] ?? [],
        })),
      );
    } catch (err: any) {
      setError(err?.message || "Failed to load roster preview.");
    } finally {
      setPreviewLoading(false);
    }
  }, [
    buildRosterRows,
    draftDutyIds.length,
    draftParticipantIds.length,
    duties,
    monthWeekStarts,
    selectedRoster,
    users,
  ]);

  useEffect(() => {
    if (loading || wizardStep !== 3) return;
    void loadPreviews();
  }, [loadPreviews, loading, wizardStep]);

  const activeDutiesForReview = useMemo(
    () =>
      draftDutyIds
        .map((dutyId) => duties.find((duty) => duty.id === dutyId))
        .filter((duty): duty is DutyDefinitionRow => Boolean(duty)),
    [draftDutyIds, duties],
  );

  const handleRosterChange = async (rosterId: string) => {
    setSelectedRosterId(rosterId);
    setWizardStep(1);
    await loadRosterSetup(rosterId);
  };

  const handleSaveParticipants = async () => {
    if (!selectedRoster) return;
    if (draftParticipantIds.length === 0) {
      setError("Select at least one participant for this roster.");
      return;
    }

    try {
      setSavingParticipants(true);
      setError("");
      await setDutyRosterMembers(selectedRoster.id, draftParticipantIds);
      await loadRosterSetup(selectedRoster.id);
    } catch (err: any) {
      setError(err?.message || "Failed to save participants.");
    } finally {
      setSavingParticipants(false);
    }
  };

  const persistDutySetup = async () => {
    if (!selectedRoster) {
      throw new Error("Select a roster first.");
    }
    if (draftDutyIds.length === 0) {
      throw new Error("Activate at least one duty for this roster.");
    }

    await setDutyRosterDuties(
      selectedRoster.id,
      draftDutyIds.map((dutyId) => ({
        dutyId,
        assignedUserId: assignmentDraft[dutyId] ?? null,
      })),
    );

    const officeId = office?.id ?? profileOfficeId;
    if (!organizationId || !officeId) {
      throw new Error("Missing office context.");
    }

    const [membersData, rosterDutiesData, dutiesData] = await Promise.all([
      getDutyRosterMembers(selectedRoster.id),
      getDutyRosterDuties(selectedRoster.id),
      getDutyDefinitions(organizationId, officeId),
    ]);

    setRosterMembers(membersData);
    setRosterDuties(rosterDutiesData);
    setDuties(dutiesData);
    syncDraftsFromRoster(membersData, rosterDutiesData);

    return {
      membersData,
      rosterDutiesData,
      dutiesData,
    };
  };

  const handleSaveDuties = async () => {
    if (!selectedRoster) return;

    try {
      setSavingDuties(true);
      setError("");
      await persistDutySetup();
    } catch (err: any) {
      setError(err?.message || "Failed to save duties.");
    } finally {
      setSavingDuties(false);
    }
  };

  const handleSaveAndGenerateRotation = async () => {
    if (!selectedRoster) return;
    if (participantsDirty) {
      setError("Save participants in step 1 before generating.");
      return;
    }
    if (draftParticipantIds.length === 0) {
      setError("Select at least one participant.");
      return;
    }

    try {
      setGeneratingRotation(true);
      setError("");
      setSuccessMessage("");

      const { membersData, rosterDutiesData, dutiesData } =
        await persistDutySetup();

      const result = await generateRosterRotation({
        roster: selectedRoster,
        startWeek: currentWeek,
        weekCount: DUTY_ROSTER_ROTATION_WEEKS,
        rosterMembers: membersData,
        rosterDuties: rosterDutiesData,
        duties: dutiesData,
        users,
      });

      setSuccessMessage(
        `Generated ${result.assignmentCount} assignments across ${result.weeksWritten} weeks.`,
      );
      setWizardStep(3);
    } catch (err: any) {
      setError(err?.message || "Failed to generate weekly rotation.");
    } finally {
      setGeneratingRotation(false);
    }
  };

  const handleQuickCreateRoster = async () => {
    if (!organizationId || !office || !userId) return;
    try {
      setError("");
      const roster = await createDutyRoster({
        organizationId,
        officeId: office.id,
        title: `${office.name} Duty Roster`,
        department: office.name,
        weekStart: currentWeek,
        createdBy: userId,
      });
      await loadPage(roster.id);
      setWizardStep(1);
    } catch (err: any) {
      setError(err?.message || "Failed to create roster.");
    }
  };

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
      `Delete "${selectedRoster.title}"? Historical assignments for this roster will also be removed.`,
    );
    if (!confirmed) return;
    await deleteDutyRosterSafely(selectedRoster.id);
    setSelectedRosterId("");
    await loadPage();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6">
        Loading duty roster...
      </div>
    );
  }

  if (!user || !profile || !organizationId || !userId) {
    return (
      <div className="min-h-screen bg-[#050505] px-4 py-6 text-white sm:px-6">
        Missing admin workspace context.
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-[#050505] text-white">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar role={profile.primary_role} />
          <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-white/[0.08] bg-[#0f0f0f] p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Duty Roster
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">
                Admin access required
              </h1>
              <p className="mt-3 text-white/55">
                Duty roster management is available to office administrators.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Duty Roster
              </p>
              <h1 className="mt-2 text-3xl font-bold">Manage office duties</h1>
              <p className="mt-2 text-sm text-white/50">
                Choose people, assign duties, and generate a month of rotation in
                one click.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {rosters.length === 0 ? (
                <button
                  onClick={() => void handleQuickCreateRoster()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
                >
                  <Plus size={16} />
                  Create roster
                </button>
              ) : (
                <button
                  onClick={() => setCreateRosterOpen(true)}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] px-4 py-3 text-sm text-white hover:bg-white/5"
                >
                  <Plus size={16} />
                  New roster
                </button>
              )}
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] px-4 py-6 text-white/60">
              Loading roster...
            </div>
          ) : !selectedRoster ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-10 text-center">
              <p className="text-lg font-semibold text-white">No roster yet</p>
              <p className="mt-2 text-sm text-white/45">
                Create a roster to start assigning duties for {office?.name ?? "your office"}.
              </p>
              <button
                onClick={() => void handleQuickCreateRoster()}
                className="mt-5 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black hover:bg-orange-400"
              >
                Create roster
              </button>
            </div>
          ) : (
            <>
              <section className="mb-6 rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/45">Active roster</p>
                    <p className="text-xl font-semibold text-white">
                      {selectedRoster.title}
                    </p>
                    <p className="text-sm text-white/35">
                      {office?.name} - week of {selectedRoster.week_start}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <select
                      value={selectedRosterId}
                      onChange={(e) => void handleRosterChange(e.target.value)}
                      className="rounded-xl border border-white/[0.08] bg-[#050505] px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                    >
                      {rosters.map((roster) => (
                        <option key={roster.id} value={roster.id}>
                          {roster.title}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => void handleArchiveToggle()}
                      className="rounded-xl border border-white/[0.08] px-3 py-2 text-xs text-white/70 hover:bg-white/5"
                    >
                      {selectedRoster.status === "active" ? "Pause" : "Activate"}
                    </button>
                    <button
                      onClick={() => void handleDelete()}
                      className="rounded-xl border border-red-500/20 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10"
                    >
                      <Trash2 size={14} className="inline" /> Delete
                    </button>
                  </div>
                </div>
              </section>

              <section className="mb-6 grid gap-3 md:grid-cols-3">
                {WIZARD_STEPS.map((step) => {
                  const isActive = wizardStep === step.id;
                  const isDone = wizardStep > step.id;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => setWizardStep(step.id)}
                      className={[
                        "rounded-2xl border px-4 py-4 text-left transition",
                        isActive
                          ? "border-orange-500 bg-orange-500/10"
                          : isDone
                            ? "border-white/[0.08] bg-[#0f0f0f]"
                            : "border-white/8 bg-[#0f0f0f] hover:bg-white/3",
                      ].join(" ")}
                    >
                      <p className="text-xs uppercase tracking-wider text-white/35">
                        Step {step.id}
                      </p>
                      <p className="mt-1 font-semibold text-white">{step.label}</p>
                    </button>
                  );
                })}
              </section>

              <section className="mb-6 rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-5">
                {wizardStep === 1 ? (
                  <RosterParticipantsStep
                    users={users}
                    participantIds={draftParticipantIds}
                    onParticipantIdsChange={(next) => {
                      setDraftParticipantIds(next);
                      setParticipantsDirty(true);
                    }}
                    onSave={handleSaveParticipants}
                    saving={savingParticipants}
                    dirty={participantsDirty}
                  />
                ) : null}

                {wizardStep === 2 ? (
                  <RosterDutiesStep
                    duties={duties}
                    activeDutyIds={draftDutyIds}
                    participantIds={draftParticipantIds}
                    users={users}
                    assignments={assignmentDraft}
                    onAssignmentsChange={(next) => {
                      setAssignmentDraft(next);
                      setDutiesDirty(true);
                    }}
                    onActiveDutyIdsChange={(next) => {
                      setDraftDutyIds(next);
                      setDutiesDirty(true);
                    }}
                    onEditDuty={(duty) => {
                      setEditingDuty(duty);
                      setDutyModalOpen(true);
                    }}
                    onCreateDuty={() => {
                      setEditingDuty(null);
                      setDutyModalOpen(true);
                    }}
                    onSave={handleSaveDuties}
                    onSaveAndGenerate={handleSaveAndGenerateRotation}
                    saving={savingDuties}
                    generating={generatingRotation}
                    dirty={dutiesDirty}
                    participantsDirty={participantsDirty}
                    rotationWeekCount={DUTY_ROSTER_ROTATION_WEEKS}
                  />
                ) : null}

                {wizardStep === 3 ? (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-lg font-semibold text-white">
                        Review schedule
                      </h3>
                      <p className="mt-1 text-sm text-white/45">
                        Your active duties and the next {DUTY_ROSTER_ROTATION_WEEKS}{" "}
                        weeks of assignments.
                      </p>
                    </div>

                    {successMessage ? (
                      <p className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                        {successMessage}
                      </p>
                    ) : null}

                    <section className="rounded-2xl border border-white/[0.08] bg-[#050505] p-4">
                      <h4 className="text-sm font-semibold text-white">
                        Active duties ({activeDutiesForReview.length})
                      </h4>
                      {activeDutiesForReview.length === 0 ? (
                        <p className="mt-2 text-sm text-white/45">
                          No duties saved yet. Go back to step 2, activate duties,
                          and generate the rotation.
                        </p>
                      ) : (
                        <div className="mt-3 space-y-2">
                          {activeDutiesForReview.map((duty) => (
                            <div
                              key={duty.id}
                              className="rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-white/80"
                            >
                              {duty.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </section>

                    {previewLoading ? (
                      <p className="text-sm text-white/45">Loading assignments...</p>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-2">
                        {monthWeekAssignments.map((week) => (
                          <RosterSimplePreview
                            key={week.weekStart}
                            title={`Week of ${week.weekStart}`}
                            assignments={week.assignments}
                            users={users}
                            emptyMessage="No assignments for this week yet. Generate the rotation in step 2."
                          />
                        ))}
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={
                        generatingRotation ||
                        participantsDirty ||
                        draftParticipantIds.length === 0 ||
                        draftDutyIds.length === 0
                      }
                      onClick={() => void handleSaveAndGenerateRotation()}
                      className="inline-flex items-center gap-2 rounded-2xl border border-white/[0.08] px-5 py-3 text-sm font-semibold text-white/80 hover:bg-white/5 disabled:opacity-50"
                    >
                      {generatingRotation
                        ? "Regenerating..."
                        : `Regenerate ${DUTY_ROSTER_ROTATION_WEEKS}-week rotation`}
                    </button>
                  </div>
                ) : null}
              </section>

              <div className="mb-6 flex flex-wrap justify-between gap-3">
                <button
                  type="button"
                  disabled={wizardStep === 1}
                  onClick={() =>
                    setWizardStep((step) => (step > 1 ? ((step - 1) as 1 | 2 | 3) : step))
                  }
                  className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-white/70 hover:bg-white/5 disabled:opacity-40"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={wizardStep === 3}
                  onClick={() => {
                    if (wizardStep === 1 && participantsDirty) {
                      setError("Save participants before continuing.");
                      return;
                    }
                    setError("");
                    setWizardStep((step) =>
                      step < 3 ? ((step + 1) as 1 | 2 | 3) : step,
                    );
                  }}
                  className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-40"
                >
                  Continue
                </button>
              </div>
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
          duties={duties.filter((duty) => duty.is_active)}
          onCreated={() => loadPage(selectedRosterId)}
        />
      ) : null}

      {office ? (
        <CreateRosterEntryModal
          open={dutyModalOpen}
          onClose={() => setDutyModalOpen(false)}
          organizationId={organizationId}
          officeId={office.id}
          userId={userId}
          users={users}
          duty={editingDuty}
          onCreated={(savedDuty) =>
            void refreshDutyDefinitions(savedDuty?.id)
          }
        />
      ) : null}
    </div>
  );
}
