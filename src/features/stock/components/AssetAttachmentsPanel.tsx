import { useEffect, useState } from "react";
import {
  fetchAssetAttachments,
  addAssetAttachment,
  removeAssetAttachment,
  uploadAttachmentFile,
} from "../services/assetAttachmentService";

interface AttachmentItem {
  id: string;
  attachment_type: string;
  file_name: string;
  file_url: string;
  notes?: string | null;
  created_at: string;
  uploaded_profile?: {
    full_name?: string | null;
    email?: string | null;
  } | null;
}

export default function AssetAttachmentsPanel({
  assetId,
  organizationId,
  userId,
}: {
  assetId: string;
  organizationId: string;
  userId?: string | null;
}) {
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attachmentType, setAttachmentType] = useState("other");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  async function loadAttachments() {
    setLoading(true);
    setError("");

    try {
      const data = await fetchAssetAttachments(assetId);
      setAttachments(data as AttachmentItem[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load attachments.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAttachments();
  }, [assetId]);

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setError("Choose a file first.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const uploaded = await uploadAttachmentFile({
        file,
        assetId,
      });

      await addAssetAttachment({
        organization_id: organizationId,
        asset_id: assetId,
        attachment_type: attachmentType as
          | "invoice"
          | "receipt"
          | "warranty"
          | "insurance"
          | "manual"
          | "image"
          | "other",
        file_name: file.name,
        file_url: uploaded.publicUrl,
        mime_type: file.type || null,
        file_size_bytes: file.size ?? null,
        notes: notes.trim() || null,
        uploaded_by: userId ?? null,
      });

      setFile(null);
      setNotes("");
      setAttachmentType("other");
      await loadAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const confirmed = window.confirm("Delete this attachment?");
    if (!confirmed) return;

    await removeAssetAttachment(id);
    await loadAttachments();
  }

  return (
    <section className="border border-white/10 bg-black p-5">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">Attachments</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Upload invoices, warranty documents, insurance files, manuals, and
          images.
        </p>
      </div>

      {error ? (
        <div className="mb-4 border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <form
        onSubmit={handleUpload}
        className="grid gap-4 border border-white/10 p-4 md:grid-cols-2 xl:grid-cols-4"
      >
        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Attachment Type</span>
          <select
            value={attachmentType}
            onChange={(e) => setAttachmentType(e.target.value)}
            className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
          >
            <option value="invoice">Invoice</option>
            <option value="receipt">Receipt</option>
            <option value="warranty">Warranty</option>
            <option value="insurance">Insurance</option>
            <option value="manual">Manual</option>
            <option value="image">Image</option>
            <option value="other">Other</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm text-zinc-300">Choose File</span>
          <input
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none file:mr-3 file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-black"
          />
        </label>

        <label className="space-y-2 xl:col-span-2">
          <span className="text-sm text-zinc-300">Notes</span>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
            placeholder="Optional notes..."
          />
        </label>

        <div className="xl:col-span-4">
          <button
            type="submit"
            disabled={saving}
            className="border border-orange-500 bg-orange-500 px-5 py-3 text-sm font-medium text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Uploading..." : "Upload Attachment"}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-3">
        {loading ? (
          <div className="text-sm text-zinc-400">Loading attachments...</div>
        ) : null}

        {!loading && !attachments.length ? (
          <div className="text-sm text-zinc-500">No attachments yet.</div>
        ) : null}

        {attachments.map((item) => (
          <div
            key={item.id}
            className="flex flex-col gap-3 border border-white/10 p-4 lg:flex-row lg:items-center lg:justify-between"
          >
            <div>
              <p className="text-sm font-medium text-white">{item.file_name}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-orange-300">
                {item.attachment_type}
              </p>
              <p className="mt-1 text-sm text-zinc-400">{item.notes || "—"}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href={item.file_url}
                target="_blank"
                rel="noreferrer"
                className="border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:border-white/20 hover:text-white"
              >
                Open
              </a>

              <button
                type="button"
                onClick={() => void handleDelete(item.id)}
                className="border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
