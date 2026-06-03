import {
  AlertCircle,
  CalendarDays,
  Copy,
  KeyRound,
  Loader2,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
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
  contentReviewLinkExpiresAt,
  createContentClient,
  ensureClientMonthlySchedule,
  deleteContentClient,
  generateContentStudioCaption,
  getContentClient,
  listContentClients,
  listContentReviewAssetsForDrafts,
  listContentReviewDrafts,
  loadContentStudioClientSnapshot,
  regenerateContentClientPin,
  regenerateContentReviewLink,
  refreshContentReviewLinkExpiry,
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
  CONTENT_STUDIO_POSTS_PER_SCHEDULE,
  canRevokeScheduleApproval,
  revokeScheduleApprovalLabel,
  getClientBatchReadiness,
  getPostReadiness,
  stageBadgeClass,
  type StageLabel,
} from "../utils/contentStudioProgress";
import {
  contentStudioCopy,
  formatScheduleMonthLabel,
  scheduleMonthKey,
} from "../utils/contentStudioTerms";
import {
  buildSchedulePostRows,
  formatScheduleDate,
  getScheduleBatchReadiness,
  resolveClientScheduleDraft,
} from "../utils/contentStudioSchedule";

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
  if (status === "approved" || status === "published")
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  if (status === "changes_requested")
    return "border-orange-400/30 bg-orange-500/10 text-orange-200";
  if (status === "sent_to_client")
    return "border-cyan-400/30 bg-cyan-500/10 text-cyan-200";
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
        <div
          className="h-full rounded-full bg-orange-500"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
    </div>
  );
}

function isClientReviewedStatus(status: string) {
  return ["viewed", "approved", "changes_requested", "published"].includes(
    status,
  );
}

function canApprove(role: string | null | undefined) {
  return [
    "admin",
    "org_admin",
    "super_admin",
    "superadmin",
    "social_media",
  ].includes(role ?? "");
}

