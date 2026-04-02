import type { EmployeeTimesheetSummaryRow } from "../services/adminService";

type EmployeeTimesheetTableProps = {
  employees: EmployeeTimesheetSummaryRow[];
};

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function formatLastSeen(value?: string | null) {
  if (!value) return "Never";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function EmployeeTimesheetTable({
  employees,
}: EmployeeTimesheetTableProps) {
  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
        No employee timesheet data found.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/80">
          <thead className="bg-white/5 text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Last Seen</th>
              <th className="px-4 py-3 font-medium">Today</th>
              <th className="px-4 py-3 font-medium">This Week</th>
              <th className="px-4 py-3 font-medium">Tracking</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => (
              <tr key={employee.user_id} className="border-t border-white/10">
                <td className="px-4 py-3">
                  <div>
                    <p className="font-medium text-white">
                      {employee.full_name || employee.email || "Unknown user"}
                    </p>
                    <p className="text-xs text-white/45">
                      {employee.email || "No email"}
                    </p>
                  </div>
                </td>

                <td className="px-4 py-3">
                  <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-400">
                    {employee.primary_role || "no role"}
                  </span>
                </td>

                <td className="px-4 py-3 text-white/65">
                  {formatLastSeen(employee.last_seen_at)}
                </td>

                <td className="px-4 py-3 text-white/65">
                  {formatDuration(employee.today_seconds ?? 0)}
                </td>

                <td className="px-4 py-3 text-white/65">
                  {formatDuration(employee.week_seconds ?? 0)}
                </td>

                <td className="px-4 py-3">
                  {employee.has_active_timer ? (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
                      Idle
                    </span>
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
