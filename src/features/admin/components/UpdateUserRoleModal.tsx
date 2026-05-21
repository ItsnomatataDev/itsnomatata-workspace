import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  updateEmployeeOffice,
  updateEmployeeRole,
  type EmployeeOverviewRow,
} from "../services/adminService";
import { getCompanyOffices } from "../../../lib/supabase/queries/offices";
import type { CompanyOffice } from "../../../lib/offices";
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
  currentUserId: string;
  onUpdated: () => Promise<void> | void;
};

export default function UpdateUserRoleModal({
  open,
  onClose,
  organizationId,
  employee,
  currentUserId,
  onUpdated,
}: UpdateUserRoleModalProps) {
  const defaultRole = "social_media";
  const [role, setRole] = useState(defaultRole);
  const [officeId, setOfficeId] = useState("");
  const [offices, setOffices] = useState<CompanyOffice[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [reason, setReason] = useState("");
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

    setOfficeId(employee?.office_id ?? "");
    setError("");
    setSuccessMessage("");
    setReason("");
  }, [employee]);

  useEffect(() => {
    if (!open || !organizationId) return;

    let cancelled = false;

    void (async () => {
      try {
        setLoadingOffices(true);
        const rows = await getCompanyOffices(organizationId);
        if (!cancelled) setOffices(rows);
      } catch (err) {
        console.error("LOAD OFFICES ERROR:", err);
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load offices.");
        }
      } finally {
        if (!cancelled) setLoadingOffices(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

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
      const nextOfficeId = officeId || null;
      const roleChanged = role !== employee.primary_role;
      const officeChanged = nextOfficeId !== (employee.office_id ?? null);

      if (!roleChanged && !officeChanged) {
        setError("Choose a new role or office before saving.");
        return;
      }

      if (roleChanged) {
        await updateEmployeeRole({
          organizationId,
          userId: employee.id,
          role,
          updatedBy: currentUserId,
          reason: reason.trim() || undefined,
        });
      }

      if (officeChanged) {
        await updateEmployeeOffice({
          organizationId,
          userId: employee.id,
          officeId: nextOfficeId,
          updatedBy: currentUserId,
          reason: reason.trim() || undefined,
        });
      }

      setSuccessMessage("User access updated successfully.");
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 py-6">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Change User Access
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Update role and office for {employee.full_name || employee.email || "user"}
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
            <div className="rounded-2xl border border-white/10 bg-black px-4 py-4">
              <p className="font-medium text-white">
                {employee.full_name || "Unnamed user"}
              </p>
              <p className="mt-1 text-sm text-white/55">
                {employee.email || "No email"}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 font-medium text-orange-400">
                  Current role: {currentRoleLabel}
                </span>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-medium text-white/60">
                  Department: {employee.department || "Not set"}
                </span>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-medium text-white/60">
                  Office: {employee.office?.name || "Not set"}
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
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:opacity-60"
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

            <div>
              <label className="mb-2 block text-sm text-white/70">
                Office
              </label>

              <select
                value={officeId}
                onChange={(e) => setOfficeId(e.target.value)}
                disabled={busy || loadingOffices}
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:opacity-60"
              >
                <option value="">No office assigned</option>
                {offices.map((office) => (
                  <option key={office.id} value={office.id}>
                    {office.name}
                    {office.is_primary ? " (Primary)" : ""}
                  </option>
                ))}
              </select>

              <p className="mt-2 text-xs text-white/45">
                Office assignment controls office-based leave, roster, task, and time filters.
              </p>
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={busy}
                rows={3}
                placeholder="Optional note for the audit log..."
                className="w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-orange-500 disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
            >
              {busy ? "Updating access..." : "Update Access"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
