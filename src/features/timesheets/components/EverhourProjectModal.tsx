import { useState } from "react";
import { X } from "lucide-react";
import { createProject } from "../../../lib/supabase/mutations/projects";

type EverhourProjectModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  createdBy: string;
  onCreated: () => Promise<void> | void;
};

export default function EverhourProjectModal({
  open,
  onClose,
  organizationId,
  createdBy,
  onCreated,
}: EverhourProjectModalProps) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    targetHours: "",
    isBillable: true,
    allowOverBudget: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("Please enter a project name.");
      return;
    }

    try {
      setBusy(true);
      await createProject({
        organizationId,
        createdBy,
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: "active",
        priority: "medium",
        dueDate: null,
        metadata: {
          targetHours: form.targetHours ? Number(form.targetHours) : null,
          isBillable: form.isBillable,
          allowOverBudget: form.allowOverBudget,
        },
      });

      setForm({
        name: "",
        description: "",
        targetHours: "",
        isBillable: true,
        allowOverBudget: false,
      });

      await onCreated();
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to create project.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              Add Everhour Project
            </h2>
            <p className="mt-1 text-sm text-white/60">
              Create a project, assign the target hours, and choose the default
              billing behavior.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-white/70">
              Project name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, name: event.target.value }))
              }
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="Project name"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              placeholder="Optional project description"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <label className="mb-2 block text-sm text-white/70">
                Target hours
              </label>
              <input
                type="number"
                min={0}
                step={0.25}
                value={form.targetHours}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    targetHours: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                placeholder="15"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-white/70">
                Billing default
              </label>
              <select
                value={String(form.isBillable)}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    isBillable: event.target.value === "true",
                  }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              >
                <option value="true">Billable</option>
                <option value="false">Non-billable</option>
              </select>
            </div>

            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black px-4 py-3">
              <input
                id="allowOverBudget"
                type="checkbox"
                checked={form.allowOverBudget}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    allowOverBudget: event.target.checked,
                  }))
                }
                className="h-4 w-4 text-orange-500"
              />
              <label
                htmlFor="allowOverBudget"
                className="text-sm text-white/70"
              >
                Allow over-budget
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? "Creating project..." : "Create project"}
          </button>
        </form>
      </div>
    </div>
  );
}
