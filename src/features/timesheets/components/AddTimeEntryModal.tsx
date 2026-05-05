import React, { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";

import {
  createManualTimeEntry,
  type ManualTimeEntryInput,
} from "../../../lib/supabase/mutations/timeEntries";
import { getProjects } from "../../../lib/supabase/queries/projects";
import { supabase } from "../../../lib/supabase/client";
import {
  getZimbabweDateKey,
  makeZimbabweLocalIso,
} from "../../../lib/utils/zimbabweCalendar";

import type { ProjectRow } from "../../../lib/supabase/queries/projects";

type TaskOption = {
  id: string;
  title: string;
};

interface AddTimeEntryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  refetch: () => void | Promise<void>;
  organizationId: string;
  userId: string;
}

export function AddTimeEntryModal({
  open,
  onOpenChange,
  refetch,
  organizationId,
  userId,
}: AddTimeEntryModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(getZimbabweDateKey(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [description, setDescription] = useState("");
  const [isBillable, setIsBillable] = useState(false);

  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [tasks, setTasks] = useState<TaskOption[]>([]);

  useEffect(() => {
    if (!open || !organizationId) return;

    const loadProjects = async () => {
      try {
        setLoadingProjects(true);
        setError(null);

        const data = await getProjects({
          organizationId,
          isActive: true,
          limit: 100,
        });

        setProjects(data);
      } catch (err) {
        console.error("Failed to load projects:", err);
        setError("Failed to load projects.");
      } finally {
        setLoadingProjects(false);
      }
    };

    void loadProjects();
  }, [open, organizationId]);

  const resetForm = () => {
    setDate(getZimbabweDateKey(new Date()));
    setStartTime("09:00");
    setEndTime("17:00");
    setProjectId("");
    setTaskId("");
    setDescription("");
    setIsBillable(false);
    setTasks([]);
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onOpenChange(false);
  };

  const handleProjectChange = async (
    event: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    const selectedProjectId = event.target.value;

    setProjectId(selectedProjectId);
    setTaskId("");
    setTasks([]);

    if (!selectedProjectId) return;

    try {
      setLoadingTasks(true);
      setError(null);

      const { data, error } = await supabase
        .from("tasks")
        .select("id, title")
        .eq("organization_id", organizationId)
        .eq("project_id", selectedProjectId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setTasks((data ?? []) as TaskOption[]);
    } catch (err) {
      console.error("Failed to load tasks:", err);
      setError("Failed to load tasks for the selected project.");
    } finally {
      setLoadingTasks(false);
    }
  };

  const getDurationSeconds = () => {
    if (!date || !startTime || !endTime) return 0;

    const start = new Date(makeZimbabweLocalIso(date, startTime));
    const end = new Date(makeZimbabweLocalIso(date, endTime));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 0;
    }

    return Math.floor((end.getTime() - start.getTime()) / 1000);
  };

  const formatDurationPreview = () => {
    const seconds = getDurationSeconds();

    if (seconds <= 0) return "—";

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours && minutes) return `${hours}h ${minutes}m`;
    if (hours) return `${hours}h`;
    return `${minutes}m`;
  };

  const validateForm = () => {
    if (!organizationId || !userId) {
      return "Missing organization or user information.";
    }

    if (!date) return "Date is required.";
    if (!startTime) return "Start time is required.";
    if (!endTime) return "End time is required.";

    const start = new Date(makeZimbabweLocalIso(date, startTime));
    const end = new Date(makeZimbabweLocalIso(date, endTime));

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return "Invalid date or time.";
    }

    if (end <= start) {
      return "End time must be after start time.";
    }

    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    const payload: ManualTimeEntryInput = {
      organizationId,
      userId,
      startedAt: new Date(makeZimbabweLocalIso(date, startTime)).toISOString(),
      endedAt: new Date(makeZimbabweLocalIso(date, endTime)).toISOString(),
      projectId: projectId || undefined,
      taskId: taskId || undefined,
      description: description.trim() || undefined,
      isBillable,
      source: "manual",
      actorUserId: userId,
      reason: "manual_time_added_from_user_timesheet",
      metadata: {
        created_from: "user_timesheet",
      },
    };

    try {
      setSubmitting(true);
      setError(null);

      await createManualTimeEntry(payload);
      await refetch();

      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error("Failed to add time entry:", err);
      setError(
        err instanceof Error ? err.message : "Failed to add time entry.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-white/10 bg-[#101010] text-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-2xl font-bold">Add Time Entry</h2>
            <p className="mt-1 text-sm text-white/50">
              Add missing work time for today or a previous day.
            </p>
          </div>

          <button
            type="button"
            onClick={handleClose}
            disabled={submitting}
            className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="max-h-[75vh] space-y-5 overflow-y-auto px-6 py-6"
        >
          {error && (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="block">
              <span className="text-sm font-medium text-white/70">Date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-orange-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white/70">
                Start time
              </span>
              <input
                type="time"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-orange-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white/70">
                End time
              </span>
              <input
                type="time"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-orange-500"
              />
            </label>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/3 px-4 py-3">
            <p className="text-sm text-white/50">
              Duration:{" "}
              <span className="font-semibold text-white">
                {formatDurationPreview()}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-medium text-white/70">
                Project optional
              </span>
              <select
                value={projectId}
                onChange={handleProjectChange}
                disabled={loadingProjects}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {loadingProjects ? "Loading projects..." : "Select project"}
                </option>

                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm font-medium text-white/70">
                Task optional
              </span>
              <select
                value={taskId}
                onChange={(event) => setTaskId(event.target.value)}
                disabled={!projectId || loadingTasks}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {loadingTasks
                    ? "Loading tasks..."
                    : projectId
                      ? "Select task"
                      : "Select project first"}
                </option>

                {tasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-sm font-medium text-white/70">
              Description / work note
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What did you work on?"
              rows={4}
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none transition placeholder:text-white/30 focus:border-orange-500"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/3 px-4 py-3">
            <input
              type="checkbox"
              checked={isBillable}
              onChange={(event) => setIsBillable(event.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="text-sm text-white/70">Billable time</span>
          </label>

          <div className="flex flex-col-reverse gap-3 pt-3 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitting ? "Adding..." : "Add Time Entry"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddTimeEntryModal;
