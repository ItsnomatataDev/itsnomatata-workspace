import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import ClientCard from "../components/ClientCard";
import ClientForm, { type ClientFormValues } from "../components/ClientForm";
import {
  createClient,
  getClients,
  type ClientItem,
} from "../services/clientService";
import { useNavigate } from "react-router-dom";
import { Briefcase, Building2, Globe, Plus, Search, Users } from "lucide-react";

function formatRelativeDate(value: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ClientsPage() {
  const auth = useAuth();
  const navigate = useNavigate();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");

  const loadClients = useCallback(async () => {
    if (!organizationId) return;

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
  }, [organizationId]);

  useEffect(() => {
    void loadClients();
  }, [organizationId]);

  const normalizedSearch = searchValue.trim().toLowerCase();

  const industries = useMemo(
    () =>
      Array.from(
        new Set(
          clients
            .map((client) => client.industry?.trim())
            .filter((industry): industry is string => Boolean(industry)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [clients],
  );

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesIndustry =
        industryFilter === "all" || client.industry === industryFilter;

      if (!matchesIndustry) return false;
      if (!normalizedSearch) return true;

      const haystack = [
        client.name,
        client.email,
        client.phone,
        client.website,
        client.industry,
        client.notes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });
  }, [clients, industryFilter, normalizedSearch]);

  const clientsWithEmail = useMemo(
    () => clients.filter((client) => client.email).length,
    [clients],
  );

  const clientsWithWebsite = useMemo(
    () => clients.filter((client) => client.website).length,
    [clients],
  );

  const newestClient = clients[0] ?? null;

  const handleCreateClient = async (values: ClientFormValues) => {
    try {
      setBusy(true);
      setError("");

      await createClient({
        organizationId: organizationId ?? "",
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

  if (!auth?.user || !profile || !organizationId) return null;

  return (
    <div className="min-h-screen bg-[#f5f1e8] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 bg-[radial-gradient(circle_at_top_left,rgba(251,146,60,0.18),transparent_28%),linear-gradient(180deg,#fbf7ef_0%,#f3ecdf_100%)] p-5 lg:p-8">
          <section className="overflow-hidden rounded-4xl border border-[#d7cec2] bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="border-b border-[#e7dfd4] px-6 py-6 lg:px-8">
              <div className="flex flex-wrap items-start justify-between gap-5">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-600">
                    Client workspace
                  </p>
                  <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
                    Relationship pipeline
                  </h1>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                    A cleaner CRM surface for browsing client accounts, opening
                    workspaces, and creating new records without the page
                    feeling like a generic admin screen.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-2xl border border-[#eadfcd] bg-[#fff8ef] px-4 py-3 text-sm text-slate-600">
                    <span className="block text-xs uppercase tracking-[0.24em] text-slate-500">
                      Latest client
                    </span>
                    <span className="mt-1 block font-semibold text-slate-900">
                      {newestClient?.name ?? "No clients yet"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCreateForm((prev) => !prev)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Plus size={16} />
                    {showCreateForm ? "Hide form" : "New client"}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-5 border-b border-[#e7dfd4] px-6 py-6 md:grid-cols-2 xl:grid-cols-4 lg:px-8">
              <div className="rounded-3xl border border-[#e9dfd3] bg-[#fffdf9] p-5">
                <div className="flex items-center gap-3 text-slate-500">
                  <Users size={18} className="text-amber-600" />
                  <p className="text-sm font-medium">Total clients</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">
                  {clients.length}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Accounts currently connected to your workspace.
                </p>
              </div>

              <div className="rounded-3xl border border-[#e9dfd3] bg-[#fffdf9] p-5">
                <div className="flex items-center gap-3 text-slate-500">
                  <Building2 size={18} className="text-amber-600" />
                  <p className="text-sm font-medium">Industries</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">
                  {industries.length}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Distinct client sectors represented in the CRM.
                </p>
              </div>

              <div className="rounded-3xl border border-[#e9dfd3] bg-[#fffdf9] p-5">
                <div className="flex items-center gap-3 text-slate-500">
                  <Briefcase size={18} className="text-amber-600" />
                  <p className="text-sm font-medium">With contact email</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">
                  {clientsWithEmail}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Ready for follow-up and workspace invites.
                </p>
              </div>

              <div className="rounded-3xl border border-[#e9dfd3] bg-[#fffdf9] p-5">
                <div className="flex items-center gap-3 text-slate-500">
                  <Globe size={18} className="text-amber-600" />
                  <p className="text-sm font-medium">Website coverage</p>
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">
                  {clientsWithWebsite}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Client records with a published website on file.
                </p>
              </div>
            </div>

            <div className="px-6 py-6 lg:px-8">
              {error ? (
                <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex flex-1 flex-col gap-3 md:flex-row">
                  <label className="relative min-w-0 flex-1">
                    <Search
                      size={18}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      value={searchValue}
                      onChange={(event) => setSearchValue(event.target.value)}
                      placeholder="Search by name, industry, email or notes"
                      className="w-full rounded-2xl border border-[#ddd3c6] bg-[#faf6ef] py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white"
                    />
                  </label>

                  <select
                    value={industryFilter}
                    onChange={(event) => setIndustryFilter(event.target.value)}
                    className="rounded-2xl border border-[#ddd3c6] bg-[#faf6ef] px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-500 focus:bg-white"
                  >
                    <option value="all">All industries</option>
                    {industries.map((industry) => (
                      <option key={industry} value={industry}>
                        {industry}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-[#e8dece] bg-[#fff8ef] px-4 py-3 text-sm text-slate-600">
                  Showing{" "}
                  <span className="font-semibold text-slate-950">
                    {filteredClients.length}
                  </span>{" "}
                  of{" "}
                  <span className="font-semibold text-slate-950">
                    {clients.length}
                  </span>{" "}
                  clients
                </div>
              </div>

              {showCreateForm ? (
                <section className="mb-6 rounded-[28px] border border-[#e7ddcf] bg-[#f8f4ec] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.26em] text-amber-600">
                        New account
                      </p>
                      <h2 className="mt-2 text-xl font-semibold text-slate-900">
                        Add a client profile
                      </h2>
                      <p className="mt-2 text-sm text-slate-600">
                        Capture the basics now and jump into the workspace
                        later. The form stays compact on purpose.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="rounded-2xl border border-[#ddd3c6] bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-950"
                    >
                      Close
                    </button>
                  </div>

                  <ClientForm busy={busy} onSubmit={handleCreateClient} />
                </section>
              ) : null}

              {loading ? (
                <div className="rounded-[28px] border border-dashed border-[#d9cfbf] bg-[#fbf7ef] p-8 text-sm text-slate-500">
                  Loading clients...
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="rounded-[28px] border border-dashed border-[#d9cfbf] bg-[#fbf7ef] p-8">
                  <p className="text-lg font-semibold text-slate-900">
                    No clients match this view
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    Try a broader search, switch the industry filter, or add a
                    new client record.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {filteredClients.map((client) => (
                    <ClientCard
                      key={client.id}
                      client={client}
                      metaLabel={`Added ${formatRelativeDate(client.created_at)}`}
                      onOpenDetails={(clientId) =>
                        navigate(`/clients/${clientId}`)
                      }
                      onOpenWorkspace={(clientId) =>
                        navigate(`/clients/${clientId}/workspace`)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
