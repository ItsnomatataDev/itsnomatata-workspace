import { useState } from "react";
import { X, AlertTriangle, Shield } from "lucide-react";
import {
  suspendUser,
  unsuspendUser,
  type EmployeeOverviewRow,
} from "../services/adminService";

type SuspendUserModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  employee: EmployeeOverviewRow | null;
  currentUserId: string;
  onUpdated: () => Promise<void> | void;
};

export default function SuspendUserModal({
  open,
  onClose,
  organizationId,
  employee,
  currentUserId,
  onUpdated,
}: SuspendUserModalProps) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  if (!open || !employee) return null;

  const handleClose = () => {
    if (busy) return;
    setError("");
    setSuccessMessage("");
    setReason("");
    onClose();
  };

  const handleSuspend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!organizationId) {
      setError("Missing organization context.");
      return;
    }

    if (employee.id === currentUserId) {
      setError("You cannot suspend yourself.");
      return;
    }

    try {
      setBusy(true);

      await suspendUser({
        organizationId,
        userId: employee.id,
        suspendedBy: currentUserId,
        reason: reason.trim() || undefined,
      });

      setSuccessMessage("User suspended successfully.");
      await onUpdated();

      window.setTimeout(() => {
        setSuccessMessage("");
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error("SUSPEND USER ERROR:", err);
      setError(err?.message || "Failed to suspend user.");
    } finally {
      setBusy(false);
    }
  };

  const handleUnsuspend = async () => {
    setError("");
    setSuccessMessage("");

    if (!organizationId) {
      setError("Missing organization context.");
      return;
    }

    try {
      setBusy(true);

      await unsuspendUser({
        organizationId,
        userId: employee.id,
      });

      setSuccessMessage("User unsuspended successfully.");
      await onUpdated();

      window.setTimeout(() => {
        setSuccessMessage("");
        handleClose();
      }, 1500);
    } catch (err: any) {
      console.error("UNSUSPEND USER ERROR:", err);
      setError(err?.message || "Failed to unsuspend user.");
    } finally {
      setBusy(false);
    }
  };

  const isSuspended = employee.is_suspended;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-lg border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {isSuspended ? "Unsuspend User" : "Suspend User"}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {isSuspended
                ? `Restore access for ${employee.full_name || employee.email || "user"}`
                : `Revoke access for ${employee.full_name || employee.email || "user"}`
              }
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

          <div className="mb-6 border border-white/10 bg-black px-4 py-4">
            <p className="font-medium text-white">
              {employee.full_name || "Unnamed user"}
            </p>
            <p className="mt-1 text-sm text-white/55">
              {employee.email || "No email"}
            </p>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="border border-orange-500/20 bg-orange-500/10 px-3 py-1 font-medium text-orange-400">
                Role: {employee.primary_role || "No role"}
              </span>

              <span className="border border-white/10 bg-white/5 px-3 py-1 font-medium text-white/60">
                Department: {employee.department || "Not set"}
              </span>

              {isSuspended && (
                <span className="border border-red-500/20 bg-red-500/10 px-3 py-1 font-medium text-red-400">
                  Suspended: {employee.suspended_at ? new Date(employee.suspended_at).toLocaleDateString() : "Unknown"}
                </span>
              )}
            </div>
          </div>

          {!isSuspended ? (
            <>
              <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-400" />
                <div className="text-sm text-amber-200">
                  <p className="font-semibold">Warning</p>
                  <p className="mt-1">
                    Suspended users will immediately lose access to the system and all its features.
                    They will not be able to log in or perform any actions until unsuspended.
                  </p>
                </div>
              </div>

              <form onSubmit={handleSuspend} className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm text-white/70">
                    Suspension Reason (Optional)
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={busy}
                    placeholder="Enter reason for suspension..."
                    rows={3}
                    className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:opacity-60 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full bg-red-500 px-4 py-3 font-semibold text-white transition hover:bg-red-400 disabled:opacity-60"
                >
                  {busy ? "Suspending..." : "Suspend User"}
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4">
                <Shield className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                <div className="text-sm text-emerald-200">
                  <p className="font-semibold">Restore Access</p>
                  <p className="mt-1">
                    This user will regain full access to the system and all its features immediately.
                  </p>
                </div>
              </div>

              <button
                onClick={handleUnsuspend}
                disabled={busy}
                className="w-full bg-emerald-500 px-4 py-3 font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {busy ? "Unsuspending..." : "Unsuspend User"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
