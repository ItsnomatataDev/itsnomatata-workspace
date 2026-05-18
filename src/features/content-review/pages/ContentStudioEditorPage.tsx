import { ArrowLeft, Eye, GripVertical, Loader2, Save, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import { ContentReviewRenderer } from "../components/ContentReviewRenderer";
import {
  assertCanUseContentStudio,
  deleteContentReviewDraft,
  getContentReviewDetail,
  listContentClients,
  inferLayoutType,
  notifyContentReviewTeam,
  updateContentReviewAsset,
  updateContentReviewDraft,
  type ContentReviewAsset,
  type ContentClient,
  type ContentReviewDetail,
  type ContentReviewDraft,
  type ContentReviewLayout,
} from "../services/contentReviewService";

type PreviewMode = "desktop" | "mobile";

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
  return "w-full rounded-xl border border-white/10 bg-black px-3 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-400/70";
}

function formatStatus(status: string) {
  return status.replace(/_/g, " ");
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

export default function ContentStudioEditorPage() {
  const { draftId = "" } = useParams();
  const auth = useAuth();
  const navigate = useNavigate();
  const profile = auth.profile;
  const organizationId = profile?.organization_id ?? null;
  const [officeId, setOfficeId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContentReviewDetail | null>(null);
  const [clients, setClients] = useState<ContentClient[]>([]);
  const [form, setForm] = useState<ReturnType<typeof draftToForm> | null>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

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
      setClients(await listContentClients({ organizationId, officeId: office.id }));
      const nextDetail = await getContentReviewDetail({
        organizationId,
        officeId: office.id,
        draftId,
      });
      setDetail(nextDetail);
      setForm(draftToForm(nextDetail.draft));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load editor.");
    } finally {
      setLoading(false);
    }
  }, [draftId, organizationId, profile?.office_id, profile?.primary_role]);

  useEffect(() => {
    void load();
  }, [load]);

  const draftPreview = useMemo(() => {
    if (!detail || !form) return null;
    const selectedAssets = detail.assets.filter((asset) => asset.is_selected !== false);
    const layoutType =
      selectedAssets.length === 1 && form.body.trim()
        ? inferLayoutType({ assets: selectedAssets, body: form.body })
        : form.layout_type;
    return {
      ...detail.draft,
      ...form,
      layout_type: layoutType,
      scheduled_at: form.scheduled_at ? new Date(form.scheduled_at).toISOString() : null,
    } satisfies ContentReviewDraft;
  }, [detail, form]);

  function updateForm<K extends keyof NonNullable<typeof form>>(key: K, value: NonNullable<typeof form>[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  async function updateAsset(
    asset: ContentReviewAsset,
    updates: Pick<
      Partial<ContentReviewAsset>,
      "heading" | "caption" | "is_selected" | "sort_order" | "crop_x" | "crop_y" | "crop_zoom"
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

  async function reorderAssets(draggedId: string, targetId: string) {
    if (!detail || draggedId === targetId) return;
    const fromIndex = detail.assets.findIndex((asset) => asset.id === draggedId);
    const toIndex = detail.assets.findIndex((asset) => asset.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;

    const reordered = [...detail.assets];
    const [dragged] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, dragged);
    const orderedAssets = reordered.map((asset, index) => ({ ...asset, sort_order: index }));
    setDetail({ ...detail, assets: orderedAssets });

    try {
      setSaving(true);
      await Promise.all(
        orderedAssets.map((asset) =>
          updateContentReviewAsset(asset.id, { sort_order: asset.sort_order }),
        ),
      );
      setMessage("Media order updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder media.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft(nextStatus?: ContentReviewDraft["status"]) {
    if (!detail || !draftPreview || !form) return;
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
      setForm(draftToForm(updated));
      setMessage(nextStatus ? "Draft saved and sent for review." : "Draft saved.");
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
    const confirmed = window.confirm(`Delete "${detail.draft.title}" and its uploaded media? Clients will no longer be able to access it.`);
    if (!confirmed) return;
    try {
      setSaving(true);
      await deleteContentReviewDraft(detail.draft.id);
      navigate("/admin/content-studio");
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
        Loading editor...
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

  if (!detail || !form || !draftPreview) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-black/95 px-4 py-3 backdrop-blur sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => navigate("/admin/content-studio")}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10"
              aria-label="Back to Content Studio"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.25em] text-orange-400">
                Content Studio Editor
              </p>
              <h1 className="truncate text-lg font-semibold">{draftPreview.title}</h1>
            </div>
            <span className="rounded-full bg-orange-500 px-3 py-1 text-xs font-bold capitalize text-black">
              {formatStatus(draftPreview.status)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreviewMode(previewMode === "desktop" ? "mobile" : "desktop")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10"
            >
              <Eye size={16} />
              {previewMode === "desktop" ? "Desktop preview" : "Mobile preview"}
            </button>
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold hover:bg-white/10 disabled:opacity-60"
            >
              <Save size={16} />
              Save
            </button>
            <button
              type="button"
              onClick={() => void saveDraft("sent_to_client")}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-60"
            >
              <Send size={16} />
              Send for review
            </button>
            <button
              type="button"
              onClick={() => void deleteDraft()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/15 disabled:opacity-60"
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      </header>

      <div className="grid min-h-[calc(100vh-73px)] gap-0 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="border-b border-white/10 bg-black p-4 xl:border-b-0 xl:border-r xl:p-6">
          {message ? (
            <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm text-emerald-200">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          <div className="space-y-4">
            <Field label="Title" value={form.title} onChange={(value) => updateForm("title", value)} />
            <Field label="Subtitle" value={form.subtitle} onChange={(value) => updateForm("subtitle", value)} />
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">Client</span>
              <select
                value={form.client_id}
                onChange={(event) => updateForm("client_id", event.target.value)}
                className={inputClassName()}
              >
                <option value="">Unassigned</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>{client.company_name}</option>
                ))}
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-white/40">Layout</span>
              <select
                value={form.layout_type}
                onChange={(event) => updateForm("layout_type", event.target.value as ContentReviewLayout)}
                className={inputClassName()}
              >
                {layouts.map((layout) => (
                  <option key={layout} value={layout}>{formatStatus(layout)}</option>
                ))}
              </select>
            </label>
            <TextArea label="Body text" value={form.body} onChange={(value) => updateForm("body", value)} rows={8} />
            <TextArea label="Main caption" value={form.captions} onChange={(value) => updateForm("captions", value)} rows={3} />
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div>
                <h2 className="text-sm font-semibold">Media text</h2>
                <p className="mt-1 text-xs text-white/45">
                  Choose which uploaded items appear in the review and add text per item.
                </p>
              </div>
              {detail.assets.length === 0 ? (
                <p className="rounded-lg border border-white/10 bg-black/30 p-3 text-xs text-white/45">
                  No media uploaded yet.
                </p>
              ) : (
                detail.assets.map((asset) => (
                  <AssetTextEditor
                    key={asset.id}
                    asset={asset}
                    saving={saving}
                    onUpdate={updateAsset}
                    onReorder={reorderAssets}
                  />
                ))
              )}
            </div>
            <Field label="Schedule date" type="datetime-local" value={form.scheduled_at} onChange={(value) => updateForm("scheduled_at", value)} />
            <Field label="CTA label" value={form.cta_label} onChange={(value) => updateForm("cta_label", value)} />
            <Field label="CTA URL" value={form.cta_url} onChange={(value) => updateForm("cta_url", value)} />
          </div>
          <Link
            to="/admin/content-studio/uploads"
            className="mt-5 inline-flex rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm font-semibold text-orange-200 hover:bg-orange-500/15"
          >
            Manage media uploads
          </Link>
        </aside>

        <section className="min-w-0 bg-neutral-100 p-4 text-neutral-950 sm:p-6 lg:p-8">
          <div className={previewMode === "mobile" ? "mx-auto max-w-[390px]" : "mx-auto max-w-6xl"}>
            <ContentReviewRenderer
              draft={draftPreview}
              assets={detail.assets as ContentReviewAsset[]}
              theme="public"
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function AssetTextEditor({
  asset,
  saving,
  onUpdate,
  onReorder,
}: {
  asset: ContentReviewAsset;
  saving: boolean;
  onUpdate: (
    asset: ContentReviewAsset,
    updates: Pick<
      Partial<ContentReviewAsset>,
      "heading" | "caption" | "is_selected" | "sort_order" | "crop_x" | "crop_y" | "crop_zoom"
    >,
  ) => void;
  onReorder: (draggedId: string, targetId: string) => void;
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
      className={`rounded-lg border p-3 ${selected ? "border-white/10 bg-black/30" : "border-white/10 bg-black/20 opacity-70"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-2">
          <GripVertical className="mt-0.5 shrink-0 text-white/30" size={16} />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white/75">{asset.file_name}</p>
            <p className="mt-1 text-[11px] capitalize text-white/35">{asset.asset_type}</p>
          </div>
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-white/40">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={rows} className={inputClassName()} />
    </label>
  );
}
