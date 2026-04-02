import { useState } from "react";
import { X } from "lucide-react";
import { createLeaveCalendarRule } from "../services/leaveCalendarService";

export default function CreateLeaveRuleModal({
  open,
  onClose,
  organizationId,
  userId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  userId: string;
  onCreated: () => Promise<void> | void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ruleType, setRuleType] = useState<"open" | "closed">("closed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setBusy(true);

      await createLeaveCalendarRule({
        organizationId,
        title,
        description,
        startDate,
        endDate,
        ruleType,
        createdBy: userId,
      });

      await onCreated();

      setTitle("");
      setDescription("");
      setStartDate("");
      setEndDate("");
      setRuleType("closed");
      onClose();
    } catch (err: any) {
      console.error("CREATE LEAVE RULE ERROR:", err);
      setError(err?.message || "Failed to create leave rule.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Create Leave Rule</h2>
            <p className="mt-1 text-sm text-white/55">
              Lock or open leave periods for employees
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            placeholder="Busy season lock"
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Optional explanation"
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          />

          <div className="grid gap-4 md:grid-cols-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <select
            value={ruleType}
            onChange={(e) => setRuleType(e.target.value as "open" | "closed")}
            className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          >
            <option value="closed">Closed period</option>
            <option value="open">Open period</option>
          </select>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save Rule"}
          </button>
        </form>
      </div>
    </div>
  );
}
