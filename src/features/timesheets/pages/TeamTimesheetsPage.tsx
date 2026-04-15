import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Filter,
  Users,
  Briefcase,
  DollarSign,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getAdminTimeEntries,
  type AdminTimeEntryRow,
  type TimeApprovalStatus,
} from "../../../lib/supabase/queries/adminTime";

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function formatMoney(amount: number) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDateOnly(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

type GroupMode = "user" | "project" | "day";

export default function TeamTimesheetsPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;

  const [entries, setEntries] = useState<AdminTimeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [approvalStatus, setApprovalStatus] = useState<
    TimeApprovalStatus | "all"
  >("all");
  const [isBillable, setIsBillable] = useState<boolean | "all">("all");
  const [groupMode, setGroupMode] = useState<GroupMode>("user");

  const organizationId = profile?.organization_id ?? null;

  useEffect(() => {
    const load = async () => {
      if (!organizationId) return;

      try {
        setLoading(true);
        setError("");

        const rows = await getAdminTimeEntries({
          organizationId,
          approvalStatus,
          isBillable,
          limit: 500,
        });

        setEntries(rows);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to load team timesheets.",
        );
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [organizationId, approvalStatus, isBillable]);

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string;
        secondary?: string;
        entries: AdminTimeEntryRow[];
        totalSeconds: number;
        totalCost: number;
        billableSeconds: number;
      }
    >();

    for (const entry of entries) {
      let key = "";
      let label = "";
      let secondary = "";

      if (groupMode === "user") {
        key = entry.user_id;
        label = entry.user_name || "Unknown member";
        secondary = entry.user_email || "";
      } else if (groupMode === "project") {
        key = entry.project_id || "no-project";
        label = entry.project_name || "No project";
        secondary = entry.client_name || "";
      } else {
        key = entry.started_at?.slice(0, 10) || "unknown-day";
        label = formatDateOnly(entry.started_at);
        secondary = "Tracked day";
      }

      const current = map.get(key) ?? {
        label,
        secondary,
        entries: [],
        totalSeconds: 0,
        totalCost: 0,
        billableSeconds: 0,
      };

      current.entries.push(entry);
      current.totalSeconds += Number(entry.duration_seconds ?? 0);
      current.totalCost += Number(entry.cost_amount ?? 0);

      if (entry.is_billable) {
        current.billableSeconds += Number(entry.duration_seconds ?? 0);
      }

      map.set(key, current);
    }

    return Array.from(map.values()).sort(
      (a, b) => b.totalSeconds - a.totalSeconds,
    );
  }, [entries, groupMode]);

  const totalTrackedSeconds = useMemo(() => {
    return entries.reduce(
      (sum, entry) => sum + Number(entry.duration_seconds ?? 0),
      0,
    );
  }, [entries]);

  const totalBillableSeconds = useMemo(() => {
    return entries.reduce((sum, entry) => {
      return entry.is_billable
        ? sum + Number(entry.duration_seconds ?? 0)
        : sum;
    }, 0);
  }, [entries]);

  const totalCost = useMemo(() => {
    return entries.reduce((sum, entry) => {
      return sum + Number(entry.cost_amount ?? 0);
    }, 0);
  }, [entries]);

  if (!auth?.user || !profile) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Everhour Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">Team Timesheets</h1>
              <p className="mt-2 text-sm text-white/50">
                Review tracked time by team member, project, or day across the
                organization.
              </p>
            </div>

            <div className="border border-white/10 bg-[#050505] px-4 py-3 text-sm text-white/65">
              {entries.length} visible entries
            </div>
          </div>

          {error ? (
            <div className="mb-6 border border-red-500/20 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/45">Tracked Time</p>
                  <p className="mt-3 text-2xl font-bold text-white">
                    {formatDuration(totalTrackedSeconds)}
                  </p>
                </div>
                <div className="border border-orange-500/20 bg-orange-500/10 p-3 text-orange-400">
                  <Clock3 size={18} />
                </div>
              </div>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/45">Billable Time</p>
                  <p className="mt-3 text-2xl font-bold text-white">
                    {formatDuration(totalBillableSeconds)}
                  </p>
                </div>
                <div className="border border-orange-500/20 bg-orange-500/10 p-3 text-orange-400">
                  <Briefcase size={18} />
                </div>
              </div>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/45">Team Groups</p>
                  <p className="mt-3 text-2xl font-bold text-white">
                    {grouped.length}
                  </p>
                </div>
                <div className="border border-orange-500/20 bg-orange-500/10 p-3 text-orange-400">
                  <Users size={18} />
                </div>
              </div>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm text-white/45">Cost Snapshot</p>
                  <p className="mt-3 text-2xl font-bold text-white">
                    {formatMoney(totalCost)}
                  </p>
                </div>
                <div className="border border-orange-500/20 bg-orange-500/10 p-3 text-orange-400">
                  <DollarSign size={18} />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6 border border-white/10 bg-[#050505] p-4">
            <div className="mb-4 flex items-center gap-2 text-sm text-white/60">
              <Filter size={14} className="text-orange-400" />
              <span>Filter and group team timesheets</span>
            </div>

            <div className="flex flex-wrap gap-3">
              <select
                value={approvalStatus}
                onChange={(event) =>
                  setApprovalStatus(
                    event.target.value as TimeApprovalStatus | "all",
                  )
                }
                className="border border-white/10 bg-black px-4 py-3 text-white outline-none"
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>

              <select
                value={String(isBillable)}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === "all") {
                    setIsBillable("all");
                  } else {
                    setIsBillable(value === "true");
                  }
                }}
                className="border border-white/10 bg-black px-4 py-3 text-white outline-none"
              >
                <option value="all">All billing</option>
                <option value="true">Billable</option>
                <option value="false">Non-billable</option>
              </select>

              <select
                value={groupMode}
                onChange={(event) =>
                  setGroupMode(event.target.value as GroupMode)
                }
                className="border border-white/10 bg-black px-4 py-3 text-white outline-none"
              >
                <option value="user">Group by user</option>
                <option value="project">Group by project</option>
                <option value="day">Group by day</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="border border-white/10 bg-[#050505] p-6 text-white/60">
              Loading team timesheets...
            </div>
          ) : grouped.length === 0 ? (
            <div className="border border-white/10 bg-[#050505] p-6 text-white/60">
              No timesheet entries found for this filter.
            </div>
          ) : (
            <div className="space-y-6">
              {grouped.map((group, index) => (
                <section
                  key={`${group.label}-${index}`}
                  className="border border-white/10 bg-[#050505] p-5"
                >
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
                    <div>
                      <h2 className="text-lg font-semibold text-white">
                        {group.label}
                      </h2>
                      {group.secondary ? (
                        <p className="mt-1 text-sm text-white/45">
                          {group.secondary}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs">
                      <div className="border border-white/10 bg-black px-3 py-2 text-white/65">
                        Total: {formatDuration(group.totalSeconds)}
                      </div>
                      <div className="border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-orange-300">
                        Billable: {formatDuration(group.billableSeconds)}
                      </div>
                      <div className="border border-white/10 bg-black px-3 py-2 text-white/65">
                        Cost: {formatMoney(group.totalCost)}
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-black/40 text-left text-white/45">
                          <th className="px-4 py-3">Description</th>
                          <th className="px-4 py-3">Task</th>
                          <th className="px-4 py-3">Project</th>
                          <th className="px-4 py-3">Started</th>
                          <th className="px-4 py-3">Duration</th>
                          <th className="px-4 py-3">Billing</th>
                          <th className="px-4 py-3">Cost</th>
                          <th className="px-4 py-3">Status</th>
                        </tr>
                      </thead>

                      <tbody>
                        {group.entries.map((entry) => (
                          <tr
                            key={entry.id}
                            className="border-b border-white/5 transition hover:bg-white/3"
                          >
                            <td className="px-4 py-4 text-white">
                              {entry.description || "No description"}
                            </td>
                            <td className="px-4 py-4 text-white/70">
                              {entry.task_title || "—"}
                            </td>
                            <td className="px-4 py-4 text-white/70">
                              {entry.project_name || "—"}
                            </td>
                            <td className="px-4 py-4 text-white/70">
                              {formatDateTime(entry.started_at)}
                            </td>
                            <td className="px-4 py-4 text-white">
                              {formatDuration(entry.duration_seconds ?? 0)}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex px-3 py-2 text-xs ${
                                  entry.is_billable
                                    ? "border border-orange-500/20 bg-orange-500/10 text-orange-300"
                                    : "border border-white/10 bg-white/5 text-white/60"
                                }`}
                              >
                                {entry.is_billable
                                  ? "Billable"
                                  : "Non-billable"}
                              </span>
                            </td>
                            <td className="px-4 py-4 text-white/70">
                              {formatMoney(entry.cost_amount ?? 0)}
                            </td>
                            <td className="px-4 py-4">
                              <span
                                className={`inline-flex px-3 py-2 text-xs ${
                                  entry.approval_status === "approved"
                                    ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                                    : entry.approval_status === "rejected"
                                      ? "border border-red-500/20 bg-red-500/10 text-red-300"
                                      : "border border-orange-500/20 bg-orange-500/10 text-orange-300"
                                }`}
                              >
                                {entry.approval_status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
