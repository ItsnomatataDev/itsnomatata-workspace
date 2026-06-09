import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Menu,
  X,
  Plus,
  Clock,
  Loader2,
  Flag,
  MessageSquare,
  CheckCircle2,
  ChevronDown,
  Pause,
  Play,
  Search,
  Trash2,
} from "lucide-react";
import CardTimeIndicator from "../components/CardTimeIndicator";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import UserAvatar from "../../../components/common/UserAvatar";
import {
  getBoard,
  getCards,
  getCardById,
  createCard,
  getBoardStats,
  getLists,
  markStatusManuallyUpdated,
  moveCard,
  shouldAlignImportedStatus,
  updateCard,
  deleteCard,
} from "../services/boardService";
import CardDetailModal from "../components/Carddetailmodal";
import type { TaskItem, TaskStatus } from "../../../lib/supabase/queries/tasks";
import type { Board, BoardStats, Card, List } from "../../../types/board";
import { supabase } from "../../../lib/supabase/client";
import {
  getActiveTimeEntry,
  startTimeEntry,
  stopTimeEntry,
  type TimeEntryItem,
} from "../../../lib/supabase/mutations/timeEntries";
import {
  makeZimbabweLocalIso,
} from "../../../lib/utils/zimbabweCalendar";
import { getRunningEntryElapsedSeconds } from "../../../lib/utils/timeMath";
import { canManageAllOffices, canUseDetailedTimeTracking } from "../../../lib/offices";


type Task = Card;

function cardToTask(card: any): Task {
  return {
    ...card,
    assignees: (card.assignees ?? []).map((a: any) => ({
      id: a.id ?? a.user_id ?? "",
      task_id: card.id,
      user_id: a.user_id ?? a.id ?? "",
      created_at: a.created_at ?? new Date().toISOString(),
      username: a.username ?? null,
      full_name: a.full_name ?? null,
      email: a.email ?? null,
      avatar_url: a.avatar_url ?? null,
    })),
    commentsCount: card.commentsCount ?? 0,
  } as Task;
}

const COLUMNS: {
  status: TaskStatus;
  label: string;
  dot: string;
  accent: string;
}[] = [
  {
    status: "backlog",
    label: "Backlog",
    dot: "bg-white/30",
    accent: "border-t-white/20",
  },
  {
    status: "todo",
    label: "To Do",
    dot: "bg-blue-400",
    accent: "border-t-blue-500",
  },
  {
    status: "in_progress",
    label: "In Progress",
    dot: "bg-orange-400",
    accent: "border-t-orange-500",
  },
  {
    status: "review",
    label: "Review",
    dot: "bg-yellow-400",
    accent: "border-t-yellow-500",
  },
  {
    status: "done",
    label: "Done",
    dot: "bg-green-400",
    accent: "border-t-green-500",
  },
];

type BoardColumnView = {
  id: string;
  status: TaskStatus;
  label: string;
  dot: string;
  accent: string;
  columnId: string | null;
};

