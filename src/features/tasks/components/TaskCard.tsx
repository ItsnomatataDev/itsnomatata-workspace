import {
  CalendarClock,
  Clock3,
  Eye,
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
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
}

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(" ").filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : source.slice(0, 2).toUpperCase();
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
  const assignees = task.assignees ?? [];
  const visibleAssignees = assignees.slice(0, 3);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/task-id", task.id);
    event.dataTransfer.setData("text/task-status", task.status);
    event.dataTransfer.effectAllowed = "move";
  };

  const handleClick = () => {
    onOpen(task.id);
  };

  return (
    <article
      draggable
      onClick={handleClick}
      onDragStart={handleDragStart}
      className="
        group relative cursor-pointer select-none
        rounded-2xl border border-white/8 bg-[#141414]/95 backdrop-blur-md
        px-4 py-4
        shadow-md shadow-black/40
        transition-all duration-200
        hover:-translate-y-1 hover:border-orange-500/25 hover:shadow-xl hover:shadow-black/60 hover:bg-[#191919]
        active:cursor-grabbing active:scale-[0.98]
      "
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-white leading-6 line-clamp-2">
          {task.title}
        </h3>

        <span
          className={`shrink-0 rounded-full px-2 py-1 text-[10px] ${getPriorityClasses(
            task.priority,
          )}`}
        >
          {task.priority}
        </span>
      </div>
      {task.description ? (
        <p className="mt-2 text-sm text-white/60 line-clamp-2">
          {task.description}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/60">
          {task.status.replaceAll("_", " ")}
        </span>

        {task.is_billable && (
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
            Billable
          </span>
        )}

        {hasRunningTimer && (
          <span className="flex items-center gap-1 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[11px] text-orange-300">
            <Radio size={12} />
            Live
          </span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="flex -space-x-2">
          {visibleAssignees.length > 0 ? (
            visibleAssignees.map((a) => (
              <div
                key={a.id}
                title={a.full_name || a.email || "User"}
                className="
                  flex h-7 w-7 items-center justify-center
                  rounded-full bg-orange-500 text-[10px] font-bold text-black
                  ring-2 ring-[#15181b]
                "
              >
                {getInitials(a.full_name, a.email)}
              </div>
            ))
          ) : (
            <div className="text-xs text-white/40">No assignees</div>
          )}
        </div>

        <div className="text-xs text-white/50 flex items-center gap-1">
          <CalendarClock size={12} className="text-orange-400" />
          {formatDueDate(task.due_date)}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs text-white/50">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <MessageSquare size={12} />
            {task.comments_count ?? 0}
          </span>

          <span className="flex items-center gap-1">
            <Users size={12} />
            {invitedCount ?? 0}
          </span>
        </div>

        <span className="flex items-center gap-1 text-white">
          <Clock3 size={12} className="text-orange-400" />
          {formatDuration(task.tracked_seconds_cache ?? 0)}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div
          title={
            task.created_by_full_name || task.created_by_email
              ? `Created by ${task.created_by_full_name ?? task.created_by_email}`
              : "Created by unknown"
          }
          className="flex h-9 min-w-[2.25rem] items-center justify-center rounded-full border border-white/10 bg-white/5 text-xs font-semibold text-white/80"
        >
          {getInitials(
            task.created_by_full_name ?? task.created_by,
            task.created_by_email,
          )}
        </div>

        <button
          onClick={(event) => {
            event.stopPropagation();
            onTrack(task.id, task.title);
          }}
          className="
            flex-1 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black
            transition hover:bg-orange-400
          "
        >
          <Clock3 size={12} className="inline mr-1" />
          Track
        </button>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(249,115,22,0.08),transparent_35%)] opacity-0 transition group-hover:opacity-100" />
    </article>
  );
}