function StatusBadge({ label }: { label: StageLabel }) {
  return (
    <span
      className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stageBadgeClass(label)}`}
    >
      {label}
    </span>
  );
}

function assetCountForDraft(detail: ContentReviewDetail | undefined) {
  return (
    detail?.assets?.filter((asset) => asset.is_selected !== false).length ?? 0
  );
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
  const [allClientDrafts, setAllClientDrafts] = useState<
    Record<string, ContentReviewDraft[]>
  >({});
  const [detailsByDraftId, setDetailsByDraftId] = useState<
    Record<string, ContentReviewDetail>
  >({});
  const [form, setForm] = useState({
    company: "",
    contact: "",
    email: "",
    phone: "",
  });
  const [lastPin, setLastPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [captionSuggestions, setCaptionSuggestions] = useState<
    Record<string, string>
  >({});
  const [imageAnalysisByDraftId, setImageAnalysisByDraftId] = useState<
    Record<string, ContentStudioImageAnalysis>
  >({});
  const [selectedAiDraftId, setSelectedAiDraftId] = useState("");
  const [activeClientTab, setActiveClientTab] = useState<
    "overview" | "schedule" | "media" | "captions" | "review-link" | "settings"
  >(clientId ? "schedule" : "overview");
  const [previewDraft, setPreviewDraft] = useState<ContentReviewDraft | null>(
    null,
  );
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTheme, setPreviewTheme] = useState<"internal" | "public">(
    "internal",
  );
  const [unassignedDrafts, setUnassignedDrafts] = useState<
    ContentReviewDraft[]
  >([]);
  const [assignClientByDraftId, setAssignClientByDraftId] = useState<
    Record<string, string>
  >({});

  const portalUrl = useMemo(
    () => (client ? buildClientPortalUrl(client.portal_token) : ""),
    [client],
  );

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

      const clientIds = new Set(allClients.map((entry) => entry.id));
      const draftMap: Record<string, ContentReviewDraft[]> = {};
      const orphaned: ContentReviewDraft[] = [];
      for (const draft of allDrafts) {
        if (!draft.client_id || !clientIds.has(draft.client_id)) {
          orphaned.push(draft);
          continue;
        }
        const bucket = draftMap[draft.client_id] ?? [];
        bucket.push(draft);
        draftMap[draft.client_id] = bucket;
      }
      orphaned.sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      setUnassignedDrafts(orphaned);
      setAllClientDrafts(draftMap);
      setAssignClientByDraftId((current) => {
        const next: Record<string, string> = {};
        for (const draft of orphaned) {
          if (current[draft.id]) next[draft.id] = current[draft.id];
        }
        return next;
      });

      const assets = await listContentReviewAssetsForDrafts({
        organizationId,
        officeId: office.id,
        draftIds: allDrafts.map((draft) => draft.id),
      });
      setDetailsByDraftId(buildContentReviewDetailsIndex(allDrafts, assets));

      if (clientId && userId) {
        const nextClient = await getContentClient({
          organizationId,
          officeId: office.id,
          clientId,
        });
        setClient(nextClient);
        await ensureClientMonthlySchedule({
          organizationId,
          officeId: office.id,
          clientId,
          createdBy: userId,
          monthKey: monthFilter !== "all" ? monthFilter : scheduleMonthKey(),
        });
        const snapshot = await loadContentStudioClientSnapshot({
          organizationId,
          officeId: office.id,
          clientId,
        });
        setAllClientDrafts((current) => ({
          ...current,
          [clientId]: snapshot.clientDrafts,
        }));
        setDetailsByDraftId((current) => ({
          ...current,
          ...snapshot.detailsByDraftId,
        }));
        setDrafts(snapshot.clientDrafts);
      } else if (clientId) {
        const nextClient = await getContentClient({
          organizationId,
          officeId: office.id,
          clientId,
        });
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
  }, [
    clientId,
    monthFilter,
    organizationId,
    profile?.office_id,
    profile?.primary_role,
    userId,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (clientId) setActiveClientTab("schedule");
  }, [clientId]);

  function openPostEditor(
    draftId: string,
    options?: { suggestedCaption?: string; displaySlot?: number },
  ) {
    const state =
      options?.suggestedCaption || options?.displaySlot != null
        ? {
            ...(options.suggestedCaption
              ? { suggestedCaption: options.suggestedCaption }
              : {}),
            ...(options.displaySlot != null
              ? { displaySlot: options.displaySlot }
              : {}),
          }
        : undefined;
    navigate(`/admin/content-studio/editor/${draftId}`, { state });
  }

  const dashboardRows = useMemo<ClientProgress[]>(() => {
    return clients.map((entry) => {
      const clientDraftList = allClientDrafts[entry.id] ?? [];
      const scheduleDraft = resolveClientScheduleDraft(
        clientDraftList,
        monthFilter !== "all" ? monthFilter : scheduleMonthKey(),
      );
      const scheduleAssets = scheduleDraft
        ? assetsForDraft(detailsByDraftId[scheduleDraft.id])
        : [];
      const batch = scheduleDraft
        ? getScheduleBatchReadiness(scheduleDraft, scheduleAssets)
        : getClientBatchReadiness(
            [],
            {},
            CONTENT_STUDIO_POSTS_PER_SCHEDULE,
            {},
          );
      const overallAverage = Math.round(
        (batch.mediaProgress +
          batch.captionsProgress +
          batch.internalProgress +
          batch.sentProgress +
          batch.clientReviewProgress) /
          5,
      );
      const overallStatus: ClientProgress["overallStatus"] =
        overallAverage === 0
          ? "Not Started"
          : batch.sentToClient >= CONTENT_STUDIO_POSTS_PER_SCHEDULE
            ? "Done"
            : batch.allPostsInternallyReady
              ? "Ready For Review"
              : "In Progress";

      return {
        client: entry,
        drafts: scheduleDraft ? [scheduleDraft] : [],
        detailsByDraftId,
        batch,
        overallStatus,
      };
    });
  }, [allClientDrafts, clients, detailsByDraftId, monthFilter]);

  const activeScheduleMonth = useMemo(() => {
    if (monthFilter !== "all") return monthFilter;
    return scheduleMonthKey();
  }, [monthFilter]);

  const activeScheduleDraft = useMemo(
    () => resolveClientScheduleDraft(drafts, activeScheduleMonth),
    [drafts, activeScheduleMonth],
  );

  const schedulePostRows = useMemo(() => {
    if (!activeScheduleDraft) return [];
    return buildSchedulePostRows(
      activeScheduleDraft,
      assetsForDraft(detailsByDraftId[activeScheduleDraft.id]),
    );
  }, [activeScheduleDraft, detailsByDraftId]);

  const clientBatch = useMemo(() => {
    if (!activeScheduleDraft) return null;
    return getScheduleBatchReadiness(
      activeScheduleDraft,
      assetsForDraft(detailsByDraftId[activeScheduleDraft.id]),
    );
  }, [activeScheduleDraft, detailsByDraftId]);

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return dashboardRows.filter((row) => {
      if (query && !row.client.company_name.toLowerCase().includes(query))
        return false;
      if (statusFilter !== "all" && row.overallStatus !== statusFilter)
        return false;
      if (monthFilter !== "all") {
        const hasMonth = row.drafts.some((draft) => {
          if (!draft.scheduled_at) return false;
          return (
            new Date(draft.scheduled_at).toISOString().slice(0, 7) ===
            monthFilter
          );
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
        await ensureClientMonthlySchedule({
          organizationId,
          officeId,
          clientId: result.client.id,
          createdBy: userId,
        });
      }
      setMessage(
        "Client created with this month's schedule. Copy the PIN now; it is only shown once.",
      );
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
      setMessage(
        "New client portal PIN generated. The portal URL stays the same; copy the PIN now.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to regenerate PIN.",
      );
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
      setMessage(
        "Post preview link revoked. Copy the new link before sharing it again.",
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to revoke post preview link.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function copy(text: string, label: string) {
    await navigator.clipboard.writeText(text);
    setMessage(`${label} copied.`);
  }

  async function copySchedulePreviewLink(draft: ContentReviewDraft) {
    try {
      setSaving(true);
      const refreshed = await refreshContentReviewLinkExpiry(draft);
      if (
        refreshed.id !== draft.id ||
        refreshed.expires_at !== draft.expires_at
      ) {
        setDrafts((current) =>
          current.map((item) => (item.id === refreshed.id ? refreshed : item)),
        );
        setAllClientDrafts((current) => {
          const clientDrafts = current[draft.client_id ?? ""];
          if (!clientDrafts) return current;
          return {
            ...current,
            [draft.client_id!]: clientDrafts.map((item) =>
              item.id === refreshed.id ? refreshed : item,
            ),
          };
        });
      }
      if (!refreshed.review_url) {
        setError("No preview link on this schedule yet.");
        return;
      }
      await copy(refreshed.review_url, "Schedule preview link");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh preview link.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSendBatchToClient() {
    if (!clientBatch?.canSendBatchToClient) return;
    const confirmed = window.confirm(
      `Send this month's schedule (${CONTENT_STUDIO_POSTS_PER_SCHEDULE} posts) to ${client?.company_name} for client review?`,
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      if (!activeScheduleDraft) return;
      let draft = await refreshContentReviewLinkExpiry(activeScheduleDraft);
      await updateContentReviewDraft(draft, {
        status: "sent_to_client",
        expires_at: contentReviewLinkExpiresAt(),
      });
      setMessage("Schedule sent to client for review.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send posts to client.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleScheduleDateChange(value: string) {
    if (!activeScheduleDraft) return;
    try {
      setSaving(true);
      await updateContentReviewDraft(activeScheduleDraft, {
        scheduled_at: value ? new Date(value).toISOString() : null,
      });
      setMessage("Schedule date updated.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update schedule date.",
      );
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

  async function handleCaptionAction(
    draft: ContentReviewDraft,
    instruction: string,
  ) {
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
        platform: instruction.toLowerCase().includes("facebook")
          ? "facebook"
          : "instagram",
        tone: instruction.toLowerCase().includes("professional")
          ? "professional"
          : "engaging",
        instruction,
      });
      setCaptionSuggestions((prev) => ({
        ...prev,
        [draft.id]: result.generatedCaption,
      }));
      setMessage(
        "AI suggestion ready. Review and apply manually — nothing is auto-saved.",
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to generate caption suggestion.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAnalyzeImage(draft: ContentReviewDraft) {
    const firstImage = (detailsByDraftId[draft.id]?.assets ?? []).find(
      (asset) =>
        asset.asset_type === "image" || asset.mime_type?.startsWith("image/"),
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
      setMessage(
        "Image analysis ready. Use Apply buttons to copy into your draft, then Save.",
      );
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
    setPreviewTheme("internal");
    setPreviewOpen(true);
  }

  async function handleAssignDraft(draft: ContentReviewDraft) {
    const targetClientId = assignClientByDraftId[draft.id];
    if (!targetClientId) {
      setError("Choose a client before assigning this post.");
      return;
    }
    const targetClient = clients.find((entry) => entry.id === targetClientId);
    try {
      setSaving(true);
      setError("");
      await updateContentReviewDraft(draft, { client_id: targetClientId });
      setMessage(
        `Assigned "${draft.title}" to ${targetClient?.company_name ?? "client"}.`,
      );
      setAssignClientByDraftId((current) => {
        const next = { ...current };
        delete next[draft.id];
        return next;
      });
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to assign post to client.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateDraftStatus(
    draft: ContentReviewDraft,
    status: ContentReviewDraft["status"],
    options?: { skipConfirm?: boolean },
  ) {
    const readiness = getPostReadiness(
      draft,
      assetCountForDraft(detailsByDraftId[draft.id]),
      assetsForDraft(detailsByDraftId[draft.id]),
    );
    if (
      status === "approved" &&
      !readiness.canApproveInternally &&
      !readiness.internallyApproved
    ) {
      setError("Add media and caption before internal approval.");
      return;
    }
    if (status === "ready_for_review") {
      if (!canRevokeScheduleApproval(draft, readiness)) {
        setError("This schedule cannot be recalled or unapproved.");
        return;
      }
      if (
        !options?.skipConfirm &&
        !window.confirm(
          `Recall "${draft.title || "this schedule"}" from client review? It will return to ready for review and clear client approval markers.`,
        )
      ) {
        return;
      }
    }
    try {
      setSaving(true);
      const updates: Partial<ContentReviewDraft> = { status };
      if (status === "ready_for_review") {
        updates.approved_at = null;
        updates.approved_by_name = null;
        updates.approved_by_email = null;
      }
      await updateContentReviewDraft(draft, updates);
      setMessage(
        status === "ready_for_review"
          ? "Schedule recalled. It is ready for review again."
          : `Post marked as ${formatStatus(status)}.`,
      );
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
              <h1 className="mt-2 text-3xl font-bold">
                {client ? client.company_name : "Content Studio"}
              </h1>
              <p className="mt-2 text-sm text-white/50">
                {client
                  ? "Manage this client's monthly schedule, posts, media, captions, and review links."
                  : `${contentStudioCopy.hierarchyLine} Assign clients, then build each schedule.`}
              </p>
            </div>
            {client ? (
              <Link
                to="/admin/content-studio/clients"
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10"
              >
                All clients
              </Link>
            ) : null}
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200">
              {message}
            </div>
          ) : null}

          {lastPin ? (
            <div className="mb-4 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-5">
              <p className="text-sm text-orange-100">One-time client PIN</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <code className="rounded-xl bg-black px-4 py-3 text-2xl font-bold tracking-[0.35em] text-orange-300">
                  {lastPin}
                </code>
                <button
                  onClick={() => void copy(lastPin, "PIN")}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black"
                >
                  Copy PIN
                </button>
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
                <select
                  className={`${inputClassName()} w-44`}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
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
                  onChange={(event) =>
                    setMonthFilter(event.target.value || "all")
                  }
                  title="Filter by month"
                />
                <button
                  type="button"
                  onClick={() =>
                    document
                      .getElementById("add-client-form")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black"
                >
                  <Plus size={16} /> Add Client
                </button>
              </div>

              {unassignedDrafts.length > 0 ? (
                <section className="overflow-hidden rounded-2xl border border-amber-500/35 bg-amber-500/10">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-amber-500/25 px-4 py-4">
                    <div className="flex items-start gap-3">
                      <span className="rounded-xl border border-amber-500/30 bg-amber-500/15 p-2 text-amber-200">
                        <AlertCircle size={18} />
                      </span>
                      <div>
                        <h2 className="text-lg font-semibold text-amber-50">
                          {contentStudioCopy.unassignedHeading} (
                          {unassignedDrafts.length})
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm text-amber-100/70">
                          {contentStudioCopy.unassignedHelp}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="max-h-[320px] overflow-auto">
                    {unassignedDrafts.map((draft) => {
                      const assetCount = assetCountForDraft(
                        detailsByDraftId[draft.id],
                      );
                      const readiness = getPostReadiness(
                        draft,
                        assetCount,
                        assetsForDraft(detailsByDraftId[draft.id]),
                      );
                      return (
                        <div
                          key={draft.id}
                          className="grid gap-3 border-b border-amber-500/20 px-4 py-4 md:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(88px,0.5fr))_minmax(220px,1fr)_auto] md:items-center"
                        >
                          <div>
                            <p className="font-semibold text-white">
                              {draft.title}
                            </p>
                            <p className="mt-1 text-xs text-amber-100/60">
                              <span className="rounded-full border border-amber-400/40 bg-amber-500/20 px-2 py-0.5 font-semibold uppercase tracking-wide text-amber-100">
                                Unassigned
                              </span>
                            </p>
                          </div>
                          <div className="text-xs text-white/70">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 font-semibold capitalize ${statusClass(draft.status)}`}
                            >
                              {formatStatus(draft.status)}
                            </span>
                          </div>
                          <div className="text-xs text-white/70">
                            {assetCount} media
                          </div>
                          <div className="text-xs text-white/60">
                            {draft.updated_at
                              ? new Date(draft.updated_at).toLocaleDateString()
                              : "-"}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <select
                              className={`${inputClassName()} min-w-[180px] flex-1`}
                              value={assignClientByDraftId[draft.id] ?? ""}
                              disabled={saving || clients.length === 0}
                              onChange={(event) =>
                                setAssignClientByDraftId((current) => ({
                                  ...current,
                                  [draft.id]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Select client…</option>
                              {clients.map((entry) => (
                                <option key={entry.id} value={entry.id}>
                                  {entry.company_name}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              disabled={
                                saving ||
                                !assignClientByDraftId[draft.id] ||
                                clients.length === 0
                              }
                              onClick={() => void handleAssignDraft(draft)}
                              className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Assign
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openPostEditor(draft.id)}
                              className="rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10"
                            >
                              Open editor
                            </button>
                            <div className="flex flex-wrap gap-1 self-center">
                              <StatusBadge label={readiness.mediaLabel} />
                              <StatusBadge label={readiness.captionLabel} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {clients.length === 0 ? (
                    <p className="border-t border-amber-500/20 px-4 py-3 text-sm text-amber-100/70">
                      Create a client below before you can assign these posts.
                    </p>
                  ) : null}
                </section>
              ) : null}

              <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                <div className="grid grid-cols-[1.1fr_1fr_repeat(8,minmax(90px,1fr))] gap-2 border-b border-white/10 px-4 py-3 text-xs uppercase tracking-wide text-white/45">
                  <span>Client</span>
                  <span>Email</span>
                  <span>Schedule posts</span>
                  <span>Media</span>
                  <span>Captions</span>
                  <span>Internal Review</span>
                  <span>Sent</span>
                  <span>Client Review</span>
                  <span>Schedule date</span>
                  <span>Actions</span>
                </div>
                <div className="max-h-[460px] overflow-auto">
                  {filteredRows.map((row) => (
                    <div
                      key={row.client.id}
                      className="grid grid-cols-[1.1fr_1fr_repeat(8,minmax(90px,1fr))] gap-2 border-b border-white/10 px-4 py-4 text-sm"
                    >
                      <div>
                        <Link
                          to={`/admin/content-studio/clients/${row.client.id}`}
                          className="font-semibold text-white hover:text-orange-200"
                        >
                          {row.client.company_name}
                        </Link>
                        <p className="text-xs text-white/50">
                          {row.overallStatus}
                        </p>
                      </div>
                      <div className="min-w-0 text-xs">
                        <a
                          href={`mailto:${row.client.email}`}
                          className="block truncate text-orange-200/90 hover:text-orange-100"
                          title={row.client.email}
                        >
                          {row.client.email}
                        </a>
                        <p className="truncate text-white/45">
                          {row.client.contact_name}
                        </p>
                      </div>
                      <div className="text-xs">
                        {row.batch.actualPosts}/
                        {CONTENT_STUDIO_POSTS_PER_SCHEDULE}
                      </div>
                      <div className="text-xs font-medium text-white/80">
                        {row.batch.mediaProgress}%
                      </div>
                      <div className="text-xs font-medium text-white/80">
                        {row.batch.captionsProgress}%
                      </div>
                      <div className="text-xs font-medium text-white/80">
                        {row.batch.internalProgress}%
                      </div>
                      <div className="text-xs">
                        {row.batch.sentToClient}/
                        {CONTENT_STUDIO_POSTS_PER_SCHEDULE}
                      </div>
                      <div className="text-xs">
                        {row.batch.clientReviewProgress}%
                      </div>
                      <div className="text-xs text-white/60">
                        {row.drafts[0]
                          ? formatScheduleDate(row.drafts[0])
                          : "-"}
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
                  {filteredRows.length === 0 ? (
                    <p className="p-4 text-sm text-white/50">
                      No clients match filters.
                    </p>
                  ) : null}
                </div>
              </div>

              <form
                id="add-client-form"
                onSubmit={handleCreateClient}
                className="rounded-2xl border border-white/10 bg-white/5 p-5"
              >
                <h2 className="text-xl font-semibold">Create client</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <input
                    value={form.company}
                    onChange={(event) =>
                      setForm({ ...form, company: event.target.value })
                    }
                    placeholder="Company name"
                    className={inputClassName()}
                  />
                  <input
                    value={form.contact}
                    onChange={(event) =>
                      setForm({ ...form, contact: event.target.value })
                    }
                    placeholder="Contact name"
                    className={inputClassName()}
                  />
                  <input
                    type="email"
                    value={form.email}
                    onChange={(event) =>
                      setForm({ ...form, email: event.target.value })
                    }
                    placeholder="Client email"
                    className={inputClassName()}
                  />
                  <input
                    value={form.phone}
                    onChange={(event) =>
                      setForm({ ...form, phone: event.target.value })
                    }
                    placeholder="Phone optional"
                    className={inputClassName()}
                  />
                </div>
                <button
                  disabled={saving}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black disabled:opacity-60"
                >
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
                      <span>
                        <strong className="text-white">
                          {clientBatch.actualPosts}/
                          {CONTENT_STUDIO_POSTS_PER_SCHEDULE}
                        </strong>{" "}
                        <span className="text-white/50">Posts in schedule</span>
                      </span>
                      <span>
                        <strong className="text-orange-200">
                          {clientBatch.internalApproved}/
                          {CONTENT_STUDIO_POSTS_PER_SCHEDULE}
                        </strong>{" "}
                        <span className="text-white/50">
                          Internally approved
                        </span>
                      </span>
                      <span>
                        <strong className="text-white">
                          {clientBatch.sentToClient}/
                          {CONTENT_STUDIO_POSTS_PER_SCHEDULE}
                        </strong>{" "}
                        <span className="text-white/50">Sent to client</span>
                      </span>
                      <span>
                        <strong className="text-white">
                          {clientBatch.clientReviewed}/
                          {CONTENT_STUDIO_POSTS_PER_SCHEDULE}
                        </strong>{" "}
                        <span className="text-white/50">Client reviewed</span>
                      </span>
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
                      <button
                        type="button"
                        onClick={() =>
                          void copy(portalUrl, "Client portal link")
                        }
                        className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200"
                      >
                        Copy portal link
                      </button>
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-white/75"
                      >
                        Open portal
                      </a>
                    </div>
                  </div>
                  {!clientBatch.canSendBatchToClient ? (
                    <p className="mt-3 text-xs text-white/45">
                      {batchSendGateHint(clientBatch)}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2 border-b border-white/10">
                {[
                  ["overview", "Overview"],
                  ["schedule", "Schedule"],
                  ["media", "Media Library"],
                  ["captions", "AI & Captions"],
                  ["review-link", "Links"],
                  ["settings", "Settings"],
                ].map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() =>
                      setActiveClientTab(
                        id as
                          | "overview"
                          | "schedule"
                          | "media"
                          | "captions"
                          | "review-link"
                          | "settings",
                      )
                    }
                    className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                      activeClientTab === id
                        ? "border-orange-500 text-white"
                        : "border-transparent text-white/55 hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeClientTab === "overview" && client ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-lg font-semibold text-white">
                    Client contact
                  </h2>
                  <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        Company
                      </dt>
                      <dd className="mt-1 font-semibold text-white">
                        {client.company_name}
                      </dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        Contact
                      </dt>
                      <dd className="mt-1 text-white">{client.contact_name}</dd>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 sm:col-span-2">
                      <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        Email
                      </dt>
                      <dd className="mt-1">
                        <a
                          href={`mailto:${client.email}`}
                          className="font-medium text-orange-200 hover:text-orange-100"
                        >
                          {client.email}
                        </a>
                      </dd>
                    </div>
                    {client.phone ? (
                      <div className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 sm:col-span-2">
                        <dt className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                          Phone
                        </dt>
                        <dd className="mt-1 text-white/80">{client.phone}</dd>
                      </div>
                    ) : null}
                  </dl>
                  {clientBatch &&
                  activeScheduleDraft &&
                  canApprove(profile?.primary_role) &&
                  canRevokeScheduleApproval(
                    activeScheduleDraft,
                    getPostReadiness(
                      activeScheduleDraft,
                      clientBatch.mediaComplete,
                      assetsForDraft(detailsByDraftId[activeScheduleDraft.id]),
                    ),
                  ) ? (
                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                      <p className="text-sm text-amber-100">
                        Recall this schedule from review if it was approved or
                        sent by mistake. Status:{" "}
                        <span className="font-semibold capitalize text-amber-50">
                          {formatStatus(activeScheduleDraft.status)}
                        </span>
                      </p>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() =>
                          void updateDraftStatus(
                            activeScheduleDraft,
                            "ready_for_review",
                          )
                        }
                        className="shrink-0 rounded-xl border border-amber-500/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-50 hover:bg-amber-500/25 disabled:opacity-60"
                      >
                        {revokeScheduleApprovalLabel(activeScheduleDraft)}
                      </button>
                    </div>
                  ) : null}
                  {clientBatch ? (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MiniStat
                          label="Posts in schedule"
                          value={`${clientBatch.actualPosts}/${CONTENT_STUDIO_POSTS_PER_SCHEDULE}`}
                        />
                        <MiniStat
                          label="Internally approved"
                          value={`${clientBatch.internalApproved}/${CONTENT_STUDIO_POSTS_PER_SCHEDULE}`}
                        />
                        <MiniStat
                          label="Sent to client"
                          value={`${clientBatch.sentToClient}/${CONTENT_STUDIO_POSTS_PER_SCHEDULE}`}
                        />
                        <MiniStat
                          label="Client reviewed"
                          value={`${clientBatch.clientReviewed}/${CONTENT_STUDIO_POSTS_PER_SCHEDULE}`}
                        />
                      </div>
                      <div className="mt-5 grid gap-3 md:grid-cols-2">
                        <ProgressPill
                          label="Media"
                          value={clientBatch.mediaProgress}
                        />
                        <ProgressPill
                          label="Captions"
                          value={clientBatch.captionsProgress}
                        />
                        <ProgressPill
                          label="Internal approval"
                          value={clientBatch.internalProgress}
                        />
                        <ProgressPill
                          label="Sent to client"
                          value={clientBatch.sentProgress}
                        />
                        <ProgressPill
                          label="Client review"
                          value={clientBatch.clientReviewProgress}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="mt-4 text-sm text-white/50">
                      No schedule for this month yet.
                    </p>
                  )}
                </section>
              ) : null}

              {activeClientTab === "media" &&
              client &&
              officeId &&
              organizationId ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-xl font-semibold">Media Library</h2>
                  <p className="mt-1 text-sm text-white/55">
                    Upload client-owned media here. Social media picks assets
                    when editing posts in the editor.
                  </p>
                  <div className="mt-4">
                    <ContentClientMediaLibrary
                      client={client}
                      organizationId={organizationId}
                      officeId={officeId}
                      userId={userId}
                      syncFromPostsOnLoad
                      onUploaded={() =>
                        setMessage("Client media library updated.")
                      }
                    />
                  </div>
                </section>
              ) : null}

              {activeClientTab === "schedule" ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  {activeScheduleDraft && clientBatch ? (
                    <>
                      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <h2 className="text-xl font-semibold text-white">
                            {activeScheduleDraft.title ||
                              formatScheduleMonthLabel(activeScheduleMonth)}
                          </h2>
                          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/60">
                            <span className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                              <CalendarDays
                                size={16}
                                className="text-orange-300"
                              />
                              <span>
                                Schedule date:{" "}
                                <strong className="text-white">
                                  {formatScheduleDate(activeScheduleDraft)}
                                </strong>
                              </span>
                            </span>
                            <span className="capitalize text-white/45">
                              {formatStatus(activeScheduleDraft.status)}
                            </span>
                          </div>
                          <label className="mt-3 block max-w-xs space-y-1.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                              Change schedule date
                            </span>
                            <input
                              type="date"
                              className={inputClassName()}
                              value={
                                activeScheduleDraft.scheduled_at
                                  ? activeScheduleDraft.scheduled_at.slice(
                                      0,
                                      10,
                                    )
                                  : `${activeScheduleMonth}-01`
                              }
                              disabled={saving}
                              onChange={(event) =>
                                void handleScheduleDateChange(
                                  event.target.value,
                                )
                              }
                            />
                          </label>
                          <p className="mt-3 max-w-2xl text-xs text-white/45">
                            {contentStudioCopy.hierarchyLine}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              openPreviewModal(activeScheduleDraft)
                            }
                            className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/5"
                          >
                            Preview schedule
                          </button>
                          {activeScheduleDraft.review_url ? (
                            <button
                              type="button"
                              onClick={() =>
                                void copySchedulePreviewLink(
                                  activeScheduleDraft,
                                )
                              }
                              className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/5"
                            >
                              Copy link
                            </button>
                          ) : null}
                          <Link
                            to={`/admin/content-studio/editor/${activeScheduleDraft.id}`}
                            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-400"
                          >
                            Open schedule
                          </Link>
                          {canApprove(profile?.primary_role) ? (
                            <>
                              {(() => {
                                const scheduleReadiness = getPostReadiness(
                                  activeScheduleDraft,
                                  clientBatch.mediaComplete,
                                  assetsForDraft(
                                    detailsByDraftId[activeScheduleDraft.id],
                                  ),
                                );
                                return (
                                  <>
                                    {scheduleReadiness.canApproveInternally ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void updateDraftStatus(
                                            activeScheduleDraft,
                                            "approved",
                                          )
                                        }
                                        className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200"
                                      >
                                        Approve schedule
                                      </button>
                                    ) : null}
                                    {canRevokeScheduleApproval(
                                      activeScheduleDraft,
                                      scheduleReadiness,
                                    ) ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          void updateDraftStatus(
                                            activeScheduleDraft,
                                            "ready_for_review",
                                          )
                                        }
                                        className="rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-500/25"
                                      >
                                        {revokeScheduleApprovalLabel(
                                          activeScheduleDraft,
                                        )}
                                      </button>
                                    ) : null}
                                  </>
                                );
                              })()}
                            </>
                          ) : null}
                        </div>
                      </div>
                      <div className="overflow-hidden rounded-xl border border-white/10">
                        <div className="grid grid-cols-[1fr_80px_80px_auto] gap-2 border-b border-white/10 bg-black/30 px-4 py-3 text-[11px] uppercase tracking-wide text-white/45">
                          <span>Post (slide in schedule)</span>
                          <span>Media</span>
                          <span>Caption</span>
                          <span>Action</span>
                        </div>
                        {schedulePostRows.map((row) => (
                          <div
                            key={row.slot}
                            role="button"
                            tabIndex={0}
                            onClick={() =>
                              openPostEditor(activeScheduleDraft.id, {
                                displaySlot: row.slot,
                              })
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openPostEditor(activeScheduleDraft.id, {
                                  displaySlot: row.slot,
                                });
                              }
                            }}
                            className="grid cursor-pointer grid-cols-[1fr_80px_80px_auto] gap-2 border-b border-white/10 px-4 py-3 text-sm transition hover:bg-white/3"
                          >
                            <div>
                              <p className="font-semibold text-white">
                                {row.label}
                              </p>
                              <p className="text-[11px] text-white/40">
                                {row.assetCount > 0
                                  ? `${row.assetCount} media file${row.assetCount === 1 ? "" : "s"}`
                                  : "Empty — add in editor"}
                              </p>
                            </div>
                            <div className="flex items-center">
                              <StatusBadge
                                label={row.hasMedia ? "Ready" : "Missing"}
                              />
                            </div>
                            <div className="flex items-center">
                              <StatusBadge
                                label={row.hasCaption ? "Ready" : "Missing"}
                              />
                            </div>
                            <div className="flex items-center">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPostEditor(activeScheduleDraft.id, {
                                    displaySlot: row.slot,
                                  });
                                }}
                                className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1 text-xs font-semibold text-orange-100"
                              >
                                Edit post
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-white/50">
                      No schedule for{" "}
                      {formatScheduleMonthLabel(activeScheduleMonth)} yet.
                      Refresh the page to create it.
                    </p>
                  )}
                </section>
              ) : null}

              {activeClientTab === "captions" && activeScheduleDraft ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-xl font-semibold">AI & Captions</h2>
                  <p className="mt-1 text-xs text-white/55">
                    Suggestions for the{" "}
                    {formatScheduleMonthLabel(activeScheduleMonth)} schedule.
                    Apply in the editor, then save each post.
                  </p>
                  {(() => {
                    const draft = activeScheduleDraft;
                    return (
                      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
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
                            <button
                              key={label}
                              type="button"
                              onClick={() =>
                                void handleCaptionAction(draft, instruction)
                              }
                              className="rounded-lg border border-white/15 px-3 py-2 text-xs text-white/80 hover:bg-white/5"
                            >
                              {label}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => void handleAnalyzeImage(draft)}
                            className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100"
                          >
                            Analyze Image + Generate Caption
                          </button>
                        </div>
                        {captionSuggestions[draft.id] ? (
                          <div className="mt-3 rounded-lg border border-white/10 p-3">
                            <p className="text-[11px] uppercase tracking-wide text-white/45">
                              Suggested Caption
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-sm text-orange-100">
                              {captionSuggestions[draft.id]}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                const caption = captionSuggestions[draft.id];
                                if (!caption) return;
                                setMessage(
                                  "Opening editor with caption suggestion. Save when ready.",
                                );
                                openPostEditor(draft.id, {
                                  suggestedCaption: caption,
                                });
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
                              setMessage(
                                "Opening editor with caption suggestion. Save when ready.",
                              );
                              openPostEditor(draft.id, {
                                suggestedCaption: text,
                              });
                            }}
                            onApplyHashtags={(tags) => {
                              const suffix = tags
                                .map((t) => (t.startsWith("#") ? t : `#${t}`))
                                .join(" ");
                              const base =
                                imageAnalysisByDraftId[draft.id]
                                  ?.generatedCaption ??
                                draft.captions ??
                                "";
                              setMessage(
                                "Opening editor with hashtags. Save when ready.",
                              );
                              openPostEditor(draft.id, {
                                suggestedCaption: `${base}\n\n${suffix}`.trim(),
                              });
                            }}
                          />
                        ) : null}
                      </div>
                    );
                  })()}
                </section>
              ) : null}

              {activeClientTab === "review-link" ? (
                <section className="space-y-5">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold">
                      Schedule preview link
                    </h2>
                    <p className="mt-2 text-sm text-white/55">
                      Copy the schedule link from the Schedule tab. Clients open
                      it without a PIN and approve each post (slide) inside the
                      schedule.
                    </p>
                    {activeScheduleDraft?.review_url ? (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            void copySchedulePreviewLink(activeScheduleDraft)
                          }
                          className="rounded-xl border border-white/15 px-3 py-2 text-xs font-semibold text-white/80"
                        >
                          Copy schedule link
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void handleRevokePostLink(activeScheduleDraft)
                          }
                          className="rounded-xl border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-200"
                        >
                          Revoke link
                        </button>
                      </div>
                    ) : null}
                    <p className="mt-3 text-xs text-white/45">
                      Example format:{" "}
                      <span className="text-orange-200/90">
                        /client-review/…
                      </span>
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold">Client portal</h2>
                    <p className="mt-2 text-sm text-white/55">
                      The portal link requires the client email and PIN.
                      Regenerating the PIN invalidates the previous PIN only;
                      the portal URL stays the same.
                    </p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/40 p-3 text-xs break-all text-white/70">
                        {portalUrl}
                      </div>
                      <div className="space-y-2 text-sm text-white/70">
                        <p>
                          Review status:{" "}
                          {activeScheduleDraft &&
                          isClientReviewedStatus(activeScheduleDraft.status)
                            ? "In progress / reviewed"
                            : "Awaiting client"}
                        </p>
                        <p>
                          Schedule date:{" "}
                          {activeScheduleDraft
                            ? formatScheduleDate(activeScheduleDraft)
                            : "—"}
                        </p>
                        <p>
                          Link valid until:{" "}
                          {activeScheduleDraft?.expires_at
                            ? new Date(
                                activeScheduleDraft.expires_at,
                              ).toLocaleString()
                            : "Extended when copied or opened"}
                        </p>
                        <p className="text-white/45">
                          Preview links stay open during client review (not tied
                          to approval). They only stop after the schedule is
                          published or archived.
                        </p>
                        <p>
                          Client feedback status:{" "}
                          {clientBatch?.clientReviewed ?? 0}/
                          {CONTENT_STUDIO_POSTS_PER_SCHEDULE} reviewed
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() =>
                          void copy(portalUrl, "Client portal link")
                        }
                        className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-200"
                      >
                        Copy portal link
                      </button>
                      <a
                        href={portalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/75"
                      >
                        Open portal
                      </a>
                      <button
                        onClick={() => void handleRegeneratePin()}
                        className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/75"
                      >
                        Regenerate PIN
                      </button>
                    </div>
                  </div>
                </section>
              ) : null}

              {activeClientTab === "settings" ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-xl font-semibold">Settings</h2>
                  <p className="mt-2 text-sm text-white/55">
                    Client-level controls and permissions remain aligned to
                    existing Content Studio rules.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => void handleRegeneratePin()}
                      className="rounded-xl border border-white/10 px-3 py-2 text-sm font-semibold text-white/75"
                    >
                      Regenerate client PIN
                    </button>
                    <button
                      onClick={() => void handleDeleteClient()}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200"
                    >
                      Delete client
                    </button>
                  </div>
                </section>
              ) : null}
            </div>
          )}

          {previewOpen && previewDraft && previewDraftModel ? (
            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/75 p-4">
              <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-neutral-950">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-orange-400">
                      Read-only preview
                    </p>
                    <h3 className="font-semibold">{previewDraft.title}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5"
                      role="group"
                      aria-label="Preview mode"
                    >
                      <button
                        type="button"
                        onClick={() => setPreviewTheme("internal")}
                        className={`rounded-[10px] px-2.5 py-1.5 text-xs font-semibold ${
                          previewTheme === "internal"
                            ? "bg-orange-500 text-black"
                            : "text-white/60 hover:text-white"
                        }`}
                      >
                        Non-review
                      </button>
                      <button
                        type="button"
                        onClick={() => setPreviewTheme("public")}
                        className={`rounded-[10px] px-2.5 py-1.5 text-xs font-semibold ${
                          previewTheme === "public"
                            ? "bg-orange-500 text-black"
                            : "text-white/60 hover:text-white"
                        }`}
                      >
                        Client review
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPreviewOpen(false)}
                      className="rounded-lg border border-white/15 p-2 text-white/80"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div
                  className={`overflow-auto p-4 ${
                    previewTheme === "public"
                      ? "bg-neutral-100 text-neutral-950"
                      : "bg-neutral-950 text-white"
                  }`}
                >
                  <ContentReviewRenderer
                    draft={previewDraftModel}
                    assets={detailsByDraftId[previewDraft.id]?.assets ?? []}
                    theme={previewTheme}
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
      <p className="text-[10px] uppercase tracking-wide text-white/45">
        {label}
      </p>
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
      <p>
        <span className="text-white/50">Mood:</span> {analysis.mood}
      </p>
      <p>
        <span className="text-white/50">Scene:</span>{" "}
        {analysis.sceneDescription}
      </p>
      <p className="whitespace-pre-wrap">
        <span className="text-white/50">Suggested caption:</span>{" "}
        {analysis.generatedCaption}
      </p>
      {analysis.hashtags.length > 0 ? (
        <p>
          <span className="text-white/50">Hashtags:</span>{" "}
          {analysis.hashtags.join(" ")}
        </p>
      ) : null}
      {analysis.shortAlternative ? (
        <p className="text-xs text-white/60">
          Short: {analysis.shortAlternative}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => onApplyCaption(analysis.generatedCaption)}
          className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-black"
        >
          Apply Caption
        </button>
        {analysis.hashtags.length > 0 ? (
          <button
            type="button"
            onClick={() => onApplyHashtags(analysis.hashtags)}
            className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-white/85"
          >
            Apply Hashtags
          </button>
        ) : null}
      </div>
    </div>
  );
}
