import { Check, X } from "lucide-react";
import type { LeaveRequestRow } from "../services/adminService";

type LeaveRequestTableProps = {
  requests: LeaveRequestRow[];
  onApprove: (request: LeaveRequestRow) => Promise<void>;
  onReject: (request: LeaveRequestRow) => Promise<void>;
  actionLoadingId?: string | null;
};

function statusClasses(status: string) {
  if (status === "approved") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "rejected") {
    return "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
}

export default function LeaveRequestTable({
  requests,
  onApprove,
  onReject,
  actionLoadingId = null,
}: LeaveRequestTableProps) {
  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
        No leave requests found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/80">
          <thead className="bg-white/5 text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Requester</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr
                key={request.id}
                className="border-t border-white/10 align-top"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-white">
                      {request.requester_name || "Unknown user"}
                    </p>
                    <p className="text-xs text-white/45">
                      {request.requester_email || request.user_id}
                    </p>
                    <p className="text-xs text-white/45">
                      Office: {request.requester_department || "—"}
                    </p>
                  </div>
                </td>

                <td className="px-4 py-3">
                  {request.start_date} → {request.end_date}
                </td>

                <td className="px-4 py-3 text-white/65">
                  <p>{request.reason || "No reason provided"}</p>
                  {request.status === "rejected" && request.rejection_reason ? (
                    <p className="mt-2 text-xs text-red-300">
                      Rejection reason: {request.rejection_reason}
                    </p>
                  ) : null}
                </td>

                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                      request.status,
                    )}`}
                  >
                    {request.status}
                  </span>
                </td>

                <td className="px-4 py-3 text-white/65">
                  {new Date(request.created_at).toLocaleString()}
                </td>

                <td className="px-4 py-3">
                  {request.status === "pending" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={actionLoadingId === request.id}
                        onClick={() => void onApprove(request)}
                        className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-60"
                      >
                        <Check size={14} />
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={actionLoadingId === request.id}
                        onClick={() => void onReject(request)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/15 disabled:opacity-60"
                      >
                        <X size={14} />
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-white/45">Completed</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
