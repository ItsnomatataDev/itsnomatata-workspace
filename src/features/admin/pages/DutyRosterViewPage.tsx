import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Clock3, Users } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getDutyRosters,
  getDutyRosterEntries,
  getOrganizationUsersForRoster,
  type DutyRosterRow,
  type DutyRosterEntryRow,
  type ProfileRosterUserRow,
} from "../services/adminService";

const SHIFT_COLORS: Record<string, string> = {
  morning: "bg-amber-500/15 text-amber-200 border-amber-500/20",
  afternoon: "bg-sky-500/15 text-sky-200 border-sky-500/20",
  evening: "bg-purple-500/15 text-purple-200 border-purple-500/20",
  night: "bg-indigo-500/15 text-indigo-200 border-indigo-500/20",
  off: "bg-white/5 text-white/40 border-white/10",
};

function getShiftColor(shiftName: string) {
  const lower = shiftName.toLowerCase();
  for (const key of Object.keys(SHIFT_COLORS)) {
    if (lower.includes(key)) return SHIFT_COLORS[key];
  }
  return "bg-orange-500/15 text-orange-200 border-orange-500/20";
}

function formatTime(value?: string | null) {
  if (!value) return "--";
  return value.slice(0, 5);
}

function formatShiftDate(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-ZA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default function DutyRosterViewPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;
  const organizationId = profile?.organization_id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rosters, setRosters] = useState<DutyRosterRow[]>([]);
  const [selectedRosterId, setSelectedRosterId] = useState("");
  const [entries, setEntries] = useState<DutyRosterEntryRow[]>([]);
  const [users, setUsers] = useState<ProfileRosterUserRow[]>([]);

  const selectedRoster = useMemo(
    () => rosters.find((r) => r.id === selectedRosterId) ?? null,
    [rosters, selectedRosterId],
  );

  const myEntries = useMemo(
    () => entries.filter((e) => e.user_id === user?.id),
    [entries, user?.id],
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

      const rosterIdToUse = rostersData[0]?.id ?? "";
      setSelectedRosterId(rosterIdToUse);

      if (rosterIdToUse) {
        const entriesData = await getDutyRosterEntries(rosterIdToUse);
        setEntries(entriesData);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load duty roster.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const handleRosterChange = async (rosterId: string) => {
    try {
      setSelectedRosterId(rosterId);
      const entriesData = await getDutyRosterEntries(rosterId);
      setEntries(entriesData);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load roster.");
    }
  };

  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // Group entries by date for a calendar-like view
  const entriesByDate = useMemo(() => {
    const map = new Map<string, DutyRosterEntryRow[]>();
    for (const entry of entries) {
      const list = map.get(entry.shift_date) ?? [];
      list.push(entry);
      map.set(entry.shift_date, list);
    }
    return map;
  }, [entries]);

  const sortedDates = useMemo(
    () => [...entriesByDate.keys()].sort(),
    [entriesByDate],
  );

  if (!profile || !user) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          {/* Header */}
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Organisation
            </p>
            <h1 className="mt-2 text-3xl font-bold">Duty Roster</h1>
            <p className="mt-2 text-sm text-white/50">
              View who is on shift, when, and what department — across the
              entire team.
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
          ) : rosters.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
              <CalendarClock size={36} className="mx-auto mb-4 text-white/20" />
              <p className="font-semibold text-white">
                No rosters published yet
              </p>
              <p className="mt-2 text-sm text-white/50">
                Your administrator hasn't created any rosters yet. Check back
                soon.
              </p>
            </div>
          ) : (
            <>
              {/* Stats */}
              <section className="mb-6 grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Rosters</p>
                    <CalendarClock size={18} className="text-orange-500" />
                  </div>
                  <p className="mt-4 text-3xl font-bold">{rosters.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">Team members</p>
                    <Users size={18} className="text-orange-500" />
                  </div>
                  <p className="mt-4 text-3xl font-bold">{users.length}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-white/60">My shifts</p>
                    <Clock3 size={18} className="text-orange-500" />
                  </div>
                  <p className="mt-4 text-3xl font-bold">{myEntries.length}</p>
                </div>
              </section>

              {/* Your upcoming shifts callout */}
              {myEntries.length > 0 ? (
                <section className="mb-6 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-5">
                  <p className="text-xs uppercase tracking-[0.2em] text-orange-400">
                    Your shifts
                  </p>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {myEntries.slice(0, 5).map((entry) => (
                      <div
                        key={entry.id}
                        className={[
                          "rounded-2xl border px-4 py-3 text-sm",
                          getShiftColor(entry.shift_name),
                        ].join(" ")}
                      >
                        <p className="font-semibold">{entry.shift_name}</p>
                        <p className="mt-1 text-xs opacity-80">
                          {formatShiftDate(entry.shift_date)}
                        </p>
                        <p className="text-xs opacity-70">
                          {formatTime(entry.start_time)} –{" "}
                          {formatTime(entry.end_time)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              {/* Roster selector */}
              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <label className="mb-2 block text-sm text-white/70">
                  Select week / roster
                </label>
                <select
                  value={selectedRosterId}
                  onChange={(e) => void handleRosterChange(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500 sm:max-w-sm"
                >
                  {rosters.map((roster) => (
                    <option key={roster.id} value={roster.id}>
                      {roster.title}
                      {roster.department
                        ? ` — ${roster.department}`
                        : ""} (w/c {roster.week_start})
                    </option>
                  ))}
                </select>
                {selectedRoster?.department ? (
                  <p className="mt-2 text-xs text-white/40">
                    Department: {selectedRoster.department}
                  </p>
                ) : null}
              </section>

              {/* Calendar-style grid */}
              {entries.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/50">
                  No shifts have been entered for this roster yet.
                </div>
              ) : (
                <section className="space-y-4">
                  {sortedDates.map((date) => {
                    const dayEntries = entriesByDate.get(date) ?? [];

                    return (
                      <div
                        key={date}
                        className="overflow-hidden rounded-2xl border border-white/10 bg-white/5"
                      >
                        <div className="border-b border-white/10 bg-white/5 px-5 py-3">
                          <p className="text-sm font-semibold text-white">
                            {formatShiftDate(date)}
                          </p>
                          <p className="text-xs text-white/40">
                            {dayEntries.length} shift
                            {dayEntries.length === 1 ? "" : "s"}
                          </p>
                        </div>

                        <div className="divide-y divide-white/5">
                          {dayEntries.map((entry) => {
                            const entryUser = userMap.get(entry.user_id);
                            const isMe = entry.user_id === user.id;

                            return (
                              <div
                                key={entry.id}
                                className={[
                                  "flex flex-wrap items-center gap-4 px-5 py-4",
                                  isMe ? "bg-orange-500/5" : "",
                                ].join(" ")}
                              >
                                {/* Employee */}
                                <div className="min-w-40 flex-1">
                                  <div className="flex items-center gap-2">
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-bold text-white">
                                      {(
                                        entryUser?.full_name ??
                                        entryUser?.email ??
                                        "?"
                                      )
                                        .charAt(0)
                                        .toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="text-sm font-medium text-white">
                                        {entryUser?.full_name ??
                                          entryUser?.email ??
                                          "Unknown"}
                                        {isMe ? (
                                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-orange-400">
                                            You
                                          </span>
                                        ) : null}
                                      </p>
                                      <p className="text-xs text-white/40">
                                        {entryUser?.primary_role ?? "—"}
                                      </p>
                                    </div>
                                  </div>
                                </div>

                                {/* Shift badge */}
                                <span
                                  className={[
                                    "rounded-full border px-3 py-1 text-xs font-semibold",
                                    getShiftColor(entry.shift_name),
                                  ].join(" ")}
                                >
                                  {entry.shift_name}
                                </span>

                                {/* Time */}
                                <p className="text-sm text-white/60">
                                  {formatTime(entry.start_time)} –{" "}
                                  {formatTime(entry.end_time)}
                                </p>

                                {/* Notes */}
                                {entry.notes ? (
                                  <p className="text-xs text-white/40">
                                    {entry.notes}
                                  </p>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
