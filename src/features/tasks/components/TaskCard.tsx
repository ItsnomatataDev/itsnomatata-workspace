import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  Users,
  Radio,
} from "lucide-react";
import type { TaskItem } from "../../../lib/supabase/queries/tasks";

function formatDueDate(value?: string | null) {
  if (!value) return "No deadline";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function getTaskTimingState(task: TaskItem) {
  if (!task.due_date) {
    return {
      label: "No deadline",
      classes: "border-white/10 bg-white/5 text-white/55",
      isLate: false,
    };
  }

  const due = new Date(task.due_date).getTime();
  const now = Date.now();
  const completedAt = task.completed_at
    ? new Date(task.completed_at).getTime()
    : null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);

  if (task.status === "done" && completedAt) {
    if (completedAt > due) {
      return {
        label: "Completed late",
        classes: "border-red-500/20 bg-red-500/10 text-red-300",
        isLate: true,
      };
    }

    return {
      label: "Completed on time",
      classes: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      isLate: false,
    };
  }

  if (due < now) {
    return {
      label: "Overdue",
      classes: "border-red-500/20 bg-red-500/10 text-red-300",
      isLate: true,
    };
  }

  if (due >= startOfToday.getTime() && due <= endOfToday.getTime()) {
    return {
      label: "Due today",
      classes: "border-amber-500/20 bg-amber-500/10 text-amber-300",
      isLate: false,
    };
  }

  return {
    label: "On schedule",
    classes: "border-white/10 bg-white/5 text-white/60",
    isLate: false,
  };
}

function getPriorityClasses(priority: TaskItem["priority"]) {
  if (priority === "urgent") {
    return "border-red-500/20 bg-red-500/10 text-red-300";
  }

  if (priority === "high") {
    return "border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  if (priority === "medium") {
    return "border-orange-500/20 bg-orange-500/10 text-orange-300";
  }

  return "border-white/10 bg-white/5 text-white/60";
}

export default function TaskCard({
  task,
  onTrack,
  onOpen,
  hasRunningTimer,
  invitedCount,
}: {
  task: TaskItem;
  onTrack: (taskId: string, title: string) => void;
  onOpen: (taskId: string) => void;
  hasRunningTimer?: boolean;
  invitedCount?: number;
}) {
  const timing = getTaskTimingState(task);

  return (
    <div
      className={`w-full overflow-hidden rounded-2xl border bg-black/50 p-4 transition hover:border-white/20 ${
        timing.isLate ? "border-red-500/20" : "border-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 wrap-break-word text-sm font-semibold leading-6 text-white">
          {task.title}
        </h3>

        <span
          className={`shrink-0 rounded-full border px-2 py-1 text-[10px] uppercase ${getPriorityClasses(
            task.priority,
          )}`}
        >
          {task.priority}
        </span>
      </div>

      {task.description ? (
        <p className="mt-3 wrap-break-word text-sm leading-6 text-white/55 line-clamp-4">
          {task.description}
        </p>
      ) : (
        <p className="mt-3 text-sm text-white/30">No description added yet.</p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
          {task.status.replaceAll("_", " ")}
        </span>

        <span
          className={`rounded-full border px-3 py-1 text-[11px] ${timing.classes}`}
        >
          {timing.label}
        </span>

        {task.status === "approved" ? (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
            Approved
          </span>
        ) : null}

        {hasRunningTimer ? (
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] text-orange-300">
            <Radio size={11} />
            Recording time
          </span>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 text-xs text-white/50">
        <div className="flex min-w-0 items-center gap-2">
          <CalendarClock size={12} className="shrink-0 text-orange-400" />
          <span className="truncate">{formatDueDate(task.due_date)}</span>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle2 size={12} className="shrink-0 text-white/40" />
          <span className="truncate">
            {task.completed_at
              ? `Completed: ${formatDueDate(task.completed_at)}`
              : "Not completed yet"}
          </span>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <Users size={12} className="shrink-0 text-white/40" />
          <span>{invitedCount ?? 0} invited</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-white/75 hover:bg-white/5"
        >
          <Eye size={12} />
          Open Card
        </button>

        <button
          type="button"
          onClick={() => onTrack(task.id, task.title)}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black"
        >
          <Clock3 size={12} />
          Track time
        </button>

        {timing.isLate ? (
          <div className="inline-flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <AlertTriangle size={12} />
            Missed deadline
          </div>
        ) : null}
      </div>
    </div>
  );
}
