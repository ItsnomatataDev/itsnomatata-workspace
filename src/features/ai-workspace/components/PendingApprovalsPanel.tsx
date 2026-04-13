import { CheckCircle2, XCircle } from "lucide-react";
import type { AIWorkspaceApprovalItem } from "../types/aiWorkspace";

interface PendingApprovalsPanelProps {
  items: AIWorkspaceApprovalItem[];
  busy?: boolean;
  onApprove?: (approvalId: string) => void;
  onReject?: (approvalId: string) => void;
}

function formatTimestamp(iso: string) {
  try {
    const date = new Date(iso);
    const now = Date.now();
    const diffMs = now - date.getTime();
    const minutes = Math.floor(diffMs / 60_000);
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

export default function PendingApprovalsPanel({
  items,
  busy = false,
  onApprove,
  onReject,
}: PendingApprovalsPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-base font-semibold text-white">Pending Approvals</h3>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">
            No pending approvals right now.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{item.title}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    item.status === "approved"
                      ? "bg-green-500/15 text-green-300"
                      : item.status === "rejected"
                        ? "bg-red-500/15 text-red-300"
                        : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {item.status}
                </span>
              </div>

              <p className="mt-2 text-sm leading-6 text-gray-300">
                {item.description}
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{formatTimestamp(item.createdAt)}</span>
                {item.requestedBy && <span>• {item.requestedBy}</span>}
              </div>

              {item.status === "pending" && (onApprove || onReject) && (
                <div className="mt-3 flex gap-2">
                  {onApprove && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onApprove(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/20 px-3 py-1.5 text-xs font-medium text-green-300 transition hover:bg-green-500/30 disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </button>
                  )}
                  {onReject && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onReject(item.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-500/30 disabled:opacity-50"
                    >
                      <XCircle size={14} />
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
