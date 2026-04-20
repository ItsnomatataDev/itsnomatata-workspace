import { Check, Clock3, DollarSign, X } from "lucide-react";
import type { AdminTimeEntryRow } from "../../../lib/supabase/queries/adminTime";

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function getStatusClasses(status?: string | null) {
  if (status === "approved") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "rejected") {
    return "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  if (status === "pending") {
    return "border border-orange-500/20 bg-orange-500/10 text-orange-300";
  }

  return "border border-white/10 bg-white/5 text-white/60";
}

export default function TimeApprovalTable({
  entries,
  selectedIds,
  onToggleSelect,
  onApprove,
  onReject,
}: {
  entries: AdminTimeEntryRow[];
  selectedIds: string[];
  onToggleSelect: (entryId: string) => void;
  onApprove: (entryId: string) => void;
  onReject: (entryId: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 bg-white/5 p-6 text-white/50">
        No time entries found for this filter.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#050505] shadow-[0_10px_30px_rgba(0,0,0,0.24)]">
      <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/5 text-left text-white/45">
            <th className="px-4 py-3">Select</th>
            <th className="px-4 py-3">Member</th>
            <th className="px-4 py-3">Work Log</th>
            <th className="px-4 py-3">Project / Task</th>
            <th className="px-4 py-3">Tracked</th>
            <th className="px-4 py-3">Billing</th>
            <th className="px-4 py-3">Cost</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>

        <tbody>
          {entries.map((entry) => {
            const selected = selectedIds.includes(entry.id);

            return (
              <tr
                key={entry.id}
                className="border-b border-white/5 align-top transition hover:bg-white/5"
              >
                <td className="px-4 py-4 align-top">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSelect(entry.id)}
                    className="h-4 w-4"
                  />
                </td>

                <td className="px-4 py-4 align-top">
                  <div>
                    <p className="font-medium text-white">
                      {entry.user_name || "Unknown member"}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {entry.user_email || "No email"}
                    </p>
                  </div>
                </td>

                <td className="px-4 py-4 align-top">
                  <p className="max-w-70 font-medium text-white">
                    {entry.description || "No description"}
                  </p>
                  <div className="mt-2 space-y-1 text-xs text-white/40">
                    <p>Started: {formatDateTime(entry.started_at)}</p>
                    <p>Ended: {formatDateTime(entry.ended_at)}</p>
                  </div>
                </td>

                <td className="px-4 py-4 align-top">
                  <div className="space-y-1 text-xs">
                    <p className="text-white/80">
                      <span className="text-white/40">Project:</span>{" "}
                      {entry.project_name || "—"}
                    </p>
                    <p className="text-white/80">
                      <span className="text-white/40">Task:</span>{" "}
                      {entry.task_title || "—"}
                    </p>
                    <p className="text-white/80">
                      <span className="text-white/40">Client:</span>{" "}
                      {entry.client_name || "—"}
                    </p>
                  </div>
                </td>

                <td className="px-4 py-4 align-top">
                  <div className="inline-flex items-center gap-2 font-medium text-white">
                    <Clock3 size={14} className="text-orange-400" />
                    <span>{formatDuration(entry.duration_seconds ?? 0)}</span>
                  </div>
                </td>

                <td className="px-4 py-4 align-top">
                  <span
                    className={`inline-flex px-3 py-2 text-xs ${
                      entry.is_billable
                        ? "border border-orange-500/20 bg-orange-500/10 text-orange-300"
                        : "border border-white/10 bg-white/5 text-white/60"
                    }`}
                  >
                    {entry.is_billable ? "Billable" : "Non-billable"}
                  </span>
                </td>

                <td className="px-4 py-4 align-top">
                  <div className="inline-flex items-center gap-2 font-medium text-white">
                    <DollarSign size={14} className="text-orange-400" />
                    <span>${Number(entry.cost_amount ?? 0).toFixed(2)}</span>
                  </div>
                </td>

                <td className="px-4 py-4 align-top">
                  <span
                    className={`inline-flex px-3 py-2 text-xs ${getStatusClasses(
                      entry.approval_status,
                    )}`}
                  >
                    {entry.approval_status || "unknown"}
                  </span>
                </td>

                <td className="px-4 py-4 align-top">
                  <div className="flex flex-wrap gap-2">
                    {entry.approval_status !== "approved" ? (
                      <button
                        type="button"
                        onClick={() => onApprove(entry.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-500 px-3 py-2 text-xs font-semibold text-black"
                      >
                        <Check size={13} />
                        Approve
                      </button>
                    ) : null}

                    {entry.approval_status !== "rejected" ? (
                      <button
                        type="button"
                        onClick={() => onReject(entry.id)}
                        className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-500 px-3 py-2 text-xs font-semibold text-black"
                      >
                        <X size={13} />
                        Reject
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
