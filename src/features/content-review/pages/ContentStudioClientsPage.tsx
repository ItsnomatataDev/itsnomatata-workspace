import {
  AlertCircle,
  CalendarDays,
  Copy,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  Send,
  Trash2,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { rememberAuthReturnPath } from "../../../lib/auth/returnPath";
import ContentClientMediaLibrary from "../components/ContentClientMediaLibrary";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import {
  assertCanUseContentStudio,
  buildClientPortalUrl,
  buildContentReviewDetailsIndex,
  contentReviewLinkExpiresAt,
  createContentReviewDraft,
  createContentClient,
  ensureClientMonthlySchedule,
  deleteContentClient,
  deleteContentReviewDraft,
  getContentClient,
  listContentClients,
  listContentReviewAssetsForDrafts,
  listContentReviewCommentsForDrafts,
  listContentReviewDrafts,
  loadContentStudioClientSnapshot,
  regenerateContentClientPin,
  regenerateContentReviewLink,
  refreshContentReviewLinkExpiry,
  notifyContentReviewTeam,
  runContentReviewMaintenanceIfDue,
  updateContentClientDetails,
  updateContentReviewDraft,
  type ContentReviewAsset,
  type ContentClient,
  type ContentReviewDetail,
  type ContentReviewDraft,
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
import { canApproveContentStudio } from "../../../lib/auth/contentStudioAccess";
import {
  contentStudioCopy,
  defaultScheduleTitle,
  formatScheduleMonthLabel,
  scheduleMonthKey,
} from "../utils/contentStudioTerms";
import {
  buildSchedulePostRows,
  draftScheduleMonthKey,
  formatScheduleDate,
  getScheduleBatchReadiness,
  getScheduleOverallProgress,
  isLegacyPostSlotDraft,
  listClientScheduleDrafts,
  resolveClientScheduleDraft,
  scheduleMonthStartIso,
  schedulesForMonth,
} from "../utils/contentStudioSchedule";
import type { ContentStudioEditorFocusTab } from "../utils/contentStudioEditorNav";

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
  return canApproveContentStudio(role);
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

const CONTENT_STUDIO_LAST_CLIENT_KEY = "content-studio:last-client-id";

function contentStudioClientPath(clientId: string, basePath: string) {
  return `${basePath}/${clientId}`;
}

function nextScheduleMonthKey() {
  const now = new Date();
  return scheduleMonthKey(new Date(now.getFullYear(), now.getMonth() + 1, 1));
}

export default function ContentStudioClientsPage() {
  const { clientId } = useParams();
  const isClientRoute = Boolean(clientId);
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const profile = auth.profile;
  const userId = auth.user?.id ?? null;
  const organizationId = profile?.organization_id ?? null;
  const contentStudioBasePath = location.pathname.startsWith("/content-studio")
    ? "/content-studio/clients"
    : "/admin/content-studio/clients";
  const contentStudioEditorBasePath = location.pathname.startsWith("/content-studio")
    ? "/content-studio/editor"
    : "/admin/content-studio/editor";
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
  const [bulkScheduleMonth, setBulkScheduleMonth] = useState(
    nextScheduleMonthKey(),
  );
  const [activeClientTab, setActiveClientTab] = useState<
    "overview" | "schedule" | "media" | "review-link" | "settings"
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
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(
    null,
  );
  const [newScheduleMonth, setNewScheduleMonth] = useState(
    nextScheduleMonthKey(),
  );
  const [clientDetailsForm, setClientDetailsForm] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
  });

  const portalUrl = useMemo(
    () => (client ? buildClientPortalUrl(client.portal_token) : ""),
    [client],
  );

  const load = useCallback(async () => {
    if (!organizationId) {
      if (clientId) setLoading(true);
      return;
    }
    try {
      setLoading(true);
      setError("");
      await runContentReviewMaintenanceIfDue();
      const office = await assertCanUseContentStudio({
        organizationId,
        officeId: profile?.office_id ?? null,
        role: profile?.primary_role ?? null,
        profile,
        roles: [
          profile?.primary_role,
          profile?.organization_role_key,
          auth?.currentOrganization?.role,
        ],
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

      const allDraftIds = allDrafts.map((draft) => draft.id);
      const [assets, comments] = await Promise.all([
        listContentReviewAssetsForDrafts({
          organizationId,
          officeId: office.id,
          draftIds: allDraftIds,
        }),
        listContentReviewCommentsForDrafts(allDraftIds),
      ]);
      setDetailsByDraftId(buildContentReviewDetailsIndex(allDrafts, assets, comments));

      if (clientId && userId) {
        const nextClient = await getContentClient({
          organizationId,
          officeId: office.id,
          clientId,
        });
        setClient(nextClient);
        setClientDetailsForm({
          companyName: nextClient.company_name,
          contactName: nextClient.contact_name,
          email: nextClient.email,
          phone: nextClient.phone ?? "",
        });
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
        setClientDetailsForm({
          companyName: nextClient.company_name,
          contactName: nextClient.contact_name,
          email: nextClient.email,
          phone: nextClient.phone ?? "",
        });
        setDrafts(draftMap[clientId] ?? []);
      } else {
        setClient(null);
        setClientDetailsForm({
          companyName: "",
          contactName: "",
          email: "",
          phone: "",
        });
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
    rememberAuthReturnPath();
  }, [clientId]);

  useEffect(() => {
    if (clientId) {
      sessionStorage.setItem(CONTENT_STUDIO_LAST_CLIENT_KEY, clientId);
      setActiveClientTab("schedule");
    }
  }, [clientId]);

  function openPostEditor(
    draftId: string,
    options?: {
      suggestedCaption?: string;
      displaySlot?: number;
      focusTab?: ContentStudioEditorFocusTab;
    },
  ) {
    const state =
      options?.suggestedCaption != null ||
      options?.displaySlot != null ||
      options?.focusTab != null
        ? {
            ...(options.suggestedCaption
              ? { suggestedCaption: options.suggestedCaption }
              : {}),
            ...(options.displaySlot != null
              ? { displaySlot: options.displaySlot }
              : {}),
            ...(options.focusTab ? { focusTab: options.focusTab } : {}),
          }
        : undefined;
    navigate(`${contentStudioEditorBasePath}/${draftId}`, { state });
  }

  const dashboardRows = useMemo<ClientProgress[]>(() => {
    const dashboardMonth =
      monthFilter !== "all" ? monthFilter : scheduleMonthKey();
    return clients.map((entry) => {
      const clientDraftList = allClientDrafts[entry.id] ?? [];
      const allSchedules = listClientScheduleDrafts(clientDraftList);
      const monthSchedules =
        monthFilter !== "all"
          ? schedulesForMonth(clientDraftList, dashboardMonth)
          : allSchedules;
      const scheduleDraft =
        monthSchedules[0] ??
        resolveClientScheduleDraft(clientDraftList, dashboardMonth);
      const scheduleAssets = scheduleDraft
        ? assetsForDraft(detailsByDraftId[scheduleDraft.id])
        : [];
      const scheduleComments = scheduleDraft
        ? (detailsByDraftId[scheduleDraft.id]?.comments ?? [])
        : [];
      const batch = scheduleDraft
        ? getScheduleBatchReadiness(scheduleDraft, scheduleAssets, undefined, scheduleComments)
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
          : batch.sentToClient > 0 && batch.expectedPosts > 0
            ? "Done"
            : batch.allPostsInternallyReady
              ? "Ready For Review"
              : "In Progress";

      return {
        client: entry,
        drafts:
          monthSchedules.length > 0
            ? monthSchedules
            : scheduleDraft
              ? [scheduleDraft]
              : allSchedules,
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

  const clientScheduleDrafts = useMemo(
    () => listClientScheduleDrafts(drafts),
    [drafts],
  );

  const schedulesInActiveMonth = useMemo(
    () => schedulesForMonth(drafts, activeScheduleMonth),
    [drafts, activeScheduleMonth],
  );

  useEffect(() => {
    if (!clientId) {
      setSelectedScheduleId(null);
      return;
    }
    const preferred =
      schedulesInActiveMonth[0] ??
      resolveClientScheduleDraft(drafts, activeScheduleMonth);
    if (!preferred) {
      setSelectedScheduleId(null);
      return;
    }
    setSelectedScheduleId((current) => {
      if (current && drafts.some((draft) => draft.id === current)) {
        return current;
      }
      return preferred.id;
    });
  }, [clientId, drafts, activeScheduleMonth, schedulesInActiveMonth]);

  const activeScheduleDraft = useMemo(() => {
    if (selectedScheduleId) {
      const selected = drafts.find((draft) => draft.id === selectedScheduleId);
      if (selected && !isLegacyPostSlotDraft(selected)) return selected;
    }
    return (
      schedulesInActiveMonth[0] ??
      resolveClientScheduleDraft(drafts, activeScheduleMonth)
    );
  }, [drafts, activeScheduleMonth, schedulesInActiveMonth, selectedScheduleId]);

  const schedulePostRows = useMemo(() => {
    if (!activeScheduleDraft) return [];
    return buildSchedulePostRows(
      activeScheduleDraft,
      assetsForDraft(detailsByDraftId[activeScheduleDraft.id]),
    );
  }, [activeScheduleDraft, detailsByDraftId]);

  const clientBatch = useMemo(() => {
    if (!activeScheduleDraft) return null;
    const detail = detailsByDraftId[activeScheduleDraft.id];
    return getScheduleBatchReadiness(
      activeScheduleDraft,
      assetsForDraft(detail),
      undefined,
      detail?.comments ?? [],
    );
  }, [activeScheduleDraft, detailsByDraftId]);

  const scheduleOverallProgress = useMemo(
    () => (clientBatch ? getScheduleOverallProgress(clientBatch) : 0),
    [clientBatch],
  );

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return dashboardRows.filter((row) => {
      if (query && !row.client.company_name.toLowerCase().includes(query))
        return false;
      if (statusFilter !== "all" && row.overallStatus !== statusFilter)
        return false;
      if (monthFilter !== "all") {
        const hasMonth = row.drafts.some(
          (draft) => draftScheduleMonthKey(draft) === monthFilter,
        );
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

  async function handleUpdateClientDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;

    if (
      !clientDetailsForm.companyName.trim() ||
      !clientDetailsForm.contactName.trim() ||
      !clientDetailsForm.email.trim()
    ) {
      setError("Company, contact name, and email are required.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const result = await updateContentClientDetails({
        clientId: client.id,
        companyName: clientDetailsForm.companyName,
        contactName: clientDetailsForm.contactName,
        email: clientDetailsForm.email,
        phone: clientDetailsForm.phone,
      });
      setClient(result.client);
      setClients((current) =>
        current.map((entry) =>
          entry.id === result.client.id ? result.client : entry,
        ),
      );
      setClientDetailsForm({
        companyName: result.client.company_name,
        contactName: result.client.contact_name,
        email: result.client.email,
        phone: result.client.phone ?? "",
      });
      setMessage("Client details updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update client details.",
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
      await copy(refreshed.review_url, "Internal review link");
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
    const postCount = clientBatch.expectedPosts;
    const confirmed = window.confirm(
      `Send this schedule (${postCount} post${postCount === 1 ? "" : "s"}) to ${client?.company_name} for client review? They will be able to open it in the client portal.`,
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      if (!activeScheduleDraft) return;
      let draft = await refreshContentReviewLinkExpiry(activeScheduleDraft);
      const updated = await updateContentReviewDraft(draft, {
        status: "sent_to_client",
        expires_at: contentReviewLinkExpiresAt(),
      });
      await notifyContentReviewTeam({
        draft: updated,
        title: "Schedule ready for client portal",
        message: `${updated.title} was sent to ${client?.company_name ?? "the client"}. Share the portal link (not the internal review link).`,
        dedupeKey: `content-batch-sent:${updated.id}`,
      });
      setMessage(
        `Schedule sent for client review. Share the portal link: ${portalUrl}`,
      );
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

  async function createScheduleForClient(targetClientId: string, monthKey: string) {
    if (!organizationId || !officeId || !userId) {
      throw new Error("Content Studio is still loading. Try again in a moment.");
    }
    const created = await createContentReviewDraft({
      organizationId,
      officeId,
      clientId: targetClientId,
      createdBy: userId,
      title: defaultScheduleTitle(monthKey),
    });
    return updateContentReviewDraft(created, {
      scheduled_at: scheduleMonthStartIso(monthKey),
      status: "ready_for_review",
      review_status: "ready_for_review",
    });
  }

  async function handleCreateSchedule() {
    if (!client) return;
    const monthKey = newScheduleMonth || nextScheduleMonthKey();
    try {
      setSaving(true);
      setError("");
      const schedule = await createScheduleForClient(client.id, monthKey);
      setSelectedScheduleId(schedule.id);
      setMessage(`${schedule.title} created.`);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create schedule.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSchedulesForAllClients() {
    if (!organizationId || !officeId || !userId) return;
    const monthKey = bulkScheduleMonth || nextScheduleMonthKey();
    const monthLabel = formatScheduleMonthLabel(monthKey);
    const confirmed = window.confirm(
      `Create ${monthLabel} schedules for all clients that do not already have one?`,
    );
    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      let createdCount = 0;
      let skippedCount = 0;

      for (const entry of clients) {
        const clientDrafts = allClientDrafts[entry.id] ?? [];
        const alreadyHasMonth = schedulesForMonth(clientDrafts, monthKey).length > 0;
        if (alreadyHasMonth) {
          skippedCount += 1;
          continue;
        }
        await createScheduleForClient(entry.id, monthKey);
        createdCount += 1;
      }

      setMessage(
        `${monthLabel} schedules created for ${createdCount} client${createdCount === 1 ? "" : "s"}. ${skippedCount} already had one.`,
      );
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create schedules.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSchedule(draft: ContentReviewDraft) {
    const confirmed = window.confirm(
      `Delete "${draft.title || "this schedule"}" and all media attached to it? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      setError("");
      await deleteContentReviewDraft(draft.id);
      setSelectedScheduleId(null);
      setMessage("Schedule and attached media deleted.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete schedule.",
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
      window.location.href = contentStudioBasePath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete client.");
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
      const monthKey = draftScheduleMonthKey(draft);
      const updates: Partial<ContentReviewDraft> = {
        client_id: targetClientId,
        scheduled_at: draft.scheduled_at ?? scheduleMonthStartIso(monthKey),
      };
      if (isLegacyPostSlotDraft(draft)) {
        updates.title = defaultScheduleTitle(monthKey);
      }
      if (draft.status === "draft") {
        updates.status = "ready_for_review";
      }
      await updateContentReviewDraft(draft, updates);
      setMessage(
        `Assigned "${updates.title ?? draft.title}" to ${targetClient?.company_name ?? "client"}. Open their workspace to view all schedules.`,
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
    options?: { skipConfirm?: boolean; internalRequestChanges?: boolean },
  ) {
    const readiness = getPostReadiness(
      draft,
      assetCountForDraft(detailsByDraftId[draft.id]),
      assetsForDraft(detailsByDraftId[draft.id]),
    );
    if (
      status === "approved" &&
      !readiness.internallyApproved
    ) {
      setError("Approve each post in the schedule before sending to the client.");
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
          : status === "approved"
            ? "Schedule internally approved. You can send it to the client when ready."
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
        {isClientRoute
          ? "Loading client workspace..."
          : "Loading content studio..."}
      </div>
    );
  }

  if (isClientRoute && !client) {
    return (
      <div className="flex min-h-screen flex-col bg-black text-white">
        <div className="flex flex-1 flex-col lg:flex-row">
          <Sidebar role={profile?.primary_role ?? null} />
          <main className="flex min-w-0 flex-1 flex-col items-center justify-center px-6 py-12">
            <p className="text-lg font-semibold text-white">
              Could not open this client workspace
            </p>
            <p className="mt-2 max-w-md text-center text-sm text-white/55">
              {error ||
                "The client may have been removed or you may not have access. Try again or return to all clients."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void load()}
                className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black"
              >
                Retry
              </button>
              <Link
                to={contentStudioBasePath}
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/75"
              >
                All clients
              </Link>
            </div>
          </main>
        </div>
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
                  ? "Manage this client's monthly schedule, posts, media library, and review links. Write captions and run AI in the schedule editor."
                  : `${contentStudioCopy.hierarchyLine} Assign clients, then build each schedule.`}
              </p>
            </div>
            {client ? (
              <Link
                to={contentStudioBasePath}
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

          {!isClientRoute ? (
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
                <input
                  className={`${inputClassName()} w-40`}
                  type="month"
                  value={bulkScheduleMonth}
                  onChange={(event) =>
                    setBulkScheduleMonth(event.target.value || nextScheduleMonthKey())
                  }
                  title="Bulk schedule month"
                />
                <button
                  type="button"
                  disabled={saving || clients.length === 0 || !userId}
                  onClick={() => void handleCreateSchedulesForAllClients()}
                  className="inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-bold text-orange-100 hover:bg-orange-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CalendarDays size={16} />
                  Create schedules
                </button>
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
                          to={contentStudioClientPath(row.client.id, contentStudioBasePath)}
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
                        {row.batch.actualPosts} / {CONTENT_STUDIO_POSTS_PER_SCHEDULE} max posts
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
                        {row.batch.sentToClient > 0
                          ? `Sent (${row.batch.expectedPosts || row.batch.sentToClient})`
                          : "Not sent"}
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
                          to={contentStudioClientPath(row.client.id, contentStudioBasePath)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Opens this client's workspace in a new tab. Client portal link is under Links in that workspace."
                          className="inline-flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100 hover:bg-orange-500/20"
                        >
                          Open client
                          <ExternalLink size={12} aria-hidden />
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
                          {clientBatch.actualPosts} / {CONTENT_STUDIO_POSTS_PER_SCHEDULE} max
                        </strong>{" "}
                        <span className="text-white/50">
                          Posts with media
                        </span>
                      </span>
                      <span>
                        <strong className="text-orange-200">
                          {clientBatch.internalApproved}/
                          {clientBatch.expectedPosts || "—"}
                        </strong>{" "}
                        <span className="text-white/50">
                          Internally approved
                        </span>
                      </span>
                      <span>
                        <strong className="text-white">
                          {clientBatch.sentToClient > 0
                            ? `Yes (${clientBatch.expectedPosts || clientBatch.sentToClient})`
                            : "Not yet"}
                        </strong>{" "}
                        <span className="text-white/50">Sent to client</span>
                      </span>
                      <span>
                        <strong className="text-white">
                          {clientBatch.clientReviewed}/
                          {clientBatch.expectedPosts || "—"}
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
                  <form
                    onSubmit={(event) => void handleUpdateClientDetails(event)}
                    className="mt-4 rounded-2xl border border-white/10 bg-black/30 p-4"
                  >
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-white">
                          Edit client details
                        </h3>
                        <p className="mt-1 text-xs text-white/45">
                          Update the contact name or email used for the client portal login.
                        </p>
                      </div>
                      <button
                        type="submit"
                        disabled={saving}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-60"
                      >
                        Save details
                      </button>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                          Company
                        </span>
                        <input
                          className={inputClassName()}
                          value={clientDetailsForm.companyName}
                          disabled={saving}
                          onChange={(event) =>
                            setClientDetailsForm((current) => ({
                              ...current,
                              companyName: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                          Contact name
                        </span>
                        <input
                          className={inputClassName()}
                          value={clientDetailsForm.contactName}
                          disabled={saving}
                          onChange={(event) =>
                            setClientDetailsForm((current) => ({
                              ...current,
                              contactName: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                          Email
                        </span>
                        <input
                          type="email"
                          className={inputClassName()}
                          value={clientDetailsForm.email}
                          disabled={saving}
                          onChange={(event) =>
                            setClientDetailsForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="space-y-1.5">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                          Phone optional
                        </span>
                        <input
                          className={inputClassName()}
                          value={clientDetailsForm.phone}
                          disabled={saving}
                          onChange={(event) =>
                            setClientDetailsForm((current) => ({
                              ...current,
                              phone: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </form>
                  {clientBatch ? (
                    <>
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MiniStat
                          label="Posts in schedule"
                          value={`${clientBatch.actualPosts} / ${CONTENT_STUDIO_POSTS_PER_SCHEDULE} max`}
                        />
                        <MiniStat
                          label="Internally approved"
                          value={`${clientBatch.internalApproved}/${clientBatch.expectedPosts || "—"}`}
                        />
                        <MiniStat
                          label="Sent to client"
                          value={
                            clientBatch.sentToClient > 0
                              ? "Sent"
                              : "Not sent"
                          }
                        />
                        <MiniStat
                          label="Client reviewed"
                          value={`${clientBatch.clientReviewed}/${clientBatch.expectedPosts || "—"}`}
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
                  <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 lg:flex-row lg:items-end">
                    <label className="block min-w-[260px] flex-1 space-y-1.5">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        Schedules for this client
                      </span>
                      <select
                        className={inputClassName()}
                        value={selectedScheduleId ?? activeScheduleDraft?.id ?? ""}
                        disabled={clientScheduleDrafts.length === 0}
                        onChange={(event) =>
                          setSelectedScheduleId(event.target.value)
                        }
                      >
                        {clientScheduleDrafts.length === 0 ? (
                          <option value="">No schedules yet</option>
                        ) : null}
                        {clientScheduleDrafts.map((draft) => (
                          <option key={draft.id} value={draft.id}>
                            {draft.title?.trim() ||
                              formatScheduleMonthLabel(
                                draftScheduleMonthKey(draft),
                              )}{" "}
                            · {formatScheduleMonthLabel(draftScheduleMonthKey(draft))}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-white/45">
                        {schedulesInActiveMonth.length === 0 && clientScheduleDrafts.length > 0
                          ? `No schedule dated ${formatScheduleMonthLabel(activeScheduleMonth)} - showing another month. Change the month filter above or pick a schedule.`
                          : schedulesInActiveMonth.length > 1
                            ? `${schedulesInActiveMonth.length} schedules in ${formatScheduleMonthLabel(activeScheduleMonth)}.`
                            : "Create another schedule when this client needs a separate month or campaign."}
                      </p>
                    </label>
                    <label className="block w-full space-y-1.5 sm:w-48">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        New schedule month
                      </span>
                      <input
                        type="month"
                        className={inputClassName()}
                        value={newScheduleMonth}
                        disabled={saving}
                        onChange={(event) =>
                          setNewScheduleMonth(event.target.value || nextScheduleMonthKey())
                        }
                      />
                    </label>
                    <button
                      type="button"
                      disabled={saving || !client || !userId}
                      onClick={() => void handleCreateSchedule()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus size={16} />
                      New schedule
                    </button>
                    <button
                      type="button"
                      disabled={saving || !activeScheduleDraft}
                      onClick={() =>
                        activeScheduleDraft
                          ? void handleDeleteSchedule(activeScheduleDraft)
                          : undefined
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                      Delete schedule
                    </button>
                  </div>
                  {activeScheduleDraft && clientBatch ? (
                    <>
                      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h2 className="text-xl font-semibold text-white">
                              {activeScheduleDraft.title ||
                                formatScheduleMonthLabel(activeScheduleMonth)}
                            </h2>
                            <span className="rounded-full border border-orange-500/35 bg-orange-500/15 px-3 py-1 text-sm font-bold text-orange-200">
                              {scheduleOverallProgress}% complete
                            </span>
                          </div>
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
                            {contentStudioCopy.hierarchyLine} {contentStudioCopy.editorWorkflow}
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
                          <button
                            type="button"
                            onClick={() =>
                              openPostEditor(activeScheduleDraft.id, {
                                focusTab: "write",
                              })
                            }
                            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-black hover:bg-orange-400"
                          >
                            Open schedule editor
                          </button>
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
                                return canRevokeScheduleApproval(
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
                                ) : null;
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
                                focusTab: !row.hasMedia
                                  ? "media"
                                  : !row.hasCaption
                                    ? "write"
                                    : undefined,
                              })
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                openPostEditor(activeScheduleDraft.id, {
                                  displaySlot: row.slot,
                                  focusTab: !row.hasMedia
                                    ? "media"
                                    : !row.hasCaption
                                      ? "write"
                                      : undefined,
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
                                    focusTab: !row.hasMedia
                                      ? "media"
                                      : !row.hasCaption
                                        ? "write"
                                        : undefined,
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

              {activeClientTab === "review-link" ? (
                <section className="space-y-5">
                  <div className="rounded-2xl border border-orange-500/25 bg-orange-500/5 p-5">
                    <h2 className="text-xl font-semibold">Client portal</h2>
                    <p className="mt-2 text-sm text-white/55">
                      Send this link to clients. They sign in with their email and
                      PIN, then approve or request changes on each schedule. Only
                      feedback from the portal counts as a client review.
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
                        <p className="text-white/45">
                          After you use Send to client, schedules appear in the
                          portal for review.
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

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold">Internal review only</h2>
                    <p className="mt-2 text-sm text-white/55">
                      Staff-only link while editing. Clients approve and comment in the client
                      portal after you send the schedule — do not share this URL with clients.
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
                          Copy internal review link
                        </button>
                        <a
                          href={activeScheduleDraft.review_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/75"
                        >
                          Open internal review
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            void handleRevokePostLink(activeScheduleDraft)
                          }
                          className="rounded-xl border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-200"
                        >
                          Revoke review link
                        </button>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-white/45">
                        Save the schedule to generate a preview link.
                      </p>
                    )}
                    <p className="mt-3 text-xs text-white/45">
                      Format:{" "}
                      <span className="text-orange-200/90">/internal-preview/…</span>
                    </p>
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
                    to={`${contentStudioEditorBasePath}/${previewDraft.id}`}
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
