import type { LeaveTypeRow, MyLeaveRequestRow } from "../services/leaveService";

type MyLeaveRequestsTableProps = {
  requests: MyLeaveRequestRow[];
  leaveTypes: LeaveTypeRow[];
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

export default function MyLeaveRequestsTable({
  requests,
  leaveTypes,
}: MyLeaveRequestsTableProps) {
  const leaveTypeMap = new Map(leaveTypes.map((item) => [item.id, item.name]));

  if (requests.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
        You have not submitted any leave requests yet.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/80">
          <thead className="bg-white/5 text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Dates</th>
              <th className="px-4 py-3 font-medium">Reason</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((request) => (
              <tr key={request.id} className="border-t border-white/10">
                <td className="px-4 py-3">
                  {request.leave_type_id
                    ? leaveTypeMap.get(request.leave_type_id) || "Leave Type"
                    : "General Leave"}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
