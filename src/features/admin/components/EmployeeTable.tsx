import {
  CheckCircle2,
  Pencil,
  Trash2,
  Shield,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { EmployeeOverviewRow } from "../services/adminService";

type EmployeeTableProps = {
  employees: EmployeeOverviewRow[];
  onEditRole: (employee: EmployeeOverviewRow) => void;
  onApprove: (employee: EmployeeOverviewRow) => void;
  onReject: (employee: EmployeeOverviewRow) => void;
  onRemove: (employee: EmployeeOverviewRow) => Promise<void>;
  onSuspend: (employee: EmployeeOverviewRow) => void;
  onDelete: (employee: EmployeeOverviewRow) => void;
  actionLoadingId?: string | null;
  currentUserId?: string | null;
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

function getAccountStatusBadge(employee: EmployeeOverviewRow) {
  const status = employee.account_status ??
    (employee.is_suspended
      ? "suspended"
      : employee.is_active === false
        ? "pending"
        : "active");

  const map = {
    active: {
      label: "Active",
      classes: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
    },
    pending: {
      label: "Pending approval",
      classes: "border-amber-500/20 bg-amber-500/10 text-amber-300",
    },
    suspended: {
      label: "Suspended",
      classes: "border-red-500/20 bg-red-500/10 text-red-300",
    },
    rejected: {
      label: "Rejected",
      classes: "border-red-500/20 bg-red-500/10 text-red-300",
    },
    deleted: {
      label: "Deleted",
      classes: "border-white/10 bg-white/5 text-white/50",
    },
  };

  return map[status];
}

export default function EmployeeTable({
  employees,
  onEditRole,
  onApprove,
  onReject,
  onRemove,
  onSuspend,
  onDelete,
  actionLoadingId = null,
  currentUserId = null,
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
              const accountStatus = employee.account_status;
              const accountBadge = getAccountStatusBadge(employee);
              const isSelf = employee.id === currentUserId;
              const isDeleted = accountStatus === "deleted";

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
                      className={`rounded-full px-3 py-1 text-xs font-medium ${accountBadge.classes}`}
                    >
                      {accountBadge.label}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-white/65">
                    <div className="space-y-1">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${presence.classes}`}
                      >
                        {presence.label}
                      </span>
                      <p className="text-xs text-white/45">
                        {formatLastSeen(employee.last_seen_at)}
                      </p>
                    </div>
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
                    <div className="flex flex-wrap gap-2">
                      {accountStatus === "pending" ? (
                        <>
                          <button
                            type="button"
                            disabled={isSelf || actionLoadingId === employee.id}
                            onClick={() => onApprove(employee)}
                            className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
                          >
                            <CheckCircle2 size={14} />
                            Approve
                          </button>
                          <button
                            type="button"
                            disabled={isSelf || actionLoadingId === employee.id}
                            onClick={() => onReject(employee)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                          >
                            <XCircle size={14} />
                            Reject
                          </button>
                        </>
                      ) : null}

                      {accountStatus === "active" ? (
                        <>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => onEditRole(employee)}
                            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/80 hover:bg-white/5 disabled:opacity-50"
                          >
                            <Pencil size={14} />
                            Role
                          </button>

                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => onSuspend(employee)}
                            className="inline-flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-500/15 disabled:opacity-50"
                          >
                            <AlertTriangle size={14} />
                            Suspend
                          </button>

                          <button
                            type="button"
                            disabled={isSelf || actionLoadingId === employee.id}
                            onClick={() => onRemove(employee)}
                            className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/15 disabled:opacity-50"
                          >
                            <Trash2 size={14} />
                            Remove
                          </button>
                        </>
                      ) : null}

                      {accountStatus === "suspended" ? (
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => onSuspend(employee)}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/15 disabled:opacity-50"
                        >
                          <Shield size={14} />
                          Unsuspend
                        </button>
                      ) : null}

                      {!isDeleted ? (
                        <button
                          type="button"
                          disabled={isSelf || actionLoadingId === employee.id}
                          onClick={() => onDelete(employee)}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Delete
                        </button>
                      ) : (
                        <span className="text-xs text-white/40">
                          No normal actions
                        </span>
                      )}
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
