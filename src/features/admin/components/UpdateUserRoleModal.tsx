import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  updateEmployeeRole,
  type EmployeeOverviewRow,
} from "../services/adminService";

type UpdateUserRoleModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  employee: EmployeeOverviewRow | null;
  onUpdated: () => Promise<void> | void;
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "it", label: "IT" },
  { value: "social_media", label: "Social Media" },
  { value: "media_team", label: "Media Team" },
  { value: "seo_specialist", label: "SEO Specialist" },
];

export default function UpdateUserRoleModal({
  open,
  onClose,
  organizationId,
  employee,
  onUpdated,
}: UpdateUserRoleModalProps) {
  const [role, setRole] = useState("social_media");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    if (employee?.primary_role) {
      setRole(employee.primary_role);
    } else {
      setRole("social_media");
    }

    setError("");
    setSuccessMessage("");
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

      setSuccessMessage("Employee role updated successfully.");
      await onUpdated();

      window.setTimeout(() => {
        setSuccessMessage("");
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("UPDATE EMPLOYEE ROLE ERROR:", err);
      setError(err?.message || "Failed to update employee role.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Change User Role</h2>
            <p className="mt-1 text-sm text-white/55">
              Update role for {employee.full_name || employee.email || "user"}
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/5 hover:text-white disabled:opacity-60"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        {successMessage ? (
          <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
            {successMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="font-medium text-white">
              {employee.full_name || "Unnamed user"}
            </p>
            <p className="mt-1 text-sm text-white/55">
              {employee.email || "No email"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-400">
                Current role: {employee.primary_role || "no role"}
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/60">
                Department: {employee.department || "Not set"}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={busy}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500 disabled:opacity-60"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? "Updating role..." : "Update Role"}
          </button>
        </form>
      </div>
    </div>
  );
}
