import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BadgeDollarSign,
  Clock3,
  FolderKanban,
  Receipt,
  Users,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getAdminTimeEntries,
  getAdminTimeSummary,
  type AdminTimeEntryRow,
  type TimeApprovalStatus,
} from "../../../lib/supabase/queries/adminTime";
import TimeApprovalTable from "../components/TimeApprovalTable";

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function startOfTodayIso() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function startOfWeekIso() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

function startOfMonthIso() {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function getDisplayLabel(entry: AdminTimeEntryRow) {
  return entry.description || "No description";
}

export default function EverhourAdminPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;

  const [entries, setEntries] = useState<AdminTimeEntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [summary, setSummary] = useState({
    totalSeconds: 0,
    pendingCount: 0,
    approvedSeconds: 0,
    billableSeconds: 0,
    activeCount: 0,
    totalCost: 0,
  });

  const [approvalStatus, setApprovalStatus] = useState<
    TimeApprovalStatus | "all"
  >("all");
  const [isBillable, setIsBillable] = useState<boolean | "all">("all");

  const organizationId = profile?.organization_id ?? null;

  const canManage =
    profile?.primary_role === "admin" || profile?.primary_role === "manager";

  useEffect(() => {
    if (!organizationId || !canManage) return;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [rows, summaryData] = await Promise.all([
          getAdminTimeEntries({
            organizationId,
            approvalStatus,
            isBillable,
            limit: 300,
          }),
          getAdminTimeSummary({
            organizationId,
          }),
        ]);

        setEntries(rows);
        setSummary(summaryData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Failed to load Everhour admin dashboard.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [organizationId, canManage, approvalStatus, isBillable]);

  const todayIso = useMemo(() => startOfTodayIso(), []);
  const weekIso = useMemo(() => startOfWeekIso(), []);
  const monthIso = useMemo(() => startOfMonthIso(), []);

  const todayEntries = useMemo(
    () => entries.filter((entry) => entry.started_at >= todayIso),
    [entries, todayIso],
  );

  const weekEntries = useMemo(
    () => entries.filter((entry) => entry.started_at >= weekIso),
    [entries, weekIso],
  );

  const monthEntries = useMemo(
    () => entries.filter((entry) => entry.started_at >= monthIso),
    [entries, monthIso],
  );

  const todaySeconds = useMemo(
    () =>
      todayEntries.reduce(
        (sum, entry) => sum + Number(entry.duration_seconds ?? 0),
        0,
      ),
    [todayEntries],
  );

  const weekSeconds = useMemo(
    () =>
      weekEntries.reduce(
        (sum, entry) => sum + Number(entry.duration_seconds ?? 0),
        0,
      ),
    [weekEntries],
  );

  const monthSeconds = useMemo(
    () =>
      monthEntries.reduce(
        (sum, entry) => sum + Number(entry.duration_seconds ?? 0),
        0,
      ),
    [monthEntries],
  );

  const pendingEntries = useMemo(
    () => entries.filter((entry) => entry.approval_status === "pending"),
    [entries],
  );

  const topWorkItems = useMemo(() => {
    const map = new Map<string, number>();

    for (const entry of entries) {
      const label = getDisplayLabel(entry);
      map.set(
        label,
        (map.get(label) ?? 0) + Number(entry.duration_seconds ?? 0),
      );
    }

    return Array.from(map.entries())
      .map(([label, seconds]) => ({ label, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 8);
  }, [entries]);

  const billablePercent = useMemo(() => {
    if (!summary.totalSeconds) return 0;
    return Math.round((summary.billableSeconds / summary.totalSeconds) * 100);
  }, [summary.billableSeconds, summary.totalSeconds]);

  if (!auth?.user || !profile || !organizationId || !canManage) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Everhour Control Center
            </p>
            <h1 className="mt-2 text-3xl font-bold">
              Time Operations Dashboard
            </h1>
            <p className="mt-2 text-sm text-white/50">
              Monitor active timers, pending approvals, billable performance,
              and top work across the organization.
            </p>
          </div>

          {error ? (
            <div className="mb-6 border border-red-500/20 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <Clock3 size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Today</p>
              </div>
              <p className="mt-3 text-2xl font-bold">
                {formatDuration(todaySeconds)}
              </p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <Clock3 size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">This week</p>
              </div>
              <p className="mt-3 text-2xl font-bold">
                {formatDuration(weekSeconds)}
              </p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <Receipt size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">This month</p>
              </div>
              <p className="mt-3 text-2xl font-bold">
                {formatDuration(monthSeconds)}
              </p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <Activity size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Active timers</p>
              </div>
              <p className="mt-3 text-2xl font-bold">{summary.activeCount}</p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Pending approvals</p>
              </div>
              <p className="mt-3 text-2xl font-bold">{summary.pendingCount}</p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <BadgeDollarSign size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Total cost</p>
              </div>
              <p className="mt-3 text-2xl font-bold">
                ${Number(summary.totalCost ?? 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="border border-white/10 bg-[#050505] p-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-white/45">Top workload</p>
                  <h2 className="mt-2 text-2xl font-bold">Most tracked work</h2>
                </div>
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-2 text-sm text-orange-300">
                  Billable ratio: {billablePercent}%
                </div>
              </div>

              {topWorkItems.length === 0 ? (
                <p className="mt-6 text-white/50">No tracked work yet.</p>
              ) : (
                <div className="mt-6 space-y-3">
                  {topWorkItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-4 border border-white/10 bg-black/30 p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {item.label}
                        </p>
                      </div>
                      <div className="shrink-0 text-sm text-orange-400">
                        {formatDuration(item.seconds)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="border border-white/10 bg-[#050505] p-6">
              <p className="text-sm text-white/45">Approval pressure</p>
              <h2 className="mt-2 text-2xl font-bold">Pending queue</h2>

              {pendingEntries.length === 0 ? (
                <p className="mt-6 text-white/50">
                  No pending entries right now.
                </p>
              ) : (
                <div className="mt-6 space-y-3">
                  {pendingEntries.slice(0, 8).map((entry) => (
                    <div
                      key={entry.id}
                      className="border border-white/10 bg-black/30 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium text-white">
                            {entry.description || "No description"}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {entry.user_id}
                          </p>
                        </div>
                        <div className="text-sm text-orange-400">
                          {formatDuration(entry.duration_seconds ?? 0)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <section className="mt-6 border border-white/10 bg-[#050505] p-6">
            <div className="mb-6 flex flex-wrap gap-3">
              <select
                value={approvalStatus}
                onChange={(event) =>
                  setApprovalStatus(
                    event.target.value as TimeApprovalStatus | "all",
                  )
                }
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
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
                  if (value === "all") setIsBillable("all");
                  else setIsBillable(value === "true");
                }}
                className="rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
              >
                <option value="all">All billing</option>
                <option value="true">Billable</option>
                <option value="false">Non-billable</option>
              </select>
            </div>

            {loading ? (
              <div className="text-white/60">Loading time dashboard...</div>
            ) : (
              <TimeApprovalTable
                entries={entries}
                selectedIds={[]}
                onToggleSelect={() => {}}
                onApprove={() => {}}
                onReject={() => {}}
              />
            )}
          </section>

          <section className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <FolderKanban size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Approved time</p>
              </div>
              <p className="mt-3 text-2xl font-bold">
                {formatDuration(summary.approvedSeconds)}
              </p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <BadgeDollarSign size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Billable time</p>
              </div>
              <p className="mt-3 text-2xl font-bold">
                {formatDuration(summary.billableSeconds)}
              </p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Total tracked</p>
              </div>
              <p className="mt-3 text-2xl font-bold">
                {formatDuration(summary.totalSeconds)}
              </p>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
