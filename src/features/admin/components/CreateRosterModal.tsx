import { useState } from "react";
import { X } from "lucide-react";
import { createDutyRoster } from "../services/adminService";

type CreateRosterModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  userId: string;
  onCreated: () => Promise<void> | void;
};

export default function CreateRosterModal({
  open,
  onClose,
  organizationId,
  userId,
  onCreated,
}: CreateRosterModalProps) {
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setBusy(true);

      await createDutyRoster({
        organizationId,
        title,
        department,
        weekStart,
        createdBy: userId,
      });

      await onCreated();
      onClose();

      setTitle("");
      setDepartment("");
      setWeekStart("");
    } catch (err: any) {
      console.error("CREATE ROSTER ERROR:", err);
      setError(err?.message || "Failed to create roster.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Create Duty Roster</h2>
            <p className="mt-1 text-sm text-white/55">
              Create a weekly duty roster for your team
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
          <div>
            <label className="mb-2 block text-sm text-white/70">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Front Office Weekly Roster"
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Operations"
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">
              Week Start
            </label>
            <input
              type="date"
              value={weekStart}
              onChange={(e) => setWeekStart(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? "Creating..." : "Create Roster"}
          </button>
        </form>
      </div>
    </div>
  );
}
