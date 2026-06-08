import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Sparkles, Users } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getCompanyOffices } from "../../../lib/supabase/queries/offices";
import RosterTable from "../components/RosterTable";
import {
  canViewDutyRoster,
  getCurrentDutyWeekStart,
  getDutyAssignmentsForWeek,
  getDutyDefinitions,
  getDutyEligibilityOverrides,
  getDutyRosterDuties,
  getDutyRosterMembers,
  getDutyRosters,
  getOrganizationUsersForRoster,
  type DutyAssignmentPreview,
  type DutyDefinitionRow,
  type DutyEligibilityOverrideRow,
  type DutyRosterDutyRow,
  type DutyRosterMemberRow,
  type DutyRosterRow,
  type ProfileRosterUserRow,
} from "../services/adminService";

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function DutyRosterViewPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;
  const organizationId = profile?.organization_id ?? null;
  const officeId = profile?.office_id ?? null;
  const canView = canViewDutyRoster(profile);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rosters, setRosters] = useState<DutyRosterRow[]>([]);
  const [users, setUsers] = useState<ProfileRosterUserRow[]>([]);
  const [duties, setDuties] = useState<DutyDefinitionRow[]>([]);
  const [rosterMembers, setRosterMembers] = useState<DutyRosterMemberRow[]>([]);
  const [rosterDuties, setRosterDuties] = useState<DutyRosterDutyRow[]>([]);
  const [thisWeekAssignments, setThisWeekAssignments] = useState<
    DutyAssignmentPreview[]
  >([]);
  const [nextWeekAssignments, setNextWeekAssignments] = useState<
    DutyAssignmentPreview[]
  >([]);
  const [overridesByDuty, setOverridesByDuty] = useState<
    Map<string, DutyEligibilityOverrideRow[]>
  >(new Map());
  const [officeName, setOfficeName] = useState("Office");

  const selectedRoster = useMemo(
    () => rosters.find((roster) => (roster.status ?? "active") === "active") ?? rosters[0] ?? null,
    [rosters],
  );

  const currentWeek = getCurrentDutyWeekStart();
  const nextWeek = addDays(currentWeek, 7);

  const loadAssignments = useCallback(
    async (
      roster: DutyRosterRow,
      members: DutyRosterMemberRow[],
      rosterDutyRows: DutyRosterDutyRow[],
      dutyRows: DutyDefinitionRow[],
      officeUsers: ProfileRosterUserRow[],
    ) => {
      const dutyIds = rosterDutyRows.map((item) => item.duty_id);
      const overrides = await getDutyEligibilityOverrides(dutyIds);
      const grouped = overrides.reduce((map, item) => {
        const current = map.get(item.duty_id) ?? [];
        current.push(item);
        map.set(item.duty_id, current);
        return map;
      }, new Map<string, DutyEligibilityOverrideRow[]>());

      const [currentAssignments, upcomingAssignments] = await Promise.all([
        getDutyAssignmentsForWeek({
          roster,
          weekStart: currentWeek,
          rosterMembers: members,
          rosterDuties: rosterDutyRows,
          duties: dutyRows,
          users: officeUsers,
          persist: true,
        }),
        getDutyAssignmentsForWeek({
          roster,
          weekStart: nextWeek,
          rosterMembers: members,
          rosterDuties: rosterDutyRows,
          duties: dutyRows,
          users: officeUsers,
          persist: true,
        }),
      ]);

      setOverridesByDuty(grouped);
      setThisWeekAssignments(currentAssignments);
      setNextWeekAssignments(upcomingAssignments);
    },
    [currentWeek, nextWeek],
  );

  const loadPage = useCallback(async () => {
    if (!organizationId || !officeId) return;

    try {
      setLoading(true);
      setError("");

      const offices = await getCompanyOffices(organizationId);
      const office = offices.find((item) => item.id === officeId) ?? null;
      setOfficeName(office?.name ?? "Office");

      if (!office || !canView) {
        setRosters([]);
        setUsers([]);
        setDuties([]);
        setRosterMembers([]);
        setRosterDuties([]);
        setThisWeekAssignments([]);
        setNextWeekAssignments([]);
        return;
      }

      const [rostersData, usersData, dutiesData] = await Promise.all([
        getDutyRosters(organizationId, office.id),
        getOrganizationUsersForRoster(organizationId, office.id),
        getDutyDefinitions(organizationId, office.id),
      ]);

      const activeRoster =
        rostersData.find((roster) => (roster.status ?? "active") === "active") ??
        rostersData[0] ??
        null;

      const [membersData, rosterDutiesData] = activeRoster
        ? await Promise.all([
            getDutyRosterMembers(activeRoster.id),
            getDutyRosterDuties(activeRoster.id),
          ])
        : [[], []];

      setRosters(rostersData);
      setUsers(usersData);
      setDuties(dutiesData);
      setRosterMembers(membersData);
      setRosterDuties(rosterDutiesData);

      if (activeRoster) {
        await loadAssignments(
          activeRoster,
          membersData,
          rosterDutiesData,
          dutiesData,
          usersData,
        );
      } else {
        setThisWeekAssignments([]);
        setNextWeekAssignments([]);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load duty roster.");
    } finally {
      setLoading(false);
    }
  }, [canView, loadAssignments, officeId, organizationId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const myAssignments = useMemo(
    () =>
      thisWeekAssignments.filter(
        (assignment) => assignment.user_id === user?.id,
      ),
    [thisWeekAssignments, user?.id],
  );

  const specialDayAssignment = useMemo(
    () =>
      thisWeekAssignments.find((assignment) => assignment.is_special_day) ??
      null,
    [thisWeekAssignments],
  );

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const specialDayUser = specialDayAssignment
    ? userMap.get(specialDayAssignment.user_id)
    : null;

  if (!profile || !user) return null;

  if (!canView) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar role={profile.primary_role} />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-8">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Duty Roster
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">
                Office assignment required
              </h1>
              <p className="mt-3 text-white/55">
                Duty roster is available once your profile is linked to an
                office.
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
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              {officeName}
            </p>
            <h1 className="mt-2 text-3xl font-bold">Duty Roster</h1>
            <p className="mt-2 text-sm text-white/50">
              This week's duties, your assignment, next week preview, and the
              team duty board.
            </p>
          </div>

          {error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/50">
              Loading duty roster...
            </div>
          ) : !selectedRoster ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
              <CalendarClock size={36} className="mx-auto mb-4 text-white/20" />
              <p className="font-semibold text-white">
                No duty roster published yet
              </p>
              <p className="mt-2 text-sm text-white/50">
                An office admin can create the first duty roster for your team.
              </p>
            </div>
          ) : (
            <>
              <section className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/60">This week</p>
                  <p className="mt-3 text-2xl font-bold text-white">
                    {currentWeek}
                  </p>
                  <p className="mt-1 text-xs text-white/35">
                    {thisWeekAssignments.length} active duties
                  </p>
                </div>
                <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5">
                  <p className="text-sm text-orange-200">My duty this week</p>
                  <p className="mt-3 text-2xl font-bold text-white">
                    {myAssignments.length > 0
                      ? myAssignments.map((item) => item.duty_name).join(", ")
                      : "No duty"}
                  </p>
                  <p className="mt-1 text-xs text-orange-100/60">
                    {myAssignments.length > 0
                      ? "You're on duty"
                      : "You're clear this week"}
                  </p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/60">Team members</p>
                  <p className="mt-3 text-3xl font-bold text-white">
                    {users.length}
                  </p>
                </div>
              </section>

              {specialDayAssignment ? (
                <section className="mb-6 rounded-3xl border border-amber-500/25 bg-amber-500/10 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.25em] text-amber-200">
                        <Sparkles size={15} />
                        {specialDayAssignment.duty_name}
                      </p>
                      <h2 className="mt-2 text-2xl font-bold text-white">
                        {specialDayUser?.full_name ||
                          specialDayUser?.email ||
                          "Assigned user"}
                      </h2>
                      <p className="mt-1 text-sm text-amber-100/65">
                        {specialDayAssignment.description ||
                          "Special day duty for the team."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-amber-500/20 bg-black/30 px-4 py-3 text-sm font-semibold text-amber-100">
                      {specialDayAssignment.shift_date ?? "Scheduled day"}
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="mb-6">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarClock size={18} className="text-orange-400" />
                  <h2 className="font-semibold text-white">
                    This Week's Duties
                  </h2>
                </div>
                <RosterTable
                  assignments={thisWeekAssignments}
                  users={users}
                  duties={duties}
                  rosterMembers={rosterMembers}
                  overridesByDuty={overridesByDuty}
                  currentUserId={user.id}
                  showMeta={false}
                />
              </section>

              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <CalendarClock size={18} className="text-orange-400" />
                  <h2 className="font-semibold text-white">
                    Next Week Preview
                  </h2>
                </div>
                <RosterTable
                  assignments={nextWeekAssignments}
                  users={users}
                  duties={duties}
                  rosterMembers={rosterMembers}
                  overridesByDuty={overridesByDuty}
                  currentUserId={user.id}
                  showMeta={false}
                />
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-2">
                  <Users size={18} className="text-orange-400" />
                  <h2 className="font-semibold text-white">Team Duty Board</h2>
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {users.map((item) => {
                    const assigned = thisWeekAssignments.filter(
                      (assignment) => assignment.user_id === item.id,
                    );
                    return (
                      <div
                        key={item.id}
                        className={[
                          "rounded-xl border px-3 py-3",
                          item.id === user.id
                            ? "border-orange-500/30 bg-orange-500/10"
                            : "border-white/8 bg-black/30",
                        ].join(" ")}
                      >
                        <p className="text-sm font-medium text-white">
                          {item.full_name || item.email || "Unknown user"}
                        </p>
                        <p className="mt-1 text-xs text-white/40">
                          {assigned.length > 0
                            ? assigned.map((entry) => entry.duty_name).join(", ")
                            : "No duty this week"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
