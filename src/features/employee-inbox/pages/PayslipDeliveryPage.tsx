import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileArchive, Send, UploadCloud, XCircle } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import {
  createPayslipBatch,
  createPayslipBatchItem,
  deliverPayslipBatch,
  getEmployeeOptions,
  getPayslipBatchItems,
  makePayslipPath,
  matchPayslipFiles,
  uploadEmployeeDocumentFile,
  type EmployeeOption,
  type PayslipBatch,
  type PayslipBatchItem,
} from "../services/employeeDocumentService";

const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function PayslipDeliveryPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const user = auth?.user ?? null;
  const organizationId = profile?.organization_id ?? null;
  const currentDate = new Date();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [batch, setBatch] = useState<PayslipBatch | null>(null);
  const [items, setItems] = useState<PayslipBatchItem[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [payrollMonth, setPayrollMonth] = useState(currentDate.getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(currentDate.getFullYear());
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!organizationId) return;
    void getEmployeeOptions(organizationId)
      .then(setEmployees)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load employees."),
      )
      .finally(() => setLoading(false));
  }, [organizationId]);

  const matches = useMemo(
    () => matchPayslipFiles(files, employees),
    [employees, files],
  );

  const matchedCount = matches.filter((item) => item.matchStatus === "matched").length;
  const unmatchedCount = matches.length - matchedCount;
  const deliveredCount = items.filter((item) => item.match_status === "delivered").length;
  const failedCount = items.filter((item) => item.match_status === "failed").length;

  async function handleCreateAndUpload() {
    if (!organizationId || !user?.id || files.length === 0) return;
    try {
      setProcessing(true);
      setError("");
      setSuccess("");

      const created = await createPayslipBatch({
        organizationId,
        title: `${monthOptions[payrollMonth - 1]} ${payrollYear} Payslips`,
        payrollMonth,
        payrollYear,
        createdBy: user.id,
      });
      setBatch(created);

      const createdItems: PayslipBatchItem[] = [];
      for (const match of matches) {
        const employee = match.employee;
        const userIdOrMatchKey = employee?.id ?? crypto.randomUUID();
        const path = makePayslipPath({
          organizationId,
          payrollYear,
          payrollMonth,
          userIdOrMatchKey,
          fileName: match.file.name,
        });
        await uploadEmployeeDocumentFile({ path, file: match.file });
        const item = await createPayslipBatchItem({
          organizationId,
          batchId: created.id,
          userId: employee?.id ?? null,
          employeeEmail: employee?.email ?? null,
          employeeName: employee?.full_name ?? null,
          fileName: match.file.name,
          filePath: path,
          matchStatus: match.matchStatus,
          errorMessage: match.errorMessage,
        });
        createdItems.push(item);
      }

      setItems(createdItems);
      setSuccess("Payslip batch created. Review matches, then deliver matched payslips.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create payslip batch.");
    } finally {
      setProcessing(false);
    }
  }

  async function handleDeliver() {
    if (!batch) return;
    try {
      setProcessing(true);
      setError("");
      setSuccess("");
      const result = await deliverPayslipBatch(batch.id);
      setSuccess(
        `Delivered ${result.delivered} payslip(s). ${result.failed} failed.`,
      );
      setItems(await getPayslipBatchItems(batch.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deliver payslips.");
    } finally {
      setProcessing(false);
    }
  }

  if (!auth?.user || !profile) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.32em] text-orange-500">
              Payroll Delivery
            </p>
            <h1 className="mt-2 text-3xl font-bold">Payslip Delivery</h1>
            <p className="mt-2 text-sm text-white/50">
              Upload PDFs, match them to employees, and deliver through secure inboxes.
            </p>
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

          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <section className="rounded-3xl border border-white/10 bg-neutral-950 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-400">
                  <UploadCloud size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Create Batch</h2>
                  <p className="text-sm text-white/45">
                    Match by employee email or full name in filename.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-sm text-white/60">Month</span>
                    <select
                      value={payrollMonth}
                      onChange={(event) => setPayrollMonth(Number(event.target.value))}
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    >
                      {monthOptions.map((month, index) => (
                        <option key={month} value={index + 1}>
                          {month}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm text-white/60">Year</span>
                    <input
                      type="number"
                      value={payrollYear}
                      onChange={(event) => setPayrollYear(Number(event.target.value))}
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm outline-none focus:border-orange-500"
                    />
                  </label>
                </div>

                <label className="grid gap-2">
                  <span className="text-sm text-white/60">Payslip PDFs</span>
                  <input
                    type="file"
                    multiple
                    accept="application/pdf"
                    onChange={(event) =>
                      setFiles(Array.from(event.target.files ?? []))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-black"
                  />
                </label>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-center">
                    <p className="text-2xl font-bold">{files.length}</p>
                    <p className="text-[11px] text-white/40">Files</p>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
                    <p className="text-2xl font-bold text-emerald-300">
                      {matchedCount}
                    </p>
                    <p className="text-[11px] text-emerald-200/70">Matched</p>
                  </div>
                  <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-center">
                    <p className="text-2xl font-bold text-amber-300">
                      {unmatchedCount}
                    </p>
                    <p className="text-[11px] text-amber-200/70">Review</p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={processing || files.length === 0}
                  onClick={() => void handleCreateAndUpload()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-bold text-black disabled:opacity-60"
                >
                  <FileArchive size={16} />
                  Create batch and upload
                </button>

                <button
                  type="button"
                  disabled={processing || !batch || matchedCount === 0}
                  onClick={() => void handleDeliver()}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  <Send size={16} />
                  Deliver matched payslips
                </button>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-neutral-950 p-4 sm:p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Match Preview</h2>
                  <p className="text-sm text-white/45">
                    Confirm filename-to-employee matching before delivery.
                  </p>
                </div>
                {batch ? (
                  <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-300">
                    {batch.status}
                  </span>
                ) : null}
              </div>

              {loading ? (
                <p className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/50">
                  Loading employees...
                </p>
              ) : files.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/50">
                  Upload payslip PDFs to preview matching.
                </p>
              ) : (
                <div className="space-y-2">
                  {matches.map((match) => (
                    <div
                      key={match.file.name}
                      className="rounded-2xl border border-white/10 bg-black/40 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {match.file.name}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            {match.employee
                              ? `${match.employee.full_name || "Unnamed"} · ${match.employee.email || "No email"}`
                              : match.errorMessage}
                          </p>
                        </div>
                        <span
                          className={[
                            "inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold",
                            match.matchStatus === "matched"
                              ? "bg-emerald-500/15 text-emerald-300"
                              : "bg-amber-500/15 text-amber-300",
                          ].join(" ")}
                        >
                          {match.matchStatus === "matched" ? (
                            <CheckCircle2 size={13} />
                          ) : (
                            <XCircle size={13} />
                          )}
                          {match.matchStatus}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {items.length > 0 ? (
                <div className="mt-6 rounded-2xl border border-white/10 bg-black/30 p-4">
                  <h3 className="font-semibold">Delivery status</h3>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <div className="rounded-xl bg-white/5 p-3">
                      <p className="text-2xl font-bold">{items.length}</p>
                      <p className="text-xs text-white/40">Batch items</p>
                    </div>
                    <div className="rounded-xl bg-emerald-500/10 p-3">
                      <p className="text-2xl font-bold text-emerald-300">
                        {deliveredCount}
                      </p>
                      <p className="text-xs text-emerald-200/70">Delivered</p>
                    </div>
                    <div className="rounded-xl bg-red-500/10 p-3">
                      <p className="text-2xl font-bold text-red-300">
                        {failedCount}
                      </p>
                      <p className="text-xs text-red-200/70">Failed</p>
                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
