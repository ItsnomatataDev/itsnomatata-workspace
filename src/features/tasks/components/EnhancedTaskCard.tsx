import {
  CalendarClock,
  Clock3,
  Eye,
  MessageSquare,
  Radio,
  Users,
  CheckSquare,
  Tag,
} from "lucide-react";
import { formatRelativeDate } from "../../../lib/utils/formatRelativeDate";
import type {
  TaskAssigneeItem,
  TaskItem,
  TaskWatcherItem,
} from "../../../lib/supabase/queries/tasks";
import { ManualTimeDialog } from "./ManualTimeDialog";
import type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";

function formatDueDate(value?: string | null) {
  if (!value) return null;
  try {
    const date = new Date(value);
    const today = new Date();
    const daysUntil = Math.ceil(
      (date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (daysUntil < 0) return `${Math.abs(daysUntil)} days overdue`;
    if (daysUntil === 0) return "Due today";
    if (daysUntil === 1) return "Due tomorrow";
    if (daysUntil <= 7) return `Due in ${daysUntil} days`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return null;
  }
}

function formatDuration(seconds?: number | null) {
  const total = Math.max(0, Number(seconds ?? 0));
  if (total === 0) return "0m";
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
  if (priority === "urgent")
    return "bg-red-500/20 text-red-300 border-red-500/30";
  if (priority === "high")
    return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  if (priority === "medium")
    return "bg-orange-500/20 text-orange-300 border-orange-500/30";
  return "bg-white/10 text-white/60 border-white/10";
}

type EnhancedTaskCard = TaskItem & {
  tracked_seconds_cache?: number | null;
  is_billable?: boolean;
  assignees?: TaskAssigneeItem[];
  watchers?: TaskWatcherItem[];
  comments_count?: number;
  checklistProgress?: { completed: number; total: number };
  labels?: Array<{ id: string; name: string; color: string }>;
};

export default function EnhancedTaskCard({
  task,
  onTrack,
  onOpen,
  hasRunningTimer,
  invitedCount,
  organizationId,
  userId,
  onTimeRefresh,
}: {
  task: EnhancedTaskCard;
  onTrack: (taskId: string, title: string) => void;
  onOpen: (taskId: string) => void;
  organizationId: string;
  userId: string;
  onTimeRefresh?: () => void;
  hasRunningTimer?: boolean;
  invitedCount?: number;
}) {
  const assignees = task.assignees ?? [];
  const visibleAssignees = assignees.slice(0, 3);
  const extraAssignees = assignees.length > 3 ? assignees.length - 3 : 0;
  const dueDate = formatDueDate(task.due_date);
  const trackedTime = formatDuration(task.tracked_seconds_cache ?? 0);
  const labels = task.labels ?? [];
  const checklistProgress = task.checklistProgress;

  const isDueSoon =
    task.due_date &&
    new Date(task.due_date).getTime() - new Date().getTime() <
      7 * 24 * 60 * 60 * 1000;

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData("text/task-id", task.id);
    event.dataTransfer.setData("text/task-status", task.status);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <article
      draggable
      onClick={() => onOpen(task.id)}
      onDragStart={handleDragStart}
      className="
        group relative cursor-pointer select-none
        rounded-2xl border border-white/8 bg-linear-to-br from-[#1a1a1a] to-[#0f0f0f] backdrop-blur-md
        px-4 py-3
        shadow-lg shadow-black/50
        transition-all duration-200
        hover:-translate-y-1 hover:border-orange-500/30 hover:shadow-2xl hover:shadow-orange-500/10
        active:cursor-grabbing active:scale-[0.98]
      "
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="text-sm font-semibold text-white leading-5 line-clamp-3 flex-1">
          {task.title}
        </h3>

        <span
          className={`
            shrink-0 rounded-md px-2 py-1 text-[9px] font-bold uppercase tracking-wider
            border ${getPriorityClasses(task.priority)}
          `}
        >
          {task.priority.slice(0, 3)}
        </span>
      </div>

      {task.description && (
        <p className="text-xs text-white/50 line-clamp-2 mb-3 leading-4">
          {task.description}
        </p>
      )}
      <div className="mb-3 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-white/70 font-medium">
          {task.status.replace(/_/g, " ")}
        </span>

        {task.is_billable && (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/15 px-2.5 py-1 text-[10px] text-emerald-300 font-medium">
            💰 Billable
          </span>
        )}

        {hasRunningTimer && (
          <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/15 px-2.5 py-1 text-[10px] text-orange-300 font-medium animate-pulse">
            <Radio size={10} />
            Live
          </span>
        )}
      </div>

      {labels.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {labels.slice(0, 3).map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-semibold text-white"
              style={{
                backgroundColor: `${label.color}20`,
                borderColor: `${label.color}40`,
                border: "1px solid",
              }}
            >
              <Tag size={10} />
              {label.name}
            </span>
          ))}
          {labels.length > 3 && (
            <span className="text-[9px] text-white/50">
              +{labels.length - 3}
            </span>
          )}
        </div>
      )}

      {checklistProgress && checklistProgress.total > 0 && (
        <div className="mb-3 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1 text-white/70">
              <CheckSquare size={12} />
              Checklist
            </div>
            <span className="text-white/50">
              {checklistProgress.completed}/{checklistProgress.total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all"
              style={{
                width: `${(checklistProgress.completed / checklistProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <div className="mb-3 space-y-2 pb-3 border-b border-white/5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-white/70">
            <Clock3 size={12} className="text-orange-400" />
            Time tracked
          </div>
          <span className="font-semibold text-white">{trackedTime}</span>
        </div>

        {dueDate && (
          <div
            className={`flex items-center justify-between text-xs ${isDueSoon ? "text-yellow-400" : "text-white/70"}`}
          >
            <div className="flex items-center gap-1">
              <CalendarClock size={12} />
              {isDueSoon ? "⚠️" : ""} {dueDate}
            </div>
          </div>
        )}
      </div>
      <div className="mb-3 flex items-center justify-between">
        {visibleAssignees.length > 0 && (
          <div className="flex -space-x-2">
            {visibleAssignees.map((a) => (
              <div
                key={a.id}
                title={a.full_name || a.email || "Team member"}
                className="
                  flex h-6 w-6 items-center justify-center
                  rounded-full bg-linear-to-br from-orange-400 to-orange-600
                  text-[9px] font-bold text-black
                  ring-2 ring-[#0f0f0f]
                  shadow-md
                "
              >
                {getInitials(a.full_name, a.email)}
              </div>
            ))}
            {extraAssignees > 0 && (
              <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/20 bg-white/10 text-[9px] font-bold text-white/70 ring-2 ring-[#0f0f0f]">
                +{extraAssignees}
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-2 text-[10px] text-white/50">
          {(task.comments_count ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare size={10} />
              {task.comments_count}
            </span>
          )}
          {(invitedCount ?? 0) > 0 && (
            <span className="flex items-center gap-1">
              <Eye size={10} />
              {invitedCount}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div
            title={`Created by ${task.created_by_full_name || task.created_by_email || "unknown"}`}
            className="
                flex h-7 w-7 items-center justify-center
                rounded-full bg-white/10 border border-white/10
                text-[9px] font-bold text-white/80
              "
          >
            {getInitials(
              task.created_by_full_name ?? task.created_by,
              task.created_by_email,
            )}
          </div>
          <span className="text-[10px] text-white/50">
            {formatRelativeDate(task.created_at)}
          </span>
          {task.watchers && task.watchers.length > 0 && (
            <div className="flex -space-x-1">
              {task.watchers.slice(0, 2).map((watcher, idx) => (
                <div
                  key={idx}
                  title={`Invited: ${watcher.full_name || watcher.email}`}
                  className="
                      flex h-5 w-5 items-center justify-center
                      rounded-full bg-gray-500/50 border border-white/20
                      text-[8px] font-bold text-white
                      ring-1 ring-background
                    "
                >
                  {getInitials(watcher.full_name, watcher.email)}
                </div>
              ))}
              {task.watchers.length > 2 && (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-500/30 border border-white/20 text-[8px] font-bold text-white/70 ring-1 ring-background">
                  +{task.watchers.length - 2}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-1">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onTrack(task.id, task.title);
            }}
            className="
              flex-1 rounded-md bg-orange-500/80 hover:bg-orange-500
              px-2 py-1.5 text-xs font-semibold text-black
              transition-all duration-150
              active:scale-95
              flex items-center justify-center gap-1
            "
          >
            <Clock3 size={12} />
            <span>Track</span>
          </button>
          <ManualTimeDialog
            taskId={task.id}
            organizationId={organizationId}
            userId={userId}
            onLogSuccess={(entry: TimeEntryItem) => {
              // refresh tracked time
              if (onTimeRefresh) onTimeRefresh();
            }}
            className="
              rounded-md bg-white/10 hover:bg-white/20
              px-2 py-1.5 text-xs font-semibold text-white
              transition-all duration-150
              active:scale-95
              flex items-center justify-center gap-1
            "
          />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[linear-gradient(135deg,rgba(249,115,22,0.08),transparent_35%)] opacity-0 transition group-hover:opacity-100" />
    </article>
  );
}
