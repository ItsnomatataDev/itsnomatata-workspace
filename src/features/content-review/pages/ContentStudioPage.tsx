import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, Copy, Image, Loader2, MessageSquare, Plus, Upload } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import {
  addInternalContentReviewComment,
  assertCanUseContentStudio,
  createContentReviewDraft,
  getContentReviewDetail,
  getItsNoMatataOffice,
  inferLayoutType,
  listContentReviewDrafts,
  notifyContentReviewTeam,
  updateContentReviewDraft,
  uploadContentReviewAsset,
  type ContentReviewAsset,
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
  if (asset.asset_type === "video" || asset.mime_type?.startsWith("video/")) {
    return (
      <video
        src={asset.file_url}
        controls
        className="aspect-video w-full rounded-xl border border-white/10 object-cover"
      />
    );
  }

  return (
    <img
      src={asset.file_url}
      alt={asset.caption ?? asset.file_name}
      className="aspect-video w-full rounded-xl border border-white/10 object-cover"
    />
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
  const [saving, setSaving] = useState(false);
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

  const selectedDraft = detail?.draft ?? drafts.find((draft) => draft.id === selectedDraftId) ?? null;
  const assets = detail?.assets ?? [];

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
      const draftData = await listContentReviewDrafts({
        organizationId,
        officeId: office.id,
        status: statusFilter,
      });
      setDrafts(draftData);
      const nextSelected = selectedDraftId ?? draftData[0]?.id ?? null;
      setSelectedDraftId(nextSelected);
      if (nextSelected) {
        const detailData = await getContentReviewDetail({
          organizationId,
          officeId: office.id,
          draftId: nextSelected,
        });
        setDetail(detailData);
      } else {
        setDetail(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load Content Studio.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, profile?.office_id, profile?.primary_role, selectedDraftId, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

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
      setSelectedDraftId(draft.id);
      setMessage("Draft created.");
      await load();
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
    const layoutType =
      detail.assets.length === 1 && bodyText.trim()
        ? inferLayoutType({ assets: detail.assets, body: bodyText })
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
      setMessage("Draft saved.");
      await load();
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
      let order = assets.length;
      for (const file of Array.from(files)) {
        await uploadContentReviewAsset({
          draft: selectedDraft,
          file,
          uploadedBy: userId,
          sortOrder: order,
        });
        order += 1;
      }
      await notifyContentReviewTeam({
        draft: selectedDraft,
        title: "Media uploaded",
        message: `${Array.from(files).length} asset(s) were uploaded for ${selectedDraft.title}.`,
        dedupeKey: `content-media:${selectedDraft.id}:${Date.now()}`,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload media.");
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
      if (status === "ready_for_review" || status === "sent_to_client") {
        await notifyContentReviewTeam({
          draft: updated,
          title: "Content review ready",
          message: `${updated.title} is ready for client review.`,
          dedupeKey: `content-ready:${updated.id}:${status}`,
        });
      }
      await load();
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add comment.");
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
                    </div>
                  ))
                )}
              </div>
            </section>

            {selectedDraft && detail ? (
              <section className="space-y-6">
                <form onSubmit={handleSaveDraft} className="rounded-2xl border border-white/10 bg-white/5 p-5">
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
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {assets.map((asset) => (
                        <MediaPreview key={asset.id} asset={asset} />
                      ))}
                    </div>
                  )}
                </section>

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
              </section>
            ) : (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/50">
                Create or select a draft to begin.
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
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
