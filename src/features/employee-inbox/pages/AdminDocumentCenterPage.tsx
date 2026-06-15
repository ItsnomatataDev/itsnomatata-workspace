import { useCallback, useEffect, useMemo, useState } from "react";
import { FileUp, Mail, MessageSquareText, RefreshCw, Send, Users } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  DOCUMENT_TYPE_OPTIONS,
  documentTypeLabel,
  getAdminDocumentDeliveries,
  getEmployeeDisplayName,
  getEmployeeOptions,
  makeEmployeeDocumentPath,
  sendDocumentToRecipients,
  uploadEmployeeDocumentFile,
  type AdminDocumentDelivery,
  type EmployeeDocumentType,
  type EmployeeOption,
} from "../services/employeeDocumentService";
import { getCompanyOffices } from "../../../lib/supabase/queries/offices";
import type { CompanyOffice } from "../../../lib/offices";

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString();
}

function emailStatusCopy(delivery: AdminDocumentDelivery) {
  const status = delivery.email_delivery?.status ?? "not_queued";
  if (status === "sent") {
    return { label: "Email sent", className: "bg-emerald-500/15 text-emerald-300" };
  }
  if (status === "failed") {
    return { label: "Email failed", className: "bg-red-500/15 text-red-300" };
  }
  if (status === "pending" || status === "processing") {
    return { label: "Email queued", className: "bg-amber-500/15 text-amber-300" };
  }
  return { label: "Inbox only", className: "bg-white/10 text-white/50" };
}

