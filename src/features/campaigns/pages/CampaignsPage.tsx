import { useState } from "react";
import { BriefcaseBusiness, Plus } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useCampaigns } from "../../../lib/hooks/useCampaigns";

export default function CampaignsPage() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    name: "",
    description: "",
    objective: "",
    start_date: "",
    end_date: "",
    budget: "",
    status: "draft",
  });

  if (!auth?.user || !auth?.profile) return null;

  const { user, profile } = auth;
  const organizationId = profile.organization_id ?? undefined;

  const { campaigns, loading, error, createCampaign } = useCampaigns({
    organizationId,
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      alert("Your account is not linked to an organization yet.");
      return;
    }

    try {
      setBusy(true);

      await createCampaign({
        organization_id: organizationId,
        client_id: form.client_id,
        name: form.name,
        description: form.description,
        objective: form.objective,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        budget: form.budget ? Number(form.budget) : null,
        status: form.status as any,
        created_by: user.id,
      });

      setForm({
        client_id: "",
        name: "",
        description: "",
        objective: "",
        start_date: "",
        end_date: "",
        budget: "",
        status: "draft",
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create campaign");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Campaigns
            </p>
            <h1 className="mt-2 text-3xl font-bold">Campaign Management</h1>
            <p className="mt-2 text-sm text-white/50">
              Manage real campaigns connected to Supabase.
            </p>
          </div>

          {!organizationId ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-300">
              Your account is not linked to an organization yet.
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                    <Plus size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">Create Campaign</h2>
                    <p className="text-sm text-white/50">Add a real campaign</p>
                  </div>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                  <input
                    value={form.client_id}
                    onChange={(e) =>
                      setForm({ ...form, client_id: e.target.value })
                    }
                    placeholder="Client ID"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                    required
                  />

                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Campaign Name"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                    required
                  />

                  <textarea
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Description"
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  />

                  <input
                    value={form.objective}
                    onChange={(e) =>
                      setForm({ ...form, objective: e.target.value })
                    }
                    placeholder="Objective"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  />

                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  />

                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  />

                  <input
                    type="number"
                    value={form.budget}
                    onChange={(e) =>
                      setForm({ ...form, budget: e.target.value })
                    }
                    placeholder="Budget"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  />

                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="planned">Planned</option>
                    <option value="in_progress">In Progress</option>
                    <option value="review">Review</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black"
                  >
                    {busy ? "Saving..." : "Create Campaign"}
                  </button>
                </form>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                    <BriefcaseBusiness size={18} />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold">All Campaigns</h2>
                    <p className="text-sm text-white/50">
                      {campaigns.length} total
                    </p>
                  </div>
                </div>

                {loading ? (
                  <p className="text-white/60">Loading campaigns...</p>
                ) : null}
                {error ? <p className="text-red-400">{error}</p> : null}

                <div className="grid gap-4 md:grid-cols-2">
                  {campaigns.map((campaign) => (
                    <div
                      key={campaign.id}
                      className="rounded-2xl border border-white/10 bg-black/40 p-4"
                    >
                      <h3 className="text-lg font-semibold">{campaign.name}</h3>
                      <p className="mt-2 text-sm text-white/55">
                        {campaign.description || "No description"}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-xs text-white/50">
                        <span>{campaign.status}</span>
                        <span>{campaign.start_date || "No date"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
