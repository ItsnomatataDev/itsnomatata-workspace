import { Copy, KeyRound, Loader2, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import ContentClientMediaLibrary from "../components/ContentClientMediaLibrary";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import {
  analyzeContentStudioImage,
  assertCanUseContentStudio,
  buildClientPortalUrl,
  buildContentReviewDetailsIndex,
  createContentClient,
  ensureClientPostSlots,
  deleteContentClient,
  deleteContentReviewDraft,
  generateContentStudioCaption,
  getContentClient,
  listContentClients,
  listContentReviewAssetsForDrafts,
  listContentReviewDrafts,
  loadContentStudioClientSnapshot,
  regenerateContentClientPin,
  regenerateContentReviewLink,
  runContentReviewMaintenanceIfDue,
  updateContentReviewDraft,
  type ContentReviewAsset,
  type ContentClient,
  type ContentReviewDetail,
  type ContentReviewDraft,
  type ContentStudioImageAnalysis,
} from "../services/contentReviewService";
import {
  batchSendGateHint,
  CONTENT_STUDIO_POSTS_PER_CLIENT,
  getClientBatchReadiness,
  getPostReadiness,
  stageBadgeClass,
  type StageLabel,
} from "../utils/contentStudioProgress";

type ClientProgress = {
  client: ContentClient;
  drafts: ContentReviewDraft[];
  detailsByDraftId: Record<string, ContentReviewDetail>;
  batch: ReturnType<typeof getClientBatchReadiness>;
  overallStatus: "Not Started" | "In Progress" | "Ready For Review" | "Done";
};

function inputClassName() {
  return "w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-400/70";
}

function statusClass(status: string) {
  if (status === "approved" || status === "published") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (status === "changes_requested") return "border-orange-400/30 bg-orange-500/10 text-orange-200";
  if (status === "sent_to_client") return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
  return "border-white/10 bg-white/5 text-white/65";
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function ProgressPill({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-white/60">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function isClientReviewedStatus(status: string) {
  return ["viewed", "approved", "changes_requested", "published"].includes(status);
}

function canApprove(role: string | null | undefined) {
  return ["admin", "org_admin", "super_admin", "superadmin", "social_media"].includes(role ?? "");
}

function StatusBadge({ label }: { label: StageLabel }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stageBadgeClass(label)}`}>
      {label}
    </span>
  );
}

function assetCountForDraft(detail: ContentReviewDetail | undefined) {
  return detail?.assets?.filter((asset) => asset.is_selected !== false).length ?? 0;
}

function assetsForDraft(detail: ContentReviewDetail | undefined) {
  return detail?.assets?.filter((asset) => asset.is_selected !== false) ?? [];
}

export default function ContentStudioClientsPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const auth = useAuth();
  const profile = auth.profile;
  const userId = auth.user?.id ?? null;
  const organizationId = profile?.organization_id ?? null;
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [clients, setClients] = useState<ContentClient[]>([]);
  const [client, setClient] = useState<ContentClient | null>(null);
  const [drafts, setDrafts] = useState<ContentReviewDraft[]>([]);
  const [allClientDrafts, setAllClientDrafts] = useState<Record<string, ContentReviewDraft[]>>({});
  const [detailsByDraftId, setDetailsByDraftId] = useState<Record<string, ContentReviewDetail>>({});
  const [form, setForm] = useState({ company: "", contact: "", email: "", phone: "" });
  const [lastPin, setLastPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [captionSuggestions, setCaptionSuggestions] = useState<Record<string, string>>({});
  const [imageAnalysisByDraftId, setImageAnalysisByDraftId] = useState<
    Record<string, ContentStudioImageAnalysis>
  >({});
  const [selectedAiDraftId, setSelectedAiDraftId] = useState("");
  const [activeClientTab, setActiveClientTab] = useState<
    "overview" | "posts" | "media" | "captions" | "review-link" | "settings"
  >(clientId ? "posts" : "overview");
  const [previewDraft, setPreviewDraft] = useState<ContentReviewDraft | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const portalUrl = useMemo(() => (client ? buildClientPortalUrl(client.portal_token) : ""), [client]);

  const load = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      await runContentReviewMaintenanceIfDue();
      const office = await assertCanUseContentStudio({
        organizationId,
        officeId: profile?.office_id ?? null,
        role: profile?.primary_role ?? null,
      });
      setOfficeId(office.id);

      const [allClients, allDrafts] = await Promise.all([
        listContentClients({ organizationId, officeId: office.id }),
        listContentReviewDrafts(
          { organizationId, officeId: office.id },
          { skipMaintenance: true },
        ),
      ]);
      setClients(allClients);

      const draftMap: Record<string, ContentReviewDraft[]> = {};
      for (const draft of allDrafts) {
        if (!draft.client_id) continue;
        const bucket = draftMap[draft.client_id] ?? [];
        bucket.push(draft);
        draftMap[draft.client_id] = bucket;
      }
      setAllClientDrafts(draftMap);

      const assets = await listContentReviewAssetsForDrafts({
        organizationId,
        officeId: office.id,
        draftIds: allDrafts.map((draft) => draft.id),
      });
      setDetailsByDraftId(buildContentReviewDetailsIndex(allDrafts, assets));

      if (clientId && userId) {
        const nextClient = await getContentClient({ organizationId, officeId: office.id, clientId });
        setClient(nextClient);
        await ensureClientPostSlots({
          organizationId,
          officeId: office.id,
          clientId,
          createdBy: userId,
        });
        const snapshot = await loadContentStudioClientSnapshot({
          organizationId,
          officeId: office.id,
          clientId,
        });
        setAllClientDrafts((current) => ({ ...current, [clientId]: snapshot.clientDrafts }));
        setDetailsByDraftId((current) => ({ ...current, ...snapshot.detailsByDraftId }));
        setDrafts(snapshot.clientDrafts);
      } else if (clientId) {
        const nextClient = await getContentClient({ organizationId, officeId: office.id, clientId });
        setClient(nextClient);
        setDrafts(draftMap[clientId] ?? []);
      } else {
        setClient(null);
        setDrafts([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clients.");
    } finally {
      setLoading(false);
    }
  }, [clientId, organizationId, profile?.office_id, profile?.primary_role, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (clientId) setActiveClientTab("posts");
  }, [clientId]);

  function openPostEditor(draftId: string, options?: { suggestedCaption?: string }) {
    navigate(`/admin/content-studio/editor/${draftId}`, {
      state: options?.suggestedCaption ? { suggestedCaption: options.suggestedCaption } : undefined,
    });
  }

  const dashboardRows = useMemo<ClientProgress[]>(() => {
    return clients.map((entry) => {
      const clientDraftList = allClientDrafts[entry.id] ?? [];
      const assetCountByDraftId = Object.fromEntries(
        clientDraftList.map((draft) => [draft.id, assetCountForDraft(detailsByDraftId[draft.id])]),
      );
      const assetsByDraftId = Object.fromEntries(
        clientDraftList.map((draft) => [draft.id, assetsForDraft(detailsByDraftId[draft.id])]),
      );
      const batch = getClientBatchReadiness(clientDraftList, assetCountByDraftId, CONTENT_STUDIO_POSTS_PER_CLIENT, assetsByDraftId);
      const overallAverage = Math.round(
        (batch.mediaProgress + batch.captionsProgress + batch.internalProgress + batch.sentProgress + batch.clientReviewProgress) / 5,
      );
      const overallStatus: ClientProgress["overallStatus"] = overallAverage === 0
        ? "Not Started"
        : batch.sentToClient >= CONTENT_STUDIO_POSTS_PER_CLIENT
        ? "Done"
        : batch.allPostsInternallyReady
        ? "Ready For Review"
        : "In Progress";

      return {
        client: entry,
        drafts: clientDraftList,
        detailsByDraftId,
        batch,
        overallStatus,
      };
    });
  }, [allClientDrafts, clients, detailsByDraftId]);

  const clientBatch = useMemo(() => {
    if (!client) return null;
    const assetCountByDraftId = Object.fromEntries(
      drafts.map((draft) => [draft.id, assetCountForDraft(detailsByDraftId[draft.id])]),
    );
    const assetsByDraftId = Object.fromEntries(
      drafts.map((draft) => [draft.id, assetsForDraft(detailsByDraftId[draft.id])]),
    );
    return getClientBatchReadiness(drafts, assetCountByDraftId, CONTENT_STUDIO_POSTS_PER_CLIENT, assetsByDraftId);
  }, [client, drafts, detailsByDraftId]);

  const sortedClientPosts = useMemo(() => {
    return [...drafts].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()).slice(0, CONTENT_STUDIO_POSTS_PER_CLIENT);
  }, [drafts]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return dashboardRows.filter((row) => {
      if (query && !row.client.company_name.toLowerCase().includes(query)) return false;
      if (statusFilter !== "all" && row.overallStatus !== statusFilter) return false;
      if (monthFilter !== "all") {
        const hasMonth = row.drafts.some((draft) => {
          if (!draft.scheduled_at) return false;
          return new Date(draft.scheduled_at).toISOString().slice(0, 7) === monthFilter;
        });
        if (!hasMonth) return false;
      }
      return true;
    });
  }, [dashboardRows, monthFilter, searchQuery, statusFilter]);

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
      if (userId) {
        await ensureClientPostSlots({
          organizationId,
          officeId,
          clientId: result.client.id,
          createdBy: userId,
        });
      }
      setMessage("Client created with 10 post slots. Copy the PIN now; it is only shown once.");
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
      setMessage("New client portal PIN generated. The portal URL stays the same; copy the PIN now.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate PIN.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRevokePostLink(draft: ContentReviewDraft) {
    const confirmed = window.confirm(
      `Revoke the preview link for "${draft.title}"? Anyone with the current link will no longer be able to open it.`,
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      setError("");
      await regenerateContentReviewLink(draft);
      setMessage("Post preview link revoked. Copy the new link before sharing it again.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke post preview link.");
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setMessage(`${label} copied.`);
  }

  async function handleSendBatchToClient() {
    if (!clientBatch?.canSendBatchToClient) return;
    const confirmed = window.confirm(
      `Send all ${CONTENT_STUDIO_POSTS_PER_CLIENT} approved posts to ${client?.company_name} for client review?`,
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      let sent = 0;
      for (const draft of sortedClientPosts) {
        const readiness = getPostReadiness(
          draft,
          assetCountForDraft(detailsByDraftId[draft.id]),
          assetsForDraft(detailsByDraftId[draft.id]),
        );
        if (!readiness.canSendToClient) continue;
        await updateContentReviewDraft(draft, { status: "sent_to_client" });
        sent += 1;
      }
      setMessage(`${sent} post(s) sent to client for review.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send posts to client.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDraft(draft: ContentReviewDraft) {
    const confirmed = window.confirm(`Delete "${draft.title}" and its uploaded media? A replacement post slot will be created on refresh.`);
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

  async function handleCaptionAction(draft: ContentReviewDraft, instruction: string) {
    try {
      setSaving(true);
      const detail = detailsByDraftId[draft.id];
      const mediaDescription = (detail?.assets ?? [])
        .map((asset) => asset.heading || asset.file_name)
        .filter(Boolean)
        .join(", ");
      const result = await generateContentStudioCaption({
        clientName: client?.company_name ?? "Client",
        postTitle: draft.title,
        existingCaption: draft.captions ?? "",
        mediaDescription,
        platform: instruction.toLowerCase().includes("facebook") ? "facebook" : "instagram",
        tone: instruction.toLowerCase().includes("professional") ? "professional" : "engaging",
        instruction,
      });
      setCaptionSuggestions((prev) => ({ ...prev, [draft.id]: result.generatedCaption }));
      setMessage("AI suggestion ready. Review and apply manually — nothing is auto-saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate caption suggestion.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyzeImage(draft: ContentReviewDraft) {
    const firstImage = (detailsByDraftId[draft.id]?.assets ?? []).find(
      (asset) => asset.asset_type === "image" || asset.mime_type?.startsWith("image/"),
    );
    if (!firstImage?.file_url) {
      setError("Add an image to this post before running image analysis.");
      return;
    }
    try {
      setSaving(true);
      const analysis = await analyzeContentStudioImage({
        clientName: client?.company_name ?? "Client",
        postTitle: draft.title,
        existingCaption: draft.captions ?? "",
        imageUrl: firstImage.file_url,
        fileName: firstImage.file_name,
        userId: userId ?? undefined,
        organizationId: organizationId ?? undefined,
      });
      setImageAnalysisByDraftId((prev) => ({ ...prev, [draft.id]: analysis }));
      setSelectedAiDraftId(draft.id);
      setMessage("Image analysis ready. Use Apply buttons to copy into your draft, then Save.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze image.");
    } finally {
      setSaving(false);
    }
  }

  const previewDraftModel = useMemo(() => {
    if (!previewDraft) return null;
    return {
      ...previewDraft,
      captions: previewDraft.captions,
      cta_label: previewDraft.cta_label,
      cta_url: previewDraft.cta_url,
    } satisfies ContentReviewDraft;
  }, [previewDraft]);

  function openPreviewModal(draft: ContentReviewDraft) {
    setPreviewDraft(draft);
    setPreviewOpen(true);
  }

  async function updateDraftStatus(draft: ContentReviewDraft, status: ContentReviewDraft["status"]) {
    const readiness = getPostReadiness(
      draft,
      assetCountForDraft(detailsByDraftId[draft.id]),
      assetsForDraft(detailsByDraftId[draft.id]),
    );
    if (status === "approved" && !readiness.canApproveInternally && !readiness.internallyApproved) {
      setError("Add media and caption before internal approval.");
      return;
    }
    try {
      setSaving(true);
      await updateContentReviewDraft(draft, { status });
      setMessage(`Post marked as ${formatStatus(status)}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="mr-2 animate-spin" size={18} />
        Loading content studio dashboard...
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
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                {client ? "Client workspace" : "Content Studio"}
              </p>
              <h1 className="mt-2 text-3xl font-bold">{client ? client.company_name : "Content Studio"}</h1>
              <p className="mt-2 text-sm text-white/50">
                {client
                  ? "Manage posts, media, captions, approvals, and review links."
                  : "Manage client content, media, captions, approvals, and review links."}
              </p>
            </div>
            {client ? (
              <Link to="/admin/content-studio/clients" className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10">
                All clients
              </Link>
            ) : null}
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
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-3">
                <input
                  className={`${inputClassName()} min-w-[220px] flex-1`}
                  placeholder="Search client"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                <select className={`${inputClassName()} w-44`} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="all">Filter by status</option>
                  <option value="Not Started">Not Started</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Ready For Review">Ready For Review</option>
                  <option value="Done">Done</option>
                </select>
                <input
                  className={`${inputClassName()} w-40`}
                  type="month"
                  value={monthFilter === "all" ? "" : monthFilter}
                  onChange={(event) => setMonthFilter(event.target.value || "all")}
                  title="Filter by month"
                />
                <button
                  type="button"
                  onClick={() => document.getElementById("add-client-form")?.scrollIntoView({ behavior: "smooth" })}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black"
                >
                  <Plus size={16} /> Add Client
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="grid grid-cols-[1.1fr_repeat(8,minmax(90px,1fr))] gap-2 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wide text-white/45">
                  <span>Client</span>
                  <span>Posts</span>
                  <span>Media</span>
                  <span>Captions</span>
                  <span>Internal Review</span>
                  <span>Sent</span>
                  <span>Client Review</span>
                  <span>Last Updated</span>
                  <span>Actions</span>
                </div>
                <div className="max-h-[460px] overflow-auto">
                  {filteredRows.map((row) => (
                    <div key={row.client.id} className="grid grid-cols-[1.1fr_repeat(8,minmax(90px,1fr))] gap-2 border-b border-white/10 px-4 py-4 text-sm">
                      <div>
                        <Link
                          to={`/admin/content-studio/clients/${row.client.id}`}
                          className="font-semibold text-white hover:text-orange-200"
                        >
                          {row.client.company_name}
                        </Link>
                        <p className="text-xs text-white/50">{row.overallStatus}</p>
                      </div>
                      <div className="text-xs">{row.batch.actualPosts}/{CONTENT_STUDIO_POSTS_PER_CLIENT}</div>
                      <div className="text-xs font-medium text-white/80">{row.batch.mediaProgress}%</div>
                      <div className="text-xs font-medium text-white/80">{row.batch.captionsProgress}%</div>
                      <div className="text-xs font-medium text-white/80">{row.batch.internalProgress}%</div>
                      <div className="text-xs">{row.batch.sentToClient}/{CONTENT_STUDIO_POSTS_PER_CLIENT}</div>
                      <div className="text-xs">{row.batch.clientReviewProgress}%</div>
                      <div className="text-xs text-white/60">
                        {row.drafts[0]?.updated_at ? new Date(row.drafts[0].updated_at).toLocaleDateString() : "-"}
                      </div>
                      <div>
                        <Link
                          to={`/admin/content-studio/clients/${row.client.id}`}
                          className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100"
                        >
                          Open Client
                        </Link>
                      </div>
                    </div>
                  ))}
                  {filteredRows.length === 0 ? <p className="p-4 text-sm text-white/50">No clients match filters.</p> : null}
                </div>
              </div>

              <form id="add-client-form" onSubmit={handleCreateClient} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="text-xl font-semibold">Create client</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
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
            </div>
          ) : (
            <div className="space-y-6">
              {clientBatch ? (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span><strong className="text-white">{clientBatch.actualPosts}/{CONTENT_STUDIO_POSTS_PER_CLIENT}</strong> <span className="text-white/50">Posts</span></span>
                      <span><strong className="text-orange-200">{clientBatch.internalApproved}/{CONTENT_STUDIO_POSTS_PER_CLIENT}</strong> <span className="text-white/50">Internally approved</span></span>
                      <span><strong className="text-white">{clientBatch.sentToClient}/{CONTENT_STUDIO_POSTS_PER_CLIENT}</strong> <span className="text-white/50">Sent to client</span></span>
                      <span><strong className="text-white">{clientBatch.clientReviewed}/{CONTENT_STUDIO_POSTS_PER_CLIENT}</strong> <span className="text-white/50">Client reviewed</span></span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={saving || !clientBatch.canSendBatchToClient}
                        title={batchSendGateHint(clientBatch)}
                        onClick={() => void handleSendBatchToClient()}
                        className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Send size={14} />
                        Send to client
                      </button>
                      <button type="button" onClick={() => void copy(portalUrl, "Client portal link")} className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200">Copy portal link</button>
                      <a href={portalUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/75">Open portal</a>
                    </div>
                  </div>
                  {!clientBatch.canSendBatchToClient ? (
                    <p className="mt-3 text-xs text-white/45">{batchSendGateHint(clientBatch)}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 border-b border-white/10">
                {[
                  ["overview", "Overview"],
                  ["posts", "Posts"],
                  ["media", "Media Library"],
                  ["captions", "AI & Captions"],
                  ["review-link", "Links"],
                  ["settings", "Settings"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setActiveClientTab(id as "overview" | "posts" | "media" | "captions" | "review-link" | "settings")
                    }
                    className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                      activeClientTab === id ? "border-orange-500 text-white" : "border-transparent text-white/55 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeClientTab === "overview" && clientBatch ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <p className="text-sm text-white/55">{client.contact_name} · {client.email}</p>
                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <MiniStat label="Post slots" value={`${clientBatch.actualPosts}/${CONTENT_STUDIO_POSTS_PER_CLIENT}`} />
                    <MiniStat label="Internally approved" value={`${clientBatch.internalApproved}/${CONTENT_STUDIO_POSTS_PER_CLIENT}`} />
                    <MiniStat label="Sent to client" value={`${clientBatch.sentToClient}/${CONTENT_STUDIO_POSTS_PER_CLIENT}`} />
                    <MiniStat label="Client reviewed" value={`${clientBatch.clientReviewed}/${CONTENT_STUDIO_POSTS_PER_CLIENT}`} />
                  </div>
                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <ProgressPill label="Media" value={clientBatch.mediaProgress} />
                    <ProgressPill label="Captions" value={clientBatch.captionsProgress} />
                    <ProgressPill label="Internal approval" value={clientBatch.internalProgress} />
                    <ProgressPill label="Sent to client" value={clientBatch.sentProgress} />
                    <ProgressPill label="Client review" value={clientBatch.clientReviewProgress} />
                  </div>
                </section>
              ) : null}

              {activeClientTab === "media" && client && officeId && organizationId ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-xl font-semibold">Media Library</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Upload client-owned media here. Social media picks assets when editing posts in the editor.
                  </p>
                  <div className="mt-4">
                    <ContentClientMediaLibrary
                      client={client}
                      organizationId={organizationId}
                      officeId={officeId}
                      userId={userId}
                      syncFromPostsOnLoad
                      onUploaded={() => setMessage("Client media library updated.")}
                    />
                  </div>
                </section>
              ) : null}

              {activeClientTab === "posts" ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold">Posts</h2>
                      <p className="mt-1 text-xs text-white/45">{CONTENT_STUDIO_POSTS_PER_CLIENT} post slots per client. Complete media, captions, and internal approval before sending.</p>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-white/10">
                    <div className="grid grid-cols-[1.2fr_90px_90px_110px_120px_100px_1fr] gap-2 border-b border-white/10 bg-black/30 px-4 py-3 text-[11px] uppercase tracking-wide text-white/45">
                      <span>Post</span>
                      <span>Media</span>
                      <span>Captions</span>
                      <span>Internal</span>
                      <span>Client review</span>
                      <span>Updated</span>
                      <span>Actions</span>
                    </div>
                    {sortedClientPosts.map((draft, index) => {
                      const readiness = getPostReadiness(
          draft,
          assetCountForDraft(detailsByDraftId[draft.id]),
          assetsForDraft(detailsByDraftId[draft.id]),
        );
                      return (
                        <div key={draft.id} className="grid grid-cols-[1.2fr_90px_90px_110px_120px_100px_1fr] gap-2 border-b border-white/10 px-4 py-3 text-sm">
                          <div>
                            <p className="font-semibold">{draft.title || `Post ${index + 1}`}</p>
                            <p className="text-[11px] capitalize text-white/40">{formatStatus(draft.status)}</p>
                          </div>
                          <div className="flex items-center"><StatusBadge label={readiness.mediaLabel} /></div>
                          <div className="flex items-center"><StatusBadge label={readiness.captionLabel} /></div>
                          <div className="flex items-center"><StatusBadge label={readiness.internalLabel} /></div>
                          <div className="flex items-center"><StatusBadge label={readiness.clientReviewLabel} /></div>
                          <div className="flex items-center text-xs text-white/55">{new Date(draft.updated_at).toLocaleDateString()}</div>
                          <div className="flex flex-wrap items-center gap-1">
                            <button type="button" onClick={() => openPreviewModal(draft)} className="rounded-lg border border-white/20 px-2 py-1 text-xs">Preview</button>
                            {draft.review_url ? (
                              <button
                                type="button"
                                onClick={() => void copy(draft.review_url!, "Post preview link")}
                                className="rounded-lg border border-white/20 px-2 py-1 text-xs"
                              >
                                Copy link
                              </button>
                            ) : null}
                            {draft.review_url ? (
                              <button
                                type="button"
                                onClick={() => void handleRevokePostLink(draft)}
                                className="rounded-lg border border-amber-500/30 px-2 py-1 text-xs text-amber-200"
                              >
                                Revoke link
                              </button>
                            ) : null}
                            <Link to={`/admin/content-studio/editor/${draft.id}`} className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-100">Open Editor</Link>
                            {canApprove(profile?.primary_role) && readiness.canApproveInternally ? (
                              <button type="button" onClick={() => void updateDraftStatus(draft, "approved")} className="rounded-lg border border-emerald-500/30 px-2 py-1 text-xs text-emerald-200">Approve</button>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                    {sortedClientPosts.length === 0 ? <p className="p-4 text-sm text-white/50">No posts yet. They are created automatically when you open this client.</p> : null}
                  </div>
                </section>
              ) : null}

              {activeClientTab === "captions" ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-xl font-semibold">AI & Captions</h2>
                  <p className="mt-1 text-xs text-white/55">Suggestions only — apply manually, then Save. No auto-approve or auto-send.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <select className={inputClassName()} value={selectedAiDraftId} onChange={(event) => setSelectedAiDraftId(event.target.value)}>
                      <option value="">Select post</option>
                      {drafts.map((draft) => (
                        <option key={draft.id} value={draft.id}>{draft.title}</option>
                      ))}
                    </select>
                  </div>
                  {drafts.map((draft) => (
                    <div key={draft.id} className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
                      <p className="font-semibold">{draft.title}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[
                          ["Generate Caption", "Generate Caption"],
                          ["Rewrite Caption", "Rewrite Caption"],
                          ["Make Shorter", "Make Shorter"],
                          ["Make Professional", "Make More Professional"],
                          ["Instagram Version", "Create Instagram Caption"],
                          ["Facebook Version", "Create Facebook Caption"],
                          ["Generate Hashtags", "Add Hashtags"],
                        ].map(([label, instruction]) => (
                          <button key={label} type="button" onClick={() => void handleCaptionAction(draft, instruction)} className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/5">
                            {label}
                          </button>
                        ))}
                        <button type="button" onClick={() => void handleAnalyzeImage(draft)} className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100">
                          Analyze Image + Generate Caption
                        </button>
                      </div>
                      {captionSuggestions[draft.id] ? (
                        <div className="mt-3 rounded-lg border border-white/10 p-3">
                          <p className="text-[11px] uppercase tracking-wide text-white/45">Suggested Caption</p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-orange-100">{captionSuggestions[draft.id]}</p>
                          <button
                            type="button"
                            onClick={() => {
                              const caption = captionSuggestions[draft.id];
                              if (!caption) return;
                              setMessage("Opening editor with caption suggestion. Save when ready.");
                              openPostEditor(draft.id, { suggestedCaption: caption });
                            }}
                            className="mt-2 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-black"
                          >
                            Apply Caption
                          </button>
                        </div>
                      ) : null}
                      {imageAnalysisByDraftId[draft.id] ? (
                        <ImageAnalysisPanel
                          analysis={imageAnalysisByDraftId[draft.id]}
                          onApplyCaption={(text) => {
                            setMessage("Opening editor with caption suggestion. Save when ready.");
                            openPostEditor(draft.id, { suggestedCaption: text });
                          }}
                          onApplyHashtags={(tags) => {
                            const suffix = tags.map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ");
                            const base = imageAnalysisByDraftId[draft.id]?.generatedCaption ?? draft.captions ?? "";
                            setMessage("Opening editor with hashtags. Save when ready.");
                            openPostEditor(draft.id, { suggestedCaption: `${base}\n\n${suffix}`.trim() });
                          }}
                        />
                      ) : null}
                    </div>
                  ))}
                </section>
              ) : null}

              {activeClientTab === "review-link" ? (
                <section className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold">Post preview links</h2>
                    <p className="mt-2 text-sm text-white/55">
                      Share a post&apos;s direct link from the Posts tab. Clients open it without a PIN. Use Revoke link on a post to invalidate an old URL and generate a new one.
                    </p>
                    <p className="mt-3 text-xs text-white/45">
                      Example format: <span className="text-orange-200/90">/client-review/…</span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold">Client portal</h2>
                    <p className="mt-2 text-sm text-white/55">
                      The portal link requires the client email and PIN. Regenerating the PIN invalidates the previous PIN only; the portal URL stays the same.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs break-all text-white/70">{portalUrl}</div>
                      <div className="space-y-2 text-sm text-white/70">
                        <p>Review status: {drafts.some((draft) => isClientReviewedStatus(draft.status)) ? "In progress / reviewed" : "Awaiting client"}</p>
                        <p>Expiry date: {drafts[0]?.expires_at ? new Date(drafts[0].expires_at).toLocaleString() : "N/A"}</p>
                        <p>Client feedback status: {clientBatch?.clientReviewed ?? 0}/{CONTENT_STUDIO_POSTS_PER_CLIENT} reviewed</p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button onClick={() => void copy(portalUrl, "Client portal link")} className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-200">Copy portal link</button>
                      <a href={portalUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/75">Open portal</a>
                      <button onClick={() => void handleRegeneratePin()} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/75">Regenerate PIN</button>
                    </div>
                  </div>
                </section>
              ) : null}

              {activeClientTab === "settings" ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-xl font-semibold">Settings</h2>
                  <p className="mt-2 text-sm text-white/55">Client-level controls and permissions remain aligned to existing Content Studio rules.</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button onClick={() => void handleRegeneratePin()} className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/75">Regenerate client PIN</button>
                    <button onClick={() => void handleDeleteClient()} className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200">Delete client</button>
                  </div>
                </section>
              ) : null}
            </div>
          )}

          {previewOpen && previewDraft && previewDraftModel ? (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4">
              <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-orange-400">Read-only preview</p>
                    <h3 className="font-semibold">{previewDraft.title}</h3>
                  </div>
                  <button type="button" onClick={() => setPreviewOpen(false)} className="rounded-lg border border-white/15 p-2 text-white/80">
                    <X size={18} />
                  </button>
                </div>
                <div className="overflow-auto bg-neutral-100 p-4 text-neutral-950">
                  <ContentReviewRenderer
                    draft={previewDraftModel}
                    assets={detailsByDraftId[previewDraft.id]?.assets ?? []}
                    theme="public"
                    viewport="responsive"
                    unifiedPostCopy
                  />
                </div>
                <div className="flex flex-wrap gap-2 border-t border-white/10 p-4">
                  <Link
                    to={`/admin/content-studio/editor/${previewDraft.id}`}
                    onClick={() => setPreviewOpen(false)}
                    className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-100"
                  >
                    Open Editor
                  </Link>
                </div>
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-white/45">{label}</p>
      <p className="mt-1 text-lg font-bold text-orange-200">{value}</p>
    </div>
  );
}

function ImageAnalysisPanel({
  analysis,
  onApplyCaption,
  onApplyHashtags,
}: {
  analysis: ContentStudioImageAnalysis;
  onApplyCaption: (caption: string) => void;
  onApplyHashtags: (tags: string[]) => void;
}) {
  return (
    <div className="mt-3 space-y-2 rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 text-sm">
      <p><span className="text-white/50">Mood:</span> {analysis.mood}</p>
      <p><span className="text-white/50">Scene:</span> {analysis.sceneDescription}</p>
      <p className="whitespace-pre-wrap"><span className="text-white/50">Suggested caption:</span> {analysis.generatedCaption}</p>
      {analysis.hashtags.length > 0 ? (
        <p><span className="text-white/50">Hashtags:</span> {analysis.hashtags.join(" ")}</p>
      ) : null}
      {analysis.shortAlternative ? (
        <p className="text-xs text-white/60">Short: {analysis.shortAlternative}</p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button type="button" onClick={() => onApplyCaption(analysis.generatedCaption)} className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-black">
          Apply Caption
        </button>
        {analysis.hashtags.length > 0 ? (
          <button type="button" onClick={() => onApplyHashtags(analysis.hashtags)} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/85">
            Apply Hashtags
          </button>
        ) : null}
      </div>
    </div>
  );
}
