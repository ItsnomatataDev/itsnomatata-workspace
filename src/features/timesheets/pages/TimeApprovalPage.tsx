import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCheck,
  Clock3,
  DollarSign,
  Filter,
  Timer,
  TriangleAlert,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getAdminTimeEntries,
  getAdminTimeSummary,
  type AdminTimeEntryRow,
  type TimeApprovalStatus,
} from "../../../lib/supabase/queries/adminTime";
import {
  approveTimeEntry,
  bulkApproveTimeEntries,
  rejectTimeEntry,
} from "../../../lib/supabase/mutations/adminTime";
import TimeApprovalTable from "../components/TimeApprovalTable";
import TimeChartsPanel from "../components/TimeChartsPanel";
import TimeInsightsPanel from "../components/TimeInsightsPanel";

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function formatMoney(amount: number) {
  return `$${Number(amount || 0).toFixed(2)}`;
}

function SummaryCard({
  title,
  value,
  subtitle,
  icon,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="border border-white/10 bg-[#050505] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-white/45">{title}</p>
          <p className="mt-3 text-2xl font-bold text-white">{value}</p>
          {subtitle ? (
            <p className="mt-2 text-xs text-white/35">{subtitle}</p>
          ) : null}
        </div>

        <div className="border border-orange-500/20 bg-orange-500/10 p-3 text-orange-400">
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function TimeApprovalPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;

  const [entries, setEntries] = useState<AdminTimeEntryRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
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
  >("pending");
  const [isBillable, setIsBillable] = useState<boolean | "all">("all");
  const [autoApproveHours, setAutoApproveHours] = useState(2);
  const [autoApproveBillable, setAutoApproveBillable] = useState(false);

  const organizationId = profile?.organization_id ?? null;

  const canManage =
    profile?.primary_role === "admin" || profile?.primary_role === "manager";

  const load = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [rows, summaryData] = await Promise.all([
        getAdminTimeEntries({
          organizationId,
          approvalStatus,
          isBillable,
          limit: 200,
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
          : "Failed to load admin time entries.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [approvalStatus, isBillable, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleSelect = (entryId: string) => {
    setSelectedIds((prev) =>
      prev.includes(entryId)
        ? prev.filter((id) => id !== entryId)
        : [...prev, entryId],
    );
  };

  const handleApprove = async (entryId: string) => {
    if (!user?.id || !canManage) return;

    try {
      setBusy(true);
      await approveTimeEntry({
        entryId,
        approvedBy: user.id,
      });
      setSelectedIds((prev) => prev.filter((id) => id !== entryId));
      await load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to approve entry";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (entryId: string) => {
    if (!canManage) return;

    try {
      setBusy(true);
      await rejectTimeEntry({ entryId });
      setSelectedIds((prev) => prev.filter((id) => id !== entryId));
      await load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to reject entry";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleBulkApprove = async () => {
    if (!user?.id || !canManage || selectedIds.length === 0) return;

    try {
      setBusy(true);
      await bulkApproveTimeEntries({
        entryIds: selectedIds,
        approvedBy: user.id,
      });
      setSelectedIds([]);
      await load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to bulk approve entries";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);
  const autoEligibleEntries = useMemo(
    () =>
      entries.filter((entry) => {
        const durationHours = Number(entry.duration_seconds ?? 0) / 3600;

        return (
          entry.approval_status === "pending" &&
          !entry.is_running &&
          Boolean(entry.ended_at) &&
          durationHours <= autoApproveHours &&
          (autoApproveBillable || !entry.is_billable)
        );
      }),
    [entries, autoApproveBillable, autoApproveHours],
  );
  const autoEligibleCount = autoEligibleEntries.length;

  const nonBillableSeconds = useMemo(
    () => Math.max(0, summary.totalSeconds - summary.billableSeconds),
    [summary.totalSeconds, summary.billableSeconds],
  );

  const dailyChartData = useMemo(() => {
    const grouped = new Map<
      string,
      {
        label: string;
        trackedHours: number;
        billableHours: number;
        cost: number;
      }
    >();

    for (const entry of entries) {
      const rawDate = entry.started_at;
      const date = new Date(rawDate);
      const label = Number.isNaN(date.getTime())
        ? rawDate.slice(0, 10)
        : date.toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          });

      const key = rawDate.slice(0, 10);
      const current = grouped.get(key) ?? {
        label,
        trackedHours: 0,
        billableHours: 0,
        cost: 0,
      };

      const hours = Number(entry.duration_seconds ?? 0) / 3600;
      current.trackedHours += hours;
      if (entry.is_billable) {
        current.billableHours += hours;
      }
      current.cost += Number(entry.cost_amount ?? 0);

      grouped.set(key, current);
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-10)
      .map(([, value]) => ({
        ...value,
        trackedHours: Number(value.trackedHours.toFixed(2)),
        billableHours: Number(value.billableHours.toFixed(2)),
        cost: Number(value.cost.toFixed(2)),
      }));
  }, [entries]);

  const handleAutoApprove = async () => {
    if (!user?.id || !canManage || autoEligibleEntries.length === 0) return;

    try {
      setBusy(true);
      await bulkApproveTimeEntries({
        entryIds: autoEligibleEntries.map((entry) => entry.id),
        approvedBy: user.id,
      });
      setSelectedIds((prev) =>
        prev.filter((id) => !autoEligibleEntries.some((entry) => entry.id === id)),
      );
      await load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to auto approve entries";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  if (!auth?.user || !profile) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Everhour Admin
              </p>
              <h1 className="mt-2 text-3xl font-bold">Time Approval Center</h1>
              <p className="mt-2 max-w-3xl text-sm text-white/50">
                Review tracked hours, billable work, cost exposure, and approval
                flow in a cleaner Everhour-style admin dashboard.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!autoEligibleCount || busy || !canManage}
                onClick={() => void handleAutoApprove()}
                className="border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                Auto approve ({autoEligibleCount})
              </button>
              <button
                type="button"
                disabled={!selectedCount || busy || !canManage}
                onClick={() => void handleBulkApprove()}
                className="border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                Approve selected ({selectedCount})
              </button>
            </div>
          </div>

          {error ? (
            <div className="mb-6 border border-red-500/20 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <SummaryCard
              title="Tracked Hours"
              value={formatDuration(summary.totalSeconds)}
              subtitle="All visible time in the current scope"
              icon={<Clock3 size={18} />}
            />
            <SummaryCard
              title="Billable Time"
              value={formatDuration(summary.billableSeconds)}
              subtitle={`Non-billable: ${formatDuration(nonBillableSeconds)}`}
              icon={<Timer size={18} />}
            />
            <SummaryCard
              title="Pending"
              value={summary.pendingCount}
              subtitle="Entries waiting for admin action"
              icon={<TriangleAlert size={18} />}
            />
            <SummaryCard
              title="Active Timers"
              value={summary.activeCount}
              subtitle="Live running timers right now"
              icon={<Activity size={18} />}
            />
            <SummaryCard
              title="Total Cost"
              value={formatMoney(summary.totalCost)}
              subtitle="Based on recorded rate snapshots"
              icon={<DollarSign size={18} />}
            />
          </div>

          <div className="mb-6 border border-white/10 bg-[#050505] p-4">
            <div className="mb-4 flex items-center gap-2 text-sm text-white/60">
              <Filter size={14} className="text-orange-400" />
              <span>Filter time records</span>
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
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="all">All statuses</option>
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
            </div>
          </div>

          <div className="mb-6 border border-orange-500/20 bg-orange-500/10 p-4">
            <div className="mb-4 flex items-center gap-2 text-sm text-orange-300">
              <CheckCheck size={16} />
              <span>Auto approval rule</span>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-2 text-sm text-white/70">
                <span>Approve entries up to</span>
                <input
                  type="number"
                  min={0.25}
                  max={12}
                  step={0.25}
                  value={autoApproveHours}
                  onChange={(event) =>
                    setAutoApproveHours(Number(event.target.value) || 0)
                  }
                  className="w-36 border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </label>

              <label className="inline-flex items-center gap-3 border border-white/10 bg-black px-4 py-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={autoApproveBillable}
                  onChange={(event) =>
                    setAutoApproveBillable(event.target.checked)
                  }
                  className="h-4 w-4"
                />
                Include billable entries
              </label>

              <div className="border border-white/10 bg-black px-4 py-3 text-sm text-white/65">
                Eligible now:{" "}
                <span className="font-semibold text-white">
                  {autoEligibleCount}
                </span>
              </div>
            </div>

            <p className="mt-3 text-sm text-white/55">
              This approves finished pending entries that match the rule above.
              Running timers are excluded automatically.
            </p>
          </div>

          <div className="mb-6">
            <TimeChartsPanel
              dailyData={dailyChartData}
              billableSeconds={summary.billableSeconds}
              nonBillableSeconds={nonBillableSeconds}
              totalCost={summary.totalCost}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_380px]">
            <section className="min-w-0 border border-white/10 bg-[#050505] p-5">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    Team Timesheet
                  </h2>
                  <p className="mt-1 text-sm text-white/45">
                    Review user logs, project context, billing, cost, and
                    approval status.
                  </p>
                </div>

                <div className="border border-white/10 bg-black px-3 py-2 text-xs text-white/55">
                  {entries.length} entries
                </div>
              </div>

              {loading ? (
                <div className="border border-white/10 bg-black/40 p-6 text-white/60">
                  Loading time approvals...
                </div>
              ) : (
                <TimeApprovalTable
                  entries={entries}
                  selectedIds={selectedIds}
                  onToggleSelect={toggleSelect}
                  onApprove={(entryId) => void handleApprove(entryId)}
                  onReject={(entryId) => void handleReject(entryId)}
                />
              )}
            </section>

            <aside>
              <TimeInsightsPanel entries={entries} summary={summary} />
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
