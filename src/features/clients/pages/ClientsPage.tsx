import { useMemo, useState } from "react";
import {
  Search,
  Plus,
  Users,
  FolderKanban,
  PauseCircle,
  BriefcaseBusiness,
} from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useClients } from "../../../lib/hooks/useClients";
import ClientForm, { type ClientFormValues } from "../components/ClientForm";
import ClientCard from "../components/ClientCard";

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ size?: number }>;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{label}</p>
        <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
          <Icon size={18} />
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

export default function ClientsPage() {
  const auth = useAuth();
  const [tab, setTab] = useState<"my" | "all">("my");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");

  if (!auth?.user || !auth?.profile) return null;

  const { user, profile } = auth;

  const { clients, myClients, stats, loading, error, createClient } =
    useClients({
      userId: user.id,
      organizationId: profile.organization_id,
    });

  const activeList = tab === "my" ? myClients : clients;

  const filteredClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return activeList;

    return activeList.filter((client) =>
      [
        client.name,
        client.slug,
        client.industry || "",
        client.status,
        client.website_url || "",
        client.brand_voice || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [activeList, query]);

  const handleCreateClient = async (values: ClientFormValues) => {
    if (!profile?.organization_id) {
      alert("No organization found for this user.");
      return;
    }

    try {
      setBusy(true);

      await createClient({
        organization_id: profile.organization_id,
        created_by: user.id,
        name: values.name,
        slug: values.slug,
        industry: values.industry,
        description: values.description,
        website_url: values.website_url,
        brand_voice: values.brand_voice,
        status: values.status,
      });

      setTab("all");
    } catch (err) {
      console.error("HANDLE CREATE CLIENT ERROR:", err);
      alert(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Clients
              </p>
              <h1 className="mt-2 text-3xl font-bold">Client Workspace</h1>
              <p className="mt-2 text-sm text-white/50">
                See clients you are actively working on and manage the full
                client list.
              </p>
            </div>

            <div className="w-full max-w-md">
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <Search size={18} className="text-white/35" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search clients..."
                  className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
                />
              </div>
            </div>
          </div>

          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="All Clients"
              value={stats.totalClients}
              icon={Users}
            />
            <SummaryCard
              label="My Clients"
              value={stats.myClients}
              icon={FolderKanban}
            />
            <SummaryCard
              label="Active"
              value={stats.activeClients}
              icon={BriefcaseBusiness}
            />
            <SummaryCard
              label="Paused"
              value={stats.pausedClients}
              icon={PauseCircle}
            />
          </section>

          <div className="mt-6 grid gap-6 xl:grid-cols-[390px_1fr]">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                  <Plus size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Create Client</h2>
                  <p className="text-sm text-white/50">
                    Add a real client to Supabase
                  </p>
                </div>
              </div>

              <ClientForm
                onSubmit={handleCreateClient}
                submitLabel="Create Client"
                busy={busy}
              />
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex rounded-2xl border border-white/10 bg-black p-1">
                  <button
                    onClick={() => setTab("my")}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      tab === "my"
                        ? "bg-orange-500 text-black"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    My Clients
                  </button>
                  <button
                    onClick={() => setTab("all")}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      tab === "all"
                        ? "bg-orange-500 text-black"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    All Clients
                  </button>
                </div>

                <p className="text-sm text-white/45">
                  {filteredClients.length} result(s)
                </p>
              </div>

              {loading ? (
                <p className="text-white/60">Loading clients...</p>
              ) : null}
              {error ? <p className="text-red-400">{error}</p> : null}

              {!loading && filteredClients.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-white/40">
                  {tab === "my"
                    ? "No clients are linked to your assigned tasks yet."
                    : "No clients found."}
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {filteredClients.map((client) => (
                  <ClientCard key={client.id} client={client} />
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
