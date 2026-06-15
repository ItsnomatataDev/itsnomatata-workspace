import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Download, FileText, Inbox, Mail, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import EmployeeDocumentViewer from "../components/EmployeeDocumentViewer";
import {
  archiveDocument,
  documentTypeLabel,
  downloadDocument,
  getMyDocuments,
  type EmployeeDocumentType,
  type MyEmployeeDocument,
} from "../services/employeeDocumentService";

type InboxFilter =
  | "all"
  | "unread"
  | "payslip"
  | "warning"
  | "letter"
  | "policy"
  | "announcement";

const filters: Array<{ id: InboxFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "payslip", label: "Payslips" },
  { id: "warning", label: "Warnings" },
  { id: "letter", label: "Letters" },
  { id: "policy", label: "Policies" },
  { id: "announcement", label: "Announcements" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZW", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function emailBadge(item: MyEmployeeDocument) {
  const status = item.email_delivery?.status ?? "not_queued";
  if (status === "sent") {
    return { label: "Email sent", className: "bg-emerald-500/15 text-emerald-300" };
  }
  if (status === "failed") {
    return { label: "Email failed", className: "bg-red-500/15 text-red-300" };
  }
  if (status === "pending" || status === "processing") {
    return { label: "Email queued", className: "bg-amber-500/15 text-amber-300" };
  }
  return { label: "Inbox only", className: "bg-white/10 text-white/55" };
}

export default function EmployeeInboxPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<MyEmployeeDocument[]>([]);
  const [selected, setSelected] = useState<MyEmployeeDocument | null>(null);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadDocuments = useCallback(
    async (options?: { showLoading?: boolean }) => {
      try {
        if (options?.showLoading !== false) {
          setLoading(true);
        }
        setError("");
        const rows = await getMyDocuments();
        setItems(rows);
        const documentId = searchParams.get("documentId");
        setSelected((current) => {
          if (documentId) {
            return rows.find((row) => row.document_id === documentId) ?? current;
          }
          return current;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load inbox.");
      } finally {
        if (options?.showLoading !== false) {
          setLoading(false);
        }
      }
    },
    [searchParams],
  );

  const handleDocumentChanged = useCallback(() => {
    void loadDocuments({ showLoading: false });
  }, [loadDocuments]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const unreadCount = items.filter((item) => item.status === "unread").length;
  const acknowledgementCount = items.filter(
    (item) =>
      item.document.requires_acknowledgement &&
      item.status !== "acknowledged",
  ).length;

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      if (filter === "unread" && item.status !== "unread") return false;
      if (
        filter !== "all" &&
        filter !== "unread" &&
        item.document.document_type !== filter
      ) {
        return false;
      }
      if (!term) return item.status !== "archived";
      return (
        item.document.title.toLowerCase().includes(term) ||
        (item.document.message ?? "").toLowerCase().includes(term) ||
        (item.acknowledgement_note ?? "").toLowerCase().includes(term) ||
        (item.email_delivery?.recipient_email ?? "").toLowerCase().includes(term) ||
        documentTypeLabel(item.document.document_type).toLowerCase().includes(term)
      );
    });
  }, [filter, items, search]);

  async function handleArchive(item: MyEmployeeDocument) {
    try {
      setBusyId(item.id);
      await archiveDocument(item);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to archive document.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(item: MyEmployeeDocument) {
    try {
      setBusyId(item.id);
      await downloadDocument(item);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download document.");
    } finally {
      setBusyId(null);
    }
  }

  if (!auth?.user || !profile) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-orange-500">
                Secure Inbox
              </p>
              <h1 className="mt-2 text-3xl font-bold">Employee Inbox</h1>
              <p className="mt-2 text-sm text-white/50">
                Private HR documents, payslips, notices, and acknowledgements.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-white/45">Unread</p>
                <p className="mt-1 text-2xl font-bold text-orange-400">
                  {unreadCount}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs text-white/45">Need acknowledgement</p>
                <p className="mt-1 text-2xl font-bold text-white">
                  {acknowledgementCount}
                </p>
              </div>
            </div>
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={[
                    "shrink-0 rounded-2xl px-4 py-2.5 text-sm font-medium transition",
                    filter === item.id
                      ? "bg-orange-500 text-black"
                      : "border border-white/10 bg-white/5 text-white/70 hover:bg-white/10",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5">
              <Search size={16} className="text-white/35" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search documents"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-white/35"
              />
            </label>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading inbox...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-[260px] flex-col items-center justify-center rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
              <Inbox size={38} className="text-orange-400" />
              <h2 className="mt-4 text-lg font-semibold">No documents found</h2>
              <p className="mt-2 text-sm text-white/45">
                New HR documents and payslips will appear here.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filteredItems.map((item) => {
                const unread = item.status === "unread";
                const requiresAck =
                  item.document.requires_acknowledgement &&
                  item.status !== "acknowledged";

                const email = emailBadge(item);

                return (
                  <article
                    key={item.id}
                    className={[
                      "rounded-3xl border p-4 transition hover:border-orange-500/30 sm:p-5",
                      unread
                        ? "border-orange-500/25 bg-orange-500/10"
                        : "border-white/10 bg-white/5",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-4">
                      <div className="rounded-2xl bg-black/50 p-3 text-orange-400">
                        <FileText size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/70">
                            {documentTypeLabel(item.document.document_type)}
                          </span>
                          {unread ? (
                            <span className="rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-semibold text-black">
                              Unread
                            </span>
                          ) : null}
                          {requiresAck ? (
                            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
                              Action needed
                            </span>
                          ) : null}
                          {item.acknowledgement_note ? (
                            <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                              Note saved
                            </span>
                          ) : null}
                          <span
                            className={[
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold",
                              email.className,
                            ].join(" ")}
                          >
                            <Mail size={11} />
                            {email.label}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(item);
                            setSearchParams({ documentId: item.document_id });
                          }}
                          className="mt-3 block w-full text-left"
                        >
                          <h2 className="wrap-break-word text-lg font-semibold text-white">
                            {item.document.title}
                          </h2>
                          <p className="mt-1 line-clamp-2 text-sm text-white/50">
                            {item.document.message || "No message included."}
                          </p>
                        </button>
                        <p className="mt-3 text-xs text-white/35">
                          Delivered {formatDate(item.delivered_at)}
                        </p>
                        {item.acknowledgement_note ? (
                          <p className="mt-3 line-clamp-2 rounded-2xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100/80">
                            {item.acknowledgement_note}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(item);
                          setSearchParams({ documentId: item.document_id });
                        }}
                        className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black"
                      >
                        View
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id || !item.document.file_path}
                        onClick={() => void handleDownload(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 disabled:opacity-60"
                      >
                        <Download size={13} />
                        Download
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        onClick={() => void handleArchive(item)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/50 hover:bg-white/5 disabled:opacity-60"
                      >
                        <Archive size={13} />
                        Archive
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {selected ? (
        <EmployeeDocumentViewer
          item={selected}
          onClose={() => {
            setSelected(null);
            setSearchParams({});
          }}
          onChanged={handleDocumentChanged}
        />
      ) : null}
    </div>
  );
}
