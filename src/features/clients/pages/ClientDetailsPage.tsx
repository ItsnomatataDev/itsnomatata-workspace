import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Globe,
  BriefcaseBusiness,
  PenSquare,
  Trash2,
  FolderKanban,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  getClientById,
  type Client,
} from "../../../lib/supabase/queries/clients";
import {
  updateClient,
  deleteClient,
} from "../../../lib/supabase/mutations/clients";
import ClientForm, { type ClientFormValues } from "../components/ClientForm";

export default function ClientDetailsPage() {
  const auth = useAuth();
  const { clientId } = useParams();
  const navigate = useNavigate();

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!auth?.profile) return null;

  const { profile } = auth;

  useEffect(() => {
    const run = async () => {
      if (!clientId) return;

      try {
        setLoading(true);
        const data = await getClientById(clientId);
        setClient(data);
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : "Failed to fetch client");
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [clientId]);

  const handleUpdate = async (values: ClientFormValues) => {
    if (!clientId) return;

    try {
      setBusy(true);
      const updated = await updateClient(clientId, {
        name: values.name,
        slug: values.slug,
        industry: values.industry,
        description: values.description,
        website_url: values.website_url,
        brand_voice: values.brand_voice,
        status: values.status,
      });
      setClient(updated);
      alert("Client updated successfully");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to update client");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!clientId) return;

    const confirmed = window.confirm("Delete this client?");
    if (!confirmed) return;

    try {
      await deleteClient(clientId);
      navigate("/clients");
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : "Failed to delete client");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading client...
            </div>
          ) : !client ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Client not found.
            </div>
          ) : (
            <>
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <Link
                    to="/clients"
                    className="inline-flex items-center gap-2 text-sm text-orange-500"
                  >
                    <ArrowLeft size={16} />
                    Back to Clients
                  </Link>

                  <p className="mt-4 text-xs uppercase tracking-[0.3em] text-orange-500">
                    Client Details
                  </p>
                  <h1 className="mt-2 text-3xl font-bold">{client.name}</h1>
                  <p className="mt-2 text-sm text-white/50">
                    Full client profile and settings.
                  </p>
                </div>

                <Link
                  to={`/clients/${client.id}/workspace`}
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black"
                >
                  <FolderKanban size={16} />
                  Open Workspace
                </Link>
              </div>

              <section className="grid gap-6 xl:grid-cols-[1fr_420px]">
                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                        <div className="flex items-center gap-2 text-orange-500">
                          <Building2 size={16} />
                          <span className="text-sm font-medium">Industry</span>
                        </div>
                        <p className="mt-3 text-white/80">
                          {client.industry || "Not set"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                        <div className="flex items-center gap-2 text-orange-500">
                          <Globe size={16} />
                          <span className="text-sm font-medium">Website</span>
                        </div>
                        <p className="mt-3 break-all text-white/80">
                          {client.website_url || "Not set"}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                        <div className="flex items-center gap-2 text-orange-500">
                          <BriefcaseBusiness size={16} />
                          <span className="text-sm font-medium">Status</span>
                        </div>
                        <p className="mt-3 uppercase text-white/80">
                          {client.status}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                        <div className="flex items-center gap-2 text-orange-500">
                          <PenSquare size={16} />
                          <span className="text-sm font-medium">
                            Brand Voice
                          </span>
                        </div>
                        <p className="mt-3 text-white/80">
                          {client.brand_voice || "Not set"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-6 rounded-2xl border border-white/10 bg-black/40 p-4">
                      <p className="text-sm font-medium text-orange-500">
                        Description
                      </p>
                      <p className="mt-3 text-white/75">
                        {client.description || "No description available."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <h2 className="mb-5 text-lg font-semibold">Edit Client</h2>
                    <ClientForm
                      initialValues={{
                        name: client.name,
                        slug: client.slug,
                        industry: client.industry || "",
                        description: client.description || "",
                        website_url: client.website_url || "",
                        brand_voice: client.brand_voice || "",
                        status: client.status,
                      }}
                      onSubmit={handleUpdate}
                      submitLabel="Update Client"
                      busy={busy}
                    />
                  </div>

                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6">
                    <h2 className="text-lg font-semibold text-red-300">
                      Danger Zone
                    </h2>
                    <p className="mt-2 text-sm text-red-200/80">
                      Deleting a client may affect linked campaigns, tasks, and
                      content.
                    </p>
                    <button
                      onClick={handleDelete}
                      className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-red-400/30 px-4 py-3 font-semibold text-red-300"
                    >
                      <Trash2 size={16} />
                      Delete Client
                    </button>
                  </div>
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
