import { useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  createAutomationFlow,
  generateFlowSlug,
} from "../services/automationFlowService";

type CreateAutomationFlowModalProps = {
  open: boolean;
  onClose: () => void;
  organizationId: string;
  userId: string;
  onCreated: () => Promise<void> | void;
};

export default function CreateAutomationFlowModal({
  open,
  onClose,
  organizationId,
  userId,
  onCreated,
}: CreateAutomationFlowModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [status, setStatus] = useState("active");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const slug = useMemo(() => generateFlowSlug(name), [name]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      setBusy(true);

      await createAutomationFlow({
        organizationId,
        createdBy: userId,
        name,
        slug,
        description,
        webhookUrl,
        status,
      });

      await onCreated();
      onClose();

      setName("");
      setDescription("");
      setWebhookUrl("");
      setStatus("active");
    } catch (err: any) {
      console.error("CREATE AUTOMATION FLOW ERROR:", err);
      setError(err?.message || "Failed to create automation flow.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Create Automation</h2>
            <p className="mt-1 text-sm text-white/55">
              Connect an n8n workflow without touching the database
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
              placeholder="Social Reply Agent"
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
              placeholder="Describe what this automation does"
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
              placeholder="https://your-n8n-domain/webhook/social-reply-agent"
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
            {busy ? "Creating automation..." : "Create Automation"}
          </button>
        </form>
      </div>
    </div>
  );
}
