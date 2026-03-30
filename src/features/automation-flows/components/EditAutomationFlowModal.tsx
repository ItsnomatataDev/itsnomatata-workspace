import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  updateAutomationFlow,
  generateFlowSlug,
  type AutomationFlowRow,
} from "../services/automationFlowService";

type EditAutomationFlowModalProps = {
  open: boolean;
  onClose: () => void;
  flow: AutomationFlowRow | null;
  onUpdated: () => Promise<void> | void;
};

export default function EditAutomationFlowModal({
  open,
  onClose,
  flow,
  onUpdated,
}: EditAutomationFlowModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!flow) return;
    setName(flow.name);
    setDescription(flow.description || "");
    setWebhookUrl(flow.webhook_url || "");
    setStatus(flow.status || "active");
  }, [flow]);

  const slug = useMemo(() => generateFlowSlug(name), [name]);

  if (!open || !flow) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setBusy(true);

      await updateAutomationFlow({
        id: flow.id,
        name,
        slug,
        description,
        webhookUrl,
        status,
        projectId: flow.project_id,
      });

      await onUpdated();
      onClose();
    } catch (err: any) {
      console.error("UPDATE AUTOMATION FLOW ERROR:", err);
      setError(err?.message || "Failed to update automation flow.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Edit Automation</h2>
            <p className="mt-1 text-sm text-white/55">
              Update workflow connection and settings
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
            <label className="mb-2 block text-sm text-white/70">
              Workflow Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">Slug</label>
            <input
              type="text"
              value={slug}
              readOnly
              className="w-full rounded-2xl border border-white/10 bg-zinc-900 px-4 py-3 text-white/70 outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">
              n8n Webhook URL
            </label>
            <input
              type="url"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-white/70">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            >
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
          >
            {busy ? "Saving changes..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}