export default function AdminDocumentCenterPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;
  const organizationId = profile?.organization_id ?? null;
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [offices, setOffices] = useState<CompanyOffice[]>([]);
  const [deliveries, setDeliveries] = useState<AdminDocumentDelivery[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [officeFilter, setOfficeFilter] = useState("all");
  const [recipientMode, setRecipientMode] = useState<"selected" | "all">(
    "selected",
  );
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [documentType, setDocumentType] =
    useState<EmployeeDocumentType>("notice");
  const [requiresAcknowledgement, setRequiresAcknowledgement] = useState(false);
  const [isConfidential, setIsConfidential] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPage = useCallback(async () => {
    if (!organizationId) return;
    try {
      setLoading(true);
      setError("");
      const [employeeRows, officeRows, deliveryRows] = await Promise.all([
        getEmployeeOptions(organizationId),
        getCompanyOffices(organizationId),
        getAdminDocumentDeliveries(organizationId),
      ]);
      setEmployees(employeeRows);
      setOffices(officeRows);
      setDeliveries(deliveryRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const officeEmployees = useMemo(
    () =>
      officeFilter === "all"
        ? employees
        : employees.filter((employee) => employee.office_id === officeFilter),
    [employees, officeFilter],
  );

  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return officeEmployees;
    return officeEmployees.filter((employee) =>
      [
        employee.full_name,
        employee.email,
        employee.department,
        employee.primary_role,
        employee.office?.name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [officeEmployees, search]);

  const recipientUserIds =
    recipientMode === "all"
      ? officeEmployees.map((employee) => employee.id)
      : selectedUserIds.filter((userId) =>
          officeEmployees.some((employee) => employee.id === userId),
        );
  const allFilteredSelected =
    filteredEmployees.length > 0 &&
    filteredEmployees.every((employee) => selectedUserIds.includes(employee.id));

  function toggleUser(userId: string) {
    setSelectedUserIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId],
    );
  }

  function toggleAllFilteredEmployees() {
    const filteredIds = filteredEmployees.map((employee) => employee.id);
    setSelectedUserIds((current) =>
      allFilteredSelected
        ? current.filter((userId) => !filteredIds.includes(userId))
        : [...new Set([...current, ...filteredIds])],
    );
  }

  async function handleSend() {
    if (!organizationId || !user?.id) return;
    if (!title.trim()) {
      setError("Document title is required.");
      return;
    }
    if (recipientUserIds.length === 0) {
      setError("Choose at least one recipient.");
      return;
    }

    try {
      setSending(true);
      setError("");
      setSuccess("");
      const documentId = crypto.randomUUID();
      let filePath: string | null = null;
      if (file) {
        filePath = makeEmployeeDocumentPath({
          organizationId,
          documentId,
          fileName: file.name,
        });
        await uploadEmployeeDocumentFile({ path: filePath, file });
      }

      const result = await sendDocumentToRecipients({
        documentId,
        organizationId,
        title: title.trim(),
        message: message.trim() || null,
        documentType,
        filePath,
        fileName: file?.name ?? null,
        mimeType: file?.type || null,
        sizeBytes: file?.size ?? null,
        requiresAcknowledgement,
        isConfidential,
        recipientUserIds,
      });

      setSuccess(`Document delivered to ${result.delivered} recipient(s).`);
      setTitle("");
      setMessage("");
      setDocumentType("notice");
      setRequiresAcknowledgement(false);
      setIsConfidential(true);
      setFile(null);
      setSelectedUserIds([]);
      setRecipientMode("selected");
      await loadPage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send document.");
    } finally {
      setSending(false);
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
                HR Delivery Console
              </p>
              <h1 className="mt-2 text-3xl font-bold">Document Center</h1>
              <p className="mt-2 text-sm text-white/50">
                Send private documents to employee inboxes with delivery tracking.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadPage()}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/10"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
            <section className="rounded-3xl border border-white/10 bg-neutral-950 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-400">
                  <FileUp size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Create and Send</h2>
                  <p className="text-sm text-white/45">
                    Files are uploaded to the private employee-documents bucket.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2">
                  <span className="text-sm text-white/60">Title</span>
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    placeholder="April 2026 payslip, HR notice..."
                  />
                </label>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm text-white/60">Document type</span>
                    <select
                      value={documentType}
                      onChange={(event) =>
                        setDocumentType(event.target.value as EmployeeDocumentType)
                      }
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      {DOCUMENT_TYPE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-sm text-white/60">Attachment</span>
                    <input
                      type="file"
                      onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-black"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm text-white/60">Message</span>
                  <textarea
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    rows={5}
                    className="resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    placeholder="Optional message employees will see before opening the file."
                  />
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={requiresAcknowledgement}
                      onChange={(event) =>
                        setRequiresAcknowledgement(event.target.checked)
                      }
                      className="h-4 w-4 accent-orange-500"
                    />
                    Requires acknowledgement
                  </label>
                  <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white/70">
                    <input
                      type="checkbox"
                      checked={isConfidential}
                      onChange={(event) => setIsConfidential(event.target.checked)}
                      className="h-4 w-4 accent-orange-500"
                    />
                    Confidential
                  </label>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">Recipients</h3>
                      <p className="text-sm text-white/45">
                        {recipientUserIds.length} selected from {officeEmployees.length} employee(s) in scope
                      </p>
                    </div>
                    <div className="flex rounded-2xl border border-white/10 bg-white/5 p-1">
                      <button
                        type="button"
                        onClick={() => setRecipientMode("selected")}
                        className={[
                          "rounded-xl px-3 py-2 text-xs font-semibold",
                          recipientMode === "selected"
                            ? "bg-orange-500 text-black"
                            : "text-white/60",
                        ].join(" ")}
                      >
                        Selected
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecipientMode("all")}
                        className={[
                          "rounded-xl px-3 py-2 text-xs font-semibold",
                          recipientMode === "all"
                            ? "bg-orange-500 text-black"
                            : "text-white/60",
                        ].join(" ")}
                      >
                        All employees
                      </button>
                    </div>
                  </div>

                  <label className="mt-4 grid gap-2">
                    <span className="text-sm text-white/60">Office filter</span>
                    <select
                      value={officeFilter}
                      onChange={(event) => {
                        setOfficeFilter(event.target.value);
                        setRecipientMode("selected");
                      }}
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      <option value="all">All offices</option>
                      {offices.map((office) => (
                        <option key={office.id} value={office.id}>
                          {office.name}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs text-white/40">
                      All employees and select-all only apply to the selected office.
                    </span>
                  </label>

                  {recipientMode === "selected" ? (
                    <>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <input
                          value={search}
                          onChange={(event) => setSearch(event.target.value)}
                          placeholder="Search employees"
                          className="min-w-[220px] flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-orange-500"
                        />
                        <button
                          type="button"
                          onClick={toggleAllFilteredEmployees}
                          disabled={filteredEmployees.length === 0}
                          className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 hover:bg-white/5 disabled:opacity-50"
                        >
                          {allFilteredSelected ? "Unselect visible" : "Select all visible"}
                        </button>
                      </div>
                      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                        {filteredEmployees.map((employee) => (
                          <label
                            key={employee.id}
                            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                          >
                            <input
                              type="checkbox"
                              checked={selectedUserIds.includes(employee.id)}
                              onChange={() => toggleUser(employee.id)}
                              className="h-4 w-4 accent-orange-500"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {getEmployeeDisplayName(employee)}
                              </p>
                              <p className="truncate text-xs text-white/40">
                                {employee.email || "No email"} ·{" "}
                                {employee.office?.name || "No office"} ·{" "}
                                {employee.department || employee.primary_role || "Employee"}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="mt-4 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4 text-sm text-orange-100">
                      This will send to every visible employee in the selected office filter.
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  disabled={sending}
                  onClick={() => void handleSend()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-black disabled:opacity-60"
                >
                  <Send size={16} />
                  {sending ? "Sending..." : "Send document"}
                </button>
              </div>
            </section>

            <aside className="space-y-4">
              <div className="rounded-3xl border border-white/10 bg-neutral-950 p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <Users size={18} className="text-orange-400" />
                  <div>
                    <h2 className="font-semibold">Delivery Tracking</h2>
                    <p className="text-sm text-white/45">
                      Latest employee document deliveries.
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {loading ? (
                    <p className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/50">
                      Loading deliveries...
                    </p>
                  ) : deliveries.length === 0 ? (
                    <p className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/50">
                      No deliveries yet.
                    </p>
                  ) : (
                    deliveries.slice(0, 18).map((delivery) => {
                      const email = emailStatusCopy(delivery);
                      return (
                        <div
                          key={delivery.id}
                          className="rounded-2xl border border-white/10 bg-black/40 p-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {delivery.document.title}
                              </p>
                              <p className="mt-0.5 truncate text-xs text-white/40">
                                {delivery.user_name || delivery.user_email || delivery.user_id}
                              </p>
                            </div>
                            <span className="rounded-full bg-white/10 px-2 py-1 text-[10px] capitalize text-white/70">
                              {delivery.status}
                            </span>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <span
                              className={[
                                "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
                                email.className,
                              ].join(" ")}
                            >
                              <Mail size={10} />
                              {email.label}
                            </span>
                            {delivery.acknowledgement_note ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-300">
                                <MessageSquareText size={10} />
                                Note
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-[11px] text-white/35">
                            {documentTypeLabel(delivery.document.document_type)} ·{" "}
                            {formatDate(delivery.delivered_at)}
                          </p>
                          {delivery.acknowledgement_note ? (
                            <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded-xl border border-emerald-500/15 bg-emerald-500/10 p-2 text-[11px] text-emerald-100/80">
                              {delivery.acknowledgement_note}
                            </p>
                          ) : null}
                          {delivery.email_delivery?.last_error ? (
                            <p className="mt-2 line-clamp-3 whitespace-pre-wrap rounded-xl border border-red-500/20 bg-red-500/10 p-2 text-[11px] text-red-200">
                              {delivery.email_delivery.last_error}
                            </p>
                          ) : null}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
}
