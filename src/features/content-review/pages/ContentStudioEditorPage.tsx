import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  Eye,
  Image as ImageIcon,
  Link2Off,
  Loader2,
  Save,
  Send,
  Settings2,
  Trash2,
  Type,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { supabase } from "../../../lib/supabase/client";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import ContentStudioLayoutPicker from "../components/ContentStudioLayoutPicker";
import EditorGettingStarted from "../components/EditorGettingStarted";
import EditorLibraryDrawer from "../components/EditorLibraryDrawer";
import SchedulePostFrameEditor from "../components/SchedulePostFrameEditor";
import type { PostFrameAiSuggestion } from "../components/PostFrameAiSuggestions";
import {
  requestContentStudioAnalyzeMedia,
  requestContentStudioCaption,
} from "../../../lib/api/contentStudioAi";
import {
  assertCanUseContentStudio,
  attachContentClientMediaToDraft,
  deleteContentReviewAsset,
  deleteContentReviewDraft,
  getContentClient,
  getContentReviewDetail,
  listContentClients,
  listContentClientMedia,
  resolveContentReviewImageUrlForAi,
  notifyContentReviewTeam,
  contentReviewLinkExpiresAt,
  regenerateContentReviewLink,
  refreshContentReviewLinkExpiry,
  updateContentReviewAsset,
  updateContentReviewDraft,
  uploadContentReviewAsset,
  type ContentClientMedia,
  type ContentReviewAsset,
  type ContentReviewComment,
  type ContentClient,
  type ContentReviewDetail,
  type ContentReviewDraft,
  type ContentReviewLayout,
} from "../services/contentReviewService";
import {
  assetDisplaySlot,
  assetsInDisplaySlot,
  contentReviewSlotAnchorId,
} from "../utils/assetDisplaySlots";
import {
  assetUpdatesFromOrdered,
  computeAssetReorder,
  computeMoveToSlot,
  nextSortOrderForSlot,
} from "../utils/contentStudioAssetOrdering";
import { buildSchedulePostRows, type SchedulePostRow } from "../utils/contentStudioSchedule";
import {
  parseContentStudioEditorLocationState,
  type ContentStudioEditorFocusTab,
} from "../utils/contentStudioEditorNav";
import { shouldUseUnifiedPostCopy } from "../utils/postCopyLayout";
import {
  canRevokeScheduleApproval,
  revokeScheduleApprovalLabel,
  getPostReadiness,
  sendGateHint,
} from "../utils/contentStudioProgress";
import { contentStudioCopy, postLabel } from "../utils/contentStudioTerms";

type PreviewMode = "desktop" | "mobile";
type PreviewTheme = "internal" | "public";
type EditorTab = ContentStudioEditorFocusTab;

const EDITOR_GUIDE_KEY = "content-studio-editor-guide-dismissed";

const EDITOR_TABS: Array<{
  id: EditorTab;
  label: string;
  navLabel: string;
  hint: string;
  icon: typeof ImageIcon;
}> = [
  { id: "setup", label: "Setup", navLabel: "Setup", hint: "Layout, client, publish date", icon: Settings2 },
  { id: "media", label: "Posts", navLabel: "Posts", hint: "Images for Post 1–10", icon: ImageIcon },
  { id: "write", label: "Write", navLabel: "Write", hint: "Captions, story, AI", icon: Type },
];

