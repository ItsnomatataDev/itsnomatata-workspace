import { useMemo } from "react";
import type { AdminTimeEntryRow } from "../../../lib/supabase/queries/adminTime";

function formatDuration(seconds: number) {
  const total = Math.max(0, Number(seconds || 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
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
  const allSelected = useMemo(
    () =>
      entries.length > 0 &&
      entries.every((item) => selectedIds.includes(item.id)),
    [entries, selectedIds],
  );

  return (
    <div className="overflow-x-auto border border-white/10 bg-[#050505]">
      <table className="min-w-full text-sm">
        <thead className="bg-white/5 text-left text-white/60">
          <tr>
            <th className="px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => {
                  entries.forEach((entry) => {
                    const isSelected = selectedIds.includes(entry.id);
                    if (!allSelected && !isSelected) onToggleSelect(entry.id);
                    if (allSelected && isSelected) onToggleSelect(entry.id);
                  });
                }}
              />
            </th>
            <th className="px-4 py-3">Employee</th>
            <th className="px-4 py-3">Task</th>
            <th className="px-4 py-3">Project</th>
            <th className="px-4 py-3">Started</th>
            <th className="px-4 py-3">Duration</th>
            <th className="px-4 py-3">Billable</th>
            <th className="px-4 py-3">Source</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Cost</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>

        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={11} className="px-4 py-8 text-center text-white/45">
                No time entries found.
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr
                key={entry.id}
                className="border-t border-white/10 text-white/80"
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(entry.id)}
                    onChange={() => onToggleSelect(entry.id)}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="min-w-45">
                    <p>{entry.user_name || "Unknown user"}</p>
                    <p className="text-xs text-white/45">
                      {entry.user_email || "—"}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="min-w-45">
                    <p>{entry.task_title || "No task"}</p>
                    <p className="text-xs text-white/45">
                      {entry.description || "—"}
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3">{entry.project_name || "—"}</td>
                <td className="px-4 py-3">
                  {formatDateTime(entry.started_at)}
                </td>
                <td className="px-4 py-3">
                  {formatDuration(entry.duration_seconds)}
                </td>
                <td className="px-4 py-3">
                  {entry.is_billable ? (
                    <span className="rounded-xl bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                      Billable
                    </span>
                  ) : (
                    <span className="rounded-xl bg-white/5 px-3 py-1 text-xs text-white/50">
                      Non-billable
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">{entry.source || "manual"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-xl px-3 py-1 text-xs ${
                      entry.approval_status === "approved"
                        ? "bg-emerald-500/10 text-emerald-300"
                        : entry.approval_status === "rejected"
                          ? "bg-red-500/10 text-red-300"
                          : "bg-orange-500/10 text-orange-300"
                    }`}
                  >
                    {entry.approval_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {entry.cost_amount != null
                    ? `$${Number(entry.cost_amount).toFixed(2)}`
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onApprove(entry.id)}
                      className="rounded-xl bg-emerald-500 px-3 py-2 text-xs font-semibold text-black"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onReject(entry.id)}
                      className="rounded-xl bg-red-500 px-3 py-2 text-xs font-semibold text-black"
                    >
                      Reject
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
