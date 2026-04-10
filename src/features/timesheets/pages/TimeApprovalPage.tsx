import { useEffect, useMemo, useState } from "react";
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

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
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

  const organizationId = profile?.organization_id ?? null;

  const canManage =
    profile?.primary_role === "admin" || profile?.primary_role === "manager";

  const load = async () => {
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
    } catch (err: any) {
      console.error("LOAD ADMIN TIME ERROR:", err);
      setError(err?.message || "Failed to load admin time entries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [organizationId, approvalStatus, isBillable]);

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
    } catch (err: any) {
      alert(err?.message || "Failed to approve entry");
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
    } catch (err: any) {
      alert(err?.message || "Failed to reject entry");
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
    } catch (err: any) {
      alert(err?.message || "Failed to bulk approve entries");
    } finally {
      setBusy(false);
    }
  };

  const selectedCount = useMemo(() => selectedIds.length, [selectedIds]);

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
              <p className="mt-2 text-sm text-white/50">
                Review, approve, and monitor tracked time across the
                organization.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!selectedCount || busy || !canManage}
                onClick={() => void handleBulkApprove()}
                className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
              >
                Approve selected ({selectedCount})
              </button>
            </div>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <div className="border border-white/10 bg-[#050505] p-4">
              <p className="text-sm text-white/45">Active timers</p>
              <p className="mt-2 text-2xl font-bold">{summary.activeCount}</p>
            </div>
            <div className="border border-white/10 bg-[#050505] p-4">
              <p className="text-sm text-white/45">Pending approvals</p>
              <p className="mt-2 text-2xl font-bold">{summary.pendingCount}</p>
            </div>
            <div className="border border-white/10 bg-[#050505] p-4">
              <p className="text-sm text-white/45">Approved time</p>
              <p className="mt-2 text-2xl font-bold">
                {formatDuration(summary.approvedSeconds)}
              </p>
            </div>
            <div className="border border-white/10 bg-[#050505] p-4">
              <p className="text-sm text-white/45">Billable time</p>
              <p className="mt-2 text-2xl font-bold">
                {formatDuration(summary.billableSeconds)}
              </p>
            </div>
            <div className="border border-white/10 bg-[#050505] p-4">
              <p className="text-sm text-white/45">Total cost</p>
              <p className="mt-2 text-2xl font-bold">
                ${summary.totalCost.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="mb-6 flex flex-wrap gap-3 border border-white/10 bg-[#050505] p-4">
            <select
              value={approvalStatus}
              onChange={(e) =>
                setApprovalStatus(e.target.value as TimeApprovalStatus | "all")
              }
              className="rounded-xl border border-white/10 bg-black px-4 py-3 text-white"
            >
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="all">All statuses</option>
            </select>

            <select
              value={String(isBillable)}
              onChange={(e) => {
                const value = e.target.value;
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
            <div className="border border-white/10 bg-[#050505] p-6 text-white/60">
              Loading time approvals...
            </div>
          ) : error ? (
            <div className="border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
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
        </main>
      </div>
    </div>
  );
}
