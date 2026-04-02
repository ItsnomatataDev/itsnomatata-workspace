import { useState } from "react";
import { X } from "lucide-react";
import { createLeaveType } from "../services/adminService";

type CreateLeaveTypeModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  onCreated: () => Promise<void> | void;
};

export default function CreateLeaveTypeModal({
  open,
  onClose,
  organizationId,
  onCreated,
}: CreateLeaveTypeModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultDays, setDefaultDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setBusy(true);

      await createLeaveType({
        organizationId,
        name,
        description,
        defaultDays,
      });

      await onCreated();
      onClose();

      setName("");
      setDescription("");
      setDefaultDays(0);
    } catch (err: any) {
      console.error("CREATE LEAVE TYPE ERROR:", err);
      setError(err?.message || "Failed to create leave type.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Create Leave Type</h2>
            <p className="mt-1 text-sm text-white/55">
              Add a leave category for your organization
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
            <label className="mb-2 block text-sm text-white/70">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="Annual Leave"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="Optional description"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">
              Default Days
            </label>
            <input
              type="number"
              min={0}
              value={defaultDays}
              onChange={(e) => setDefaultDays(Number(e.target.value))}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? "Creating..." : "Create Leave Type"}
          </button>
        </form>
      </div>
    </div>
  );
}
