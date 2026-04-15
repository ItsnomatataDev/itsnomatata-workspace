import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import ClientContactsList from "../components/ClientContactsList";
import ClientContactForm, {
  type ClientContactFormValues,
} from "../components/ClientContactForm";
import { getClientById, type ClientItem } from "../services/clientService";
import {
  createClientContact,
  getClientContacts,
  type ClientContactItem,
} from "../services/clientContactService";

export default function ClientDetailsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const { clientId } = useParams();

  if (!auth?.user || !auth?.profile) return null;

  const { profile } = auth;
  const organizationId = profile.organization_id;

  if (!organizationId || !clientId) return null;

  const [client, setClient] = useState<ClientItem | null>(null);
  const [contacts, setContacts] = useState<ClientContactItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [error, setError] = useState("");

  const loadClientDetails = async () => {
    try {
      setLoading(true);
      setError("");

      const [clientRow, contactRows] = await Promise.all([
        getClientById(organizationId, clientId),
        getClientContacts({ organizationId, clientId }),
      ]);

      setClient(clientRow);
      setContacts(contactRows);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load client details.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClientDetails();
  }, [organizationId, clientId]);

  const handleCreateContact = async (values: ClientContactFormValues) => {
    if (!client) return;

    try {
      setBusy(true);
      setError("");

      await createClientContact({
        organizationId,
        clientId: client.id,
        fullName: values.fullName,
        email: values.email || null,
        phone: values.phone || null,
        title: values.title || null,
        isPrimary: values.isPrimary,
        sendInvite: values.sendInvite,
      });

      await loadClientDetails();
      setShowContactForm(false);
      alert("Client contact created successfully.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create contact.";
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
          <button
            type="button"
            onClick={() => navigate("/clients")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80"
          >
            Back to clients
          </button>

          {loading ? (
            <div className="mt-6 text-white/60">Loading client details...</div>
          ) : error ? (
            <div className="mt-6 border border-red-500/20 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          ) : !client ? (
            <div className="mt-6 text-white/50">Client not found.</div>
          ) : (
            <>
              <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                    Client Details
                  </p>
                  <h1 className="mt-2 text-3xl font-bold">{client.name}</h1>
                  <p className="mt-2 text-sm text-white/50">
                    Client profile, contacts, and workspace access.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setShowContactForm((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/85"
                  >
                    <Plus size={14} />
                    {showContactForm ? "Close Contact Form" : "Add Contact"}
                  </button>

                  <button
                    type="button"
                    onClick={() => navigate(`/clients/${client.id}/workspace`)}
                    className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black"
                  >
                    Open Client Workspace
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
                <section className="space-y-6">
                  <div className="border border-white/10 bg-[#050505] p-6">
                    <h2 className="text-xl font-semibold">Profile</h2>

                    <div className="mt-4 space-y-3 text-sm text-white/70">
                      <p>Email: {client.email || "—"}</p>
                      <p>Phone: {client.phone || "—"}</p>
                      <p>Website: {client.website || "—"}</p>
                      <p>Industry: {client.industry || "—"}</p>
                      <p>Notes: {client.notes || "—"}</p>
                    </div>
                  </div>

                  {showContactForm ? (
                    <div className="border border-white/10 bg-[#050505] p-6">
                      <h2 className="mb-4 text-xl font-semibold">
                        Add Contact
                      </h2>

                      <ClientContactForm
                        busy={busy}
                        onSubmit={handleCreateContact}
                      />
                    </div>
                  ) : null}
                </section>

                <section>
                  <h2 className="mb-4 text-xl font-semibold">Contacts</h2>
                  <ClientContactsList contacts={contacts} />
                </section>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
