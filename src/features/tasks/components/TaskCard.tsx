import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  MessageSquare,
  Radio,
  Users,
} from "lucide-react";
import type {
  TaskAssigneeItem,
  TaskItem,
} from "../../../lib/supabase/queries/tasks";

function formatDueDate(value?: string | null) {
  if (!value) return "No deadline";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Number(seconds ?? 0));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);

  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(" ").filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getTaskTimingState(task: TaskItem) {
  if (!task.due_date) {
    return {
      label: "No deadline",
      classes: "bg-white/5 text-white/55",
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
        classes: "bg-red-500/10 text-red-300",
        isLate: true,
      };
    }

    return {
      label: "Completed on time",
      classes: "bg-emerald-500/10 text-emerald-300",
      isLate: false,
    };
  }

  if (due < now) {
    return {
      label: "Overdue",
      classes: "bg-red-500/10 text-red-300",
      isLate: true,
    };
  }

  if (due >= startOfToday.getTime() && due <= endOfToday.getTime()) {
    return {
      label: "Due today",
      classes: "bg-amber-500/10 text-amber-300",
      isLate: false,
    };
  }

  return {
    label: "On schedule",
    classes: "bg-white/5 text-white/60",
    isLate: false,
  };
}

function getPriorityClasses(priority: TaskItem["priority"]) {
  if (priority === "urgent") return "bg-red-500/10 text-red-300";
  if (priority === "high") return "bg-amber-500/10 text-amber-300";
  if (priority === "medium") return "bg-orange-500/10 text-orange-300";
  return "bg-white/5 text-white/60";
}

type TrelloTaskCard = TaskItem & {
  tracked_seconds_cache?: number | null;
  is_billable?: boolean;
  assignees?: TaskAssigneeItem[];
  comments_count?: number;
};

export default function TaskCard({
  task,
  onTrack,
  onOpen,
  hasRunningTimer,
  invitedCount,
}: {
  task: TrelloTaskCard;
  onTrack: (taskId: string, title: string) => void;
  onOpen: (taskId: string) => void;
  hasRunningTimer?: boolean;
  invitedCount?: number;
}) {
  const timing = getTaskTimingState(task);
  const assignees = task.assignees ?? [];
  const visibleAssignees = assignees.slice(0, 3);
  const extraAssigneeCount = Math.max(
    0,
    assignees.length - visibleAssignees.length,
  );

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/task-id", task.id);
    event.dataTransfer.setData("text/task-status", task.status);
    event.dataTransfer.setData("text/task-column-id", task.column_id ?? "");
    event.dataTransfer.setData(
      "text/task-position",
      String(task.position ?? 0),
    );
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <article
      draggable
      onDragStart={handleDragStart}
      className={`cursor-grab rounded-xl bg-[#101214] px-4 py-4 shadow-sm transition hover:bg-[#161a1d] active:cursor-grabbing ${
        timing.isLate ? "ring-1 ring-red-500/20" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 flex-1 wrap-break-word text-sm font-semibold leading-6 text-white">
          {task.title}
        </h3>

        <span
          className={`shrink-0 rounded-xl px-2 py-1 text-[10px] uppercase ${getPriorityClasses(
            task.priority,
          )}`}
        >
          {task.priority}
        </span>
      </div>

      {task.description ? (
        <p className="mt-2 line-clamp-3 wrap-break-word text-sm leading-6 text-white/60">
          {task.description}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-xl bg-white/5 px-3 py-1 text-[11px] text-white/60">
          {task.status.replaceAll("_", " ")}
        </span>

        <span className={`rounded-xl px-3 py-1 text-[11px] ${timing.classes}`}>
          {timing.label}
        </span>

        {task.is_billable ? (
          <span className="rounded-xl bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
            Billable
          </span>
        ) : null}

        {hasRunningTimer ? (
          <span className="inline-flex items-center gap-2 rounded-xl bg-orange-500/10 px-3 py-1 text-[11px] text-orange-300">
            <Radio size={15} />
            Recording
          </span>
        ) : null}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex -space-x-2">
          {visibleAssignees.length > 0 ? (
            visibleAssignees.map((assignee) => (
              <div
                key={assignee.id}
                title={assignee.full_name || assignee.email || "Member"}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-[11px] font-semibold text-black ring-2 ring-[#101214]"
              >
                {getInitials(assignee.full_name, assignee.email)}
              </div>
            ))
          ) : (
            <div className="flex h-8 items-center rounded-full bg-white/5 px-3 text-[11px] text-white/45">
              No members
            </div>
          )}

          {extraAssigneeCount > 0 ? (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[11px] text-white ring-2 ring-[#101214]">
              +{extraAssigneeCount}
            </div>
          ) : null}
        </div>

        <div className="text-right text-[11px] text-white/55">
          <div className="inline-flex items-center gap-1">
            <CalendarClock size={11} className="text-orange-400" />
            <span>{formatDueDate(task.due_date)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-white/55">
        {task.description ? (
          <div className="inline-flex items-center gap-1">
            <FileText size={12} />
            <span>Description</span>
          </div>
        ) : null}

        <div className="inline-flex items-center gap-1">
          <MessageSquare size={12} />
          <span>{task.comments_count ?? 0}</span>
        </div>

        <div className="inline-flex items-center gap-1">
          <Users size={12} />
          <span>{invitedCount ?? 0}</span>
        </div>

        <div className="inline-flex items-center gap-1 text-white">
          <Clock3 size={12} className="text-orange-400" />
          <span>{formatDuration(task.tracked_seconds_cache ?? 0)}</span>
        </div>

        {task.completed_at ? (
          <div className="inline-flex items-center gap-1 text-emerald-300">
            <CheckCircle2 size={12} />
            <span>Done</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onOpen(task.id)}
          className="inline-flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
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
          <div className="inline-flex items-center gap-2 rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">
            <AlertTriangle size={12} />
            Missed deadline
          </div>
        ) : null}
      </div>
    </article>
  );
}
