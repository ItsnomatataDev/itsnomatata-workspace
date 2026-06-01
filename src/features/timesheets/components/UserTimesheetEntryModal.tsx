import React from "react";
import { AlertCircle, X } from "lucide-react";

export type TimesheetEntryFormState = {
  date: string;
  startTime: string;
  endTime: string;
  taskId: string;
  clientId: string;
  description: string;
  isBillable: boolean;
  reason: string;
};

type BoardOption = {
  id: string;
  name: string;
};

type TaskOption = {
  id: string;
  title: string;
};

type UserTimesheetEntryModalProps = {
  open: boolean;
  title: string;
  description: string;
  submitLabel: string;
  showReason?: boolean;
  submitting: boolean;
  formError: string | null;
  form: TimesheetEntryFormState;
  boards: BoardOption[];
  tasks: TaskOption[];
  loadingBoards: boolean;
  loadingTasks: boolean;
  durationPreview: string | null;
  onClose: () => void;
  onSubmit: (event: React.FormEvent) => void;
  onFormChange: (
    updater: (prev: TimesheetEntryFormState) => TimesheetEntryFormState,
  ) => void;
  onBoardChange: (boardId: string) => void;
};

export function UserTimesheetEntryModal({
  open,
  title,
  description,
  submitLabel,
  showReason = false,
  submitting,
  formError,
  form,
  boards,
  tasks,
  loadingBoards,
  loadingTasks,
  durationPreview,
  onClose,
  onSubmit,
  onFormChange,
  onBoardChange,
}: UserTimesheetEntryModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-3xl border border-white/10 bg-[#101010] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 p-6">
          <div>
            <h3 className="text-2xl font-bold">{title}</h3>
            <p className="mt-1 text-sm text-white/45">{description}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl p-2 hover:bg-white/10 disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6">
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
                  onFormChange((prev) => ({ ...prev, date: e.target.value }))
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
                  onFormChange((prev) => ({
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
                  onFormChange((prev) => ({
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
              <span className="text-sm text-white/60">Project optional</span>
              <select
                value={form.clientId}
                onChange={(e) => onBoardChange(e.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-orange-500"
              >
                <option value="">
                  {loadingBoards && boards.length === 0
                    ? "Loading projects..."
                    : "Select project"}
                </option>

                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-white/60">Task optional</span>
              <select
                value={form.taskId}
                onChange={(e) =>
                  onFormChange((prev) => ({ ...prev, taskId: e.target.value }))
                }
                disabled={
                  !form.clientId || (loadingTasks && tasks.length === 0)
                }
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">
                  {loadingTasks && tasks.length === 0
                    ? "Loading tasks..."
                    : form.clientId
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

          <label className="mt-5 block">
            <span className="text-sm text-white/60">
              Description / work note
            </span>
            <textarea
              value={form.description}
              onChange={(e) =>
                onFormChange((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              rows={4}
              placeholder="Example: Worked on dashboard fixes and client updates"
              className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-orange-500"
            />
          </label>

          {showReason && (
            <label className="mt-5 block">
              <span className="text-sm text-white/60">Reason for edit</span>
              <textarea
                value={form.reason}
                onChange={(e) =>
                  onFormChange((prev) => ({
                    ...prev,
                    reason: e.target.value,
                  }))
                }
                rows={3}
                placeholder="Example: Corrected forgotten time after working on the task"
                className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-white outline-none placeholder:text-white/25 focus:border-orange-500"
              />
            </label>
          )}

          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/3 p-4 md:flex-row md:items-center md:justify-between">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.isBillable}
                onChange={(e) =>
                  onFormChange((prev) => ({
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
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Saving..." : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
