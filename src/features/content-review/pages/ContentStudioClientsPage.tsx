import { Copy, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  assertCanUseContentStudio,
  buildClientPortalUrl,
  createContentClient,
  createContentReviewDraft,
  deleteContentClient,
  deleteContentReviewDraft,
  getContentClient,
  listContentClients,
  listContentReviewDrafts,
  regenerateContentClientPin,
  type ContentClient,
  type ContentReviewDraft,
} from "../services/contentReviewService";

function inputClassName() {
  return "w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-400/70";
}

function statusClass(status: string) {
  if (status === "approved" || status === "published") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (status === "changes_requested") return "border-orange-400/30 bg-orange-500/10 text-orange-200";
  return "border-white/10 bg-white/5 text-white/65";
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

export default function ContentStudioClientsPage() {
  const { clientId } = useParams();
  const auth = useAuth();
  const profile = auth.profile;
  const userId = auth.user?.id ?? null;
  const organizationId = profile?.organization_id ?? null;
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [clients, setClients] = useState<ContentClient[]>([]);
  const [client, setClient] = useState<ContentClient | null>(null);
  const [drafts, setDrafts] = useState<ContentReviewDraft[]>([]);
  const [form, setForm] = useState({ company: "", contact: "", email: "", phone: "" });
  const [draftTitle, setDraftTitle] = useState("");
  const [lastPin, setLastPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const portalUrl = useMemo(() => (client ? buildClientPortalUrl(client.portal_token) : ""), [client]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      const office = await assertCanUseContentStudio({
        organizationId,
        officeId: profile?.office_id ?? null,
        role: profile?.primary_role ?? null,
      });
      setOfficeId(office.id);
      const allClients = await listContentClients({ organizationId, officeId: office.id });
      setClients(allClients);
      if (clientId) {
        const nextClient = await getContentClient({ organizationId, officeId: office.id, clientId });
        setClient(nextClient);
        setDrafts(await listContentReviewDrafts({ organizationId, officeId: office.id, clientId }));
      } else {
        setClient(null);
        setDrafts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, [clientId, organizationId, profile?.office_id, profile?.primary_role]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleCreateClient(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !officeId) return;
    try {
      setSaving(true);
      const result = await createContentClient({
        organizationId,
        officeId,
        companyName: form.company,
        contactName: form.contact,
        email: form.email,
        phone: form.phone,
      });
      setLastPin(result.pin);
      setForm({ company: "", contact: "", email: "", phone: "" });
      setMessage("Client created. Copy the PIN now; it is only shown once.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create client.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRegeneratePin() {
    if (!client) return;
    try {
      setSaving(true);
      const result = await regenerateContentClientPin(client.id);
      setLastPin(result.pin);
      setMessage("New PIN generated. Copy it now; it is only shown once.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate PIN.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateDraft(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !officeId || !userId || !client || !draftTitle.trim()) return;
    try {
      setSaving(true);
      const draft = await createContentReviewDraft({
        organizationId,
        officeId,
        createdBy: userId,
        title: draftTitle,
        clientId: client.id,
      });
      setDraftTitle("");
      setMessage("Draft created for client.");
      await load();
      window.location.href = `/admin/content-studio/editor/${draft.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create draft.");
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setMessage(`${label} copied.`);
  }

  async function handleDeleteDraft(draft: ContentReviewDraft) {
    const confirmed = window.confirm(`Delete "${draft.title}" and its uploaded media? This removes it from the client portal.`);
    if (!confirmed) return;
    try {
      setSaving(true);
      await deleteContentReviewDraft(draft.id);
      setMessage("Draft and attached media deleted.");
      await load();
    } catch (err) {
      setError(`Failed to delete draft: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteClient() {
    if (!client) return;
    const confirmed = window.confirm(
      `Delete ${client.company_name}, all assigned drafts, and uploaded media? The client portal link will stop working.`,
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      await deleteContentClient(client.id);
      setMessage("Client, assigned drafts, and media deleted.");
      window.location.href = "/admin/content-studio/clients";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete client.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="mr-2 animate-spin" size={18} />
        Loading clients...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile?.primary_role ?? null} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">Client Review Portal</p>
              <h1 className="mt-2 text-3xl font-bold">{client ? client.company_name : "Content Clients"}</h1>
              <p className="mt-2 text-sm text-white/50">IT's No Matata client review access, PINs, and assigned drafts.</p>
            </div>
            <Link to="/admin/content-studio" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10">
              Back to studio
            </Link>
          </div>

          {error ? <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">{error}</div> : null}
          {message ? <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200">{message}</div> : null}
          {lastPin ? (
            <div className="mb-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5">
              <p className="text-sm text-orange-100">One-time client PIN</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <code className="rounded-xl bg-black px-4 py-3 text-2xl font-bold tracking-[0.35em] text-orange-300">{lastPin}</code>
                <button onClick={() => void copy(lastPin, "PIN")} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black">Copy PIN</button>
              </div>
            </div>
          ) : null}

          {!client ? (
            <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
              <form onSubmit={handleCreateClient} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Create client</h2>
                <div className="mt-4 space-y-3">
                  <input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Company name" className={inputClassName()} />
                  <input value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="Contact name" className={inputClassName()} />
                  <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="Client email" className={inputClassName()} />
                  <input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="Phone optional" className={inputClassName()} />
                </div>
                <button disabled={saving} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black disabled:opacity-60">
                  <Plus size={16} />
                  Create client and PIN
                </button>
              </form>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Clients</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {clients.map((item) => (
                    <Link key={item.id} to={`/admin/content-studio/clients/${item.id}`} className="rounded-xl border border-white/10 bg-black/30 p-4 hover:bg-white/5">
                      <p className="font-semibold">{item.company_name}</p>
                      <p className="mt-1 text-sm text-white/55">{item.contact_name} · {item.email}</p>
                    </Link>
                  ))}
                  {clients.length === 0 ? <p className="text-sm text-white/50">No content clients yet.</p> : null}
                </div>
              </section>
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Portal access</h2>
                <p className="mt-2 text-sm text-white/55">{client.contact_name} · {client.email}</p>
                <div className="mt-4 rounded-xl border border-white/10 bg-black/40 p-3 text-xs text-white/60 break-all">{portalUrl}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button onClick={() => void copy(portalUrl, "Portal link")} className="inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-200">
                    <Copy size={15} /> Copy portal link
                  </button>
                  <button onClick={() => void handleRegeneratePin()} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/70">
                    <KeyRound size={15} /> Regenerate PIN
                  </button>
                  <button onClick={() => void handleDeleteClient()} className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">
                    <Trash2 size={15} /> Delete client
                  </button>
                </div>
                <form onSubmit={handleCreateDraft} className="mt-6 border-t border-white/10 pt-5">
                  <h3 className="font-semibold">Create draft for client</h3>
                  <input value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="Draft title" className={`${inputClassName()} mt-3`} />
                  <button disabled={saving || !draftTitle.trim()} className="mt-3 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black disabled:opacity-60">
                    Create draft
                  </button>
                </form>
              </section>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Assigned drafts</h2>
                <div className="mt-4 grid gap-3">
                  {drafts.map((draft) => (
                    <div key={draft.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold">{draft.title}</p>
                          <p className="mt-1 text-sm text-white/45">{draft.scheduled_at ? new Date(draft.scheduled_at).toLocaleString() : "No schedule date"}</p>
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass(draft.status)}`}>{formatStatus(draft.status)}</span>
                      </div>
                      <Link to={`/admin/content-studio/editor/${draft.id}`} className="mt-3 inline-flex rounded-lg border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/10">
                        Open editor
                      </Link>
                      <button
                        type="button"
                        onClick={() => void handleDeleteDraft(draft)}
                        className="ml-2 mt-3 inline-flex items-center gap-1 rounded-lg border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10"
                      >
                        <Trash2 size={13} />
                        Delete
                      </button>
                    </div>
                  ))}
                  {drafts.length === 0 ? <p className="text-sm text-white/50">No drafts assigned to this client yet.</p> : null}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
