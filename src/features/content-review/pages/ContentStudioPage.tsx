import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, Copy, GripVertical, Image, Loader2, MessageSquare, Plus, Trash2, Upload } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import {
  addInternalContentReviewComment,
  assertCanUseContentStudio,
  CONTENT_REVIEW_UPLOAD_LIMIT_BYTES,
  createContentReviewDraft,
  deleteContentReviewAsset,
  deleteContentReviewDraft,
  formatContentReviewFileSize,
  getContentReviewDetail,
  getItsNoMatataOffice,
  inferLayoutType,
  listContentReviewDrafts,
  notifyContentReviewTeam,
  setContentReviewAssetsSelected,
  updateContentReviewAsset,
  updateContentReviewDraft,
  uploadContentReviewAsset,
  type ContentReviewAsset,
  type ContentReviewActivity,
  type ContentReviewComment,
  type ContentReviewDetail,
  type ContentReviewDraft,
  type ContentReviewLayout,
  type ContentReviewStatus,
} from "../services/contentReviewService";

const statuses: Array<ContentReviewStatus | "all"> = [
  "all",
  "draft",
  "ready_for_review",
  "sent_to_client",
  "viewed",
  "changes_requested",
  "approved",
  "published",
  "archived",
];

const layouts: ContentReviewLayout[] = [
  "split_media_text",
  "article",
  "gallery",
  "event_announcement",
  "campaign_preview",
  "testimonial",
  "media_showcase",
];

function inputClassName() {
  return "w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-400/70";
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
}

function statusClass(status: string) {
  if (status === "approved" || status === "published") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "changes_requested") {
    return "border-orange-400/30 bg-orange-500/10 text-orange-200";
  }
  if (status === "archived") return "border-white/10 bg-white/5 text-white/50";
  return "border-orange-500/20 bg-orange-500/10 text-orange-200";
}

function MediaPreview({ asset }: { asset: ContentReviewAsset }) {
  const cropStyle = {
    "--crop-position": `${asset.crop_x ?? 50}% ${asset.crop_y ?? 50}%`,
    "--crop-transform": `scale(${asset.crop_zoom ?? 1})`,
    "--crop-origin": `${asset.crop_x ?? 50}% ${asset.crop_y ?? 50}%`,
  } as CSSProperties;

  if (asset.asset_type === "video" || asset.mime_type?.startsWith("video/")) {
    return (
      <video
        src={asset.file_url}
        controls
        className="aspect-video w-full rounded-xl border border-white/10 object-contain sm:object-cover"
      />
    );
  }

  return (
    <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10">
      <img
        src={asset.file_url}
        alt={asset.caption ?? asset.file_name}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-contain [object-position:var(--crop-position)] [transform-origin:var(--crop-origin)] sm:object-cover sm:[transform:var(--crop-transform)]"
        style={cropStyle}
      />
    </div>
  );
}

