import { Pencil, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { EmployeeOverviewRow } from "../services/adminService";

type EmployeeTableProps = {
  employees: EmployeeOverviewRow[];
  onEditRole: (employee: EmployeeOverviewRow) => void;
  onRemove: (employee: EmployeeOverviewRow) => Promise<void>;
  actionLoadingId?: string | null;
};

function getPresenceState(lastSeenAt?: string | null) {
  if (!lastSeenAt) {
    return {
      label: "Offline",
      classes: "border border-white/10 bg-white/5 text-white/60",
    };
  }

  const diffMs = Date.now() - new Date(lastSeenAt).getTime();
  const diffMinutes = diffMs / (1000 * 60);

  if (diffMinutes <= 5) {
    return {
      label: "Online",
      classes:
        "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    };
  }

  if (diffMinutes <= 60 * 24) {
    return {
      label: "Away",
      classes: "border border-amber-500/20 bg-amber-500/10 text-amber-300",
    };
  }

  return {
    label: "Offline",
    classes: "border border-white/10 bg-white/5 text-white/60",
  };
}

function formatLastSeen(lastSeenAt?: string | null) {
  if (!lastSeenAt) return "Never";
  try {
    return new Date(lastSeenAt).toLocaleString();
  } catch {
    return lastSeenAt;
  }
}

function formatDuration(totalSeconds: number) {
  const safe = Math.max(0, totalSeconds || 0);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;

  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export default function EmployeeTable({
  employees,
  onEditRole,
  onRemove,
  actionLoadingId = null,
}: EmployeeTableProps) {
  const navigate = useNavigate();

  if (employees.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
        No employees found in this organization.
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
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Seen</th>
              <th className="px-4 py-3 font-medium">Today</th>
              <th className="px-4 py-3 font-medium">Week</th>
              <th className="px-4 py-3 font-medium">Tracking</th>
              <th className="px-4 py-3 font-medium">Department</th>
              <th className="px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((employee) => {
              const presence = getPresenceState(employee.last_seen_at);

              return (
                <tr key={employee.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/admin/employees/${employee.id}`)
                      }
                      className="font-medium text-orange-400 transition hover:text-orange-300 hover:underline"
                    >
                      {employee.full_name || employee.email || "Unnamed user"}
                    </button>
                  </td>

                  <td className="px-4 py-3 text-white/65">
                    {employee.email || "No email"}
                  </td>

                  <td className="px-4 py-3">
                    <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-400">
                      {employee.primary_role || "no role"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${presence.classes}`}
                    >
                      {presence.label}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-white/65">
                    {formatLastSeen(employee.last_seen_at)}
                  </td>

                  <td className="px-4 py-3 text-white/65">
                    {formatDuration(employee.today_seconds)}
                  </td>

                  <td className="px-4 py-3 text-white/65">
                    {formatDuration(employee.week_seconds)}
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

                  <td className="px-4 py-3 text-white/65">
                    {employee.department || "Not set"}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onEditRole(employee)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/5"
                      >
                        <Pencil size={14} />
                        Change Role
                      </button>

                      <button
                        type="button"
                        disabled={actionLoadingId === employee.id}
                        onClick={() => void onRemove(employee)}
                        className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/15 disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        Remove
                      </button>
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
