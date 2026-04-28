import { useState } from "react";
import { X, Wallet } from "lucide-react";
import type { LeaveRequestRow } from "../services/adminService";

interface ModifyLeaveBalanceModalProps {
  open: boolean;
  onClose: () => void;
  userRequest: LeaveRequestRow | null;
  onSave: (params: { newTotal?: number; newRemaining?: number; reason: string }) => Promise<void>;
}

export default function ModifyLeaveBalanceModal({
  open,
  onClose,
  userRequest,
  onSave,
}: ModifyLeaveBalanceModalProps) {
  const [newTotal, setNewTotal] = useState<number | "">("");
  const [newRemaining, setNewRemaining] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (!open || !userRequest) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newTotal === "" && newRemaining === "") {
      setError("Please enter either a new total or new remaining days.");
      return;
    }

    if (!reason.trim()) {
      setError("Please provide a reason for this modification.");
      return;
    }

    try {
      setSaving(true);
      await onSave({
        newTotal: newTotal === "" ? undefined : Number(newTotal),
        newRemaining: newRemaining === "" ? undefined : Number(newRemaining),
        reason: reason.trim(),
      });
    } catch (err: any) {
      setError(err?.message || "Failed to modify leave balance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black p-6 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wallet size={20} className="text-orange-500" />
            <h2 className="text-lg font-semibold">Modify Leave Balance</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm text-white/60">Employee</p>
          <p className="mt-1 font-medium text-white">
            {userRequest.requester_name || userRequest.requester_email || "Unknown"}
          </p>
          <p className="mt-2 text-sm text-white/60">Email</p>
          <p className="mt-1 font-medium text-white">{userRequest.requester_email || "N/A"}</p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newTotal" className="mb-2 block text-sm text-white/60">
              New Total Days (leave blank to keep current)
            </label>
            <input
              id="newTotal"
              type="number"
              min="0"
              value={newTotal}
              onChange={(e) => setNewTotal(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              placeholder="e.g., 22"
            />
          </div>

          <div>
            <label htmlFor="newRemaining" className="mb-2 block text-sm text-white/60">
              New Remaining Days (leave blank to keep current)
            </label>
            <input
              id="newRemaining"
              type="number"
              min="0"
              value={newRemaining}
              onChange={(e) => setNewRemaining(e.target.value === "" ? "" : Number(e.target.value))}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              placeholder="e.g., 15"
            />
          </div>

          <div>
            <label htmlFor="reason" className="mb-2 block text-sm text-white/60">
              Reason for Modification
            </label>
            <textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you're modifying this balance..."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-orange-500 focus:outline-none resize-none"
              rows={3}
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-orange-600 px-4 py-3 text-sm font-medium text-white hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
