import { useMemo, useState, type FormEvent } from "react";
import { Check, History, Minus, Plus, Users, Wallet, X } from "lucide-react";
import type {
  LeaveBalanceAuditHistoryRow,
  LeaveBalanceEmployeeRow,
} from "../../leave/services/leaveBalanceAuditService";

type AdjustmentType = "add" | "subtract";

const DEFAULT_LEAVE_DAYS_TOTAL = 22;

type LeaveBalanceAdjustmentCardProps = {
  employees: LeaveBalanceEmployeeRow[];
  history: LeaveBalanceAuditHistoryRow[];
  saving?: boolean;
  onSave: (params: {
    userId: string;
    newTotal: number;
    newRemaining: number;
    reason: string;
  }) => Promise<void>;
};

function displayName(
  person?: { full_name?: string | null; email?: string | null } | null,
) {
  return person?.full_name?.trim() || person?.email?.trim() || "Unknown user";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function LeaveBalanceAdjustmentCard({
  employees,
  history,
  saving = false,
  onSave,
}: LeaveBalanceAdjustmentCardProps) {
  const [employeeId, setEmployeeId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<AdjustmentType>("add");
  const [days, setDays] = useState<number | "">("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [showTeamBalances, setShowTeamBalances] = useState(false);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === employeeId) ?? null,
    [employees, employeeId],
  );

  const dayCount = days === "" ? 0 : Number(days);
  const signedDays = adjustmentType === "add" ? dayCount : -dayCount;
  const currentTotal = selectedEmployee?.leave_days_total ?? 0;
  const currentRemaining = selectedEmployee?.leave_days_remaining ?? 0;
  const newTotal = DEFAULT_LEAVE_DAYS_TOTAL;
  const newRemaining = currentRemaining + signedDays;
  const isSubtract = adjustmentType === "subtract";

  const validate = () => {
    if (!selectedEmployee) return "Please select an employee.";
    if (!Number.isFinite(dayCount) || dayCount <= 0) {
      return "Days must be greater than 0.";
    }
    if (!reason.trim()) return "Reason for adjustment is required.";
    if (newRemaining < 0) {
      return "Remaining balance can be 0, but it cannot go below 0.";
    }
    if (newRemaining > DEFAULT_LEAVE_DAYS_TOTAL) {
      return `Remaining balance cannot be more than the ${DEFAULT_LEAVE_DAYS_TOTAL}-day annual entitlement.`;
    }
    return "";
  };

  const handleConfirmRequest = (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    setError(validationError);
    if (!validationError) setConfirmOpen(true);
  };

  const handleSave = async () => {
    const validationError = validate();
    setError(validationError);
    if (validationError || !selectedEmployee) return;

    try {
      await onSave({
        userId: selectedEmployee.id,
        newTotal,
        newRemaining,
        reason: reason.trim(),
      });

      setDays("");
      setReason("");
      setConfirmOpen(false);
    } catch (err: any) {
      setError(err?.message || "Failed to adjust leave balance.");
    }
  };

  const confirmationText = selectedEmployee
    ? `You are about to ${isSubtract ? "subtract" : "add"} ${dayCount} leave day${dayCount === 1 ? "" : "s"} ${isSubtract ? "from" : "to"} ${displayName(selectedEmployee)}. Total entitlement stays at ${DEFAULT_LEAVE_DAYS_TOTAL}; new remaining balance will be ${newRemaining} day${newRemaining === 1 ? "" : "s"}. Continue?`
    : "";

  return (
    <section className="mb-6 rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Wallet size={18} className="text-orange-500" />
          <div>
            <h2 className="text-lg font-semibold">Leave Balance Adjustment</h2>
            <p className="mt-1 text-sm text-white/50">
              Select an employee, review the current balance, then confirm the change.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowTeamBalances((current) => !current)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
        >
          <Users size={16} />
          {showTeamBalances ? "Hide Team Balances" : "View Team Balances"}
        </button>
      </div>

      {showTeamBalances ? (
        <div className="mb-5 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div>
              <h3 className="font-semibold text-white">Team Leave Balances</h3>
              <p className="mt-1 text-sm text-white/50">
                Total entitlement is fixed at {DEFAULT_LEAVE_DAYS_TOTAL}; balance changes only adjust remaining days.
              </p>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
              {employees.length} employee{employees.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm text-white/75">
              <thead className="bg-white/5 text-white/45">
                <tr>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Total leave days</th>
                  <th className="px-4 py-3 font-medium">Remaining leave days</th>
                  <th className="px-4 py-3 font-medium">Used days</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => {
                  const usedDays = Math.max(
                    employee.leave_days_total - employee.leave_days_remaining,
                    0,
                  );
                  const exhausted = employee.leave_days_remaining === 0;

                  return (
                    <tr key={employee.id} className="border-t border-white/10">
                      <td className="px-4 py-3">
                        <p className="font-medium text-white">{displayName(employee)}</p>
                        <p className="mt-1 text-xs text-white/45">
                          {employee.email || employee.primary_role || employee.id}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {employee.leave_days_total}
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">
                        {employee.leave_days_remaining}
                      </td>
                      <td className="px-4 py-3">{usedDays}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            exhausted
                              ? "border border-amber-500/20 bg-amber-500/10 text-amber-300"
                              : "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          {exhausted ? "Exhausted" : "Available"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.8fr)]">
        <form
          onSubmit={handleConfirmRequest}
          className="rounded-2xl border border-white/10 bg-black/30 p-4"
        >
          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="leaveBalanceEmployee" className="mb-2 block text-sm text-white/60">
                Step 1: Select employee
              </label>
              <select
                id="leaveBalanceEmployee"
                value={employeeId}
                onChange={(event) => setEmployeeId(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
              >
                <option value="">Choose an employee</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {displayName(employee)}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-sm font-medium text-white">Step 2: Current Balance</p>
              {selectedEmployee ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-white/45">Employee name</p>
                    <p className="mt-1 font-medium text-white">
                      {displayName(selectedEmployee)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Current total leave days</p>
                    <p className="mt-1 text-2xl font-semibold text-white">
                      {currentTotal}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-white/45">Current remaining leave days</p>
                    <p className="mt-1 text-2xl font-semibold text-emerald-300">
                      {currentRemaining}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-3 text-sm text-white/45">
                  Current balance appears after you select an employee.
                </p>
              )}
            </div>

            <div className="md:col-span-2">
              <p className="mb-2 text-sm text-white/60">Step 3: Choose adjustment type</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAdjustmentType("add")}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    adjustmentType === "add"
                      ? "bg-emerald-500 text-black"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <Plus size={16} />
                  Add Leave Days
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustmentType("subtract")}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    adjustmentType === "subtract"
                      ? "bg-amber-400 text-black"
                      : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
                  }`}
                >
                  <Minus size={16} />
                  Subtract Leave Days
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="leaveAdjustmentDays" className="mb-2 block text-sm text-white/60">
                Step 4: Enter number of days
              </label>
              <input
                id="leaveAdjustmentDays"
                type="number"
                min="1"
                step="1"
                value={days}
                onChange={(event) =>
                  setDays(event.target.value === "" ? "" : Number(event.target.value))
                }
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                placeholder="e.g., 3"
              />
            </div>

            <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-4">
              <p className="text-sm font-medium text-orange-100">
                New Balance After Change
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-orange-100/60">Total entitlement</p>
                  <p className="mt-1 text-2xl font-semibold text-orange-100">
                    {selectedEmployee && dayCount > 0 ? newTotal : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-orange-100/60">New remaining</p>
                  <p className="mt-1 text-2xl font-semibold text-orange-100">
                    {selectedEmployee && dayCount > 0 ? newRemaining : "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label htmlFor="leaveAdjustmentReason" className="mb-2 block text-sm text-white/60">
                Step 5: Reason for adjustment
              </label>
              <textarea
                id="leaveAdjustmentReason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="min-h-24 w-full resize-none rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-orange-500 focus:outline-none"
                placeholder="Reason for adjustment"
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={16} />
              Step 6: Confirm adjustment
            </button>
          </div>
        </form>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <div className="mb-4 flex items-center gap-2">
            <History size={16} className="text-orange-500" />
            <h3 className="font-semibold text-white">Recent Balance Changes</h3>
          </div>

          {history.length === 0 ? (
            <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-5 text-sm text-white/50">
              No balance changes recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-white">{displayName(item.employee)}</p>
                      <p className="mt-1 text-xs text-white/45">
                        Changed by {displayName(item.modifier)}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs text-white/45">
                      {formatDate(item.created_at)}
                    </p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full border border-white/10 bg-black/40 px-3 py-1 text-white/65">
                      Previous remaining: {item.previous_remaining}
                    </span>
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                      New remaining: {item.new_remaining}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-white/65">{item.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmOpen && selectedEmployee ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-black p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Confirm adjustment</h3>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-sm leading-6 text-white/70">{confirmationText}</p>
            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={saving}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
