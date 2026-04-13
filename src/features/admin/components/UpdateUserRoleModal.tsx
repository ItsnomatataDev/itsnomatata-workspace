import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  updateEmployeeRole,
  type EmployeeOverviewRow,
} from "../services/adminService";
import {
  ADMIN_ROLE_ASSIGNMENT_OPTIONS,
  ROLE_LABELS,
  isAppRole,
} from "../../../lib/constants/roles";

type UpdateUserRoleModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  employee: EmployeeOverviewRow | null;
  onUpdated: () => Promise<void> | void;
};

export default function UpdateUserRoleModal({
  open,
  onClose,
  organizationId,
  employee,
  onUpdated,
}: UpdateUserRoleModalProps) {
  const defaultRole = "social_media";
  const [role, setRole] = useState(defaultRole);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (employee?.primary_role && employee.primary_role !== "admin") {
      setRole(employee.primary_role);
    } else if (employee?.primary_role === "admin") {
      setRole("manager");
    } else {
      setRole(defaultRole);
    }

    setError("");
    setSuccessMessage("");
  }, [employee]);

  const currentRoleLabel = useMemo(() => {
    if (!employee?.primary_role || !isAppRole(employee.primary_role)) {
      return employee?.primary_role || "No role";
    }
    return ROLE_LABELS[employee.primary_role];
  }, [employee]);

  if (!open || !employee) return null;

  const handleClose = () => {
    if (busy) return;
    setError("");
    setSuccessMessage("");
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!organizationId) {
      setError("Missing organization context.");
      return;
    }

    try {
      setBusy(true);

      await updateEmployeeRole({
        organizationId,
        userId: employee.id,
        role,
      });

      setSuccessMessage("User role updated successfully.");
      await onUpdated();

      window.setTimeout(() => {
        setSuccessMessage("");
        onClose();
      }, 900);
    } catch (err: any) {
      console.error("UPDATE EMPLOYEE ROLE ERROR:", err);
      setError(err?.message || "Failed to update user role.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Change User Role
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Update role for {employee.full_name || employee.email || "user"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="border border-white/10 p-2 text-white/70 transition hover:bg-white/5 hover:text-white disabled:opacity-60"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5">
          {error ? (
            <div className="mb-4 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-4 border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {successMessage}
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="border border-white/10 bg-black px-4 py-4">
              <p className="font-medium text-white">
                {employee.full_name || "Unnamed user"}
              </p>
              <p className="mt-1 text-sm text-white/55">
                {employee.email || "No email"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="border border-orange-500/20 bg-orange-500/10 px-3 py-1 font-medium text-orange-400">
                  Current role: {currentRoleLabel}
                </span>

                <span className="border border-white/10 bg-white/5 px-3 py-1 font-medium text-white/60">
                  Department: {employee.department || "Not set"}
                </span>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">
                New Role
              </label>

              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={busy}
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:opacity-60"
              >
                {ADMIN_ROLE_ASSIGNMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-white/45">
                Super Admin is hidden from this list and can only be assigned to
                allowlisted email addresses.
              </p>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
            >
              {busy ? "Updating role..." : "Update Role"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
