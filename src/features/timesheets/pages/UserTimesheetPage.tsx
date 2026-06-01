import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { getBoards } from "../../boards/services/boardService";
import { canManageAllOffices } from "../../../lib/offices";
import {
  useUserTimesheet,
  type TimesheetView,
} from "../../../lib/hooks/useUserTimesheet";
import {
  createManualTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
} from "../../../lib/supabase/mutations/timeEntries";
import { supabase } from "../../../lib/supabase/client";
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
import { canUseDetailedTimeTracking } from "../../../lib/offices";
import { UserTimesheetEntryModal } from "../components/UserTimesheetEntryModal";

type TimeForm = {
  date: string;
  startTime: string;
  endTime: string;
  taskId: string;
  clientId: string;
  description: string;
  isBillable: boolean;
  reason: string;
};

type BoardsOption = {
  id: string;
  name: string;
};

type TaskOption = {
  id: string;
  title: string;
  clientId?: string | null;
};

const getTodayInputDate = () => new Date().toISOString().slice(0, 10);

const createLocalIsoDateTime = (date: string, time: string) => {
  return new Date(`${date}T${time}:00`).toISOString();
};

const getDateInputValue = (iso?: string | null) => {
  if (!iso) return getTodayInputDate();
  return new Date(iso).toISOString().slice(0, 10);
};

const getTimeInputValue = (iso?: string | null) => {
  if (!iso) return "";
  return new Date(iso).toTimeString().slice(0, 5);
};

const emptyForm = (): TimeForm => ({
  date: getTodayInputDate(),
  startTime: "",
  endTime: "",
  taskId: "",
  clientId: "",
  description: "",
  isBillable: false,
  reason: "",
});

