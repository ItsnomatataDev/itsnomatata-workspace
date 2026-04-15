import { useEffect, useState } from "react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import ClientCard from "../components/ClientCard";
import ClientForm, { type ClientFormValues } from "../components/ClientForm";
import {
  createClient,
  getClients,
  type ClientItem,
} from "../services/clientService";
import { useNavigate } from "react-router-dom";
import { Building2, Briefcase, Plus, Users } from "lucide-react";

export default function ClientsPage() {
  const auth = useAuth();
  const navigate = useNavigate();

  if (!auth?.user || !auth?.profile) return null;

  const { profile } = auth;
  const organizationId = profile.organization_id;

  if (!organizationId) return null;

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState("");

  const loadClients = async () => {
    try {
      setLoading(true);
      setError("");
      const rows = await getClients(organizationId);
      setClients(rows);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load clients.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClients();
  }, [organizationId]);

  const handleCreateClient = async (values: ClientFormValues) => {
    try {
      setBusy(true);
      setError("");

      await createClient({
        organizationId,
        name: values.name,
        email: values.email || null,
        phone: values.phone || null,
        website: values.website || null,
        industry: values.industry || null,
        notes: values.notes || null,
      });

      await loadClients();
      setShowCreateForm(false);
      alert("Client created successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create client.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Clients
              </p>
              <h1 className="mt-2 text-3xl font-bold">Client Directory</h1>
              <p className="mt-2 text-sm text-white/50">
                Create clients, open details, and jump into their workspace.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateForm((prev) => !prev)}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black"
            >
              <Plus size={16} />
              {showCreateForm ? "Close Form" : "Add Client"}
            </button>
          </div>

          {error ? (
            <div className="mb-6 border border-red-500/20 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 md:grid-cols-3">
            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <Users size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Total clients</p>
              </div>
              <p className="mt-3 text-3xl font-bold">{clients.length}</p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <Building2 size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Profiles</p>
              </div>
              <p className="mt-3 text-sm text-white/60">
                Open a client profile to view contacts and account information.
              </p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <Briefcase size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Workspaces</p>
              </div>
              <p className="mt-3 text-sm text-white/60">
                Open a workspace to view invited cards, tracked time, and
                submissions.
              </p>
            </div>
          </div>

          {showCreateForm ? (
            <section className="mb-6 border border-white/10 bg-[#050505] p-5">
              <h2 className="mb-4 text-lg font-semibold">Create Client</h2>
              <ClientForm busy={busy} onSubmit={handleCreateClient} />
            </section>
          ) : null}

          {loading ? (
            <div className="border border-white/10 bg-[#050505] p-6 text-white/60">
              Loading clients...
            </div>
          ) : clients.length === 0 ? (
            <div className="border border-white/10 bg-[#050505] p-6 text-white/50">
              No clients found yet.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clients.map((client) => (
                <ClientCard
                  key={client.id}
                  client={client}
                  onOpenDetails={(clientId) => navigate(`/clients/${clientId}`)}
                  onOpenWorkspace={(clientId) =>
                    navigate(`/clients/${clientId}/workspace`)
                  }
                />
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