function InlineCardAdder({
  onAdd,
  onCancel,
}: {
  onAdd: (title: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const submit = async () => {
    const title = value.trim();
    if (!title) return;
    setSaving(true);
    try {
      await onAdd(title);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-orange-500/40 bg-[#1a1a1a] p-2 space-y-2">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void submit();
          }
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Enter a title for this card…"
        rows={2}
        className="w-full resize-none rounded-lg bg-white/8 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:bg-white/10"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={!value.trim() || saving}
          className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 disabled:opacity-50 transition"
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Plus size={12} />
          )}
          Add card
        </button>
        <button
          onClick={onCancel}
          className="rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-white/30",
};

const STATUS_BADGE_COLOR: Record<string, string> = {
  backlog: "bg-white/10 text-white/60",
  todo: "bg-blue-500/15 text-blue-300",
  in_progress: "bg-orange-500/15 text-orange-300",
  review: "bg-yellow-500/15 text-yellow-300",
  done: "bg-green-500/15 text-green-300",
};

function KanbanCard({
  task,
  onOpen,
  onDelete,
  onDragStart,
  onTrack,
  isTrackingThisTask,
  liveSeconds,
  onPauseTimer,
  hasRunningTimer,
  timerBusy,
  canTrackTime,
}: {
  task: Task;
  onOpen: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onDragStart: (e: React.DragEvent, id: string, status: TaskStatus) => void;
  onTrack: (taskId: string, title: string) => void;
  isTrackingThisTask?: boolean;
  liveSeconds?: number;
  onPauseTimer?: () => void;
  hasRunningTimer?: boolean;
  timerBusy?: boolean;
  canTrackTime?: boolean;
}) {
  const priority = PRIORITY_COLOR[task.priority] ?? PRIORITY_COLOR.medium;
  const labels = Array.isArray(task.metadata?.labels)
    ? (task.metadata.labels as Array<{ id: string; name: string; color: string }>)
    : [];
  const trackedSeconds = Number(task.tracked_seconds_cache ?? 0) +
    (isTrackingThisTask ? Number(liveSeconds ?? 0) : 0);
  const estimatedSeconds = Number(task.estimated_seconds ?? 0);
  const estimatePercent = estimatedSeconds > 0
    ? Math.min(100, Math.round((trackedSeconds / estimatedSeconds) * 100))
    : 0;
  const isOverEstimate = estimatedSeconds > 0 && trackedSeconds > estimatedSeconds;
  const isOverdue =
    task.due_date &&
    new Date(task.due_date) < new Date() &&
    task.status !== "done";
  const allAssignees = (task.assignees as any[]) ?? [];
  const visibleAssignees = allAssignees.slice(0, 3);
  const extraAssignees = Math.max(0, allAssignees.length - visibleAssignees.length);
  const assigneeNames = allAssignees
    .map((assignee) => assignee.full_name || assignee.email)
    .filter(Boolean)
    .join(", ");
  const formatLiveTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const pad = (v: number) => String(v).padStart(2, "0");
    if (hrs > 0) return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
    return `${pad(mins)}:${pad(secs)}`;
  };

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id, task.status)}
      onClick={() => onOpen(task.id)}
      className="group w-full cursor-pointer rounded-xl border border-white/10 bg-[#131313] p-3 transition-all hover:border-white/25 hover:bg-[#1c1c1c] hover:shadow-lg hover:shadow-black/40 active:opacity-70"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium text-white leading-snug line-clamp-3">
          {task.title}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id, task.title);
          }}
          className="shrink-0 rounded-lg p-1 text-white/20 opacity-0 transition group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-300"
          title="Delete card"
        >
          <Trash2 size={13} />
        </button>
      </div>
      <div className="mb-2">
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold capitalize ${
            STATUS_BADGE_COLOR[task.status] ?? "bg-white/10 text-white/50"
          }`}
        >
          {task.status.replace("_", " ")}
        </span>
      </div>
      {/* Title */}
      {labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {labels.slice(0, 4).map((label) => (
            <span
              key={label.id}
              className="h-2 min-w-8 rounded-full"
              style={{ backgroundColor: label.color }}
              title={label.name}
            />
          ))}
        </div>
      )}

      {assigneeNames ? (
        <p className="mb-2 truncate text-[11px] text-white/55" title={assigneeNames}>
          Assigned to {assigneeNames}
        </p>
      ) : null}

      {/* Due date */}
      {task.due_date && (
        <div
          className={`inline-flex items-center gap-1 text-[11px] rounded-md px-2 py-0.5 mb-2 font-medium ${
            isOverdue
              ? "bg-red-500/20 text-red-400"
              : task.status === "done"
                ? "bg-green-500/15 text-green-400"
                : "bg-white/8 text-white/50"
          }`}
        >
          <Clock size={10} />
          {new Date(task.due_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </div>
      )}

      {estimatedSeconds > 0 && (
        <div className="mb-2">
          <div className="mb-1 flex items-center justify-between text-[10px] text-white/35">
            <span>Estimate</span>
            <span className={isOverEstimate ? "text-red-300" : "text-white/45"}>
              {estimatePercent}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full ${isOverEstimate ? "bg-red-500" : "bg-orange-500"}`}
              style={{ width: `${estimatePercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`flex items-center gap-1 text-[11px] font-medium ${priority}`}
          >
            <Flag size={10} /> {task.priority}
          </span>
          {!!task.commentsCount && (
            <span className="flex items-center gap-1 text-[11px] text-white/35">
              <MessageSquare size={10} /> {task.commentsCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {canTrackTime && isTrackingThisTask ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2 py-1">
              <div className="h-1 w-1 rounded-full bg-orange-500 animate-pulse" />
              <span className="text-[10px] font-mono font-semibold text-orange-400">
                {formatLiveTime(liveSeconds || 0)}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPauseTimer?.();
                }}
                disabled={timerBusy}
                className="rounded p-0.5 text-orange-400 hover:bg-orange-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                title="Pause timer"
              >
                <Pause size={10} />
              </button>
            </div>
          ) : canTrackTime ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onTrack(task.id, task.title);
              }}
              disabled={hasRunningTimer || timerBusy}
              className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-white/50 hover:bg-white/10 hover:text-white transition disabled:opacity-50 disabled:cursor-not-allowed"
              title={hasRunningTimer ? "Another timer is running" : "Start timer"}
            >
              <Play size={10} />
            </button>
          ) : null}
          <CardTimeIndicator
            taskId={task.id}
            className="text-[11px]"
            showTotalTime
            todayOnly
          />
          {visibleAssignees.length > 0 ? (
            <div className="flex -space-x-1">
              {visibleAssignees.map((assignee) => (
                <UserAvatar
                  key={assignee.user_id ?? assignee.id}
                  person={assignee}
                  size="sm"
                  className="border-orange-500/30 ring-2 ring-[#131313]"
                />
              ))}
              {extraAssignees > 0 && (
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/10 text-[9px] font-bold text-white/50 ring-2 ring-[#131313]">
                  +{extraAssignees}
                </div>
              )}
            </div>
          ) : (
            <UserAvatar
              person={{
                username: task.created_by_username,
                full_name: task.created_by_full_name ?? task.created_by,
                email: task.created_by_email,
                avatar_url: task.created_by_avatar_url,
              }}
              size="sm"
              className="border-dashed border-white/15 ring-2 ring-[#131313]"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Column ─────────────────────────────────────────────────────────────────────

function KanbanColumn({
  status,
  label,
  dot,
  accent,
  columnId,
  tasks,
  onOpen,
  onDelete,
  onAddCard,
  onDragStart,
  onDrop,
  onTrack,
  isTrackingThisTask,
  liveSeconds,
  onPauseTimer,
  hasRunningTimer,
  timerBusy,
  canTrackTime,
}: {
  status: TaskStatus;
  label: string;
  dot: string;
  accent: string;
  columnId: string | null;
  tasks: Task[];
  onOpen: (id: string) => void;
  onDelete: (id: string, title: string) => void;
  onAddCard: (status: TaskStatus, title: string, columnId?: string | null) => Promise<void>;
  onDragStart: (e: React.DragEvent, id: string, status: TaskStatus) => void;
  onDrop: (e: React.DragEvent, targetStatus: TaskStatus) => void;
  onTrack: (taskId: string, title: string) => void;
  isTrackingThisTask?: (taskId: string) => boolean;
  liveSeconds?: number;
  onPauseTimer?: () => void;
  hasRunningTimer?: boolean;
  timerBusy?: boolean;
  canTrackTime?: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsOver(true);
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(e) => {
        setIsOver(false);
        onDrop(e, status);
      }}
      className={`flex w-[min(18rem,calc(100vw-2rem))] shrink-0 flex-col rounded-2xl border border-t-2 sm:w-72 ${accent} ${
        isOver ? "border-orange-500/40 bg-orange-500/5" : "border-white/10"
      } bg-[#0d0d0d] transition-colors`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-3.5 pb-3">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${dot}`} />
          <h3 className="text-sm font-semibold text-white">{label}</h3>
          <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs font-medium text-white/50">
            {tasks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white transition"
          aria-label={`Add card to ${label}`}
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex min-h-20 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3 max-h-[calc(100dvh-260px)] sm:max-h-[calc(100vh-230px)]">
        {tasks.map((task) => (
          <KanbanCard
            key={task.id}
            task={task}
            onOpen={onOpen}
            onDelete={onDelete}
            onDragStart={onDragStart}
            onTrack={onTrack}
            isTrackingThisTask={isTrackingThisTask?.(task.id)}
            liveSeconds={liveSeconds}
            onPauseTimer={onPauseTimer}
            hasRunningTimer={hasRunningTimer}
            timerBusy={timerBusy}
            canTrackTime={canTrackTime}
          />
        ))}

        {adding ? (
          <InlineCardAdder
            onAdd={async (title) => {
              await onAddCard(status, title, columnId);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-xs text-white/25 hover:border-white/25 hover:text-white/60 transition"
          >
            <Plus size={13} /> Add a card
          </button>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function BoardViewPage() {
  const auth = useAuth();
  const { boardId } = useParams<{ boardId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;
  const canViewAllOffices = canManageAllOffices(profile);
  const canTrackTime = canUseDetailedTimeTracking(profile);

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<BoardColumnView[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groupedTasks, setGroupedTasks] = useState<Record<string, Task[]>>({});
  const [stats, setStats] = useState<BoardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTimer, setActiveTimer] = useState<TimeEntryItem | null>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [timerBusy, setTimerBusy] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const requestedCardId = useMemo(() => {
    return new URLSearchParams(location.search).get("cardId");
  }, [location.search]);

  // drag state
  const dragRef = useRef<{ id: string; status: TaskStatus } | null>(null);

  const makeColumnViews = useCallback((lists: List[]): BoardColumnView[] => {
    return lists.map((list, index) => {
      const fallback = COLUMNS[index] ?? COLUMNS[COLUMNS.length - 1];
      const statusFromId = list.id.startsWith("list-")
        ? list.id.replace("list-", "") as TaskStatus
        : null;
      const status = statusFromId ?? statusFromTrelloListName(list.name);

      return {
        id: list.id,
        columnId: list.id.startsWith("list-") ? null : list.id,
        status,
        label: list.name,
        dot: fallback.dot,
        accent: fallback.accent,
      };
    });
  }, []);

  const loadActiveTimer = useCallback(async () => {
    if (!auth?.user?.id || !organizationId || !canTrackTime) {
      setActiveTimer(null);
      return;
    }

    const runningEntry = await getActiveTimeEntry({
      organizationId,
      userId: auth.user.id,
    });

    setActiveTimer(runningEntry);
  }, [auth?.user?.id, organizationId, canTrackTime]);

  useEffect(() => {
    loadActiveTimer();
  }, [loadActiveTimer]);

  useEffect(() => {
    if (!activeTimer) {
      setLiveSeconds(0);
      return;
    }

    const tick = () => {
      setLiveSeconds(getRunningEntryElapsedSeconds(activeTimer));
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer]);

  // ── Load ─────────────────────────────────────────────────────────────────────

  const loadBoardData = useCallback(async () => {
    if (!boardId || !organizationId) return;
    try {
      setLoading(true);
      setError("");

      const boardData = await getBoard(boardId);
      if (!boardData) throw new Error(`Board not found (id: ${boardId})`);
      const profileOfficeId = (profile?.office_id as string | null | undefined) ?? null;
      if (
        !canViewAllOffices &&
        boardData.office_id &&
        profileOfficeId &&
        boardData.office_id !== profileOfficeId
      ) {
        navigate("/boards", {
          replace: true,
          state: { error: "You do not have access to that office board." },
        });
        return;
      }

      const [listsData, cardsData] = await Promise.all([
        getLists(boardId),
        getCards(organizationId, boardId),
      ]);

      setBoard(boardData);

      const nextColumns = makeColumnViews(listsData);
      setColumns(nextColumns);
      const normalised = (cardsData as any[]).map(cardToTask);
      const aligned = alignImportedCardStatuses(normalised, nextColumns);
      setTasks(aligned);
      setGroupedTasks(groupByColumn(aligned, nextColumns));

      // Stats non-critical
      getBoardStats(organizationId, boardId).then(setStats).catch(console.warn);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load board.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [boardId, canViewAllOffices, navigate, organizationId, profile?.office_id, makeColumnViews]);

  useEffect(() => {
    void loadBoardData();
  }, [loadBoardData]);

  useEffect(() => {
    if (!requestedCardId) {
      setSelectedTask(null);
      return;
    }

    if (loading) return;

    const nextSelectedTask = tasks.find((task) => task.id === requestedCardId);
    if (nextSelectedTask) {
      setSelectedTask((current) =>
        current?.id === nextSelectedTask.id
          ? { ...current, ...nextSelectedTask }
          : nextSelectedTask,
      );
      return;
    }

    if (!organizationId) return;

    let cancelled = false;
    void getCardById(organizationId, requestedCardId)
      .then((card) => {
        if (cancelled || !card) return;
        const deepLinkedTask = cardToTask(card);
        setSelectedTask(deepLinkedTask);
        setTasks((current) => {
          if (current.some((task) => task.id === deepLinkedTask.id)) return current;
          return [...current, deepLinkedTask];
        });
        setGroupedTasks((current) => {
          const groupKey =
            deepLinkedTask.column_id ??
            deepLinkedTask.status ??
            "todo";
          return {
            ...current,
            [groupKey]: [...(current[groupKey] ?? []), deepLinkedTask],
          };
        });
      })
      .catch((err) => {
        console.warn("Failed to open card from notification link:", err);
        if (!cancelled) setSelectedTask(null);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, organizationId, requestedCardId, tasks]);

  // Realtime subscription for time entries and cards
  useEffect(() => {
    if (!organizationId || !boardId) return;

    const channel = supabase
      .channel('board-view-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'time_entries',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          // Reload board data when time entries change
          loadBoardData();
          loadActiveTimer();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `client_id=eq.${boardId}`,
        },
        () => {
          // Reload board data when cards change
          loadBoardData();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'task_assignees',
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          loadBoardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, boardId, loadBoardData, loadActiveTimer]);

  function statusFromTrelloListName(name: string | null | undefined): TaskStatus {
    const normalized = name?.trim().toLowerCase() ?? "";
    const compact = normalized.replace(/[^a-z0-9]/g, "");
    if (normalized.includes("done") || normalized.includes("complete")) return "done";
    if (normalized.includes("review") || normalized.includes("approval")) return "review";
    if (normalized.includes("todo") || compact.includes("todo")) return "todo";
    if (
      normalized.includes("progress") ||
      normalized.includes("doing") ||
      normalized.includes("active")
    ) return "in_progress";
    if (
      normalized.includes("backlog") ||
      normalized.includes("ideas") ||
      normalized.includes("pending")
    ) return "backlog";
    return "todo";
  }

  function isKnownTrelloTodoListName(name: string) {
    const normalized = name.trim().toLowerCase();
    const compact = normalized.replace(/[^a-z0-9]/g, "");
    return normalized.includes("todo") || compact.includes("todo");
  }

  function getImportedStatusFromMetadata(task: Task): TaskStatus | null {
    const metadata = (task.metadata ?? {}) as Record<string, unknown>;
    if (!shouldAlignImportedStatus(task)) return null;

    if (metadata.trello_closed === true || metadata.trello_due_complete === true) {
      return "done";
    }

    const sourceListName =
      typeof metadata.original_trello_list_name === "string"
        ? metadata.original_trello_list_name
        : typeof metadata.trello_list_name === "string"
          ? metadata.trello_list_name
          : null;

    if (!sourceListName) return null;
    const sourceStatus = statusFromTrelloListName(sourceListName);
    return sourceStatus === "todo" && !isKnownTrelloTodoListName(sourceListName)
      ? null
      : sourceStatus;
  }

  function alignImportedCardStatuses(
    list: Task[],
    boardColumns: BoardColumnView[],
  ): Task[] {
    const changed: Array<{ taskId: string; updates: Partial<Card> }> = [];

    const aligned = list.map((task) => {
      if (!shouldAlignImportedStatus(task)) return task;

      const sourceStatus = getImportedStatusFromMetadata(task);
      if (!sourceStatus) return task;

      const workflowColumnId = getWorkflowColumnIdForStatus(
        sourceStatus,
        boardColumns,
      );
      const nextColumnId = workflowColumnId ?? null;
      if (task.status === sourceStatus && (task.column_id ?? null) === nextColumnId) {
        return task;
      }

      const updates: Partial<Card> = {
        status: sourceStatus,
        column_id: nextColumnId,
      };
      changed.push({ taskId: task.id, updates });
      return { ...task, ...updates } as Task;
    });

    for (const change of changed) {
      void updateCard(change.taskId, change.updates).catch((err) => {
        console.warn("Failed to align imported card status", err);
      });
    }

    return aligned;
  }

  function groupByColumn(
    list: Task[],
    boardColumns: BoardColumnView[] = columns,
  ): Record<string, Task[]> {
    const columnIds = new Set(
      boardColumns.map((column) => column.columnId).filter(Boolean),
    );

    return list.reduce(
      (acc, t) => {
        const key = t.column_id && columnIds.has(t.column_id)
          ? t.column_id
          : t.status || "todo";
        if (!acc[key]) acc[key] = [];
        acc[key].push(t);
        return acc;
      },
      {} as Record<string, Task[]>,
    );
  }

  const filteredTasks = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return tasks;

    return tasks.filter((task) => {
      const metadata = task.metadata ?? {};
      const labels = Array.isArray(metadata.labels)
        ? metadata.labels as Array<{ name?: string | null; color?: string | null }>
        : [];
      const assignees = (task.assignees as any[]) ?? [];
      const haystack = [
        task.title,
        task.description,
        task.status,
        task.priority,
        metadata.trello_list_name,
        metadata.original_trello_list_name,
        metadata.trello_short_link,
        ...labels.flatMap((label) => [label.name, label.color]),
        ...assignees.flatMap((assignee) => [assignee.full_name, assignee.email]),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [tasks, searchValue]);

  const visibleGroupedTasks = useMemo(
    () => groupByColumn(filteredTasks, columns),
    [filteredTasks, columns],
  );

  function getWorkflowColumnIdForStatus(
    status: TaskStatus,
    boardColumns: BoardColumnView[] = columns,
  ) {
    const workflowLabel = COLUMNS.find((column) => column.status === status)?.label;
    const exact = boardColumns.find(
      (column) =>
        column.status === status &&
        column.columnId &&
        workflowLabel &&
        column.label.trim().toLowerCase() === workflowLabel.toLowerCase(),
    );
    return exact?.columnId ?? null;
  }

  function withWorkflowColumnForStatus<T extends Partial<TaskItem>>(
    updates: T,
    boardColumns: BoardColumnView[] = columns,
  ): T & { column_id?: string | null } {
    if (!updates.status) return updates;
    return {
      ...updates,
      column_id: getWorkflowColumnIdForStatus(updates.status, boardColumns),
    };
  }

  // ── Add card ─────────────────────────────────────────────────────────────────

  const handleAddCard = useCallback(
    async (status: TaskStatus, title: string, columnId?: string | null) => {
      if (!organizationId || !boardId) return;
      const rawCard = await createCard(organizationId, boardId, {
        title,
        status,
        columnId: columnId ?? null,
        createdBy: auth?.user?.id ?? null,
      });
      const newTask = cardToTask(rawCard);
      setTasks((prev) => [...prev, newTask]);
      setGroupedTasks((prev) => {
        const next = { ...prev };
        const groupKey = columnId ?? status;
        if (!next[groupKey]) next[groupKey] = [];
        next[groupKey] = [...next[groupKey], newTask];
        return next;
      });
      getBoardStats(organizationId, boardId).then(setStats).catch(console.warn);
    },
    [organizationId, boardId, auth?.user?.id],
  );

  // ── Open card ────────────────────────────────────────────────────────────────

  const handleOpenTask = useCallback(
    (taskId: string) => {
      setSelectedTask(tasks.find((t) => t.id === taskId) ?? null);
      const params = new URLSearchParams(location.search);
      params.set("cardId", taskId);
      navigate(
        {
          pathname: location.pathname,
          search: params.toString(),
        },
        { replace: false },
      );
    },
    [location.pathname, location.search, navigate, tasks],
  );

  const handleCloseTaskModal = useCallback(() => {
    setSelectedTask(null);
    const params = new URLSearchParams(location.search);
    params.delete("cardId");
    navigate(
      {
        pathname: location.pathname,
        search: params.toString(),
      },
      { replace: true },
    );
  }, [location.pathname, location.search, navigate]);

  const handleUpdateTask = useCallback(
    (updates: Partial<TaskItem>) => {
      const taskId = selectedTask?.id;
      if (!taskId) return;

      const persistedUpdates: Partial<TaskItem> = withWorkflowColumnForStatus({
        ...updates,
      });
      if (updates.status !== undefined) {
        persistedUpdates.metadata = markStatusManuallyUpdated(
          {
            ...((selectedTask.metadata ?? {}) as Record<string, unknown>),
            ...((updates.metadata ?? {}) as Record<string, unknown>),
          },
          auth?.user?.id ?? null,
        );
      }
      if (updates.due_date !== undefined) {
        persistedUpdates.due_date = updates.due_date
          ? makeZimbabweLocalIso(updates.due_date.slice(0, 10), "17:00:00")
          : null;
      }
      if (updates.start_date !== undefined) {
        persistedUpdates.start_date = updates.start_date
          ? makeZimbabweLocalIso(updates.start_date.slice(0, 10), "08:00:00")
          : null;
      }

      setSelectedTask((prev) =>
        prev ? ({ ...prev, ...persistedUpdates } as Task) : null,
      );
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? ({ ...t, ...persistedUpdates } as Task) : t,
        ),
      );
      const nextTasks = tasks.map((t) =>
        t.id === taskId ? ({ ...t, ...persistedUpdates } as Task) : t,
      );
      setGroupedTasks(groupByColumn(nextTasks));

      void updateCard(
        taskId,
        persistedUpdates as Partial<Card>,
        updates.status !== undefined
          ? { markStatusAsManual: true, userId: auth?.user?.id ?? null }
          : undefined,
      ).catch((err) => {
        console.error("Failed to save card updates:", err);
        alert(err?.message || "Failed to save card updates");
        void loadBoardData();
      });
    },
    [auth?.user?.id, loadBoardData, selectedTask, tasks],
  );

  // ── Drag & drop ──────────────────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (e: React.DragEvent, id: string, status: TaskStatus) => {
      dragRef.current = { id, status };
      e.dataTransfer.effectAllowed = "move";
    },
    [],
  );

  const handleDeleteTask = useCallback(
    async (taskId: string, title: string, confirmFirst = true) => {
      if (confirmFirst && !window.confirm(`Delete "${title}"? This removes the card and keeps existing time entries for reporting.`)) {
        return;
      }

      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      setGroupedTasks((prev) => {
        const next: Record<string, Task[]> = {};
        for (const [key, value] of Object.entries(prev)) {
          next[key] = value.filter((task) => task.id !== taskId);
        }
        return next;
      });
      setSelectedTask((current) => current?.id === taskId ? null : current);
      if (selectedTask?.id === taskId) {
        handleCloseTaskModal();
      }

      try {
        await deleteCard(taskId);
        if (organizationId && boardId) {
          getBoardStats(organizationId, boardId).then(setStats).catch(console.warn);
        }
      } catch (err) {
        console.error("Delete card failed, reloading", err);
        void loadBoardData();
      }
    },
    [boardId, handleCloseTaskModal, loadBoardData, organizationId, selectedTask?.id],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStatus: TaskStatus, targetColumnId?: string | null) => {
      e.preventDefault();
      const drag = dragRef.current;
      if (!drag) return;
      const task = tasks.find((t) => t.id === drag.id);
      if (!task) {
        dragRef.current = null;
        return;
      }

      const nextTask = {
        ...task,
        status: targetStatus,
        column_id: targetColumnId ?? null,
        metadata: markStatusManuallyUpdated(
          (task.metadata ?? {}) as Record<string, unknown>,
          auth?.user?.id ?? null,
        ),
      } as Task;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) => (t.id === drag.id ? nextTask : t)),
      );
      setSelectedTask((current) => (current?.id === drag.id ? nextTask : current));
      setGroupedTasks((prev) => {
        const next = { ...prev };
        const sourceKey = task.column_id ?? drag.status;
        const targetKey = targetColumnId ?? targetStatus;
        next[sourceKey] = (next[sourceKey] ?? []).filter((t) => t.id !== drag.id);
        next[targetKey] = [...(next[targetKey] ?? []), nextTask];
        return next;
      });

      try {
        await moveCard(drag.id, targetStatus, 0, targetColumnId ?? null, {
          markStatusAsManual: true,
          userId: auth?.user?.id ?? null,
        });
      } catch (err) {
        console.error("Move failed, reverting", err);
        alert((err as any)?.message || "Failed to move card");
        void loadBoardData();
      }
      dragRef.current = null;
    },
    [auth?.user?.id, tasks, loadBoardData],
  );

  // ── Timer handlers ─────────────────────────────────────────────────────────────

  const handleTrack = useCallback(async (taskId: string, title: string) => {
    if (!auth?.user?.id || !organizationId || !canTrackTime) return;
    
    try {
      setTimerBusy(true);

      const inProgressColumnId = getWorkflowColumnIdForStatus("in_progress");

      await startTimeEntry({
        organizationId,
        userId: auth.user.id,
        taskId,
        clientId: boardId ?? null,
        description: `Working on ${title}`,
        source: "board",
      });

      await updateCard(taskId, {
        status: "in_progress",
        column_id: inProgressColumnId,
      } as Partial<Card>, {
        markStatusAsManual: true,
        userId: auth.user.id,
      });

      // Reload active timer
      await loadActiveTimer();
      await loadBoardData();
    } catch (err: any) {
      console.error("Failed to start timer:", err);
      alert(err?.message || "Failed to start timer");
    } finally {
      setTimerBusy(false);
    }
  }, [auth?.user?.id, boardId, canTrackTime, getWorkflowColumnIdForStatus, loadActiveTimer, loadBoardData, organizationId]);

  const isTrackingThisTask = useCallback((taskId: string) => {
    return activeTimer?.task_id === taskId;
  }, [activeTimer]);

  const handlePauseTimer = useCallback(async () => {
    if (!activeTimer?.id || !activeTimer?.started_at) return;

    try {
      setTimerBusy(true);

      await stopTimeEntry(activeTimer.id, {
        userId: auth?.user?.id,
        organizationId: organizationId ?? undefined,
      });

      await loadActiveTimer();
    } catch (err: any) {
      console.error("Failed to stop timer:", err);
      alert(err?.message || "Failed to stop timer");
    } finally {
      setTimerBusy(false);
    }
  }, [activeTimer, auth?.user?.id, loadActiveTimer, organizationId]);

  // ── Guards ───────────────────────────────────────────────────────────────────

  if (!auth?.user || !profile || !organizationId) return null;

  if (error) {
    return (
      <div className="flex min-h-screen flex-col bg-[#050505] lg:flex-row">
        <Sidebar role={profile.primary_role ?? "manager"} />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-8 py-6 text-center max-w-md w-full">
            <X size={24} className="text-red-400 mx-auto mb-4" />
            <p className="text-base font-semibold text-red-300 mb-2">
              Failed to load board
            </p>
            <p className="text-sm text-red-400/70 mb-5 wrap-break-word">{error}</p>
            <button
              onClick={() => void loadBoardData()}
              className="rounded-xl bg-orange-500 hover:bg-orange-600 px-5 py-2 text-sm font-semibold text-white transition"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const total = stats?.totalCards ?? 0;
  const done = stats?.cardsDone ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="flex min-h-screen flex-col bg-[#050505] lg:flex-row">
      <Sidebar role={profile.primary_role ?? "manager"} />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* ── Header ── */}
        <div className="flex shrink-0 flex-col gap-3 border-b border-white/10 bg-[#080808] px-4 py-3 sm:px-5 md:flex-row md:items-center md:justify-between md:gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-base font-bold text-white truncate">
                  {loading ? (
                    <span className="inline-block h-5 w-36 animate-pulse rounded bg-white/10" />
                  ) : (
                    board?.name
                  )}
                </h1>
                {board?.industry && (
                  <span className="hidden md:inline text-[11px] text-white/40 border border-white/10 rounded-lg px-2 py-0.5">
                    {board.industry}
                  </span>
                )}
              </div>
              {!loading && total > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-20 h-1 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-white/35">
                    {done}/{total} done
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="hidden min-w-64 max-w-sm flex-1 items-center md:flex">
            <div className="relative w-full">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
              />
              <input
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search cards, members, labels..."
                className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-9 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-500/40 focus:bg-white/8"
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/30 transition hover:bg-white/10 hover:text-white"
                  aria-label="Clear card search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!loading && stats && (
              <div className="hidden items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-4 py-2 text-xs text-white/50 md:flex">
                <span>
                  <span className="font-semibold text-orange-400">
                    {stats.cardsInProgress}
                  </span>{" "}
                  active
                </span>
                <span className="text-white/15">|</span>
                <span>
                  <Clock size={10} className="inline mr-1" />
                  {Math.floor((stats.totalTimeTracked ?? 0) / 3600)}h tracked
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="border-b border-white/10 bg-[#080808] px-5 py-3 md:hidden">
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
            />
            <input
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder="Search cards..."
              className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-9 pr-9 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-orange-500/40 focus:bg-white/8"
            />
            {searchValue && (
              <button
                type="button"
                onClick={() => setSearchValue("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/30 transition hover:bg-white/10 hover:text-white"
                aria-label="Clear card search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={26} className="text-orange-500 animate-spin" />
                  <p className="text-sm text-white/40">Loading board…</p>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-w-max items-start gap-3 p-4 sm:gap-4 sm:p-6">
                {columns.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    {...col}
                    tasks={visibleGroupedTasks[col.columnId ?? col.status] ?? []}
                    onOpen={handleOpenTask}
                    onDelete={handleDeleteTask}
                    onAddCard={handleAddCard}
                    onDragStart={handleDragStart}
                    onDrop={(event, status) => handleDrop(event, status, col.columnId)}
                    onTrack={handleTrack}
                    isTrackingThisTask={isTrackingThisTask}
                    liveSeconds={liveSeconds}
                    onPauseTimer={handlePauseTimer}
                    hasRunningTimer={!!activeTimer}
                    timerBusy={timerBusy}
                    canTrackTime={canTrackTime}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Card Detail Modal */}
      {selectedTask && auth?.user && (
        <CardDetailModal
          cardId={selectedTask.id}
          card={selectedTask}
          isOpen={!!selectedTask}
          onClose={handleCloseTaskModal}
          onUpdate={handleUpdateTask}
          onDelete={(cardId) => handleDeleteTask(cardId, selectedTask.title, false)}
          onToggleTimer={(id, title) => {
            if (activeTimer?.task_id === id) {
              void handlePauseTimer();
              return;
            }
            void handleTrack(id, title);
          }}
          hasRunningTimer={!!activeTimer}
          currentUserId={auth.user.id}
          organizationId={organizationId!}
          boardOfficeId={selectedTask.office_id ?? board?.office_id ?? null}
        />
      )}

    </div>
  );
}