const UserTimesheetPage = () => {
  const auth = useAuth() as any;
  const profile = auth?.profile;
  const authUser = auth?.user;
  const currentOrganization = auth?.currentOrganization;

  const [activeView, setActiveView] = useState<TimesheetView>("today");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<any | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [form, setForm] = useState<TimeForm>(emptyForm());

  const [boards, setBoards] = useState<BoardsOption[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);

  const organizationId =
    currentOrganization?.organization_id || profile?.organization_id || "";
  const userId =
    profile?.user_id ||
    profile?.auth_user_id ||
    authUser?.id ||
    profile?.id ||
    "";
  const detailedTimeTrackingDisabled =
    profile && !canUseDetailedTimeTracking(profile);

  const entryModalOpen = isAddModalOpen || Boolean(editingEntry);
  const profileOfficeId = profile?.office_id ?? null;
  const canViewAllOffices = canManageAllOffices(profile);
  const tasksLoadSeqRef = useRef(0);

  const { data, loading, error, refetch } = useUserTimesheet({
    organizationId,
    userId,
    view: activeView,
    realtime: !entryModalOpen,
  });

  const todayKey = getZimbabweDateKey(new Date());
  const todayTotal = data.daily[todayKey]?.totalSeconds || 0;
  const runningStatus = data.activeEntry ? "Timer running" : "No active timer";

  const loadBoards = useCallback(async () => {
    if (!organizationId) {
      setBoards([]);
      return;
    }

    try {
      setLoadingBoards(true);

      const data = await getBoards(organizationId, {
        officeId: canViewAllOffices ? null : profileOfficeId,
        includeAllOffices: canViewAllOffices,
      });

      setBoards(
        data.map((board) => ({
          id: board.id,
          name: board.name,
        })),
      );
    } catch (err) {
      console.error("Failed to load boards:", err);
    } finally {
      setLoadingBoards(false);
    }
  }, [canViewAllOffices, organizationId, profileOfficeId]);

  const loadCardsForBoard = useCallback(
    async (boardId: string) => {
      if (!organizationId || !boardId) {
        setTasks([]);
        return;
      }

      const requestSeq = ++tasksLoadSeqRef.current;

      try {
        setLoadingTasks(true);

        const { data, error } = await supabase
          .from("tasks")
          .select("id, title, client_id, status, priority")
          .eq("organization_id", organizationId)
          .eq("client_id", boardId)
          .is("archived_at", null)
          .order("position", { ascending: true });

        if (error) throw error;
        if (requestSeq !== tasksLoadSeqRef.current) return;

        setTasks((data || []) as TaskOption[]);
      } catch (err) {
        console.error("Failed to load cards:", err);
        if (requestSeq !== tasksLoadSeqRef.current) return;
        setTasks([]);
      } finally {
        if (requestSeq === tasksLoadSeqRef.current) {
          setLoadingTasks(false);
        }
      }
    },
    [organizationId],
  );

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    if (!entryModalOpen) return;
    void loadBoards();
  }, [entryModalOpen, loadBoards]);

  useEffect(() => {
    if (!entryModalOpen) return;

    if (!form.clientId) {
      setTasks([]);
      return;
    }

    void loadCardsForBoard(form.clientId);
  }, [entryModalOpen, form.clientId, loadCardsForBoard]);

  const handleBoardChange = (boardId: string) => {
    setForm((prev) => ({
      ...prev,
      clientId: boardId,
      taskId: "",
    }));
  };

  const resetForm = () => {
    setForm(emptyForm());
    setTasks([]);
    setFormError(null);
  };

  const openAddModal = () => {
    setSuccessMessage(null);
    setFormError(null);
    setEditingEntry(null);
    setTasks([]);
    setForm(emptyForm());
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    if (submitting) return;
    setIsAddModalOpen(false);
    resetForm();
  };

  const openEditModal = async (entry: any) => {
    setSuccessMessage(null);
    setFormError(null);
    setEditingEntry(entry);

    const boardId =
      entry.client_id ||
      entry.projects?.client_id ||
      entry.source_board_id ||
      "";

    setForm({
      date: getDateInputValue(entry.started_at),
      startTime: getTimeInputValue(entry.started_at),
      endTime: getTimeInputValue(entry.ended_at),
      taskId: entry.task_id || "",
      clientId: boardId,
      description: entry.description || "",
      isBillable: Boolean(entry.is_billable),
      reason: "",
    });

    if (!boardId) {
      setTasks([]);
    }
  };

  const closeEditModal = () => {
    if (submitting) return;
    setEditingEntry(null);
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

  const validateTimeForm = (isEdit = false) => {
    if (!organizationId || !userId) {
      return "Missing organization or user profile information.";
    }

    if (!form.date) return "Date is required.";
    if (!form.startTime) return "Start time is required.";
    if (!form.endTime) return "End time is required.";

    const start = new Date(`${form.date}T${form.startTime}:00`);
    const end = new Date(`${form.date}T${form.endTime}:00`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "Invalid date or time.";
    }

    if (end <= start) {
      return "End time must be after start time.";
    }

    if (isEdit && !form.reason.trim()) {
      return "Please provide a reason for this edit.";
    }

    return null;
  };

  const handleSubmitManualTime = async (event: React.FormEvent) => {
    event.preventDefault();

    setFormError(null);
    setSuccessMessage(null);

    const validationError = validateTimeForm(false);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      await createManualTimeEntry({
        organizationId,
        userId,
        taskId: form.taskId || null,
        clientId: form.clientId || null,
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

  const handleSubmitEditTime = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!editingEntry?.id) return;

    setFormError(null);
    setSuccessMessage(null);

    const validationError = validateTimeForm(true);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    try {
      setSubmitting(true);

      await updateTimeEntry({
        entryId: editingEntry.id,
        actorUserId: userId,
        reason: form.reason.trim(),
        payload: {
          description: form.description.trim() || null,
          started_at: createLocalIsoDateTime(form.date, form.startTime),
          ended_at: createLocalIsoDateTime(form.date, form.endTime),
          task_id: form.taskId || null,
          client_id: form.clientId || null,
          is_billable: form.isBillable,
          metadata: {
            ...(editingEntry.metadata || {}),
            last_user_timesheet_edit_at: new Date().toISOString(),
          },
        },
      });

      await refetch();
      setSuccessMessage("Time entry updated successfully.");
      setEditingEntry(null);
      resetForm();
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to update time entry.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!deletingEntry?.id) return;

    try {
      setSubmitting(true);
      setFormError(null);
      setSuccessMessage(null);

      await deleteTimeEntry(deletingEntry.id, {
        actorUserId: userId,
        reason: "deleted_from_user_timesheet",
      });

      await refetch();

      setSuccessMessage("Time entry deleted successfully.");
      setDeletingEntry(null);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to delete time entry.",
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

              {entry.task_id && (
                <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-xs text-orange-300">
                  Task-linked
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
            <button
              type="button"
              onClick={() => void openEditModal(entry)}
              className="rounded-lg p-2 hover:bg-white/10"
              title="Edit time entry"
            >
              <Edit size={16} />
            </button>

            <button
              type="button"
              onClick={() => setDeletingEntry(entry)}
              className="rounded-lg p-2 hover:bg-white/10"
              title="Delete time entry"
            >
              <Trash2 size={16} className="text-red-400" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (detailedTimeTrackingDisabled) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar role={profile.primary_role} />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h1 className="text-2xl font-bold">Time tracking disabled</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/55">
                Three Little Birds employees clock in and clock out for attendance only.
                Detailed task time tracking is disabled for this office.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile?.primary_role || "user"} />

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8 rounded-3xl border border-white/10 bg-linear-to-br from-white/8 to-white/2 px-4 py-6 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-orange-300/80">
                  Timesheet
                </p>
                <h1 className="mt-3 text-4xl font-bold">My Timesheet</h1>
                <p className="mt-3 max-w-2xl text-white/55">
                  Review tracked work, add missing time, edit task-linked time,
                  and keep your records aligned with admin time management.
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
                  type="button"
                  onClick={() => refetch()}
                  className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-medium hover:bg-white/20"
                >
                  <RefreshCw size={16} />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={openAddModal}
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
                  type="button"
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
                    Add missing work time, edit task-linked entries, or delete
                    incorrect records.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={openAddModal}
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
                    type="button"
                    onClick={openAddModal}
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
          </div>
        </main>
      </div>

      <UserTimesheetEntryModal
        open={isAddModalOpen}
        title="Add Time Entry"
        description="Add missing work time for today or a previous day."
        submitLabel="Add Time Entry"
        submitting={submitting}
        formError={formError}
        form={form}
        boards={boards}
        tasks={tasks}
        loadingBoards={loadingBoards}
        loadingTasks={loadingTasks}
        durationPreview={durationPreview}
        onClose={closeAddModal}
        onSubmit={handleSubmitManualTime}
        onFormChange={setForm}
        onBoardChange={handleBoardChange}
      />

      <UserTimesheetEntryModal
        open={Boolean(editingEntry)}
        title="Edit Time Entry"
        description="Update the time, project/task link, description, or billable status."
        submitLabel="Save Changes"
        showReason
        submitting={submitting}
        formError={formError}
        form={form}
        boards={boards}
        tasks={tasks}
        loadingBoards={loadingBoards}
        loadingTasks={loadingTasks}
        durationPreview={durationPreview}
        onClose={closeEditModal}
        onSubmit={handleSubmitEditTime}
        onFormChange={setForm}
        onBoardChange={handleBoardChange}
      />

      {deletingEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101010] p-6 shadow-2xl">
            <h3 className="text-2xl font-bold">Delete Time Entry</h3>
            <p className="mt-3 text-sm text-white/55">
              This will remove the time entry from your timesheet and update
              related admin views.
            </p>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/3 p-4 text-sm text-white/60">
              <p>{deletingEntry.description || "No description"}</p>
              <p className="mt-2">
                Duration:{" "}
                <span className="font-semibold text-white">
                  {formatDuration(Number(deletingEntry.duration_seconds || 0))}
                </span>
              </p>
            </div>

            {formError && (
              <div className="mt-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
                {formError}
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 md:flex-row md:justify-end">
              <button
                type="button"
                onClick={() => setDeletingEntry(null)}
                disabled={submitting}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/70 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteEntry}
                disabled={submitting}
                className="rounded-xl bg-red-500 px-5 py-3 text-sm font-semibold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Deleting..." : "Delete Entry"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserTimesheetPage;
