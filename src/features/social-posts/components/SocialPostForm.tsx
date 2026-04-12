import { useMemo, useState } from "react";
import type { Campaign } from "../../../lib/supabase/queries/campaigns";
import type { Client } from "../../../lib/supabase/queries/clients";

const PLATFORM_OPTIONS = ["LinkedIn", "Instagram", "Facebook", "X", "TikTok"];

export default function SocialPostForm({
  clients,
  campaigns,
  onGenerate,
}: {
  clients: Client[];
  campaigns: Campaign[];
  onGenerate: (prompt: string) => void;
}) {
  const [form, setForm] = useState({
    clientId: clients[0]?.id ?? "",
    campaignId: campaigns[0]?.id ?? "",
    platform: "LinkedIn",
    objective: "Generate leads",
    tone: "confident and practical",
    deliverables: 3,
  });

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

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();

    const clientName = selectedClient?.name || "this client";
    const campaignName = selectedCampaign?.name || "our current campaign";
    const prompt = `You are assisting a social media team at ITsNomatata. Create ${form.deliverables} ${form.platform} post ideas for ${clientName} under the ${campaignName} campaign. The objective is ${form.objective}. Use a ${form.tone} tone, include hooks, CTA options, and show how to batch production to save team time.`;

    onGenerate(prompt);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-5"
    >
      <div>
        <h3 className="text-lg font-semibold text-white">AI Brief Builder</h3>
        <p className="mt-1 text-sm text-white/50">
          Turn client context into a useful prompt for the workspace assistant.
        </p>
      </div>

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
        <option value="">Select client</option>
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
      >
        <option value="">Select campaign</option>
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
            setForm((current) => ({ ...current, platform: event.target.value }))
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
          className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
        />
      </div>

      <input
        value={form.objective}
        onChange={(event) =>
          setForm((current) => ({ ...current, objective: event.target.value }))
        }
        placeholder="Objective"
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
      />

      <input
        value={form.tone}
        onChange={(event) =>
          setForm((current) => ({ ...current, tone: event.target.value }))
        }
        placeholder="Tone"
        className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
      />

      <button
        type="submit"
        className="w-full rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
      >
        Create AI brief
      </button>
    </form>
  );
}