export default function ContentStudioPage() {
  const auth = useAuth();
  const location = useLocation();
  const profile = auth.profile;
  const organizationId = profile?.organization_id ?? null;
  const userId = auth.user?.id ?? null;
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ContentReviewDraft[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContentReviewDetail | null>(null);
  const [statusFilter, setStatusFilter] = useState<ContentReviewStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipNextDetailLoadRef = useRef(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [internalComment, setInternalComment] = useState("");

  const section = location.pathname.endsWith("/uploads")
    ? "uploads"
    : location.pathname.endsWith("/reviews")
      ? "reviews"
      : location.pathname.endsWith("/calendar")
        ? "calendar"
        : location.pathname.endsWith("/drafts")
          ? "drafts"
          : "studio";

  const selectedDraft =
    detail?.draft.id === selectedDraftId
      ? detail.draft
      : drafts.find((draft) => draft.id === selectedDraftId) ?? null;
  const assets = detail?.draft.id === selectedDraftId ? detail.assets : [];

  const loadDraftDetail = useCallback(
    async (draftId: string | null) => {
      if (!draftId || !organizationId || !officeId) {
        setDetail(null);
        return;
      }

      try {
        setDetailLoading(true);
        setError("");
        const detailData = await getContentReviewDetail({
          organizationId,
          officeId,
          draftId,
        });
        setDetail(detailData);
        setDrafts((current) =>
          current.map((draft) =>
            draft.id === detailData.draft.id ? detailData.draft : draft,
          ),
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load draft.");
      } finally {
        setDetailLoading(false);
      }
    },
    [organizationId, officeId],
  );

  const initializeStudio = useCallback(async () => {
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
      const draftData = await listContentReviewDrafts({
        organizationId,
        officeId: office.id,
        status: statusFilter,
      });
      setDrafts(draftData);
      setSelectedDraftId((current) => {
        if (current && draftData.some((draft) => draft.id === current)) return current;
        return draftData[0]?.id ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Content Studio.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, profile?.office_id, profile?.primary_role, statusFilter]);

  useEffect(() => {
    void initializeStudio();
  }, [initializeStudio]);

  useEffect(() => {
    if (loading || !officeId) return;
    if (skipNextDetailLoadRef.current) {
      skipNextDetailLoadRef.current = false;
      return;
    }
    void loadDraftDetail(selectedDraftId);
  }, [loading, officeId, selectedDraftId, loadDraftDetail]);

  function syncDraftInList(draft: ContentReviewDraft) {
    setDrafts((current) =>
      current.map((item) => (item.id === draft.id ? draft : item)),
    );
  }

  const counts = useMemo(() => {
    return {
      total: drafts.length,
      ready: drafts.filter((draft) => draft.status === "ready_for_review").length,
      sent: drafts.filter((draft) => draft.status === "sent_to_client" || draft.status === "viewed").length,
      approved: drafts.filter((draft) => draft.status === "approved").length,
    };
  }, [drafts]);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!organizationId || !officeId || !userId) return;
    try {
      setSaving(true);
      const draft = await createContentReviewDraft({
        organizationId,
        officeId,
        createdBy: userId,
        title: createTitle,
      });
      setCreateTitle("");
      setDrafts((current) => [draft, ...current.filter((item) => item.id !== draft.id)]);
      skipNextDetailLoadRef.current = true;
      setSelectedDraftId(draft.id);
      setDetail({
        draft,
        assets: [],
        comments: [],
        activity: [] as ContentReviewActivity[],
      });
      setMessage("Draft created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create draft.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedDraft || !detail) return;
    const form = new FormData(event.currentTarget);
    const bodyText = String(form.get("body") || "");
    const requestedLayout = String(form.get("layout_type") || selectedDraft.layout_type) as ContentReviewLayout;
    const selectedAssets = detail.assets.filter((asset) => asset.is_selected !== false);
    const layoutType =
      selectedAssets.length === 1 && bodyText.trim()
        ? inferLayoutType({ assets: selectedAssets, body: bodyText })
        : requestedLayout;
    try {
      setSaving(true);
      const updated = await updateContentReviewDraft(selectedDraft, {
        title: String(form.get("title") || "Untitled review"),
        subtitle: String(form.get("subtitle") || ""),
        summary: String(form.get("summary") || ""),
        body: bodyText,
        captions: String(form.get("captions") || ""),
        notes: String(form.get("notes") || ""),
        layout_type: layoutType,
        scheduled_at: String(form.get("scheduled_at") || "") || null,
        expires_at: String(form.get("expires_at") || "") || null,
        cta_label: String(form.get("cta_label") || ""),
        cta_url: String(form.get("cta_url") || ""),
      });
      setDetail({ ...detail, draft: updated });
      syncDraftInList(updated);
      setMessage("Draft saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files || !selectedDraft || !userId) return;
    try {
      setSaving(true);
      setError("");
      setMessage("Preparing media. Large videos may take a few minutes to compress.");
      let order = assets.length;
      for (const file of Array.from(files)) {
        await uploadContentReviewAsset({
          draft: selectedDraft,
          file,
          uploadedBy: userId,
          sortOrder: order,
          displaySlot: order,
        });
        order += 1;
      }
      await notifyContentReviewTeam({
        draft: selectedDraft,
        title: "Media uploaded",
        message: `${Array.from(files).length} asset(s) were uploaded for ${selectedDraft.title}.`,
        dedupeKey: `content-media:${selectedDraft.id}:${Date.now()}`,
      });
      await loadDraftDetail(selectedDraft.id);
      setMessage(`${Array.from(files).length} asset(s) uploaded. Videos are compressed when the browser supports it.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload media.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddCarouselSlide(asset: ContentReviewAsset, files: FileList | null) {
    if (!files || !selectedDraft || !userId || !detail) return;
    const displaySlot = asset.display_slot ?? asset.sort_order;
    const slotAssets = detail.assets.filter(
      (item) => (item.display_slot ?? item.sort_order) === displaySlot,
    );
    let order = slotAssets.length
      ? Math.max(...slotAssets.map((item) => item.sort_order)) + 1
      : asset.sort_order;

    try {
      setSaving(true);
      setError("");
      for (const file of Array.from(files)) {
        await uploadContentReviewAsset({
          draft: selectedDraft,
          file,
          uploadedBy: userId,
          sortOrder: order,
          displaySlot,
        });
        order += 1;
      }
      await loadDraftDetail(selectedDraft.id);
      setMessage("Carousel slide added to this row.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add carousel slide.");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateAsset(
    asset: ContentReviewAsset,
    updates: Pick<
      Partial<ContentReviewAsset>,
      | "heading"
      | "caption"
      | "is_selected"
      | "sort_order"
      | "display_slot"
      | "crop_x"
      | "crop_y"
      | "crop_zoom"
    >,
  ) {
    if (!detail) return;
    try {
      setSaving(true);
      const updated = await updateContentReviewAsset(asset.id, updates);
      setDetail({
        ...detail,
        assets: detail.assets.map((item) => (item.id === updated.id ? updated : item)),
      });
      setMessage("Media updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update media.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSetAllAssetSelection(isSelected: boolean) {
    if (!detail || detail.assets.length === 0) return;
    try {
      setSaving(true);
      const assetIds = detail.assets.map((asset) => asset.id);
      await setContentReviewAssetsSelected(assetIds, isSelected);
      setDetail({
        ...detail,
        assets: detail.assets.map((asset) => ({ ...asset, is_selected: isSelected })),
      });
      setMessage(isSelected ? "All media selected." : "All media unselected.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update media selection.");
      if (selectedDraftId) await loadDraftDetail(selectedDraftId);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAsset(asset: ContentReviewAsset) {
    const confirmed = window.confirm(`Delete "${asset.file_name}" from this draft?`);
    if (!confirmed || !detail) return;
    try {
      setSaving(true);
      await deleteContentReviewAsset(asset);
      setDetail({
        ...detail,
        assets: detail.assets.filter((item) => item.id !== asset.id),
      });
      setMessage("Media deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete media.");
      await loadDraftDetail(selectedDraftId);
    } finally {
      setSaving(false);
    }
  }

  async function handleReorderAssets(draggedId: string, targetId: string) {
    if (!detail || draggedId === targetId) return;
    const fromIndex = detail.assets.findIndex((asset) => asset.id === draggedId);
    const toIndex = detail.assets.findIndex((asset) => asset.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...detail.assets];
    const [dragged] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, dragged);
    const orderedAssets = reordered.map((asset, index) => ({
      ...asset,
      sort_order: index,
      display_slot: index,
    }));
    setDetail({ ...detail, assets: orderedAssets });

    try {
      setSaving(true);
      await Promise.all(
        orderedAssets.map((asset) =>
          updateContentReviewAsset(asset.id, {
            sort_order: asset.sort_order,
            display_slot: asset.display_slot,
          }),
        ),
      );
      setMessage("Media order updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder media.");
      await loadDraftDetail(selectedDraftId);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: ContentReviewStatus) {
    if (!selectedDraft || !detail) return;
    try {
      setSaving(true);
      const updated = await updateContentReviewDraft(selectedDraft, { status });
      setDetail({ ...detail, draft: updated });
      syncDraftInList(updated);
      if (status === "ready_for_review" || status === "sent_to_client") {
        await notifyContentReviewTeam({
          draft: updated,
          title: "Content review ready",
          message: `${updated.title} is ready for client review.`,
          dedupeKey: `content-ready:${updated.id}:${status}`,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status.");
    } finally {
      setSaving(false);
    }
  }

  async function copyReviewLink() {
    if (!selectedDraft?.review_url) return;
    await navigator.clipboard.writeText(selectedDraft.review_url);
    setMessage("Review link copied.");
  }

  async function handleInternalComment(event: FormEvent) {
    event.preventDefault();
    if (!selectedDraft || !userId || !internalComment.trim()) return;
    try {
      setSaving(true);
      await addInternalContentReviewComment({
        draft: selectedDraft,
        body: internalComment,
        createdBy: userId,
        authorName: profile?.full_name ?? "Internal team",
        authorEmail: profile?.email ?? null,
      });
      setInternalComment("");
      setMessage("Internal comment added.");
      await loadDraftDetail(selectedDraft.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteDraft(draft: ContentReviewDraft) {
    const confirmed = window.confirm(`Delete "${draft.title}" and its uploaded media? Clients will no longer be able to access it.`);
    if (!confirmed) return;
    try {
      setSaving(true);
      await deleteContentReviewDraft(draft.id);
      setMessage("Draft and attached media deleted.");
      const remaining = drafts.filter((item) => item.id !== draft.id);
      setDrafts(remaining);
      const nextId = remaining[0]?.id ?? null;
      setSelectedDraftId(nextId);
      if (nextId) {
        await loadDraftDetail(nextId);
      } else {
        setDetail(null);
      }
    } catch (err) {
      setError(`Failed to delete draft: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">Loading Content Studio...</div>
    );
  }

  if (error && !officeId) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar role={profile?.primary_role ?? null} />
          <main className="flex-1 p-6">
            <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-6 text-orange-100">
              {error}
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
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                IT's No Matata only
              </p>
              <h1 className="mt-2 text-3xl font-bold">Content Studio</h1>
              <p className="mt-2 text-sm text-white/50">
                Create blog-style client review links for content approval.
              </p>
            </div>
            <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row">
              <input
                value={createTitle}
                onChange={(event) => setCreateTitle(event.target.value)}
                placeholder="New draft title"
                className={inputClassName()}
              />
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
              >
                <Plus size={16} />
                New Draft
              </button>
            </form>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
              {error}
            </div>
          ) : null}
          {message ? (
            <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200">
              {message}
            </div>
          ) : null}

          <div className="mb-6 grid gap-4 md:grid-cols-4">
            <Metric label="Drafts" value={counts.total} icon={<Image size={18} />} />
            <Metric label="Ready" value={counts.ready} icon={<CheckCircle2 size={18} />} />
            <Metric label="Client Review" value={counts.sent} icon={<MessageSquare size={18} />} />
            <Metric label="Approved" value={counts.approved} icon={<CheckCircle2 size={18} />} />
          </div>

          <div className="mb-6 flex flex-wrap gap-2 border-b border-white/10">
            {[
              ["/admin/content-studio", "Studio"],
              ["/admin/content-studio/clients", "Clients"],
              ["/admin/content-studio/drafts", "Drafts"],
              ["/admin/content-studio/uploads", "Uploads"],
              ["/admin/content-studio/reviews", "Reviews"],
              ["/admin/content-studio/calendar", "Calendar"],
            ].map(([to, label]) => (
              <Link
                key={to}
                to={to}
                className={`border-b-2 px-4 py-3 text-sm font-semibold ${
                  location.pathname === to
                    ? "border-orange-500 text-white"
                    : "border-transparent text-white/50 hover:text-white"
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {section === "uploads" ? (
            <UploadsTab
              drafts={drafts}
              selectedDraft={selectedDraft}
              assets={assets}
              saving={saving}
              onSelect={setSelectedDraftId}
              onUpload={handleUpload}
              onUpdateAsset={handleUpdateAsset}
              onReorderAssets={handleReorderAssets}
              onSetAllSelected={handleSetAllAssetSelection}
              onDeleteAsset={handleDeleteAsset}
              onAddCarouselSlide={handleAddCarouselSlide}
            />
          ) : section === "reviews" ? (
            <ReviewsTab drafts={drafts} detail={detail} onSelect={setSelectedDraftId} />
          ) : section === "calendar" ? (
            <CalendarTab drafts={drafts} />
          ) : (
          <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-semibold">Drafts</h2>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as ContentReviewStatus | "all")}
                  className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white"
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                {drafts.length === 0 ? (
                  <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/50">
                    No content drafts yet.
                  </p>
                ) : (
                  drafts.map((draft) => (
                    <div
                      key={draft.id}
                      className={`w-full rounded-xl border p-4 text-left ${
                        selectedDraftId === draft.id
                          ? "border-orange-500/50 bg-orange-500/10"
                          : "border-white/10 bg-black/30 hover:bg-white/5"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedDraftId(draft.id)}
                        className="block w-full text-left"
                      >
                        <p className="font-semibold text-white">{draft.title}</p>
                      </button>
                      <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs capitalize ${statusClass(draft.status)}`}>
                        {formatStatus(draft.status)}
                      </span>
                      <Link
                        to={`/admin/content-studio/editor/${draft.id}`}
                        className="mt-3 inline-flex rounded-lg border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/10"
                      >
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
                  ))
                )}
              </div>
            </section>

            {selectedDraft ? (
              <section className="relative space-y-6">
                {detailLoading ? (
                  <div className="absolute inset-0 z-10 flex items-start justify-center rounded-2xl bg-black/40 pt-16 backdrop-blur-[1px]">
                    <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-4 py-2 text-sm text-white/70">
                      <Loader2 size={16} className="animate-spin text-orange-400" />
                      Loading draft...
                    </div>
                  </div>
                ) : null}
                <form
                  key={selectedDraft.id}
                  onSubmit={handleSaveDraft}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <h2 className="text-xl font-semibold">Draft Editor</h2>
                      <p className="mt-1 text-sm text-white/45">
                        {selectedDraft.review_url}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyReviewLink()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-200 hover:bg-orange-500/15"
                    >
                      <Copy size={16} />
                      Copy review link
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDraft(selectedDraft)}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-200 hover:bg-red-500/15"
                    >
                      <Trash2 size={16} />
                      Delete draft
                    </button>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <Field name="title" label="Title" defaultValue={selectedDraft.title} />
                    <Field name="subtitle" label="Subtitle" defaultValue={selectedDraft.subtitle ?? ""} />
                    <Field name="summary" label="Summary" defaultValue={selectedDraft.summary ?? ""} />
                    <label className="space-y-2">
                      <span className="text-xs font-semibold uppercase tracking-wide text-white/40">Layout</span>
                      <select name="layout_type" defaultValue={selectedDraft.layout_type} className={inputClassName()}>
                        {layouts.map((layout) => (
                          <option key={layout} value={layout}>{formatStatus(layout)}</option>
                        ))}
                      </select>
                    </label>
                    <Field name="scheduled_at" label="Schedule date" type="datetime-local" defaultValue={selectedDraft.scheduled_at?.slice(0, 16) ?? ""} />
                    <Field name="expires_at" label="Review expiry" type="datetime-local" defaultValue={selectedDraft.expires_at?.slice(0, 16) ?? ""} />
                    <Field name="cta_label" label="CTA label" defaultValue={selectedDraft.cta_label ?? ""} />
                    <Field name="cta_url" label="CTA URL" defaultValue={selectedDraft.cta_url ?? ""} />
                    <TextField name="body" label="Body text" defaultValue={selectedDraft.body ?? ""} />
                    <TextField name="captions" label="Captions" defaultValue={selectedDraft.captions ?? ""} />
                    <TextField name="notes" label="Internal/client notes" defaultValue={selectedDraft.notes ?? ""} />
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-5">
                    <button type="submit" disabled={saving} className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60">
                      Save draft
                    </button>
                    <button type="button" onClick={() => void setStatus("ready_for_review")} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10">
                      Ready for review
                    </button>
                    <button type="button" onClick={() => void setStatus("sent_to_client")} className="rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-200 hover:bg-orange-500/15">
                      Mark sent to client
                    </button>
                  </div>
                </form>

                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold">Media Uploads</h2>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400">
                      <Upload size={16} />
                      Upload media
                      <input
                        type="file"
                        multiple
                        accept="image/*,video/*"
                        className="hidden"
                        onChange={(event) => void handleUpload(event.target.files)}
                      />
                    </label>
                  </div>
                  {assets.length === 0 ? (
                    <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/50">
                      No media uploaded yet.
                    </p>
                  ) : (
                    <>
                      <AssetSelectionToolbar
                        assets={assets}
                        saving={saving}
                        onSetAllSelected={handleSetAllAssetSelection}
                      />
                      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {assets.map((asset) => (
                          <AssetReviewCard
                            key={asset.id}
                            asset={asset}
                            saving={saving}
                            onUpdate={handleUpdateAsset}
                            onReorder={handleReorderAssets}
                            onDelete={handleDeleteAsset}
                            onAddCarouselSlide={handleAddCarouselSlide}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </section>

                {detail?.draft.id === selectedDraft.id ? (
                  <>
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-xl font-semibold">Blog-style Preview</h2>
                  <div className="mt-4">
                    <ContentReviewRenderer draft={selectedDraft} assets={assets} theme="internal" />
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold">Review Comments</h2>
                    <form onSubmit={handleInternalComment} className="mt-4 space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
                      <textarea
                        value={internalComment}
                        onChange={(event) => setInternalComment(event.target.value)}
                        rows={3}
                        placeholder="Add an internal team comment"
                        className={inputClassName()}
                      />
                      <button
                        type="submit"
                        disabled={saving || !internalComment.trim()}
                        className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
                      >
                        Add internal comment
                      </button>
                    </form>
                    <div className="mt-4 space-y-3">
                      {detail.comments.length === 0 ? (
                        <p className="text-sm text-white/50">No review comments yet.</p>
                      ) : (
                        detail.comments.map((comment) => (
                          <div key={comment.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${commentLabelClass(comment)}`}>
                                {commentLabel(comment)}
                              </span>
                              <p className="font-semibold text-white">{comment.author_name}</p>
                            </div>
                            <p className="mt-2 text-sm text-white/70">{comment.body}</p>
                            <p className="mt-2 text-xs text-white/35">{new Date(comment.created_at).toLocaleString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold">Activity History</h2>
                    <div className="mt-4 space-y-3">
                      {detail.activity.map((item) => (
                        <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                          <p className="font-semibold capitalize text-white">{formatStatus(item.activity_type)}</p>
                          <p className="mt-1 text-xs text-white/45">{new Date(item.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
                  </>
                ) : null}
              </section>
            ) : (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
                Create or select a draft to begin.
              </section>
            )}
          </div>
          )}
        </main>
      </div>
    </div>
  );
}

function UploadsTab({
  drafts,
  selectedDraft,
  assets,
  saving,
  onSelect,
  onUpload,
  onUpdateAsset,
  onReorderAssets,
  onSetAllSelected,
  onDeleteAsset,
  onAddCarouselSlide,
}: {
  drafts: ContentReviewDraft[];
  selectedDraft: ContentReviewDraft | null;
  assets: ContentReviewAsset[];
  saving: boolean;
  onSelect: (draftId: string) => void;
  onUpload: (files: FileList | null) => void;
  onUpdateAsset: (
    asset: ContentReviewAsset,
    updates: Pick<
      Partial<ContentReviewAsset>,
      | "heading"
      | "caption"
      | "is_selected"
      | "sort_order"
      | "display_slot"
      | "crop_x"
      | "crop_y"
      | "crop_zoom"
    >,
  ) => void;
  onReorderAssets: (draggedId: string, targetId: string) => void;
  onSetAllSelected: (isSelected: boolean) => void;
  onDeleteAsset: (asset: ContentReviewAsset) => void;
  onAddCarouselSlide: (asset: ContentReviewAsset, files: FileList | null) => void;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div
        className="rounded-2xl border border-white/10 bg-white/5 p-5"
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) event.preventDefault();
        }}
        onDrop={(event) => {
          if (!event.dataTransfer.files.length) return;
          event.preventDefault();
          onUpload(event.dataTransfer.files);
        }}
      >
        <h2 className="text-xl font-semibold">Select draft</h2>
        <div className="mt-4 space-y-2">
          {drafts.map((draft) => (
            <button
              key={draft.id}
              type="button"
              onClick={() => onSelect(draft.id)}
              className={`w-full rounded-xl border p-4 text-left ${
                selectedDraft?.id === draft.id
                  ? "border-orange-500/50 bg-orange-500/10"
                  : "border-white/10 bg-black/30 hover:bg-white/5"
              }`}
            >
              <p className="font-semibold">{draft.title}</p>
              <p className="mt-1 text-xs capitalize text-white/45">{formatStatus(draft.status)}</p>
            </button>
          ))}
          {drafts.length === 0 ? <p className="text-sm text-white/50">No drafts available.</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Uploads</h2>
            <p className="mt-1 text-sm text-white/45">
              Images and supported videos are compressed before upload. Limit {formatContentReviewFileSize(CONTENT_REVIEW_UPLOAD_LIMIT_BYTES)} per file. Media is permanently deleted after 60 days.
            </p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400">
            <Upload size={16} />
            Upload media
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              disabled={!selectedDraft || saving}
              onChange={(event) => onUpload(event.target.files)}
            />
          </label>
        </div>
        {!selectedDraft ? (
          <p className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/50">
            Select a draft before uploading media.
          </p>
        ) : assets.length === 0 ? (
          <p className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/50">
            No media uploaded for this draft yet.
          </p>
        ) : (
          <>
            <AssetSelectionToolbar
              assets={assets}
              saving={saving}
              onSetAllSelected={onSetAllSelected}
            />
            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assets.map((asset) => (
                <AssetReviewCard
                  key={asset.id}
                  asset={asset}
                  saving={saving}
                  onUpdate={onUpdateAsset}
                  onReorder={onReorderAssets}
                  onDelete={onDeleteAsset}
                  onAddCarouselSlide={onAddCarouselSlide}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function AssetSelectionToolbar({
  assets,
  saving,
  onSetAllSelected,
}: {
  assets: ContentReviewAsset[];
  saving: boolean;
  onSetAllSelected: (isSelected: boolean) => void;
}) {
  const selectedCount = assets.filter((asset) => asset.is_selected !== false).length;
  const allSelected = selectedCount === assets.length;

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/25 p-3">
      <p className="text-sm text-white/55">
        {selectedCount} of {assets.length} selected
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving || allSelected}
          onClick={() => onSetAllSelected(true)}
          className="rounded-lg border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Select all
        </button>
        <button
          type="button"
          disabled={saving || selectedCount === 0}
          onClick={() => onSetAllSelected(false)}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Unselect all
        </button>
      </div>
    </div>
  );
}

function ReviewsTab({
  drafts,
  detail,
  onSelect,
}: {
  drafts: ContentReviewDraft[];
  detail: ContentReviewDetail | null;
  onSelect: (draftId: string) => void;
}) {
  const reviewDrafts = drafts.filter((draft) =>
    ["ready_for_review", "sent_to_client", "viewed", "changes_requested", "approved"].includes(draft.status),
  );

  return (
    <section className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold">Review queue</h2>
        <div className="mt-4 space-y-2">
          {reviewDrafts.map((draft) => (
            <button key={draft.id} type="button" onClick={() => onSelect(draft.id)} className="w-full rounded-xl border border-white/10 bg-black/30 p-4 text-left hover:bg-white/5">
              <p className="font-semibold">{draft.title}</p>
              <span className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs capitalize ${statusClass(draft.status)}`}>
                {formatStatus(draft.status)}
              </span>
            </button>
          ))}
          {reviewDrafts.length === 0 ? <p className="text-sm text-white/50">No drafts are currently in review.</p> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-xl font-semibold">Client feedback and activity</h2>
        {!detail ? (
          <p className="mt-4 text-sm text-white/50">Select a review item to see comments and activity.</p>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-3">
              {detail.comments.map((comment) => (
                <div key={comment.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${commentLabelClass(comment)}`}>
                    {commentLabel(comment)}
                  </span>
                  <p className="mt-2 font-semibold">{comment.author_name}</p>
                  <p className="mt-2 text-sm text-white/70">{comment.body}</p>
                </div>
              ))}
              {detail.comments.length === 0 ? <p className="text-sm text-white/50">No comments yet.</p> : null}
            </div>
            <div className="space-y-3">
              {detail.activity.map((item) => (
                <div key={item.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
                  <p className="font-semibold capitalize">{formatStatus(item.activity_type)}</p>
                  <p className="mt-1 text-xs text-white/45">{new Date(item.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AssetReviewCard({
  asset,
  saving,
  onUpdate,
  onReorder,
  onDelete,
  onAddCarouselSlide,
}: {
  asset: ContentReviewAsset;
  saving: boolean;
  onUpdate: (
    asset: ContentReviewAsset,
    updates: Pick<
      Partial<ContentReviewAsset>,
      | "heading"
      | "caption"
      | "is_selected"
      | "sort_order"
      | "display_slot"
      | "crop_x"
      | "crop_y"
      | "crop_zoom"
    >,
  ) => void;
  onReorder: (draggedId: string, targetId: string) => void;
  onDelete: (asset: ContentReviewAsset) => void;
  onAddCarouselSlide: (asset: ContentReviewAsset, files: FileList | null) => void;
}) {
  const [heading, setHeading] = useState(asset.heading ?? "");
  const [caption, setCaption] = useState(asset.caption ?? "");
  const [crop, setCrop] = useState({
    crop_x: asset.crop_x ?? 50,
    crop_y: asset.crop_y ?? 50,
    crop_zoom: asset.crop_zoom ?? 1,
  });
  const selected = asset.is_selected !== false;
  const isImage = asset.asset_type !== "video" && !asset.mime_type?.startsWith("video/");

  useEffect(() => {
    setHeading(asset.heading ?? "");
    setCaption(asset.caption ?? "");
  }, [asset.heading, asset.caption]);

  useEffect(() => {
    setCrop({
      crop_x: asset.crop_x ?? 50,
      crop_y: asset.crop_y ?? 50,
      crop_zoom: asset.crop_zoom ?? 1,
    });
  }, [asset.crop_x, asset.crop_y, asset.crop_zoom]);

  return (
    <div
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", asset.id)}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes("text/plain")) event.preventDefault();
      }}
      onDrop={(event) => {
        const draggedId = event.dataTransfer.getData("text/plain");
        if (!draggedId) return;
        event.preventDefault();
        onReorder(draggedId, asset.id);
      }}
      className={`group rounded-xl border p-3 ${selected ? "border-white/10 bg-black/30" : "border-white/10 bg-black/20 opacity-70"}`}
    >
      <div className="relative">
        <MediaPreview asset={asset} />
        <button
          type="button"
          disabled={saving}
          onClick={() => onDelete(asset)}
          className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-red-400/30 bg-black/80 text-red-100 opacity-100 shadow-lg transition hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
          aria-label={`Delete ${asset.file_name}`}
          title="Delete media"
        >
          <Trash2 size={15} />
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <GripVertical className="shrink-0 text-white/30" size={16} />
          <p className="min-w-0 truncate text-xs text-white/45">
            {asset.file_name}
            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/50">
              Row {(asset.display_slot ?? asset.sort_order) + 1}
            </span>
          </p>
        </div>
        <label className="inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-white/70">
          <input
            type="checkbox"
            checked={selected}
            disabled={saving}
            onChange={(event) => onUpdate(asset, { is_selected: event.target.checked })}
            className="h-4 w-4 rounded border-white/20 bg-black accent-orange-500"
          />
          Use
        </label>
      </div>
      <input
        value={heading}
        onChange={(event) => setHeading(event.target.value)}
        placeholder="Heading for this media item"
        className={`${inputClassName()} mt-3`}
      />
      <textarea
        value={caption}
        onChange={(event) => setCaption(event.target.value)}
        rows={3}
        placeholder="Paragraph for this media item"
        className={`${inputClassName()} mt-3`}
      />
      <button
        type="button"
        disabled={saving || (heading === (asset.heading ?? "") && caption === (asset.caption ?? ""))}
        onClick={() => onUpdate(asset, { heading, caption })}
        className="mt-3 rounded-lg border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Save heading and paragraph
      </button>
      {isImage ? (
        <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10">
          Add carousel slide to this row
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={saving}
            onChange={(event) => {
              onAddCarouselSlide(asset, event.target.files);
              event.target.value = "";
            }}
          />
        </label>
      ) : null}
      {isImage ? (
        <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
          <RangeControl
            label="Crop X"
            min={0}
            max={100}
            step={1}
            value={crop.crop_x}
            onChange={(value) => setCrop((current) => ({ ...current, crop_x: value }))}
          />
          <RangeControl
            label="Crop Y"
            min={0}
            max={100}
            step={1}
            value={crop.crop_y}
            onChange={(value) => setCrop((current) => ({ ...current, crop_y: value }))}
          />
          <RangeControl
            label="Zoom"
            min={1}
            max={2}
            step={0.05}
            value={crop.crop_zoom}
            onChange={(value) => setCrop((current) => ({ ...current, crop_zoom: value }))}
          />
          <button
            type="button"
            disabled={
              saving ||
              (crop.crop_x === (asset.crop_x ?? 50) &&
                crop.crop_y === (asset.crop_y ?? 50) &&
                crop.crop_zoom === (asset.crop_zoom ?? 1))
            }
            onClick={() => onUpdate(asset, crop)}
            className="rounded-lg border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save crop
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs text-white/45">
        <span>{label}</span>
        <span>{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-orange-500"
      />
    </label>
  );
}

function CalendarTab({ drafts }: { drafts: ContentReviewDraft[] }) {
  const scheduled = drafts
    .filter((draft) => draft.scheduled_at)
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-3">
        <CalendarDays className="text-orange-400" size={20} />
        <div>
          <h2 className="text-xl font-semibold">Content Calendar</h2>
          <p className="mt-1 text-sm text-white/45">Scheduled client review items by date.</p>
        </div>
      </div>
      <div className="mt-5 grid gap-3">
        {scheduled.map((draft) => (
          <div key={draft.id} className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{draft.title}</p>
                <p className="mt-1 text-sm text-white/50">{new Date(String(draft.scheduled_at)).toLocaleString()}</p>
              </div>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold capitalize ${statusClass(draft.status)}`}>
                {formatStatus(draft.status)}
              </span>
            </div>
            <Link to={`/admin/content-studio/editor/${draft.id}`} className="mt-3 inline-flex rounded-lg border border-orange-500/20 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/10">
              Open editor
            </Link>
          </div>
        ))}
        {scheduled.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/50">
            No scheduled content yet. Add a schedule date in the editor.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function commentLabel(comment: ContentReviewComment) {
  if (comment.comment_type === "change_request") return "Change Request";
  if (comment.comment_type === "approval_note") return "Approval Note";
  if (comment.author_type === "internal" || comment.visibility === "internal") {
    return "Internal Comment";
  }
  return "Client Comment";
}

function commentLabelClass(comment: ContentReviewComment) {
  if (comment.comment_type === "change_request") {
    return "border-orange-400/30 bg-orange-500/10 text-orange-200";
  }
  if (comment.comment_type === "approval_note") {
    return "border-emerald-400/30 bg-emerald-500/10 text-emerald-200";
  }
  if (comment.author_type === "internal" || comment.visibility === "internal") {
    return "border-white/10 bg-white/10 text-white/75";
  }
  return "border-sky-400/30 bg-sky-500/10 text-sky-200";
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/60">{label}</p>
        <span className="text-orange-400">{icon}</span>
      </div>
      <p className="mt-4 text-3xl font-bold text-white">{value}</p>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue: string;
  type?: string;
}) {
  return (
    <label className="space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/40">{label}</span>
      <input name={name} type={type} defaultValue={defaultValue} className={inputClassName()} />
    </label>
  );
}

function TextField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="space-y-2 md:col-span-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/40">{label}</span>
      <textarea name={name} defaultValue={defaultValue} rows={5} className={inputClassName()} />
    </label>
  );
}