function inputClassName() {
  return "w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-400/70";
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function canApproveRole(role: string | null | undefined) {
  return ["admin", "org_admin", "super_admin", "superadmin", "social_media"].includes(role ?? "");
}

function draftToForm(draft: ContentReviewDraft) {
  return {
    title: draft.title,
    subtitle: draft.subtitle ?? "",
    summary: draft.summary ?? "",
    body: draft.body ?? "",
    captions: draft.captions ?? "",
    notes: draft.notes ?? "",
    layout_type: draft.layout_type,
    scheduled_at: draft.scheduled_at?.slice(0, 16) ?? "",
    cta_label: draft.cta_label ?? "",
    cta_url: draft.cta_url ?? "",
    client_id: draft.client_id ?? "",
  };
}

function formsEqual(a: ReturnType<typeof draftToForm>, b: ReturnType<typeof draftToForm>) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export default function ContentStudioEditorPage() {
  const { draftId = "" } = useParams();
  const location = useLocation();
  const auth = useAuth();
  const navigate = useNavigate();
  const profile = auth.profile;
  const userId = auth.user?.id ?? null;
  const organizationId = profile?.organization_id ?? null;
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContentReviewDetail | null>(null);
  const [clients, setClients] = useState<ContentClient[]>([]);
  const [form, setForm] = useState<ReturnType<typeof draftToForm> | null>(null);
  const [savedForm, setSavedForm] = useState<ReturnType<typeof draftToForm> | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("mobile");
  const [previewTheme, setPreviewTheme] = useState<PreviewTheme>("internal");
  const [activeDisplaySlot, setActiveDisplaySlot] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("setup");
  const [showEditorGuide, setShowEditorGuide] = useState(
    () => typeof window !== "undefined" && !window.localStorage.getItem(EDITOR_GUIDE_KEY),
  );
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const pendingNavSlotRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editorClient, setEditorClient] = useState<ContentClient | null>(null);
  const [libraryTargetSlot, setLibraryTargetSlot] = useState<number | null>(null);
  const [clientLibraryMedia, setClientLibraryMedia] = useState<ContentClientMedia[]>([]);
  const [aiLoadingSlot, setAiLoadingSlot] = useState<number | null>(null);
  const [aiBySlot, setAiBySlot] = useState<Record<number, PostFrameAiSuggestion | null>>({});

  const load = useCallback(async () => {
    if (!organizationId || !draftId) return;
    try {
      setLoading(true);
      setError("");
      const office = await assertCanUseContentStudio({
        organizationId,
        officeId: profile?.office_id ?? null,
        role: profile?.primary_role ?? null,
      });
      setOfficeId(office.id);
      const nextDetail = await getContentReviewDetail({
        organizationId,
        officeId: office.id,
        draftId,
      });
      setDetail(nextDetail);
      if (nextDetail.draft.client_id) {
        setEditorClient(
          await getContentClient({
            organizationId,
            officeId: office.id,
            clientId: nextDetail.draft.client_id,
          }),
        );
      } else {
        setEditorClient(null);
      }
      const baseForm = draftToForm(nextDetail.draft);
      const navState = parseContentStudioEditorLocationState(location.state);
      const suggestedCaption = navState.suggestedCaption?.trim();
      const nextForm = suggestedCaption ? { ...baseForm, captions: suggestedCaption } : baseForm;
      setForm(nextForm);
      setSavedForm(baseForm);
      if (navState.focusTab) {
        setActiveTab(navState.focusTab);
      }
      if (typeof navState.displaySlot === "number") {
        pendingNavSlotRef.current = navState.displaySlot;
        setActiveDisplaySlot(navState.displaySlot);
        if (!navState.focusTab) setActiveTab("media");
      } else if (nextDetail.assets.length > 0) {
        const first = [...nextDetail.assets].sort(
          (a, b) =>
            (a.display_slot ?? a.sort_order) - (b.display_slot ?? b.sort_order),
        )[0];
        if (first) {
          setActiveDisplaySlot(assetDisplaySlot(first));
          setSelectedAssetId(first.id);
        }
      }
      if (suggestedCaption) {
        setMessage("AI caption loaded. Save when ready.");
        setActiveTab("write");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load editor.");
    } finally {
      setLoading(false);
    }
  }, [draftId, location.state, organizationId, profile?.office_id, profile?.primary_role]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!editorClient || !organizationId || !officeId) {
      setClientLibraryMedia([]);
      return;
    }
    void listContentClientMedia({
      organizationId,
      officeId,
      clientId: editorClient.id,
    }).then(setClientLibraryMedia).catch(() => setClientLibraryMedia([]));
  }, [editorClient, organizationId, officeId, detail?.assets.length]);

  useEffect(() => {
    if (!organizationId || !officeId) return;
    if (activeTab !== "setup" && !libraryOpen) return;
    if (clients.length > 0) return;
    let cancelled = false;
    void listContentClients({ organizationId, officeId })
      .then((rows) => {
        if (!cancelled) setClients(rows);
      })
      .catch(() => {
        if (!cancelled) setClients([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, clients.length, libraryOpen, officeId, organizationId]);

  useEffect(() => {
    if (!organizationId || !officeId || !form?.client_id) {
      setEditorClient(null);
      return;
    }
    void getContentClient({
      organizationId,
      officeId,
      clientId: form.client_id,
    })
      .then(setEditorClient)
      .catch(() => setEditorClient(null));
  }, [form?.client_id, officeId, organizationId]);

  const refreshFeedback = useCallback(async () => {
    if (!organizationId || !officeId || !draftId) return;
    try {
      const latest = await getContentReviewDetail({
        organizationId,
        officeId,
        draftId,
      });
      setDetail((current) => {
        if (!current) return latest;
        return {
          ...current,
          draft: latest.draft,
          comments: latest.comments,
          activity: latest.activity,
        };
      });
    } catch (err) {
      console.warn("CONTENT STUDIO FEEDBACK REFRESH ERROR:", err);
    }
  }, [draftId, officeId, organizationId]);

  useEffect(() => {
    if (!draftId) return;
    const channel = supabase
      .channel(`content-review-feedback:${draftId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "content_review_comments",
          filter: `draft_id=eq.${draftId}`,
        },
        () => {
          void refreshFeedback();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [draftId, refreshFeedback]);

  const orderedAssets = useMemo(() => {
    if (!detail) return [];
    return [...detail.assets]
      .filter((asset) => asset.is_selected !== false)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [detail]);

  const draftPreview = useMemo(() => {
    if (!detail || !form) return null;
    return {
      ...detail.draft,
      ...form,
      layout_type: form.layout_type,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    } satisfies ContentReviewDraft;
  }, [detail, form]);

  const unifiedPreview = useMemo(() => {
    if (!detail) return true;
    return shouldUseUnifiedPostCopy(detail.assets);
  }, [detail]);

  const isDirty = useMemo(() => {
    if (!form || !savedForm) return false;
    return !formsEqual(form, savedForm);
  }, [form, savedForm]);

  const editorReadiness = useMemo(() => {
    if (!detail || !form) return null;
    return getPostReadiness(
      { ...detail.draft, captions: form.captions, body: form.body, summary: form.summary },
      orderedAssets.length,
      orderedAssets,
    );
  }, [detail, form, orderedAssets]);

  const clientFeedback = useMemo(() => {
    if (!detail) return [];
    return detail.comments.filter(
      (item) =>
        item.author_type === "client" ||
        item.source === "client" ||
        item.comment_type === "change_request" ||
        item.comment_type === "approval_note",
    );
  }, [detail]);

  const selectedAsset = orderedAssets.find((asset) => asset.id === selectedAssetId) ?? null;

  const scrollToDisplaySlot = useCallback((slot: number) => {
    window.setTimeout(() => {
      previewScrollRef.current
        ?.querySelector(`#${contentReviewSlotAnchorId(slot)}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 200);
  }, []);

  const schedulePostRows = useMemo(() => {
    if (!detail || !form) return [];
    return buildSchedulePostRows(
      { ...detail.draft, captions: form.captions, body: form.body, summary: form.summary },
      orderedAssets,
    );
  }, [detail, form, orderedAssets]);

  const postsWithMediaCount = useMemo(
    () => schedulePostRows.filter((row) => row.hasMedia).length,
    [schedulePostRows],
  );

  function dismissEditorGuide() {
    setShowEditorGuide(false);
    try {
      window.localStorage.setItem(EDITOR_GUIDE_KEY, "1");
    } catch {
      // ignore
    }
  }

  const focusDisplaySlot = useCallback(
    (slot: number, tab: EditorTab = "media") => {
      setActiveDisplaySlot(slot);
      const inSlot = assetsInDisplaySlot(orderedAssets, slot);
      setSelectedAssetId(inSlot[0]?.id ?? null);
      setActiveTab(tab);
      scrollToDisplaySlot(slot);
    },
    [orderedAssets, scrollToDisplaySlot],
  );

  useEffect(() => {
    if (loading || pendingNavSlotRef.current == null) return;
    const slot = pendingNavSlotRef.current;
    pendingNavSlotRef.current = null;
    focusDisplaySlot(slot);
    scrollToDisplaySlot(slot);
  }, [focusDisplaySlot, loading, orderedAssets, scrollToDisplaySlot]);

  function resolveTargetDisplaySlot() {
    if (activeDisplaySlot != null) return activeDisplaySlot;
    if (selectedAsset) return assetDisplaySlot(selectedAsset);
    return 0;
  }

  function selectFilmstripAsset(assetId: string) {
    const asset = orderedAssets.find((item) => item.id === assetId);
    setSelectedAssetId(assetId);
    if (asset) {
      const slot = assetDisplaySlot(asset);
      setActiveDisplaySlot(slot);
      scrollToDisplaySlot(slot);
    }
  }

  async function persistAssetOrder(nextAssets: ContentReviewAsset[]) {
    if (!detail) return;
    setDetail({ ...detail, assets: nextAssets });
    try {
      setSaving(true);
      await Promise.all(
        assetUpdatesFromOrdered(nextAssets).map((update) =>
          updateContentReviewAsset(update.id, {
            sort_order: update.sort_order,
            display_slot: update.display_slot,
          }),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update media order.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  function updateForm<K extends keyof NonNullable<typeof form>>(key: K, value: NonNullable<typeof form>[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function uploadToDisplaySlot(slot: number, files: FileList | null) {
    if (!files || !userId || !detail) return;
    try {
      setSaving(true);
      setActiveDisplaySlot(slot);
      let order = nextSortOrderForSlot(detail.assets, slot);
      const added: ContentReviewAsset[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadContentReviewAsset({
          draft: detail.draft,
          file,
          uploadedBy: userId,
          sortOrder: order,
          displaySlot: slot,
        });
        added.push(uploaded);
        order += 1;
      }
      setDetail({ ...detail, assets: [...detail.assets, ...added] });
      if (added[0]) {
        setSelectedAssetId(added[0].id);
      }
      setActiveTab("media");
      setMessage(
        `${added.length} file(s) added to ${postLabel(slot)}. Add text in the selected post panel on the right.`,
      );
      scrollToDisplaySlot(slot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload media.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadToPost(files: FileList | null) {
    await uploadToDisplaySlot(resolveTargetDisplaySlot(), files);
  }

  async function attachLibraryMedia(media: ContentClientMedia) {
    if (!detail || !userId) return;
    try {
      setSaving(true);
      const order = detail.assets.length;
      const targetSlot = libraryTargetSlot ?? resolveTargetDisplaySlot();
      const attached = await attachContentClientMediaToDraft({
        media,
        targetDraft: detail.draft,
        uploadedBy: userId,
        sortOrder: order,
        displaySlot: targetSlot,
      });
      setDetail({ ...detail, assets: [...detail.assets, attached] });
      setSelectedAssetId(attached.id);
      setActiveDisplaySlot(targetSlot);
      setLibraryTargetSlot(null);
      setLibraryOpen(false);
      scrollToDisplaySlot(targetSlot);
      setMessage(`Added to ${postLabel(targetSlot)}. Add caption in the post frame, then Save.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add library media.");
    } finally {
      setSaving(false);
    }
  }

  async function removePostAsset(asset: ContentReviewAsset) {
    if (!detail) return;
    const confirmed = window.confirm(`Remove "${asset.file_name}" from this post?`);
    if (!confirmed) return;
    try {
      setSaving(true);
      await deleteContentReviewAsset(asset);
      const nextAssets = detail.assets.filter((item) => item.id !== asset.id);
      setDetail({ ...detail, assets: nextAssets });
      if (selectedAssetId === asset.id) {
        setSelectedAssetId(nextAssets[0]?.id ?? null);
      }
      setMessage("Removed from post.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove media.");
    } finally {
      setSaving(false);
    }
  }

  async function reorderAssets(draggedId: string, targetId: string) {
    if (!detail) return;
    const next = computeAssetReorder(detail.assets, draggedId, targetId);
    if (!next) return;
    await persistAssetOrder(next);
    setMessage("Media order updated.");
  }

  async function moveAssetToSlot(assetId: string, slot: number) {
    if (!detail) return;
    const next = computeMoveToSlot(detail.assets, assetId, slot);
    if (!next) return;
    await persistAssetOrder(next);
    focusDisplaySlot(slot, "media");
    setMessage(`Moved to ${postLabel(slot)}.`);
  }

  async function updateSlotCopy(
    slot: number,
    field: "heading" | "caption",
    value: string,
    primaryAssetId: string | null,
  ) {
    if (!detail || !primaryAssetId) return;
    const previous = detail.assets.find((asset) => asset.id === primaryAssetId);
    if (!previous || previous[field] === value) return;
    setDetail({
      ...detail,
      assets: detail.assets.map((asset) =>
        asset.id === primaryAssetId ? { ...asset, [field]: value } : asset,
      ),
    });
    try {
      await updateContentReviewAsset(primaryAssetId, { [field]: value });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save post text.");
      await load();
    }
  }

  function openLibraryForSlot(slot: number) {
    setLibraryTargetSlot(slot);
    setActiveDisplaySlot(slot);
    setLibraryOpen(true);
  }

  async function attachLibraryMediaById(slot: number, mediaId: string) {
    const media = clientLibraryMedia.find((item) => item.id === mediaId);
    if (!media || !detail || !userId) return;
    try {
      setSaving(true);
      setActiveDisplaySlot(slot);
      const order = nextSortOrderForSlot(detail.assets, slot);
      const attached = await attachContentClientMediaToDraft({
        media,
        targetDraft: detail.draft,
        uploadedBy: userId,
        sortOrder: order,
        displaySlot: slot,
      });
      setDetail({ ...detail, assets: [...detail.assets, attached] });
      setSelectedAssetId(attached.id);
      setMessage(`Added to ${postLabel(slot)} from library.`);
      scrollToDisplaySlot(slot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add library media.");
    } finally {
      setSaving(false);
    }
  }

  function applyAiToPostCaption(slot: number, caption: string, replace = false) {
    const primary = assetsInDisplaySlot(orderedAssets, slot)[0];
    if (!primary) return;
    const next = replace
      ? caption
      : [primary.caption?.trim(), caption].filter(Boolean).join("\n\n");
    void updateSlotCopy(slot, "caption", next, primary.id);
    setMessage("Caption updated for this post. Use Save on the toolbar when ready.");
  }

  function appendAiHashtagsToPost(slot: number, tags: string[]) {
    const primary = assetsInDisplaySlot(orderedAssets, slot)[0];
    if (!primary) return;
    const suffix = tags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`)).join(" ");
    const next = [primary.caption?.trim(), suffix].filter(Boolean).join("\n\n");
    void updateSlotCopy(slot, "caption", next, primary.id);
  }

  async function runFrameAi(
    slot: number,
    instruction: string,
    options?: { tone?: string; platform?: string; analyze?: boolean },
  ) {
    if (!form || !detail) return;
    const slotAssets = assetsInDisplaySlot(orderedAssets, slot);
    const primary = slotAssets[0];
    if (!primary?.file_url) {
      setError(`Add media to ${postLabel(slot)} before using AI.`);
      return;
    }
    try {
      setAiLoadingSlot(slot);
      setError("");
      setActiveDisplaySlot(slot);
      const existingCaption = primary.caption?.trim() ?? "";

      if (options?.analyze) {
        const mediaUrl = await resolveContentReviewImageUrlForAi({
          fileUrl: primary.file_url,
          storagePath: primary.storage_path,
        });
        const isVideo =
          primary.asset_type === "video" || primary.mime_type?.startsWith("video/");
        const analysis = await requestContentStudioAnalyzeMedia({
          clientName: editorClient?.company_name ?? "Client",
          postTitle: `${form.title} — ${postLabel(slot)}`,
          mediaUrl,
          mediaType: isVideo ? "video" : "image",
          existingCaption,
          platform: options.platform,
          tone: options.tone,
          instruction,
          storagePath: primary.storage_path,
          fileName: primary.file_name,
        });
        setAiBySlot((current) => ({ ...current, [slot]: analysis }));
        setMessage(`AI analysis ready for ${postLabel(slot)}. Apply suggestions in the frame.`);
        return;
      }

      const result = await requestContentStudioCaption({
        clientName: editorClient?.company_name ?? "Client",
        postTitle: `${form.title} — ${postLabel(slot)}`,
        existingCaption,
        mediaDescription: primary.heading?.trim() || primary.file_name,
        platform: options?.platform,
        tone: options?.tone,
        instruction,
      });
      setAiBySlot((current) => ({
        ...current,
        [slot]: {
          mood: "",
          sceneDescription: "",
          suggestedCaption: result.generatedCaption,
          generatedCaption: result.generatedCaption,
          hashtags: result.hashtags,
          shortAlternative: result.shortAlternative,
          platformCaptions: {},
        },
      }));
      setMessage(`AI caption suggestion for ${postLabel(slot)}. Apply when ready, then Save.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI request failed.");
    } finally {
      setAiLoadingSlot(null);
    }
  }

  async function copyPostPreviewLink() {
    const url = detail?.draft.review_url;
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setMessage("Post preview link copied. No PIN is required for this link.");
  }

  async function revokePostPreviewLink() {
    if (!detail) return;
    const confirmed = window.confirm(
      `Revoke the preview link for "${detail.draft.title}"? Anyone with the current link will no longer be able to open it.`,
    );
    if (!confirmed) return;
    try {
      setSaving(true);
      setError("");
      const updated = await regenerateContentReviewLink(detail.draft);
      setDetail({ ...detail, draft: updated });
      setMessage("Post preview link revoked. Copy the new link before sharing it again.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke post preview link.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft(nextStatus?: ContentReviewDraft["status"]) {
    if (!detail || !draftPreview || !form || !editorReadiness) return;
    if (nextStatus === "sent_to_client" && !editorReadiness.canSendToClient) {
      setError(sendGateHint(editorReadiness));
      return;
    }
    if (nextStatus === "approved" && !editorReadiness.canApproveInternally && !editorReadiness.internallyApproved) {
      setError("Add media and social caption before internal approval.");
      return;
    }
    if (nextStatus === "ready_for_review") {
      if (!canRevokeScheduleApproval(detail.draft, editorReadiness)) {
        setError("This schedule cannot be recalled or unapproved.");
        return;
      }
      if (
        !window.confirm(
          `Recall "${form.title.trim() || "this schedule"}" from client review? It will return to ready for review.`,
        )
      ) {
        return;
      }
    }
    try {
      setSaving(true);
      let workingDraft = detail.draft;
      if (nextStatus === "sent_to_client") {
        workingDraft = await refreshContentReviewLinkExpiry(workingDraft);
      }
      const updated = await updateContentReviewDraft(workingDraft, {
        title: form.title.trim() || "Untitled review",
        subtitle: form.subtitle,
        summary: form.summary,
        body: form.body,
        captions: form.captions,
        notes: form.notes,
        layout_type: form.layout_type,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        cta_label: form.cta_label,
        cta_url: form.cta_url,
        client_id: form.client_id || null,
        ...(nextStatus === "ready_for_review"
          ? {
              status: nextStatus,
              approved_at: null,
              approved_by_name: null,
              approved_by_email: null,
            }
          : nextStatus === "sent_to_client"
            ? { status: nextStatus, expires_at: contentReviewLinkExpiresAt() }
            : nextStatus
              ? { status: nextStatus }
              : {}),
      });
      setDetail({ ...detail, draft: updated });
      const persisted = draftToForm(updated);
      setForm(persisted);
      setSavedForm(persisted);
      setMessage(
        nextStatus === "sent_to_client"
          ? "Saved and sent for client review."
          : nextStatus === "approved"
            ? "Post internally approved."
            : nextStatus === "ready_for_review"
              ? "Schedule recalled. Ready for review again."
              : "All changes saved.",
      );
      if (nextStatus === "sent_to_client") {
        await notifyContentReviewTeam({
          draft: updated,
          title: "Content review ready",
          message: `${updated.title} is ready for client review.`,
          dedupeKey: `content-editor-ready:${updated.id}:${nextStatus}`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDraft() {
    if (!detail) return;
    const confirmed = window.confirm(`Delete "${detail.draft.title}" and its media?`);
    if (!confirmed) return;
    try {
      setSaving(true);
      await deleteContentReviewDraft(detail.draft.id);
      navigate(
        detail.draft.client_id
          ? `/admin/content-studio/clients/${detail.draft.client_id}`
          : "/admin/content-studio/clients",
      );
    } catch (err) {
      setError(`Failed to delete draft: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="mr-2 animate-spin" size={18} />
        Loading studio...
      </div>
    );
  }

  if (error && !officeId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
        <div className="max-w-lg rounded-2xl border border-orange-500/20 bg-orange-500/10 p-6 text-orange-100">
          {error}
        </div>
      </div>
    );
  }

  if (!detail || !form || !draftPreview || !officeId || !organizationId) return null;

  const clientDashboardPath = detail.draft.client_id
    ? `/admin/content-studio/clients/${detail.draft.client_id}`
    : "/admin/content-studio/clients";

  return (
    <main className="flex h-screen flex-col overflow-hidden bg-neutral-950 text-white">
      <header className="z-30 shrink-0 border-b border-white/10 bg-black/95 px-3 py-2.5 backdrop-blur sm:px-5">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(clientDashboardPath)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
            aria-label="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] text-white/45">
              {editorClient ? editorClient.company_name : "Content Studio"}
              <span className="mx-1.5 text-white/25">/</span>
              {contentStudioCopy.scheduleSingular} editor
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <input
                value={form.title}
                onChange={(event) => updateForm("title", event.target.value)}
                className="min-w-0 flex-1 truncate bg-transparent text-base font-semibold text-white outline-none placeholder:text-white/30 focus:border-b focus:border-orange-500/50"
                placeholder={contentStudioCopy.clientReviewHeadlinePlaceholder}
              />
              {activeDisplaySlot != null ? (
                <span className="shrink-0 rounded-full bg-orange-500/15 px-2.5 py-0.5 text-[11px] font-bold text-orange-200">
                  {postLabel(activeDisplaySlot)}
                </span>
              ) : null}
            </div>
          </div>
          <div className="hidden items-center gap-3 text-[11px] font-medium text-white/50 sm:flex">
            <span className={editorReadiness?.hasMedia ? "text-orange-300" : ""}>
              {editorReadiness?.hasMedia ? "●" : "○"} Media
            </span>
            <span className={editorReadiness?.hasCaption ? "text-orange-300" : ""}>
              {editorReadiness?.hasCaption ? "●" : "○"} Caption
            </span>
            <span className={editorReadiness?.internallyApproved ? "text-emerald-300" : ""}>
              {editorReadiness?.internallyApproved ? "●" : "○"} Internal
            </span>
          </div>
          <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-bold capitalize text-black">
            {formatStatus(draftPreview.status)}
          </span>
          <span className={`text-xs ${isDirty ? "text-amber-300" : "text-white/40"}`}>
            {saving ? "Saving…" : isDirty ? "Unsaved" : "Saved"}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {detail.draft.review_url ? (
              <>
                <button
                  type="button"
                  onClick={() => void copyPostPreviewLink()}
                  title="Direct post link — no PIN required"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-semibold hover:bg-white/10"
                >
                  <Copy size={14} />
                  Copy preview link
                </button>
                <button
                  type="button"
                  onClick={() => void revokePostPreviewLink()}
                  disabled={saving}
                  title="Invalidate the current preview URL and generate a new one"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/15 disabled:opacity-60"
                >
                  <Link2Off size={14} />
                  Revoke link
                </button>
              </>
            ) : null}
            <div
              className="inline-flex rounded-xl border border-white/10 bg-white/5 p-0.5"
              role="group"
              aria-label="Preview mode"
            >
              <button
                type="button"
                onClick={() => setPreviewTheme("internal")}
                title="Studio editing view — not what the client sees"
                className={`rounded-[10px] px-2.5 py-1.5 text-xs font-semibold transition ${
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
                title="Preview the public client review page"
                className={`rounded-[10px] px-2.5 py-1.5 text-xs font-semibold transition ${
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
              onClick={() => setPreviewMode(previewMode === "mobile" ? "desktop" : "mobile")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-semibold hover:bg-white/10"
            >
              <Eye size={14} />
              {previewMode === "mobile" ? "Mobile" : "Desktop"}
            </button>
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-xs font-semibold hover:bg-white/10 disabled:opacity-60"
            >
              <Save size={14} />
              Save
            </button>
            {canApproveRole(profile?.primary_role) && editorReadiness?.canApproveInternally ? (
              <button
                type="button"
                onClick={() => void saveDraft("approved")}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 disabled:opacity-60"
              >
                <CheckCircle2 size={14} />
                Approve
              </button>
            ) : null}
            {canApproveRole(profile?.primary_role) &&
            detail &&
            editorReadiness &&
            canRevokeScheduleApproval(detail.draft, editorReadiness) ? (
              <button
                type="button"
                onClick={() => void saveDraft("ready_for_review")}
                disabled={saving}
                title="Recall schedule from client review or undo internal approval"
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-2.5 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-500/25 disabled:opacity-60"
              >
                {revokeScheduleApprovalLabel(detail.draft)}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => void saveDraft("sent_to_client")}
              disabled={saving || !editorReadiness?.canSendToClient}
              title={editorReadiness ? sendGateHint(editorReadiness) : "Loading…"}
              className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send size={14} />
              Send for review
            </button>
          </div>
        </div>
        {(message || error) && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message ? (
              <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-200">
                {error}
              </p>
            ) : null}
          </div>
        )}
      </header>

      {showEditorGuide ? (
        <EditorGettingStarted
          activeTab={activeTab}
          postsWithMedia={postsWithMediaCount}
          hasCaption={Boolean(form.captions?.trim() || form.body?.trim())}
          onSelectTab={setActiveTab}
          onDismiss={dismissEditorGuide}
        />
      ) : null}

      <div className="flex min-h-0 flex-1">
        <nav
          className="flex w-[88px] shrink-0 flex-col gap-1 border-r border-white/10 bg-black px-1.5 py-3 sm:w-[96px]"
          aria-label="Editor sections"
        >
          {EDITOR_TABS.map((tab, index) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const badge =
              tab.id === "setup" && clientFeedback.length > 0 ? clientFeedback.length : null;
            return (
              <button
                key={tab.id}
                type="button"
                title={tab.hint}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-semibold transition ${
                  active
                    ? "bg-orange-500/15 text-orange-200"
                    : "text-white/45 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <span
                  className={`text-[9px] font-bold ${active ? "text-orange-300" : "text-white/30"}`}
                >
                  {index + 1}
                </span>
                <Icon size={18} />
                {tab.navLabel}
                {badge ? (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-black">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <section
            className={`relative flex min-h-0 flex-1 flex-col ${
              previewTheme === "public" ? "bg-neutral-200/95" : "bg-neutral-950"
            }`}
          >
            {previewTheme === "internal" ? (
              <p className="shrink-0 border-b border-white/10 bg-black/40 px-4 py-2 text-center text-[11px] text-white/50">
                <strong className="text-white/70">Frame editor</strong> — what you edit here matches the client
                review layout. Toggle{" "}
                <span className="text-orange-200/90">Client review</span> in the toolbar for a read-only preview.
              </p>
            ) : (
              <p className="shrink-0 border-b border-neutral-300 bg-white px-4 py-2 text-center text-[11px] text-neutral-600">
                Read-only client review preview — switch to <strong>Non-review</strong> to edit posts.
              </p>
            )}
            <div ref={previewScrollRef} className="flex-1 overflow-auto p-4 sm:p-6">
              {previewTheme === "public" && detail && form ? (
                <div
                  className={`mx-auto transition-all ${
                    previewMode === "mobile"
                      ? "max-w-[390px] rounded-4xl border-10 border-neutral-800 bg-neutral-100 shadow-2xl"
                      : "max-w-4xl rounded-2xl border border-neutral-300/80 bg-white shadow-xl"
                  }`}
                >
                  <div
                    className={
                      previewMode === "mobile"
                        ? "overflow-hidden rounded-[1.4rem]"
                        : "overflow-hidden rounded-xl"
                    }
                  >
                    <ContentReviewRenderer
                      draft={draftPreview}
                      assets={detail.assets as ContentReviewAsset[]}
                      theme="public"
                      viewport={previewMode === "mobile" ? "mobile" : "responsive"}
                      unifiedPostCopy={unifiedPreview}
                      highlightDisplaySlot={activeDisplaySlot}
                    />
                  </div>
                </div>
              ) : detail && form ? (
                <div className="space-y-6">
                  {activeTab === "setup" ? (
                    <div className="mx-auto max-w-5xl rounded-xl border border-orange-500/25 bg-orange-500/5 px-4 py-3 text-center text-xs text-white/55">
                      Layout, client, and publish date are in the <strong className="text-orange-200">Setup</strong>{" "}
                      panel on the right. Posts below use that layout on the client link.
                    </div>
                  ) : null}
                  {activeTab === "write" ? (
                    <section className="mx-auto max-w-5xl space-y-3 rounded-2xl border border-white/10 bg-black/50 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">
                        Whole schedule copy
                      </p>
                      <TextArea
                        label="Story text"
                        value={form.body}
                        onChange={(value) => updateForm("body", value)}
                        rows={4}
                        hint="Shown after images on the client review link (when layout uses shared story)."
                      />
                      <TextArea
                        label="Social caption (schedule-wide)"
                        value={form.captions}
                        onChange={(value) => updateForm("captions", value)}
                        rows={3}
                        hint="Used when a post has no per-post caption. Per-post captions are in each frame below."
                      />
                    </section>
                  ) : null}
                  <SchedulePostFrameEditor
                    rows={schedulePostRows}
                    draft={detail.draft}
                    activeSlot={activeDisplaySlot}
                    saving={saving}
                    canUseLibrary={Boolean(editorClient)}
                    aiLoadingSlot={aiLoadingSlot}
                    aiBySlot={aiBySlot}
                    onSelectSlot={(slot) => {
                      setActiveDisplaySlot(slot);
                      scrollToDisplaySlot(slot);
                    }}
                    onUploadToSlot={(slot, files) => void uploadToDisplaySlot(slot, files)}
                    onOpenLibrary={(slot) => openLibraryForSlot(slot)}
                    onAttachLibraryById={(slot, mediaId) => void attachLibraryMediaById(slot, mediaId)}
                    onRemoveAsset={(asset) => void removePostAsset(asset)}
                    onUpdateSlotCopy={(slot, field, value, assetId) =>
                      void updateSlotCopy(slot, field, value, assetId)
                    }
                    onAiAction={(slot, instruction, options) =>
                      void runFrameAi(slot, instruction, options)
                    }
                    onDismissAi={(slot) =>
                      setAiBySlot((current) => ({ ...current, [slot]: null }))
                    }
                    onApplyAiCaption={(slot, caption) => applyAiToPostCaption(slot, caption, false)}
                    onApplyAiHashtags={(slot, tags) => appendAiHashtagsToPost(slot, tags)}
                    onReplaceAiCaption={(slot, caption) => applyAiToPostCaption(slot, caption, true)}
                  />
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <aside className="hidden w-[min(100%,400px)] shrink-0 flex-col border-l border-white/10 bg-black lg:flex xl:w-[420px]">
          <EditorSidePanel
            activeTab={activeTab}
            activeDisplaySlot={activeDisplaySlot}
            form={form}
            clients={clients}
            editorClient={editorClient}
            clientFeedback={clientFeedback}
            schedulePostRows={schedulePostRows}
            saving={saving}
            onUpdateForm={updateForm}
            onSelectSlot={(slot) => {
              setActiveDisplaySlot(slot);
              scrollToDisplaySlot(slot);
            }}
            onDeleteDraft={() => void deleteDraft()}
            onGoToSetup={() => setActiveTab("setup")}
            clientDashboardPath={clientDashboardPath}
          />
        </aside>
      </div>

      <div className="flex flex-col border-t border-white/10 bg-black lg:hidden">
        <EditorPanelTabs
          activeTab={activeTab}
          onSelect={setActiveTab}
          feedbackCount={clientFeedback.length}
        />
        <div className="flex max-h-[min(65vh,560px)] min-h-0 flex-col">
          <EditorSidePanel
            activeTab={activeTab}
            activeDisplaySlot={activeDisplaySlot}
            form={form}
            clients={clients}
            editorClient={editorClient}
            clientFeedback={clientFeedback}
            schedulePostRows={schedulePostRows}
            saving={saving}
            onUpdateForm={updateForm}
            onSelectSlot={(slot) => {
              setActiveDisplaySlot(slot);
              scrollToDisplaySlot(slot);
            }}
            onGoToSetup={() => setActiveTab("setup")}
            onDeleteDraft={() => void deleteDraft()}
            clientDashboardPath={clientDashboardPath}
          />
        </div>
      </div>

      {editorClient ? (
        <EditorLibraryDrawer
          open={libraryOpen}
          client={editorClient}
          organizationId={organizationId}
          officeId={officeId}
          userId={userId}
          onClose={() => setLibraryOpen(false)}
          onSelect={(media) => void attachLibraryMedia(media)}
        />
      ) : null}
    </main>
  );
}

function EditorPanelTabs({
  activeTab,
  onSelect,
  feedbackCount,
}: {
  activeTab: EditorTab;
  onSelect: (tab: EditorTab) => void;
  feedbackCount: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 border-b border-white/10 p-2">
      {EDITOR_TABS.map((tab, index) => {
        const Icon = tab.icon;
        const active = activeTab === tab.id;
        const badge = tab.id === "setup" && feedbackCount > 0 ? feedbackCount : null;
        return (
          <button
            key={tab.id}
            type="button"
            title={tab.hint}
            onClick={() => onSelect(tab.id)}
            className={`relative flex flex-col items-center gap-0.5 rounded-xl px-2 py-2 text-[10px] font-semibold ${
              active ? "bg-orange-500/15 text-orange-200" : "text-white/45"
            }`}
          >
            <span className={`text-[9px] font-bold ${active ? "text-orange-300" : "text-white/30"}`}>
              {index + 1}
            </span>
            <Icon size={16} />
            {tab.navLabel}
            {badge ? (
              <span className="absolute right-1 top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-orange-500 px-0.5 text-[8px] font-bold text-black">
                {badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function EditorSidePanel({
  activeTab,
  activeDisplaySlot,
  form,
  clients,
  editorClient,
  clientFeedback,
  schedulePostRows,
  saving,
  onUpdateForm,
  onSelectSlot,
  onDeleteDraft,
  onGoToSetup,
  clientDashboardPath,
}: {
  activeTab: EditorTab;
  activeDisplaySlot: number | null;
  form: ReturnType<typeof draftToForm>;
  clients: ContentClient[];
  editorClient: ContentClient | null;
  clientFeedback: ContentReviewComment[];
  schedulePostRows: SchedulePostRow[];
  saving: boolean;
  onUpdateForm: <K extends keyof ReturnType<typeof draftToForm>>(key: K, value: ReturnType<typeof draftToForm>[K]) => void;
  onSelectSlot: (slot: number) => void;
  onDeleteDraft: () => void;
  onGoToSetup: () => void;
  clientDashboardPath: string;
}) {
  let tabBody: ReactNode = null;

  if (activeTab === "media") {
    tabBody = (
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">Posts</h2>
          <p className="mt-1 text-xs text-white/45">
            Edit media and captions in the centre frames. Jump to a post below.
          </p>
        </div>
        <ul className="space-y-1.5">
          {schedulePostRows.map((row) => (
            <li key={row.slot}>
              <button
                type="button"
                onClick={() => onSelectSlot(row.slot)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition ${
                  activeDisplaySlot === row.slot
                    ? "border-orange-500/40 bg-orange-500/10 text-orange-100"
                    : "border-white/10 bg-white/5 text-white/75 hover:border-white/20"
                }`}
              >
                <span className="font-semibold">{row.label}</span>
                <span className="text-[10px] text-white/40">
                  {row.hasMedia ? "Media ✓" : "—"} · {row.hasCaption ? "Copy ✓" : "—"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  } else if (activeTab === "write") {
    tabBody = (
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Write & extras</h2>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            Schedule story and social caption are in the centre panel. Per-post AI and captions are inside each
            frame.
          </p>
        </div>
        <Field label="CTA label" value={form.cta_label} onChange={(value) => onUpdateForm("cta_label", value)} />
        <Field label="CTA URL" value={form.cta_url} onChange={(value) => onUpdateForm("cta_url", value)} />
        <TextArea
          label="Internal notes"
          value={form.notes}
          onChange={(value) => onUpdateForm("notes", value)}
          rows={3}
          hint="Staff only — not shown on the client review link."
        />
      </div>
    );
  } else {
    tabBody = (
      <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold">Setup</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/45">{contentStudioCopy.editorSetupHint}</p>
      </div>

      <section className="space-y-3 rounded-xl border border-orange-500/25 bg-orange-500/5 p-3 sm:p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-200/90">
            {contentStudioCopy.clientReviewHeadline}
          </p>
          <p className="mt-1 text-xs text-white/50">{contentStudioCopy.clientReviewHeadlineHelp}</p>
        </div>
        <Field
          label={contentStudioCopy.clientReviewHeadline}
          value={form.title}
          onChange={(value) => onUpdateForm("title", value)}
          placeholder={contentStudioCopy.clientReviewHeadlinePlaceholder}
        />
        <Field
          label={contentStudioCopy.clientReviewSubtitle}
          value={form.subtitle}
          onChange={(value) => onUpdateForm("subtitle", value)}
          placeholder="Optional tagline under the headline"
        />
        <p className="text-[11px] text-white/40">{contentStudioCopy.clientReviewSubtitleHelp}</p>
      </section>

      <section className="rounded-xl border border-orange-500/25 bg-orange-500/5 p-3 sm:p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-orange-200/90">
          Schedule layout
        </p>
        <p className="mb-3 text-xs text-white/50">{contentStudioCopy.editorLayoutHint}</p>
        <ContentStudioLayoutPicker
          value={form.layout_type}
          onChange={(layout) => onUpdateForm("layout_type", layout)}
        />
      </section>

      <section className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-3 sm:p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Client & schedule</p>
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/40">Client</span>
        <select
          value={form.client_id}
          onChange={(event) => onUpdateForm("client_id", event.target.value)}
          className={inputClassName()}
        >
          <option value="">Unassigned</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.company_name}
            </option>
          ))}
        </select>
      </label>
      <Field
        label={contentStudioCopy.publishDate}
        type="datetime-local"
        value={form.scheduled_at}
        onChange={(value) => onUpdateForm("scheduled_at", value)}
      />
      </section>

      <section className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/45">
          Client feedback {clientFeedback.length > 0 ? `(${clientFeedback.length})` : ""}
        </h3>
        {clientFeedback.length === 0 ? (
          <p className="text-xs text-white/45">No client feedback yet.</p>
        ) : (
          <div className="max-h-48 space-y-2 overflow-auto">
            {clientFeedback.map((comment) => (
              <ClientFeedbackCard key={comment.id} comment={comment} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-2">
      {editorClient ? (
        <Link
          to={`/admin/content-studio/clients/${editorClient.id}`}
          className="block rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-center text-sm font-semibold text-orange-200"
        >
          Manage client library
        </Link>
      ) : null}
      <Link
        to={clientDashboardPath}
        className="block rounded-xl border border-white/10 px-4 py-3 text-center text-sm text-white/70"
      >
        Back to client dashboard
      </Link>
      <button
        type="button"
        disabled={saving}
        onClick={onDeleteDraft}
        className="w-full rounded-xl border border-red-500/20 bg-red-500/10 py-2.5 text-sm font-semibold text-red-200 disabled:opacity-60"
      >
        Delete schedule
      </button>
      </section>
    </div>
    );
  }

  const activeTabMeta = EDITOR_TABS.find((tab) => tab.id === activeTab);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {activeTabMeta ? (
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-white/30">
            {activeTabMeta.label}
          </p>
        ) : null}
        {tabBody}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/40">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={inputClassName()}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  hint?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/40">{label}</span>
      {hint ? <p className="text-[11px] text-white/40">{hint}</p> : null}
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={inputClassName()} />
    </label>
  );
}

function ClientFeedbackCard({ comment }: { comment: ContentReviewComment }) {
  const isChangeRequest = comment.comment_type === "change_request";
  const isApproval = comment.comment_type === "approval_note";
  const badgeClass = isChangeRequest
    ? "border-orange-400/30 bg-orange-500/10 text-orange-200"
    : isApproval
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
      : "border-sky-400/30 bg-sky-500/10 text-sky-200";

  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${badgeClass}`}>
          {isChangeRequest ? "Changes" : isApproval ? "Approved" : "Comment"}
        </span>
        <p className="text-xs font-semibold text-white/85">{comment.author_name || "Client"}</p>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-xs text-white/70">{comment.body}</p>
      <p className="mt-2 text-[10px] text-white/40">{new Date(comment.created_at).toLocaleString()}</p>
    </div>
  );
}
