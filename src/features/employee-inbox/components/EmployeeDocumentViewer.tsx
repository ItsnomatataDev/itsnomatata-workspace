import { useEffect, useState } from "react";
import { Archive, CheckCircle2, Download, FileText, X } from "lucide-react";
import {
  acknowledgeDocument,
  archiveDocument,
  documentTypeLabel,
  downloadDocument,
  getSignedDocumentUrl,
  markDocumentRead,
  type MyEmployeeDocument,
} from "../services/employeeDocumentService";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

export default function EmployeeDocumentViewer({
  item,
  onClose,
  onChanged,
}: {
  item: MyEmployeeDocument;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setSignedUrl(null);
    setError("");

    void markDocumentRead(item)
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to mark as read.");
        }
      })
      .finally(onChanged);

    void getSignedDocumentUrl(item.document)
      .then((url) => {
        if (mounted) setSignedUrl(url);
      })
      .catch((err) => {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load secure preview.");
        }
      });

    return () => {
      mounted = false;
    };
  }, [item, onChanged]);

  const canPreviewPdf = item.document.mime_type?.includes("pdf") && signedUrl;
  const canPreviewImage = item.document.mime_type?.startsWith("image/") && signedUrl;
  const acknowledged = item.status === "acknowledged" || Boolean(item.acknowledged_at);

  async function handleAcknowledge() {
    try {
      setBusy(true);
      setError("");
      await acknowledgeDocument(item, note);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to acknowledge document.");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive() {
    try {
      setBusy(true);
      setError("");
      await archiveDocument(item);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive document.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload() {
    try {
      setBusy(true);
      setError("");
      await downloadDocument(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download document.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 px-4 py-4 backdrop-blur sm:px-6">
      <div className="mx-auto max-w-5xl rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 p-4 sm:p-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300">
                {documentTypeLabel(item.document.document_type)}
              </span>
              {item.document.is_confidential ? (
                <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
                  Confidential
                </span>
              ) : null}
              {item.document.requires_acknowledgement ? (
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                  Acknowledgement required
                </span>
              ) : null}
            </div>
            <h2 className="mt-3 break-words text-2xl font-bold text-white">
              {item.document.title}
            </h2>
            <p className="mt-1 text-sm text-white/45">
              Delivered {formatDate(item.delivered_at)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 bg-white/5 p-2 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close document"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-h-[420px] overflow-hidden rounded-2xl border border-white/10 bg-black/60">
            {canPreviewPdf ? (
              <iframe
                src={signedUrl}
                className="h-[70vh] min-h-[420px] w-full"
                title={item.document.title}
              />
            ) : canPreviewImage ? (
              <div className="flex min-h-[420px] items-center justify-center p-4">
                <img
                  src={signedUrl}
                  alt={item.document.title}
                  className="max-h-[70vh] max-w-full rounded-xl object-contain"
                />
              </div>
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center p-8 text-center">
                <FileText size={42} className="text-orange-400" />
                <p className="mt-4 text-sm text-white/60">
                  Preview is not available for this file type.
                </p>
                {item.document.file_name ? (
                  <p className="mt-2 break-all text-xs text-white/40">
                    {item.document.file_name}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-orange-400">
                Message
              </p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/70">
                {item.document.message || "No message included."}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-orange-400">
                Status
              </p>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-white/45">Current</dt>
                  <dd className="capitalize text-white">{item.status}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/45">Read</dt>
                  <dd className="text-right text-white/70">{formatDate(item.read_at)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-white/45">Acknowledged</dt>
                  <dd className="text-right text-white/70">
                    {formatDate(item.acknowledged_at)}
                  </dd>
                </div>
              </dl>
            </div>

            {item.document.requires_acknowledgement && !acknowledged ? (
              <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
                <p className="text-sm font-semibold text-orange-200">
                  Acknowledgement required
                </p>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={3}
                  placeholder="Optional note"
                  className="mt-3 w-full resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleAcknowledge()}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                >
                  <CheckCircle2 size={16} />
                  Acknowledge
                </button>
              </div>
            ) : item.document.requires_acknowledgement ? (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                This document has been acknowledged.
              </div>
            ) : null}

            {error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            <div className="grid gap-2">
              <button
                type="button"
                disabled={busy || !item.document.file_path}
                onClick={() => void handleDownload()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-60"
              >
                <Download size={16} />
                Download
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleArchive()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/5 disabled:opacity-60"
              >
                <Archive size={16} />
                Archive
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
