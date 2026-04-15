import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, FileText, Send, XCircle } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useTimeEntries } from "../../../lib/hooks/useTimeEntries";
import {
  createTimesheet,
  getTimesheetsForApproval,
  getTimesheetsForUser,
  rejectTimesheet,
  approveTimesheet,
  submitTimesheet,
  type TimesheetSubmission,
} from "../services/timesheetService";

function formatDuration(totalSeconds: number) {
  const safeSeconds = Math.max(0, Number(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? 6 : day - 1;

  const start = new Date(now);
  start.setDate(now.getDate() - diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return {
    weekStart: start.toISOString().slice(0, 10),
    weekEnd: end.toISOString().slice(0, 10),
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function getStatusClasses(status: TimesheetSubmission["status"]) {
  if (status === "approved") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "rejected") {
    return "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  if (status === "submitted") {
    return "border border-orange-500/20 bg-orange-500/10 text-orange-300";
  }

  return "border border-white/10 bg-white/5 text-white/60";
}

export default function TimesheetsPage() {
  const auth = useAuth();

  if (!auth?.user || !auth?.profile) return null;

  const { user, profile } = auth;
  const organizationId = profile.organization_id;

  if (!organizationId) return null;

  const { weekStart, weekEnd, startIso, endIso } = useMemo(
    () => getWeekDates(),
    [],
  );

  const {
    entries,
    totals,
    loading: timeLoading,
  } = useTimeEntries({
    organizationId,
    userId: user.id,
    startDate: startIso,
    endDate: endIso,
  });
  const [myTimesheets, setMyTimesheets] = useState<TimesheetSubmission[]>([]);
  const [approvalQueue, setApprovalQueue] = useState<TimesheetSubmission[]>([]);
  const [notes, setNotes] = useState("");
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const canApprove =
    profile.primary_role === "admin" || profile.primary_role === "manager";

  const currentWeekTimesheet = useMemo(() => {
    return myTimesheets.find(
      (item) => item.week_start === weekStart && item.week_end === weekEnd,
    );
  }, [myTimesheets, weekStart, weekEnd]);

  const groupedEntries = useMemo(() => {
    const map = new Map<
      string,
      {
        date: string;
        totalSeconds: number;
        entries: typeof entries;
      }
    >();

    for (const entry of entries) {
      const dateKey = entry.started_at.slice(0, 10);
      const current = map.get(dateKey) ?? {
        date: dateKey,
        totalSeconds: 0,
        entries: [],
      };

      current.entries.push(entry);
      current.totalSeconds += Number(entry.duration_seconds ?? 0);
      map.set(dateKey, current);
    }

    return Array.from(map.values()).sort((a, b) =>
      b.date.localeCompare(a.date),
    );
  }, [entries]);

  const loadTimesheets = async () => {
    try {
      setError("");

      const [mine, approvals] = await Promise.all([
        getTimesheetsForUser(organizationId, user.id),
        canApprove
          ? getTimesheetsForApproval(organizationId)
          : Promise.resolve([]),
      ]);

      setMyTimesheets(mine);
      setApprovalQueue(approvals);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load timesheets.";
      setError(message);
    }
  };

  useEffect(() => {
    void loadTimesheets();
  }, [profile.organization_id, user.id, canApprove]);

  const handleCreateCurrentWeek = async () => {
    try {
      setCreating(true);
      setError("");

      await createTimesheet({
        organizationId,
        userId: user.id,
        weekStart,
        weekEnd,
        notes,
      });

      setNotes("");
      await loadTimesheets();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to create timesheet.";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (timesheetId: string) => {
    try {
      setBusy(true);
      setError("");

      await submitTimesheet({
        timesheetId,
        organizationId,
      });

      await loadTimesheets();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit timesheet.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleApprove = async (timesheetId: string) => {
    try {
      setBusy(true);
      setError("");

      await approveTimesheet({
        timesheetId,
        organizationId,
        approverId: user.id,
      });

      await loadTimesheets();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to approve timesheet.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async (timesheetId: string) => {
    try {
      setBusy(true);
      setError("");

      await rejectTimesheet({
        timesheetId,
        organizationId,
        approverId: user.id,
        notes: reviewNotes[timesheetId] || null,
      });

      await loadTimesheets();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to reject timesheet.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Timesheets
            </p>
            <h1 className="mt-2 text-3xl font-bold">Weekly Timesheets</h1>
            <p className="mt-2 text-sm text-white/50">
              Review tracked time, create weekly submissions, and monitor
              approvals.
            </p>
          </div>

          {error ? (
            <div className="mb-6 border border-red-500/20 bg-red-500/10 p-4 text-red-300">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <Clock3 size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">This week</p>
              </div>
              <p className="mt-3 text-3xl font-bold">
                {formatDuration(totals.totalSeconds)}
              </p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Billable</p>
              </div>
              <p className="mt-3 text-3xl font-bold">
                {formatDuration(totals.billableSeconds)}
              </p>
            </div>

            <div className="border border-white/10 bg-[#050505] p-5">
              <div className="flex items-center gap-3">
                <FileText size={18} className="text-orange-500" />
                <p className="text-sm text-white/55">Current week status</p>
              </div>
              <div className="mt-3">
                {currentWeekTimesheet ? (
                  <span
                    className={`inline-flex rounded-xl px-3 py-2 text-sm ${getStatusClasses(
                      currentWeekTimesheet.status,
                    )}`}
                  >
                    {currentWeekTimesheet.status}
                  </span>
                ) : (
                  <span className="text-white/50">Not created yet</span>
                )}
              </div>
            </div>
          </div>

          <section className="mt-6 border border-white/10 bg-[#050505] p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white/45">Current week</p>
                <h2 className="mt-2 text-2xl font-bold">
                  {formatDate(weekStart)} - {formatDate(weekEnd)}
                </h2>
                <p className="mt-2 text-sm text-white/50">
                  Build a weekly timesheet from the time already tracked this
                  week.
                </p>
              </div>

              {!currentWeekTimesheet ? (
                <button
                  type="button"
                  onClick={() => void handleCreateCurrentWeek()}
                  disabled={creating || timeLoading}
                  className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                >
                  Create current week timesheet
                </button>
              ) : currentWeekTimesheet.status === "draft" ? (
                <button
                  type="button"
                  onClick={() => void handleSubmit(currentWeekTimesheet.id)}
                  disabled={busy}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                >
                  <Send size={15} />
                  Submit timesheet
                </button>
              ) : null}
            </div>

            {!currentWeekTimesheet ? (
              <div className="mt-5">
                <label className="mb-2 block text-sm text-white/60">
                  Optional notes for this week
                </label>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                  placeholder="Add notes for this week's timesheet..."
                />
              </div>
            ) : currentWeekTimesheet.notes ? (
              <div className="mt-5 border border-white/10 bg-black/40 p-4">
                <p className="text-sm text-white/45">Submission notes</p>
                <p className="mt-2 whitespace-pre-wrap text-white/80">
                  {currentWeekTimesheet.notes}
                </p>
              </div>
            ) : null}
          </section>

          <section className="mt-6 border border-white/10 bg-[#050505] p-6">
            <div>
              <p className="text-sm text-white/45">Tracked entries</p>
              <h2 className="mt-2 text-2xl font-bold">Weekly breakdown</h2>
            </div>

            {timeLoading ? (
              <div className="mt-6 text-white/60">
                Loading weekly entries...
              </div>
            ) : groupedEntries.length === 0 ? (
              <div className="mt-6 text-white/50">
                No time entries found for this week.
              </div>
            ) : (
              <div className="mt-6 space-y-5">
                {groupedEntries.map((group) => (
                  <div
                    key={group.date}
                    className="border border-white/10 bg-black/30 p-4"
                  >
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {formatDate(group.date)}
                        </p>
                        <p className="mt-1 text-xs text-white/45">
                          {group.entries.length} entr
                          {group.entries.length === 1 ? "y" : "ies"}
                        </p>
                      </div>

                      <div className="text-sm text-orange-400">
                        {formatDuration(group.totalSeconds)}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {group.entries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex flex-col gap-3 border border-white/10 bg-[#050505] p-4 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-white">
                              {entry.description || "No description"}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {formatDateTime(entry.started_at)} →{" "}
                              {formatDateTime(entry.ended_at)}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="border border-white/10 bg-white/5 px-3 py-2 text-white/70">
                              {entry.is_billable ? "Billable" : "Non-billable"}
                            </span>
                            <span className="border border-white/10 bg-white/5 px-3 py-2 text-white/70">
                              {entry.source || "—"}
                            </span>
                            <span className="border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-orange-300">
                              {formatDuration(
                                Number(entry.duration_seconds ?? 0),
                              )}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-6 border border-white/10 bg-[#050505] p-6">
            <div>
              <p className="text-sm text-white/45">My submissions</p>
              <h2 className="mt-2 text-2xl font-bold">Timesheet history</h2>
            </div>

            {myTimesheets.length === 0 ? (
              <div className="mt-6 text-white/50">
                No timesheets created yet.
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                {myTimesheets.map((timesheet) => (
                  <div
                    key={timesheet.id}
                    className="flex flex-col gap-4 border border-white/10 bg-black/30 p-4 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="font-medium text-white">
                        {formatDate(timesheet.week_start)} -{" "}
                        {formatDate(timesheet.week_end)}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        Created {formatDateTime(timesheet.created_at)}
                      </p>
                      {timesheet.notes ? (
                        <p className="mt-2 text-sm text-white/70">
                          {timesheet.notes}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-xl px-3 py-2 text-sm ${getStatusClasses(
                          timesheet.status,
                        )}`}
                      >
                        {timesheet.status}
                      </span>

                      {timesheet.status === "draft" ? (
                        <button
                          type="button"
                          onClick={() => void handleSubmit(timesheet.id)}
                          disabled={busy}
                          className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                        >
                          Submit
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {canApprove ? (
            <section className="mt-6 border border-white/10 bg-[#050505] p-6">
              <div>
                <p className="text-sm text-white/45">Approval queue</p>
                <h2 className="mt-2 text-2xl font-bold">
                  Submitted timesheets awaiting review
                </h2>
              </div>

              {approvalQueue.length === 0 ? (
                <div className="mt-6 text-white/50">
                  No submitted timesheets waiting for approval.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {approvalQueue.map((timesheet) => (
                    <div
                      key={timesheet.id}
                      className="border border-white/10 bg-black/30 p-4"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="font-medium text-white">
                            {formatDate(timesheet.week_start)} -{" "}
                            {formatDate(timesheet.week_end)}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            Submitted {formatDateTime(timesheet.submitted_at)}
                          </p>
                          {timesheet.notes ? (
                            <p className="mt-2 text-sm text-white/70">
                              {timesheet.notes}
                            </p>
                          ) : null}
                        </div>

                        <span
                          className={`inline-flex rounded-xl px-3 py-2 text-sm ${getStatusClasses(
                            timesheet.status,
                          )}`}
                        >
                          {timesheet.status}
                        </span>
                      </div>

                      <div className="mt-4">
                        <label className="mb-2 block text-sm text-white/60">
                          Review note
                        </label>
                        <textarea
                          value={reviewNotes[timesheet.id] ?? ""}
                          onChange={(event) =>
                            setReviewNotes((prev) => ({
                              ...prev,
                              [timesheet.id]: event.target.value,
                            }))
                          }
                          rows={3}
                          className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                          placeholder="Optional approval or rejection note..."
                        />
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void handleApprove(timesheet.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                        >
                          <CheckCircle2 size={15} />
                          Approve
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleReject(timesheet.id)}
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                        >
                          <XCircle size={15} />
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
        </main>
      </div>
    </div>
  );
}
