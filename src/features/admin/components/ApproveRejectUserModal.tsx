import { useEffect, useState } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";
import {
  approveUser,
  rejectUser,
  type EmployeeOverviewRow,
} from "../services/adminService";
import { ADMIN_ROLE_ASSIGNMENT_OPTIONS } from "../../../lib/constants/roles";

type ApproveRejectUserModalProps = {
  open: boolean;
  mode: "approve" | "reject";
  onClose: () => void;
  organizationId: string;
  employee: EmployeeOverviewRow | null;
  currentUserId: string;
  onUpdated: () => Promise<void> | void;
};

export default function ApproveRejectUserModal({
  open,
  mode,
  onClose,
  organizationId,
  employee,
  currentUserId,
  onUpdated,
}: ApproveRejectUserModalProps) {
  const [role, setRole] = useState("social_media");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    setRole(employee?.primary_role || "social_media");
    setReason("");
    setError("");
    setSuccessMessage("");
  }, [employee, mode]);

  if (!open || !employee) return null;

  const approving = mode === "approve";

  const handleClose = () => {
    if (busy) return;
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!organizationId) {
      setError("Missing organization context.");
      return;
    }

    if (employee.id === currentUserId) {
      setError("You cannot approve or reject your own account.");
      return;
    }

    if (!approving && !reason.trim()) {
      setError("Please add a rejection reason.");
      return;
    }

    try {
      setBusy(true);

      if (approving) {
        await approveUser({
          organizationId,
          userId: employee.id,
          role,
          approvedBy: currentUserId,
        });
        setSuccessMessage("User approved successfully.");
      } else {
        await rejectUser({
          organizationId,
          userId: employee.id,
          rejectedBy: currentUserId,
          reason: reason.trim(),
        });
        setSuccessMessage("User rejected successfully.");
      }

      await onUpdated();

      window.setTimeout(() => {
        onClose();
      }, 900);
    } catch (err) {
      console.error("APPROVE/REJECT USER ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : approving
            ? "Failed to approve user."
            : "Failed to reject user.",
      );
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
              {approving ? "Approve User" : "Reject Signup"}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {employee.full_name || employee.email || "Pending user"}
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

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error ? (
            <div className="border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          {successMessage ? (
            <div className="border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
              {successMessage}
            </div>
          ) : null}

          {approving ? (
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Role after approval
              </label>
              <select
                value={role}
                onChange={(event) => setRole(event.target.value)}
                disabled={busy}
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:opacity-60"
              >
                {ADMIN_ROLE_ASSIGNMENT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Rejection reason
              </label>
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={busy}
                rows={3}
                className="w-full resize-none border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:opacity-60"
                placeholder="Why is this signup being rejected?"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className={`flex w-full items-center justify-center gap-2 px-4 py-3 font-semibold transition disabled:opacity-60 ${
              approving
                ? "bg-emerald-500 text-black hover:bg-emerald-400"
                : "bg-red-500 text-white hover:bg-red-400"
            }`}
          >
            {approving ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
            {busy
              ? approving
                ? "Approving..."
                : "Rejecting..."
              : approving
                ? "Approve User"
                : "Reject User"}
          </button>
        </form>
      </div>
    </div>
  );
}
