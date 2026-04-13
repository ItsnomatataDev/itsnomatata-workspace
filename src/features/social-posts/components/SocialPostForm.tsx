import { useMemo, useState, useEffect } from "react";
import type {
  SocialPlatform,
  SocialPostPriority,
} from "../../../lib/hooks/useSocialPosts";
import type { Campaign } from "../../../lib/supabase/queries/campaigns";
import type { Client } from "../../../lib/supabase/queries/clients";

const PLATFORM_OPTIONS: SocialPlatform[] = [
  "LinkedIn",
  "Instagram",
  "Facebook",
  "X",
  "TikTok",
];

export default function SocialPostForm({
  clients,
  campaigns,
  onGenerate,
  onCreatePost,
}: {
  clients: Client[];
  campaigns: Campaign[];
  onGenerate: (prompt: string) => void;
  onCreatePost: (payload: {
    title: string;
    platform: SocialPlatform;
    clientId?: string | null;
    campaignId?: string | null;
    priority: SocialPostPriority;
    estimatedHours: number;
    scheduledFor: string;
    aiAngle: string;
  }) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    title: "",
    clientId: "",
    campaignId: "",
    platform: "LinkedIn" as SocialPlatform,
    objective: "",
    tone: "",
    priority: "medium" as SocialPostPriority,
    deliverables: 3,
    estimatedHours: 2,
    scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16),
  });

  // Reset form when clients list changes
  useEffect(() => {
    setForm((current) => ({
      ...current,
      clientId: clients[0]?.id ?? "",
      campaignId: "",
    }));
  }, [clients]);

  // Reset form when campaigns list changes
  useEffect(() => {
    if (form.clientId) {
      const availableCampaigns = campaigns.filter(
        (c) => c.client_id === form.clientId,
      );
      setForm((current) => ({
        ...current,
        campaignId: availableCampaigns[0]?.id ?? "",
      }));
    }
  }, [campaigns, form.clientId]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.id === form.clientId) ?? null,
    [clients, form.clientId],
  );

  const availableCampaigns = useMemo(() => {
    if (!form.clientId) return campaigns;
    return campaigns.filter((campaign) => campaign.client_id === form.clientId);
  }, [campaigns, form.clientId]);

  const selectedCampaign = useMemo(
    () =>
      availableCampaigns.find((campaign) => campaign.id === form.campaignId) ??
      availableCampaigns[0] ??
      null,
    [availableCampaigns, form.campaignId],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.clientId) {
      setError("Please select a client");
      return;
    }

    if (!selectedCampaign) {
      setError("Please select a campaign");
      return;
    }

    const clientName = selectedClient?.name || "this client";
    const campaignName = selectedCampaign?.name || "our current campaign";

    const objective =
      form.objective.trim() || "Increase brand awareness and engagement";
    const tone = form.tone.trim() || "professional and authentic";

    const prompt = `You are assisting a social media team at ITsNomatata. Create ${form.deliverables} ${form.platform} post ideas for ${clientName} under the ${campaignName} campaign. The objective is: ${objective}. Use a ${tone} tone. Include hooks, CTA options, and show how to batch production to save team time.`;

    const title =
      form.title.trim() || `${campaignName} ${form.platform} content pack`;

    try {
      setBusy(true);
      onGenerate(prompt);

      await onCreatePost({
        title,
        platform: form.platform,
        clientId: form.clientId || null,
        campaignId: selectedCampaign.id || null,
        priority: form.priority,
        estimatedHours: Math.max(0.5, form.estimatedHours),
        scheduledFor: new Date(form.scheduledFor).toISOString(),
        aiAngle: objective,
      });

      setSuccess(`✓ Created draft: ${title}`);

      // Reset form to defaults
      setForm((current) => ({
        ...current,
        title: "",
        objective: "",
        tone: "",
        deliverables: 3,
        estimatedHours: 2,
        priority: "medium",
        platform: "LinkedIn",
        scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000)
          .toISOString()
          .slice(0, 16),
      }));

      // Clear success message after 3 seconds
      window.setTimeout(() => setSuccess(""), 3000);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create social post.",
      );
    } finally {
      setBusy(false);
    }
  };

  const isFormValid = Boolean(form.clientId && selectedCampaign);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5"
    >
      <div>
        <h3 className="text-lg font-semibold text-white">AI Brief Builder</h3>
        <p className="mt-1 text-sm text-white/50">
          Turn client context into a useful prompt and create a tracked social
          post draft at the same time.
        </p>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          {success}
        </div>
      ) : null}

      <input
        value={form.title}
        onChange={(event) =>
          setForm((current) => ({ ...current, title: event.target.value }))
        }
        placeholder="Post title (optional)"
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
      />

      <select
        value={form.clientId}
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            clientId: event.target.value,
            campaignId: "",
          }))
        }
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
      >
        <option value="">
          {clients.length === 0 ? "No clients available" : "Select client"}
        </option>
        {clients.map((client) => (
          <option key={client.id} value={client.id}>
            {client.name}
          </option>
        ))}
      </select>

      <select
        value={selectedCampaign?.id ?? ""}
        onChange={(event) =>
          setForm((current) => ({ ...current, campaignId: event.target.value }))
        }
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
        disabled={!form.clientId}
      >
        <option value="">
          {availableCampaigns.length === 0
            ? form.clientId
              ? "No campaigns for this client"
              : "Select a client first"
            : "Select campaign"}
        </option>
        {availableCampaigns.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.name}
          </option>
        ))}
      </select>

      <div className="grid gap-4 md:grid-cols-2">
        <select
          value={form.platform}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              platform: event.target.value as SocialPlatform,
            }))
          }
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
        >
          {PLATFORM_OPTIONS.map((platform) => (
            <option key={platform} value={platform}>
              {platform}
            </option>
          ))}
        </select>

        <input
          type="number"
          min={1}
          max={12}
          value={form.deliverables}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              deliverables: Number(event.target.value) || 1,
            }))
          }
          placeholder="Number of post ideas"
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <select
          value={form.priority}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              priority: event.target.value as SocialPostPriority,
            }))
          }
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
        >
          <option value="low">Low priority</option>
          <option value="medium">Medium priority</option>
          <option value="high">High priority</option>
        </select>

        <input
          type="number"
          min={0.5}
          max={20}
          step={0.5}
          value={form.estimatedHours}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              estimatedHours: Number(event.target.value) || 0.5,
            }))
          }
          placeholder="Estimated hours"
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
        />
      </div>

      <input
        type="datetime-local"
        value={form.scheduledFor}
        onChange={(event) =>
          setForm((current) => ({
            ...current,
            scheduledFor: event.target.value,
          }))
        }
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
      />

      <input
        value={form.objective}
        onChange={(event) =>
          setForm((current) => ({ ...current, objective: event.target.value }))
        }
        placeholder="Campaign objective (optional)"
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
      />

      <input
        value={form.tone}
        onChange={(event) =>
          setForm((current) => ({ ...current, tone: event.target.value }))
        }
        placeholder="Tone/voice (optional)"
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
      />

      <button
        type="submit"
        disabled={busy || !isFormValid}
        className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:bg-orange-500/50 disabled:cursor-not-allowed"
      >
        {busy ? "Saving..." : "Create draft + AI brief"}
      </button>
    </form>
  );
}
