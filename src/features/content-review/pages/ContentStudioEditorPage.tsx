import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Copy,
  Eye,
  Image as ImageIcon,
  Link2Off,
  Loader2,
  Save,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  Type,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { supabase } from "../../../lib/supabase/client";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import EditorLibraryDrawer from "../components/EditorLibraryDrawer";
import PostMediaFilmstrip from "../components/PostMediaFilmstrip";
import {
  assertCanUseContentStudio,
  attachContentClientMediaToDraft,
  deleteContentReviewAsset,
  deleteContentReviewDraft,
  getContentClient,
  getContentReviewDetail,
  listContentClients,
  generateContentStudioCaption,
  notifyContentReviewTeam,
  regenerateContentReviewLink,
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
import { shouldUseUnifiedPostCopy } from "../utils/postCopyLayout";
import {
  getPostReadiness,
  sendGateHint,
} from "../utils/contentStudioProgress";

type ContentStudioEditorLocationState = {
  suggestedCaption?: string;
};

type PreviewMode = "desktop" | "mobile";
type EditorTab = "media" | "copy" | "ai" | "details";

const layouts: ContentReviewLayout[] = [
  "split_media_text",
  "article",
  "gallery",
  "event_announcement",
  "campaign_preview",
  "testimonial",
  "media_showcase",
];

const AI_ACTIONS: Array<{
  label: string;
  instruction: string;
  tone?: string;
  platform?: string;
}> = [
  { label: "Generate caption", instruction: "Generate a new caption" },
  { label: "Rewrite", instruction: "Rewrite this caption" },
  { label: "Make shorter", instruction: "Make this caption shorter" },
  { label: "More professional", instruction: "Make this caption more professional", tone: "professional" },
  { label: "Add hashtags", instruction: "Add relevant hashtags" },
  { label: "Add emojis", instruction: "Add tasteful emojis" },
  { label: "Instagram version", instruction: "Rewrite for Instagram", tone: "engaging", platform: "instagram" },
  { label: "Facebook version", instruction: "Rewrite for Facebook", tone: "friendly", platform: "facebook" },
];

const EDITOR_TABS: Array<{ id: EditorTab; label: string; icon: typeof ImageIcon }> = [
  { id: "media", label: "Media", icon: ImageIcon },
  { id: "copy", label: "Copy", icon: Type },
  { id: "ai", label: "AI", icon: Sparkles },
  { id: "details", label: "Details", icon: Settings2 },
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
  const [activeTab, setActiveTab] = useState<EditorTab>("copy");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const aiMenuRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [captionAiLoading, setCaptionAiLoading] = useState(false);
  const [editorClient, setEditorClient] = useState<ContentClient | null>(null);

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
      const suggestedCaption = (location.state as ContentStudioEditorLocationState | null)?.suggestedCaption?.trim();
      const nextForm = suggestedCaption ? { ...baseForm, captions: suggestedCaption } : baseForm;
      setForm(nextForm);
      setSavedForm(baseForm);
      if (suggestedCaption) {
        setMessage("AI caption loaded. Save when ready.");
        setActiveTab("copy");
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
    if (!organizationId || !officeId) return;
    if (activeTab !== "details" && !libraryOpen) return;
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

  useEffect(() => {
    if (!aiMenuOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node)) {
        setAiMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [aiMenuOpen]);

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
    const unified = shouldUseUnifiedPostCopy(detail.assets);
    const layoutType: ContentReviewLayout = unified ? "media_showcase" : form.layout_type;
    return {
      ...detail.draft,
      ...form,
      layout_type: layoutType,
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

  function updateForm<K extends keyof NonNullable<typeof form>>(key: K, value: NonNullable<typeof form>[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function handleUploadToPost(files: FileList | null) {
    if (!files || !userId || !detail) return;
    try {
      setSaving(true);
      let order = detail.assets.length;
      const added: ContentReviewAsset[] = [];
      for (const file of Array.from(files)) {
        const uploaded = await uploadContentReviewAsset({
          draft: detail.draft,
          file,
          uploadedBy: userId,
          sortOrder: order,
          displaySlot: order,
        });
        added.push(uploaded);
        order += 1;
      }
      setDetail({ ...detail, assets: [...detail.assets, ...added] });
      if (added[0]) setSelectedAssetId(added[0].id);
      setActiveTab("media");
      setMessage(`${added.length} file(s) added.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload media.");
    } finally {
      setSaving(false);
    }
  }

  async function attachLibraryMedia(media: ContentClientMedia) {
    if (!detail || !userId) return;
    try {
      setSaving(true);
      const order = detail.assets.length;
      const attached = await attachContentClientMediaToDraft({
        media,
        targetDraft: detail.draft,
        uploadedBy: userId,
        sortOrder: order,
      });
      setDetail({ ...detail, assets: [...detail.assets, attached] });
      setSelectedAssetId(attached.id);
      setMessage("Added from library.");
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
    if (!detail || draggedId === targetId) return;
    const fromIndex = detail.assets.findIndex((asset) => asset.id === draggedId);
    const toIndex = detail.assets.findIndex((asset) => asset.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...detail.assets];
    const [dragged] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, dragged);
    const ordered = reordered.map((asset, index) => ({
      ...asset,
      sort_order: index,
      display_slot: index,
    }));
    setDetail({ ...detail, assets: ordered });

    try {
      setSaving(true);
      await Promise.all(
        ordered.map((asset) =>
          updateContentReviewAsset(asset.id, {
            sort_order: asset.sort_order,
            display_slot: asset.display_slot,
          }),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder media.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function applyAiCaptionInstruction(instruction: string, tone = "professional", platform = "instagram") {
    if (!form || !detail) return;
    setAiMenuOpen(false);
    try {
      setCaptionAiLoading(true);
      const mediaDescription = detail.assets.map((asset) => asset.file_name).join(", ");
      const result = await generateContentStudioCaption({
        clientName: editorClient?.company_name ?? "Client",
        postTitle: form.title,
        existingCaption: form.captions,
        mediaDescription,
        platform,
        tone,
        instruction,
      });
      updateForm("captions", result.generatedCaption);
      setActiveTab("copy");
      setMessage("AI suggestion added to social caption. Save to persist.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate caption.");
    } finally {
      setCaptionAiLoading(false);
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
    try {
      setSaving(true);
      const updated = await updateContentReviewDraft(detail.draft, {
        title: form.title.trim() || "Untitled review",
        subtitle: form.subtitle,
        summary: form.summary,
        body: form.body,
        captions: form.captions,
        notes: form.notes,
        layout_type: draftPreview.layout_type,
        scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
        cta_label: form.cta_label,
        cta_url: form.cta_url,
        client_id: form.client_id || null,
        ...(nextStatus ? { status: nextStatus } : {}),
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
            : "All changes saved.",
      );
      if (nextStatus === "sent_to_client" || nextStatus === "ready_for_review") {
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
              Post editor
            </p>
            <input
              value={form.title}
              onChange={(event) => updateForm("title", event.target.value)}
              className="mt-0.5 w-full max-w-xl truncate bg-transparent text-base font-semibold text-white outline-none placeholder:text-white/30 focus:border-b focus:border-orange-500/50"
              placeholder="Post title"
            />
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

      <div className="flex min-h-0 flex-1">
        <nav className="flex w-[72px] shrink-0 flex-col items-center gap-1 border-r border-white/10 bg-black py-3">
          {EDITOR_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            const badge =
              tab.id === "details" && clientFeedback.length > 0 ? clientFeedback.length : null;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex w-14 flex-col items-center gap-1 rounded-xl px-2 py-2.5 text-[10px] font-semibold transition ${
                  active
                    ? "bg-orange-500/15 text-orange-200"
                    : "text-white/45 hover:bg-white/5 hover:text-white/80"
                }`}
              >
                <Icon size={18} />
                {tab.label}
                {badge ? (
                  <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-black">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>

        <div className="flex min-w-0 flex-1 flex-col">
          <section className="relative flex min-h-0 flex-1 flex-col bg-neutral-200/95">
            <div className="flex-1 overflow-auto p-4 sm:p-6">
              <div
                className={`mx-auto transition-all ${
                  previewMode === "mobile"
                    ? "max-w-[390px] rounded-4xl border-10 border-neutral-800 bg-neutral-100 shadow-2xl"
                    : "max-w-4xl rounded-2xl border border-neutral-300/80 bg-white shadow-xl"
                }`}
              >
                <div className={previewMode === "mobile" ? "overflow-hidden rounded-[1.4rem]" : "overflow-hidden rounded-xl"}>
                  {orderedAssets.length === 0 && !form.body?.trim() && !form.captions?.trim() ? (
                    <div className="flex min-h-[320px] flex-col items-center justify-center bg-white p-8 text-center text-neutral-600">
                      <ImageIcon className="text-orange-400" size={32} />
                      <p className="mt-3 text-sm font-medium">Start with media</p>
                      <p className="mt-1 max-w-xs text-xs text-neutral-500">
                        Open the library or upload files in the filmstrip below.
                      </p>
                      {editorClient ? (
                        <button
                          type="button"
                          onClick={() => setLibraryOpen(true)}
                          className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-black"
                        >
                          Open client library
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <ContentReviewRenderer
                      draft={draftPreview}
                      assets={detail.assets as ContentReviewAsset[]}
                      theme="public"
                      viewport={previewMode === "mobile" ? "mobile" : "responsive"}
                      unifiedPostCopy={unifiedPreview}
                    />
                  )}
                </div>
              </div>
            </div>
            <PostMediaFilmstrip
              assets={orderedAssets}
              selectedAssetId={selectedAssetId}
              saving={saving}
              canUseLibrary={Boolean(editorClient)}
              onSelect={setSelectedAssetId}
              onReorder={(from, to) => void reorderAssets(from, to)}
              onRemove={(asset) => void removePostAsset(asset)}
              onUpload={(files) => void handleUploadToPost(files)}
              onOpenLibrary={() => setLibraryOpen(true)}
            />
          </section>
        </div>

        <aside className="hidden w-[min(100%,340px)] shrink-0 overflow-auto border-l border-white/10 bg-black p-4 lg:block xl:w-[360px]">
          <EditorSidePanel
            activeTab={activeTab}
            form={form}
            clients={clients}
            editorClient={editorClient}
            selectedAsset={selectedAsset}
            clientFeedback={clientFeedback}
            captionAiLoading={captionAiLoading}
            aiMenuOpen={aiMenuOpen}
            aiMenuRef={aiMenuRef}
            saving={saving}
            onUpdateForm={updateForm}
            onSetAiMenuOpen={setAiMenuOpen}
            onApplyAi={applyAiCaptionInstruction}
            onOpenLibrary={() => setLibraryOpen(true)}
            onRemoveAsset={(asset) => void removePostAsset(asset)}
            onDeleteDraft={() => void deleteDraft()}
            clientDashboardPath={clientDashboardPath}
          />
        </aside>
      </div>

      <div className="border-t border-white/10 bg-black p-3 lg:hidden">
        <EditorSidePanel
          activeTab={activeTab}
          form={form}
          clients={clients}
          editorClient={editorClient}
          selectedAsset={selectedAsset}
          clientFeedback={clientFeedback}
          captionAiLoading={captionAiLoading}
          aiMenuOpen={aiMenuOpen}
          aiMenuRef={aiMenuRef}
          saving={saving}
          onUpdateForm={updateForm}
          onSetAiMenuOpen={setAiMenuOpen}
          onApplyAi={applyAiCaptionInstruction}
          onOpenLibrary={() => setLibraryOpen(true)}
          onRemoveAsset={(asset) => void removePostAsset(asset)}
          onDeleteDraft={() => void deleteDraft()}
          clientDashboardPath={clientDashboardPath}
        />
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

function EditorSidePanel({
  activeTab,
  form,
  clients,
  editorClient,
  selectedAsset,
  clientFeedback,
  captionAiLoading,
  aiMenuOpen,
  aiMenuRef,
  saving,
  onUpdateForm,
  onSetAiMenuOpen,
  onApplyAi,
  onOpenLibrary,
  onRemoveAsset,
  onDeleteDraft,
  clientDashboardPath,
}: {
  activeTab: EditorTab;
  form: ReturnType<typeof draftToForm>;
  clients: ContentClient[];
  editorClient: ContentClient | null;
  selectedAsset: ContentReviewAsset | null;
  clientFeedback: ContentReviewComment[];
  captionAiLoading: boolean;
  aiMenuOpen: boolean;
  aiMenuRef: React.RefObject<HTMLDivElement | null>;
  saving: boolean;
  onUpdateForm: <K extends keyof ReturnType<typeof draftToForm>>(key: K, value: ReturnType<typeof draftToForm>[K]) => void;
  onSetAiMenuOpen: (open: boolean) => void;
  onApplyAi: (instruction: string, tone?: string, platform?: string) => void;
  onOpenLibrary: () => void;
  onRemoveAsset: (asset: ContentReviewAsset) => void;
  onDeleteDraft: () => void;
  clientDashboardPath: string;
}) {
  if (activeTab === "media") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Media</h2>
          <p className="mt-1 text-xs text-white/45">
            Use the filmstrip under the preview to order blocks. Pick files from the client library or upload directly.
          </p>
        </div>
        {editorClient ? (
          <button
            type="button"
            onClick={onOpenLibrary}
            className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black hover:bg-orange-400"
          >
            Open client library
          </button>
        ) : (
          <p className="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/50">
            Assign a client under Details to unlock the shared media library.
          </p>
        )}
        {selectedAsset ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-xs font-semibold text-white/70">Selected block</p>
            <p className="mt-1 truncate text-sm">{selectedAsset.file_name}</p>
            <button
              type="button"
              disabled={saving}
              onClick={() => onRemoveAsset(selectedAsset)}
              className="mt-3 w-full rounded-lg border border-red-500/25 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-60"
            >
              Remove from post
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (activeTab === "copy") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Copy</h2>
          <p className="mt-1 text-xs text-white/45">One story and one social caption for the whole post.</p>
        </div>
        <TextArea
          label="Story text"
          value={form.body}
          onChange={(value) => onUpdateForm("body", value)}
          rows={7}
          hint="Shown after your images in the client review."
        />
        <TextArea
          label="Social caption"
          value={form.captions}
          onChange={(value) => onUpdateForm("captions", value)}
          rows={5}
          hint="Instagram / Facebook caption."
        />
        <Field label="Subtitle" value={form.subtitle} onChange={(value) => onUpdateForm("subtitle", value)} />
        <Field label="CTA label" value={form.cta_label} onChange={(value) => onUpdateForm("cta_label", value)} />
        <Field label="CTA URL" value={form.cta_url} onChange={(value) => onUpdateForm("cta_url", value)} />
      </div>
    );
  }

  if (activeTab === "ai") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold">AI assist</h2>
          <p className="mt-1 text-xs text-white/45">
            Suggestions only — review the social caption, then Save. Nothing is auto-sent or auto-approved.
          </p>
        </div>
        <div className="relative" ref={aiMenuRef}>
          <button
            type="button"
            disabled={captionAiLoading}
            onClick={() => onSetAiMenuOpen(!aiMenuOpen)}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-100 disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              {captionAiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              Caption assist
            </span>
            <ChevronDown size={16} className={`transition ${aiMenuOpen ? "rotate-180" : ""}`} />
          </button>
          {aiMenuOpen ? (
            <div className="absolute left-0 right-0 z-10 mt-2 overflow-hidden rounded-xl border border-white/10 bg-neutral-900 shadow-xl">
              {AI_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  disabled={captionAiLoading}
                  onClick={() => void onApplyAi(action.instruction, action.tone, action.platform)}
                  className="block w-full border-b border-white/5 px-4 py-2.5 text-left text-sm text-white/85 last:border-0 hover:bg-white/5 disabled:opacity-60"
                >
                  {action.label}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {form.captions ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-[11px] uppercase tracking-wide text-white/40">Current caption</p>
            <p className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-white/75">{form.captions}</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold">Details</h2>
        <p className="mt-1 text-xs text-white/45">Client, schedule, and feedback.</p>
      </div>
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
        label="Schedule"
        type="datetime-local"
        value={form.scheduled_at}
        onChange={(value) => onUpdateForm("scheduled_at", value)}
      />
      <TextArea label="Internal notes" value={form.notes} onChange={(value) => onUpdateForm("notes", value)} rows={3} />
      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-white/40">Layout (advanced)</span>
        <select
          value={form.layout_type}
          onChange={(event) => onUpdateForm("layout_type", event.target.value as ContentReviewLayout)}
          className={inputClassName()}
        >
          {layouts.map((layout) => (
            <option key={layout} value={layout}>
              {formatStatus(layout)}
            </option>
          ))}
        </select>
      </label>
      <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
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
      </div>
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
        Delete post
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/40">{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={inputClassName()} />
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
