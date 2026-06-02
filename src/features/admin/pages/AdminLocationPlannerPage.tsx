import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Droplets, Lock, MapPin, Move, Unlock } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getLocationPlannerAssignments,
  getOrganizationLocationsForPlanner,
  getOrganizationUsersForPlanner,
  upsertLocationPlannerAssignment,
  type LocationPlannerOfficeRow,
  type LocationPlannerUserRow,
} from "../services/adminService";

const EDITOR_ROLES = new Set(["admin", "org_admin", "super_admin", "superadmin"]);

export default function AdminLocationPlannerPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const role = String(profile?.primary_role ?? "");
  const organizationId = profile?.organization_id ?? null;

  const canEdit = EDITOR_ROLES.has(role);
  const [jetboardOpen, setJetboardOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [locations, setLocations] = useState<LocationPlannerOfficeRow[]>([]);
  const [users, setUsers] = useState<LocationPlannerUserRow[]>([]);
  const [assignmentsByUserId, setAssignmentsByUserId] = useState<Record<string, string>>({});
  const [activeDragMemberId, setActiveDragMemberId] = useState<string | null>(null);

  const nextWeekDateRange = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

    return `${dateFormatter.format(start)} - ${dateFormatter.format(end)}`;
  }, []);

  const nextWeekStart = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() + ((8 - today.getDay()) % 7 || 7));
    start.setHours(0, 0, 0, 0);
    return start.toISOString().slice(0, 10);
  }, []);

  const weekDays = useMemo(() => {
    const monday = new Date(`${nextWeekStart}T00:00:00.000Z`);
    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(monday);
      current.setUTCDate(monday.getUTCDate() + index);
      return {
        key: current.toISOString().slice(0, 10),
        dayLabel: new Intl.DateTimeFormat("en-ZA", { weekday: "short" }).format(current),
        dateLabel: new Intl.DateTimeFormat("en-ZA", {
          day: "2-digit",
          month: "short",
        }).format(current),
      };
    });
  }, [nextWeekStart]);

  const loadPlanner = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [locationsData, usersData, assignmentsData] = await Promise.all([
        getOrganizationLocationsForPlanner(organizationId),
        getOrganizationUsersForPlanner(organizationId),
        getLocationPlannerAssignments({
          organizationId,
          weekStart: nextWeekStart,
        }),
      ]);

      setLocations(locationsData);
      setUsers(usersData.filter((item) => item.account_status !== "deleted"));

      const nextAssignments: Record<string, string> = {};
      for (const assignment of assignmentsData) {
        nextAssignments[assignment.user_id] = assignment.location_office_id;
      }
      setAssignmentsByUserId(nextAssignments);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load planner data.");
    } finally {
      setLoading(false);
    }
  }, [nextWeekStart, organizationId]);

  useEffect(() => {
    void loadPlanner();
  }, [loadPlanner]);

  const jetboardLocationIds = useMemo(
    () =>
      new Set(
        locations
          .filter((location) => location.slug.toLowerCase().includes("jetboard"))
          .map((location) => location.id),
      ),
    [locations],
  );

  const fallbackLocationId = useMemo(() => {
    const threeLittleBirds = locations.find((location) =>
      location.slug.toLowerCase().includes("three-little-birds"),
    );
    return threeLittleBirds?.id ?? locations[0]?.id ?? "";
  }, [locations]);

  const visibleLocations = useMemo(
    () =>
      locations.filter((location) =>
        jetboardOpen ? true : !jetboardLocationIds.has(location.id),
      ),
    [jetboardLocationIds, jetboardOpen, locations],
  );

  const activeLocationIds = useMemo(
    () => new Set(visibleLocations.map((location) => location.id)),
    [visibleLocations],
  );

  const effectiveUsers = useMemo(
    () =>
      users.map((member) => {
        const assignedLocationId =
          assignmentsByUserId[member.id] ?? member.office_id ?? fallbackLocationId;
        const safeLocationId = activeLocationIds.has(assignedLocationId)
          ? assignedLocationId
          : fallbackLocationId;
        return {
          ...member,
          locationId: safeLocationId,
        };
      }),
    [activeLocationIds, assignmentsByUserId, fallbackLocationId, users],
  );

  const locationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const location of visibleLocations) counts.set(location.id, 0);

    for (const member of effectiveUsers) {
      if (counts.has(member.locationId)) {
        counts.set(member.locationId, (counts.get(member.locationId) ?? 0) + 1);
      }
    }

    return counts;
  }, [effectiveUsers, visibleLocations]);

  const currentUserLocation = useMemo(() => {
    if (!user?.id) return null;
    const me = effectiveUsers.find((member) => member.id === user.id);
    if (!me) return null;
    return visibleLocations.find((location) => location.id === me.locationId) ?? null;
  }, [effectiveUsers, user?.id, visibleLocations]);

  const moveMemberToLocation = async (memberId: string, locationId: string) => {
    if (!canEdit) return;
    if (!activeLocationIds.has(locationId)) return;

    if (!organizationId) return;

    const previous = assignmentsByUserId[memberId];

    setAssignmentsByUserId((current) => ({
      ...current,
      [memberId]: locationId,
    }));

    try {
      setSaving(true);
      await upsertLocationPlannerAssignment({
        organizationId,
        weekStart: nextWeekStart,
        userId: memberId,
        locationOfficeId: locationId,
        assignedBy: user?.id ?? null,
      });
    } catch (err: any) {
      setError(err?.message ?? "Failed to save assignment.");
      setAssignmentsByUserId((current) => {
        const next = { ...current };
        if (previous) {
          next[memberId] = previous;
        } else {
          delete next[memberId];
        }
        return next;
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile?.primary_role} />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                {canEdit ? "Admin Workspace" : "Team Workspace"}
              </p>
              <h1 className="mt-2 text-3xl font-bold">People Location Calendar</h1>
              <p className="mt-2 text-sm text-white/60">
                {canEdit
                  ? "Weekly people planner for offices and seasonal sites. Drag people between locations to adjust next-week allocations."
                  : "Read-only weekly team calendar showing where everyone is allocated."}
              </p>
              {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.25em] text-white/40">Access</p>
              <p className="mt-1 flex items-center gap-2 text-sm font-medium">
                {canEdit ? <Unlock size={14} className="text-emerald-300" /> : <Lock size={14} className="text-orange-300" />}
                {canEdit ? "You can manage assignments" : "View-only mode"} {saving ? " - saving..." : ""}
              </p>
            </div>
          </div>

          <section className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/60">Planning week</p>
              <p className="mt-3 flex items-center gap-2 text-xl font-semibold">
                <CalendarDays size={18} className="text-orange-400" />
                {nextWeekDateRange}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/60">Active locations</p>
              <p className="mt-3 text-3xl font-bold">{visibleLocations.length}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <p className="text-sm text-white/60">Assigned people</p>
              <p className="mt-3 text-3xl font-bold">{effectiveUsers.length}</p>
            </div>
          </section>

          <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Weekly Calendar View</h2>
                <p className="mt-1 text-sm text-white/55">
                  Clean weekly snapshot of where the team is allocated.
                </p>
              </div>
              <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/60">
                {nextWeekDateRange}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-7">
              {weekDays.map((day) => (
                <div key={day.key} className="rounded-xl border border-white/10 bg-black/30 p-3">
                  <p className="text-xs uppercase tracking-wide text-white/45">{day.dayLabel}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{day.dateLabel}</p>
                  <div className="mt-3 space-y-2">
                    {visibleLocations.map((location) => (
                      <div
                        key={`${day.key}-${location.id}`}
                        className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5"
                      >
                        <span className="truncate pr-2 text-[11px] text-white/70">{location.name}</span>
                        <span className="rounded-full bg-black/40 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">
                          {locationCounts.get(location.id) ?? 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {canEdit ? (
            <>
              <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Seasonal Site Conditions</h2>
                    <p className="mt-1 text-sm text-white/55">
                      Jetboard opens only when the Zambezi river conditions are safe.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setJetboardOpen((previous) => !previous)}
                    className={[
                      "inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition",
                      jetboardOpen
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                        : "border-orange-500/30 bg-orange-500/10 text-orange-200",
                      "hover:opacity-90",
                    ].join(" ")}
                  >
                    <Droplets size={15} />
                    {jetboardOpen ? "Jetboard is open" : "Jetboard is closed"}
                  </button>
                </div>
              </section>

              <section className="mb-6">
                <div className="mb-4 flex items-center gap-2">
                  <Move size={16} className="text-orange-400" />
                  <h2 className="text-lg font-semibold">Admin Planning Board</h2>
                </div>
                {loading ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-sm text-white/60">
                    Loading organization users and locations...
                  </div>
                ) : visibleLocations.length === 0 ? (
                  <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-sm text-white/60">
                    No locations found. Add offices first, then plan people by location.
                  </div>
                ) : (
                  <div className="grid gap-4 lg:grid-cols-3">
                    {visibleLocations.map((location) => {
                      const locationMembers = effectiveUsers.filter((member) => member.locationId === location.id);

                      return (
                        <div
                          key={location.id}
                          onDragOver={(event) => {
                            event.preventDefault();
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const memberId = event.dataTransfer.getData("text/memberId");
                            if (memberId) moveMemberToLocation(memberId, location.id);
                            setActiveDragMemberId(null);
                          }}
                          className="rounded-2xl border border-white/10 bg-white/5 p-4"
                        >
                          <div className="mb-3 flex items-start justify-between gap-2">
                            <div>
                              <h3 className="flex items-center gap-2 text-base font-semibold">
                                <MapPin size={15} className="text-orange-300" />
                                {location.name}
                              </h3>
                              <p className="mt-1 text-xs text-white/40">{location.slug}</p>
                            </div>
                            <span className="rounded-full bg-black/40 px-2 py-1 text-xs font-semibold text-white/70">
                              {locationCounts.get(location.id) ?? 0}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {locationMembers.length === 0 ? (
                              <div className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-xs text-white/45">
                                Drop people here
                              </div>
                            ) : (
                              locationMembers.map((member) => (
                                <div
                                  key={member.id}
                                  draggable
                                  onDragStart={(event) => {
                                    setActiveDragMemberId(member.id);
                                    event.dataTransfer.setData("text/memberId", member.id);
                                  }}
                                  onDragEnd={() => setActiveDragMemberId(null)}
                                  className={[
                                    "rounded-xl border border-white/10 bg-black/30 px-3 py-2",
                                    "cursor-grab active:cursor-grabbing",
                                    activeDragMemberId === member.id ? "opacity-50" : "",
                                  ].join(" ")}
                                >
                                  <p className="text-sm font-medium text-white">
                                    {member.full_name || member.email || "Unnamed user"}
                                  </p>
                                  <p className="text-xs text-white/45">
                                    {member.department || "General"} - {member.primary_role || "Team member"}
                                  </p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Team View</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Read-only schedule overview for next week.
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-xs text-white/60">
                  {currentUserLocation ? `Your location: ${currentUserLocation.name}` : "No personal assignment"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {visibleLocations.map((location) => {
                  const locationMembers = effectiveUsers.filter((member) => member.locationId === location.id);
                  return (
                    <div key={location.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-semibold text-white">{location.name}</p>
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-white/70">
                          {locationMembers.length}
                        </span>
                      </div>
                      <div className="max-h-52 space-y-1.5 overflow-auto pr-1">
                        {locationMembers.length === 0 ? (
                          <p className="text-xs text-white/40">No people allocated</p>
                        ) : (
                          locationMembers.map((member) => (
                            <div key={member.id} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                              <p className="truncate text-xs font-medium text-white">
                                {member.full_name || member.email || "Unnamed user"}
                              </p>
                              <p className="truncate text-[11px] text-white/45">
                                {member.primary_role || "Team member"}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
            <p className="font-medium text-white">How this behaves</p>
            <p className="mt-2">
              Viewers get a dedicated read-only calendar and team list, while admins get planning controls.
              If Jetboard is closed by admins, anyone assigned there appears at Three Little Birds as a fallback.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}
