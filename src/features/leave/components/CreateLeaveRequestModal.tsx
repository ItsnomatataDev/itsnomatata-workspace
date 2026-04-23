import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  createLeaveRequest,
  type LeaveTypeRow,
} from "../services/leaveService";
import {
  checkLeaveAvailability,
  type LeaveCalendarEventRow,
  type LeaveCalendarRuleRow,
} from "../services/leaveCalendarService";

type CreateLeaveRequestModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  userId: string;
  leaveTypes: LeaveTypeRow[];
  officeOptions?: string[];
  defaultOffice?: string;
  requesterRole?: string | null;
  onCreated: () => Promise<void> | void;
};

export default function CreateLeaveRequestModal({
  open,
  onClose,
  organizationId,
  userId,
  leaveTypes,
  officeOptions = [],
  defaultOffice = "",
  requesterRole = null,
  onCreated,
}: CreateLeaveRequestModalProps) {
  const resolvedOfficeOptions = Array.from(
    new Set(
      [...officeOptions, defaultOffice]
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

  const [requestOffice, setRequestOffice] = useState(defaultOffice.trim());
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [blockedRules, setBlockedRules] = useState<LeaveCalendarRuleRow[]>([]);
  const [overlappingLeaves, setOverlappingLeaves] = useState<
    (LeaveCalendarEventRow & {
      requester_name?: string | null;
      requester_email?: string | null;
    })[]
  >([]);

  const hasAvailabilityConflict =
    blockedRules.length > 0 || overlappingLeaves.length > 0;

  const resetForm = () => {
    setRequestOffice(defaultOffice.trim());
    setLeaveTypeId("");
    setStartDate("");
    setEndDate("");
    setReason("");
    setError("");
    setSuccessMessage("");
    setBlockedRules([]);
    setOverlappingLeaves([]);
  };

  useEffect(() => {
    if (!open) return;
    setRequestOffice(defaultOffice.trim());
  }, [open, defaultOffice]);

  useEffect(() => {
    let active = true;

    const runAvailabilityCheck = async () => {
      if (
        !open ||
        !requestOffice ||
        !startDate ||
        !endDate ||
        endDate < startDate
      ) {
        if (active) {
          setBlockedRules([]);
          setOverlappingLeaves([]);
          setCheckingAvailability(false);
        }
        return;
      }

      try {
        setCheckingAvailability(true);

        const result = await checkLeaveAvailability({
          organizationId,
          startDate,
          endDate,
          requestDepartment: requestOffice,
          requestRole: requesterRole,
        });

        if (!active) return;

        setBlockedRules(result.blockedRules);
        setOverlappingLeaves(result.overlappingApprovedLeaves);
      } catch (err) {
        console.error("CHECK LEAVE AVAILABILITY ERROR:", err);
        if (!active) return;
        setBlockedRules([]);
        setOverlappingLeaves([]);
      } finally {
        if (active) {
          setCheckingAvailability(false);
        }
      }
    };

    void runAvailabilityCheck();

    return () => {
      active = false;
    };
  }, [open, organizationId, requestOffice, requesterRole, startDate, endDate]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!requestOffice) {
      setError("Please choose the office for this leave request.");
      return;
    }

    if (!startDate || !endDate) {
      setError("Please provide both start and end dates.");
      return;
    }

    if (endDate < startDate) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    if (blockedRules.length > 0) {
      setError(
        blockedRules[0]?.title
          ? `This leave period is closed: ${blockedRules[0].title}.`
          : "This leave period is closed.",
      );
      return;
    }

    if (overlappingLeaves.length > 0) {
      const firstOverlap = overlappingLeaves[0];
      const overlapName =
        firstOverlap?.requester_name ||
        firstOverlap?.requester_email ||
        "another employee";
      const overlapRole = firstOverlap?.requester_role || "the same role";
      
      // Check if the overlap is due to role-based restriction
      if (requesterRole && firstOverlap?.requester_role?.toLowerCase() === requesterRole.toLowerCase()) {
        setError(
          `You cannot submit leave because ${overlapName} (${overlapRole}) is already on approved leave for this period. Role-based leave restriction applies across all offices.`,
        );
        return;
      }

      setError(
        `You cannot submit leave for ${requestOffice} because ${overlapName} is already on approved leave in that office for the selected period.`,
      );
      return;
    }

    try {
      setBusy(true);

      await createLeaveRequest({
        organizationId,
        userId,
        leaveTypeId: leaveTypeId || null,
        startDate,
        endDate,
        reason,
        requestDepartment: requestOffice,
        requestRole: requesterRole,
      });

      setSuccessMessage("Leave request submitted successfully.");
      await onCreated();

      window.setTimeout(() => {
        resetForm();
        onClose();
      }, 1200);
    } catch (err: unknown) {
      console.error("CREATE LEAVE REQUEST ERROR:", err);
      setError(
        err instanceof Error ? err.message : "Failed to submit leave request.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Request Leave</h2>
            <p className="mt-1 text-sm text-white/55">
              Submit a leave request for admin review
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/5 hover:text-white"
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
          <div>
            <label className="mb-2 block text-sm text-white/70">Office</label>
            <select
              value={requestOffice}
              onChange={(e) => setRequestOffice(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            >
              <option value="">Select office</option>
              {resolvedOfficeOptions.map((office) => (
                <option key={office} value={office}>
                  {office}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">
              Leave Type
            </label>
            <select
              value={leaveTypeId}
              onChange={(e) => setLeaveTypeId(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            >
              <option value="">Select leave type</option>
              {leaveTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              />
            </div>
          </div>

          {checkingAvailability ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/60">
              Checking leave availability...
            </div>
          ) : null}

          {blockedRules.length > 0 ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <p className="font-semibold text-red-300">
                Leave is closed for the selected period
              </p>
              <div className="mt-3 space-y-2">
                {blockedRules.map((rule) => (
                  <div
                    key={rule.id}
                    className="rounded-xl border border-red-500/20 bg-black/30 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-white">
                      {rule.title}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      {rule.start_date} → {rule.end_date}
                    </p>
                    {rule.description ? (
                      <p className="mt-1 text-xs text-white/45">
                        {rule.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {overlappingLeaves.length > 0 ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="font-semibold text-amber-300">
                {requesterRole && overlappingLeaves.some(l => l.requester_role?.toLowerCase() === requesterRole.toLowerCase())
                  ? "Leave submission is disabled due to role-based restriction across all offices"
                  : "Leave submission is disabled because someone is already on leave in this period"}
              </p>
              <div className="mt-3 space-y-2">
                {overlappingLeaves.map((leave) => (
                  <div
                    key={leave.id}
                    className="rounded-xl border border-white/10 bg-black/30 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-white">
                      {leave.requester_name ||
                        leave.requester_email ||
                        "Employee"}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      {leave.start_date} → {leave.end_date}
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      Office:{" "}
                      {leave.requester_department || requestOffice || "—"}
                    </p>
                    {leave.requester_role ? (
                      <p className="mt-1 text-xs text-white/45">
                        Role: {leave.requester_role}
                        {requesterRole && leave.requester_role.toLowerCase() === requesterRole.toLowerCase() && (
                          <span className="ml-2 text-amber-400">(Role-based restriction)</span>
                        )}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm text-white/70">Reason</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="Optional reason for leave"
            />
          </div>

          <button
            type="submit"
            disabled={
              busy ||
              checkingAvailability ||
              hasAvailabilityConflict ||
              !requestOffice
            }
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy
              ? "Submitting..."
              : checkingAvailability
                ? "Checking availability..."
                : !requestOffice
                  ? "Choose office first"
                  : hasAvailabilityConflict
                    ? "Leave unavailable for selected dates"
                    : "Submit Leave Request"}
          </button>
        </form>
      </div>
    </div>
  );
}
