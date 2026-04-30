import { useEffect, useState } from "react";
import { X, Calendar } from "lucide-react";
import type { LeaveRequestRow } from "../services/adminService";
import {
  calculateLeaveDaysForOffice,
  getLeaveCountingRuleLabel,
  LEAVE_OFFICES,
} from "../../leave/utils/leaveDays";

interface ModifyLeaveRequestModalProps {
  open: boolean;
  onClose: () => void;
  leaveRequest: LeaveRequestRow | null;
  organizationId: string;
  onSave: (params: {
    newStartDate: string;
    newEndDate: string;
    office: string;
    reason: string;
  }) => Promise<void>;
}

export default function ModifyLeaveRequestModal({
  open,
  onClose,
  leaveRequest,
  organizationId,
  onSave,
}: ModifyLeaveRequestModalProps) {
  const [newStartDate, setNewStartDate] = useState(
    leaveRequest?.start_date || ""
  );
  const [newEndDate, setNewEndDate] = useState(leaveRequest?.end_date || "");
  const [office, setOffice] = useState(
    leaveRequest?.office || leaveRequest?.request_department || "IT's Nomatata",
  );
  const [reason, setReason] = useState("");
  const [previewDays, setPreviewDays] = useState(leaveRequest?.requested_days ?? 0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!leaveRequest || !open) return;
    setNewStartDate(leaveRequest.start_date);
    setNewEndDate(leaveRequest.end_date);
    setOffice(leaveRequest.office || leaveRequest.request_department || "IT's Nomatata");
    setPreviewDays(leaveRequest.requested_days ?? 0);
    setReason("");
    setError("");
  }, [leaveRequest, open]);

  useEffect(() => {
    let active = true;

    const runPreview = async () => {
      if (!organizationId || !newStartDate || !newEndDate || newEndDate < newStartDate) {
        setPreviewDays(0);
        return;
      }

      const days = await calculateLeaveDaysForOffice({
        organizationId,
        startDate: newStartDate,
        endDate: newEndDate,
        office,
      });

      if (active) setPreviewDays(days);
    };

    void runPreview();

    return () => {
      active = false;
    };
  }, [newStartDate, newEndDate, office, organizationId]);

  if (!open || !leaveRequest) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!newStartDate || !newEndDate) {
      setError("Please select both start and end dates.");
      return;
    }

    if (newStartDate > newEndDate) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    if (!reason.trim()) {
      setError("Please provide a reason for this modification.");
      return;
    }

    try {
      setSaving(true);
      await onSave({
        newStartDate,
        newEndDate,
        office,
        reason: reason.trim(),
      });
    } catch (err: any) {
      setError(err?.message || "Failed to modify leave request.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black p-6 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Calendar size={20} className="text-orange-500" />
            <h2 className="text-lg font-semibold">Modify Leave Request</h2>
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
            {leaveRequest.requester_name || leaveRequest.requester_email || "Unknown"}
          </p>
          <p className="mt-2 text-sm text-white/60">Current Dates</p>
          <p className="mt-1 font-medium text-white">
            {leaveRequest.start_date} to {leaveRequest.end_date} ({leaveRequest.requested_days} days)
          </p>
          <p className="mt-2 text-sm text-white/60">Office</p>
          <p className="mt-1 font-medium text-white">
            {leaveRequest.office || leaveRequest.request_department || "IT's Nomatata"}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="office" className="mb-2 block text-sm text-white/60">
              Office
            </label>
            <select
              id="office"
              value={office}
              onChange={(e) => setOffice(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
            >
              {LEAVE_OFFICES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs text-white/45">
              {getLeaveCountingRuleLabel(office)}
            </p>
          </div>

          <div>
            <label htmlFor="startDate" className="mb-2 block text-sm text-white/60">
              New Start Date
            </label>
            <input
              id="startDate"
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label htmlFor="endDate" className="mb-2 block text-sm text-white/60">
              New End Date
            </label>
            <input
              id="endDate"
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              required
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
              placeholder="Explain why you're modifying this leave request..."
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white focus:border-orange-500 focus:outline-none resize-none"
              rows={3}
              required
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            Recalculated request: {previewDays} day{previewDays === 1 ? "" : "s"}
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
