import React, { useMemo, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import {
  useUserTimesheet,
  type TimesheetView,
} from "../../../lib/hooks/useUserTimesheet";
import { createManualTimeEntry } from "../../../lib/supabase/mutations/timeEntries";
import {
  Clock3,
  CalendarDays,
  TrendingUp,
  Plus,
  Edit,
  Trash2,
  Pause,
  Play,
  RefreshCw,
  X,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { formatDuration } from "../../../lib/utils/formatTime";
import { getZimbabweDateKey } from "../../../lib/utils/zimbabweCalendar";

type AddTimeForm = {
  date: string;
  startTime: string;
  endTime: string;
  taskId: string;
  projectId: string;
  description: string;
  isBillable: boolean;
};

const getTodayInputDate = () => {
  const now = new Date();
  return now.toISOString().slice(0, 10);
};

const createLocalIsoDateTime = (date: string, time: string) => {
  const value = new Date(`${date}T${time}:00`);
  return value.toISOString();
};

const UserTimesheetPage = () => {
  const auth = useAuth() as any;
  const profile = auth?.profile;
  const authUser = auth?.user;

  const [activeView, setActiveView] = useState<TimesheetView>("today");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [form, setForm] = useState<AddTimeForm>({
    date: getTodayInputDate(),
    startTime: "",
    endTime: "",
    taskId: "",
    projectId: "",
    description: "",
    isBillable: false,
  });

  const organizationId = profile?.organization_id || "";

  const userId =
    profile?.user_id ||
    profile?.auth_user_id ||
    authUser?.id ||
    profile?.id ||
    "";

  const { data, loading, error, refetch } = useUserTimesheet({
    organizationId,
    userId,
    view: activeView,
    realtime: true,
  });

  const todayKey = getZimbabweDateKey(new Date());
  const todayTotal = data.daily[todayKey]?.totalSeconds || 0;

  const runningStatus = data.activeEntry ? "Timer running" : "No active timer";

  const resetForm = () => {
    setForm({
      date: getTodayInputDate(),
      startTime: "",
      endTime: "",
      taskId: "",
      projectId: "",
      description: "",
      isBillable: false,
    });
    setFormError(null);
  };

  const closeAddModal = () => {
    if (submitting) return;
    setIsAddModalOpen(false);
    resetForm();
  };

  const durationPreview = useMemo(() => {
    if (!form.date || !form.startTime || !form.endTime) return null;

    const start = new Date(`${form.date}T${form.startTime}:00`);
    const end = new Date(`${form.date}T${form.endTime}:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return null;
    }

    const seconds = Math.floor((end.getTime() - start.getTime()) / 1000);

    if (seconds <= 0) return null;

    return formatDuration(seconds);
  }, [form.date, form.startTime, form.endTime]);

  const handleSubmitManualTime = async (event: React.FormEvent) => {
    event.preventDefault();

    setFormError(null);
    setSuccessMessage(null);

    if (!organizationId || !userId) {
      setFormError("Missing organization or user profile information.");
      return;
    }

    if (!form.date) {
      setFormError("Date is required.");
      return;
    }

    if (!form.startTime) {
      setFormError("Start time is required.");
      return;
    }

    if (!form.endTime) {
      setFormError("End time is required.");
      return;
    }

    const start = new Date(`${form.date}T${form.startTime}:00`);
    const end = new Date(`${form.date}T${form.endTime}:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setFormError("Invalid date or time.");
      return;
    }

    if (end <= start) {
      setFormError("End time must be after start time.");
      return;
    }

    try {
      setSubmitting(true);

      await createManualTimeEntry({
        organizationId,
        userId,
        taskId: form.taskId.trim() || null,
        projectId: form.projectId.trim() || null,
        description: form.description.trim() || null,
        startedAt: createLocalIsoDateTime(form.date, form.startTime),
        endedAt: createLocalIsoDateTime(form.date, form.endTime),
        isBillable: form.isBillable,
        source: "manual",
        actorUserId: userId,
        reason: "manual_time_added_from_user_timesheet",
        metadata: {
          created_from: "user_timesheet",
        },
      });

      await refetch();

      setSuccessMessage("Time entry added successfully.");
      setIsAddModalOpen(false);
      resetForm();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to add time entry.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const EntryRow = ({ entry }: { entry: any }) => {
    const label =
      entry.task_title ||
      entry.project_name ||
      entry.client_name ||
      entry.tasks?.title ||
      entry.projects?.name ||
      "General";

    const sourceLabel =
      entry.entry_type === "manual" || entry.source === "manual"
        ? "Manual"
        : entry.is_running
          ? "Timer running"
          : "Timer";

    return (
      <div className="group rounded-2xl border border-white/10 bg-white/3 p-4 transition-all hover:border-orange-500/40 hover:bg-white/6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold">
                {entry.description || "No description"}
              </p>

              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60">
                {sourceLabel}
              </span>

              {entry.is_billable && (
                <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                  Billable
                </span>
              )}

              {entry.approval_status && (
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60">
                  {String(entry.approval_status).charAt(0).toUpperCase() +
                    String(entry.approval_status).slice(1)}
                </span>
              )}
            </div>

            <p className="mt-2 truncate text-sm text-white/50">{label}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm lg:min-w-90">
            <div>
              <p className="text-xs uppercase tracking-wider text-white/35">
                Start
              </p>
              <p className="mt-1 text-white/80">
                {entry.started_at
                  ? new Date(entry.started_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-white/35">
                End
              </p>
              <p className="mt-1 text-white/80">
                {entry.ended_at
                  ? new Date(entry.ended_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Running"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-wider text-white/35">
                Duration
              </p>
              <p className="mt-1 font-mono font-semibold text-white">
                {formatDuration(Number(entry.duration_seconds || 0))}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
            <button className="rounded-lg p-2 hover:bg-white/10">
              <Edit size={16} />
            </button>
            <button className="rounded-lg p-2 hover:bg-white/10">
              <Trash2 size={16} className="text-red-400" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile?.primary_role || "user"} />

        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <div className="mb-8 rounded-3xl border border-white/10 bg-linear-to-br from-white/8 to-white/2 p-6 lg:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-orange-300/80">
                  Timesheet
                </p>
                <h1 className="mt-3 text-4xl font-bold">My Timesheet</h1>
                <p className="mt-3 max-w-2xl text-white/55">
                  Review tracked work, add missing time, and keep your daily
                  records aligned with admin time management.
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3 text-sm text-white/60">
                  <span>
                    Today:{" "}
                    <span className="text-white">
                      {new Date().toLocaleDateString([], {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </span>
                  <span className="hidden h-1 w-1 rounded-full bg-white/30 md:block" />
                  <span>{runningStatus}</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => refetch()}
                  className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/20"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>

                <button
                  onClick={() => {
                    setSuccessMessage(null);
                    setFormError(null);
                    setIsAddModalOpen(true);
                  }}
                  className="flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  <Plus size={18} />
                  Add Time
                </button>
              </div>
            </div>
          </div>

          {successMessage && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-200">
              <CheckCircle2 size={18} />
              <p>{successMessage}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-200">
              <AlertCircle size={18} />
              <p>{error}</p>
            </div>
          )}

          <div className="mb-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
              <p className="text-sm uppercase tracking-wider text-white/40">
                Today
              </p>
              <p className="mt-2 text-3xl font-bold">
                {(todayTotal / 3600).toFixed(1)}h
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
              <p className="text-sm uppercase tracking-wider text-white/40">
                Period Total
              </p>
              <p className="mt-2 text-3xl font-bold">
                {formatDuration(data.summary.totalSeconds || 0)}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
              <p className="text-sm uppercase tracking-wider text-white/40">
                Average Daily
              </p>
              <p className="mt-2 text-3xl font-bold">
                {data.summary.avgDailyHours.toFixed(1)}h
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/4 p-5">
              <p className="text-sm uppercase tracking-wider text-white/40">
                Entries
              </p>
              <p className="mt-2 text-3xl font-bold">
                {data.summary.entryCount}
              </p>
            </div>
          </div>

          <div className="mb-8 flex rounded-2xl border border-white/10 bg-white/4 p-1">
            {(["today", "week", "month", "all"] as TimesheetView[]).map(
              (view) => (
                <button
                  key={view}
                  onClick={() => setActiveView(view)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    activeView === view
                      ? "bg-orange-500 text-white shadow-lg"
                      : "text-white/55 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  {view === "today" && <Clock3 size={18} />}
                  {view === "week" && <CalendarDays size={18} />}
                  {view === "month" && <CalendarDays size={18} />}
                  {view === "all" && <TrendingUp size={18} />}
                  {view.charAt(0).toUpperCase() + view.slice(1)}
                </button>
              ),
            )}
          </div>

          <div className="space-y-6">
            {data.activeEntry && (
              <div className="rounded-2xl border border-green-500/20 bg-linear-to-r from-green-500/10 to-emerald-500/10 p-5">
                <div className="flex items-center gap-4">
                  <div className="h-3 w-3 rounded-full bg-orange-400 animate-pulse" />
                  <div className="flex-1">
                    <p className="font-semibold">Timer Running</p>
                    <p className="text-sm text-white/55">
                      {data.activeEntry.description || "No description"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-lg bg-white/10 p-2 hover:bg-white/20">
                      <Pause size={16} />
                    </button>
                    <button className="rounded-lg bg-orange-500 p-2 text-white hover:bg-orange-600">
                      <Play size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-white/4 p-5 lg:p-6">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Time Entries</h2>
                  <p className="mt-1 text-sm text-white/45">
                    Add missing work time or review entries for the selected
                    period.
                  </p>
                </div>

                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600"
                >
                  <Plus size={18} />
                  Add Time
                </button>
              </div>

              {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/3 p-10 text-center text-white/45">
                  Loading your timesheet...
                </div>
              ) : data.entries.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/15 bg-white/3 p-10 text-center">
                  <Clock3 size={48} className="mx-auto mb-4 text-white/25" />
                  <p className="text-lg font-semibold">
                    No time entries found for this period
                  </p>
                  <p className="mx-auto mt-2 max-w-md text-sm text-white/45">
                    Add time manually if you forgot to start the timer.
                  </p>
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600"
                  >
                    <Plus size={18} />
                    Add Time
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.entries.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} />
                  ))}
                </div>
              )}
            </div>

            {Object.values(data.daily).length > 0 && (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
                {Object.values(data.daily)
                  .slice(-7)
                  .map((day) => (
                    <div
                      key={day.date}
                      className="rounded-2xl border border-white/10 bg-white/4 p-5"
                    >
                      <p className="text-sm uppercase tracking-wider text-white/40">
                        {day.date}
                      </p>
                      <p className="mt-2 text-3xl font-bold">
                        {(day.totalSeconds / 3600).toFixed(1)}h
                      </p>
                      <p className="mt-2 text-sm text-white/55">
                        {day.entries.length} entries
                      </p>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#101010] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 p-6">
              <div>
                <h3 className="text-2xl font-bold">Add Time Entry</h3>
                <p className="mt-1 text-sm text-white/45">
                  Add missing work time for today or a previous day.
                </p>
              </div>

              <button
                onClick={closeAddModal}
                className="rounded-xl p-2 hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitManualTime} className="p-6">
              {formError && (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                  <AlertCircle size={18} />
                  <p>{formError}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                <label className="block">
                  <span className="text-sm text-white/60">Date</span>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, date: e.target.value }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-orange-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-white/60">Start time</span>
                  <input
                    type="time"
                    value={form.startTime}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        startTime: e.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-orange-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-white/60">End time</span>
                  <input
                    type="time"
                    value={form.endTime}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        endTime: e.target.value,
                      }))
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-orange-500"
                  />
                </label>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                <label className="block">
                  <span className="text-sm text-white/60">
                    Task ID optional
                  </span>
                  <input
                    type="text"
                    value={form.taskId}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, taskId: e.target.value }))
                    }
                    placeholder="Paste task id if available"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-orange-500"
                  />
                </label>

                <label className="block">
                  <span className="text-sm text-white/60">
                    Project ID optional
                  </span>
                  <input
                    type="text"
                    value={form.projectId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        projectId: e.target.value,
                      }))
                    }
                    placeholder="Paste project id if available"
                    className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-orange-500"
                  />
                </label>
              </div>

              <label className="mt-5 block">
                <span className="text-sm text-white/60">
                  Description / work note
                </span>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Example: Worked on dashboard fixes and client updates"
                  className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-orange-500"
                />
              </label>

              <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/3 p-4 md:flex-row md:items-center md:justify-between">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={form.isBillable}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        isBillable: e.target.checked,
                      }))
                    }
                    className="h-4 w-4 rounded border-white/20 bg-black"
                  />
                  <span className="text-sm text-white/70">
                    Mark this time as billable
                  </span>
                </label>

                <p className="text-sm text-white/45">
                  Duration:{" "}
                  <span className="font-semibold text-white">
                    {durationPreview || "—"}
                  </span>
                </p>
              </div>

              <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/70 hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? "Adding time..." : "Add Time Entry"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserTimesheetPage;
