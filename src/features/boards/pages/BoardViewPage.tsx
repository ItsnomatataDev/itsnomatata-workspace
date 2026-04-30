import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import {
  Menu,
  X,
  Plus,
  Clock,
  LayoutList,
  Loader2,
  Flag,
  MessageSquare,
  User,
  CheckCircle2,
  ChevronDown,
  Pause,
  Play,
  Trash2,
} from "lucide-react";
import CardTimeIndicator from "../components/CardTimeIndicator";
import { useAuth } from "../../../app/providers/AuthProvider";
import BoardSidebar from "../components/BoardSidebar";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import {
  getBoard,
  getCards,
  createCard,
  getBoardStats,
  getLists,
  moveCard,
  updateCard,
  deleteCard,
} from "../services/boardService";
import CardDetailModal from "../components/Carddetailmodal";
import type { TaskItem, TaskStatus } from "../../../lib/supabase/queries/tasks";
import type { Board, BoardStats, Card, List } from "../../../types/board";
import { useTimeEntries } from "../../../lib/hooks/useTimeEntries";
import { supabase } from "../../../lib/supabase/client";
import {
  clampToZimbabweCutoff,
  isAtOrAfterZimbabweCutoff,
  makeZimbabweLocalIso,
} from "../../../lib/utils/zimbabweCalendar";


type Task = Card;

function cardToTask(card: any): Task {
  return {
    ...card,
    assignees: (card.assignees ?? []).map((a: any) => ({
      id: a.id ?? a.user_id ?? "",
      task_id: card.id,
      user_id: a.user_id ?? a.id ?? "",
      created_at: a.created_at ?? new Date().toISOString(),
      full_name: a.full_name ?? null,
      email: a.email ?? null,
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

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-white/30",
};

// ── Codex inline add ──────────────────────────────────────────────────────────

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

// ── Codex workflow card ───────────────────────────────────────────────────────

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
  const initials = (() => {
    const a = (task.assignees as any[])?.[0];
    if (!a) return null;
    const src = a.full_name ?? a.email ?? "";
    const parts = src.split(" ").filter(Boolean);
    return parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : src.slice(0, 2).toUpperCase();
  })();

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
          {isTrackingThisTask ? (
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
          ) : (
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
          )}
          <CardTimeIndicator
            taskId={task.id}
            className="text-[11px]"
            showTotalTime
          />
          {initials ? (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/20 border border-orange-500/30 text-[10px] font-bold text-orange-400">
              {initials}
            </div>
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-white/15">
              <User size={10} className="text-white/25" />
            </div>
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
      className={`flex w-72 shrink-0 flex-col rounded-2xl border border-t-2 ${accent} ${
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
          onClick={() => setAdding(true)}
          className="rounded-lg p-1 text-white/30 hover:bg-white/10 hover:text-white transition"
        >
          <Plus size={15} />
        </button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 overflow-y-auto px-3 pb-3 flex-1 min-h-20 max-h-[calc(100vh-230px)]">
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
          />
        ))}

        {/* Inline adder */}
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
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;

  const [board, setBoard] = useState<Board | null>(null);
  const [columns, setColumns] = useState<BoardColumnView[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [groupedTasks, setGroupedTasks] = useState<Record<string, Task[]>>({});
  const [stats, setStats] = useState<BoardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [activeTimer, setActiveTimer] = useState<any>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [timerBusy, setTimerBusy] = useState(false);

  // drag state
  const dragRef = useRef<{ id: string; status: TaskStatus } | null>(null);

  // Timer state
  const { entries } = useTimeEntries({
    organizationId,
    userId: auth?.user?.id,
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date().toISOString(),
  });

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
    if (!auth?.user?.id || !organizationId) return;
    
    const { data: runningEntry } = await supabase
      .from("time_entries")
      .select("*")
      .eq("user_id", auth.user.id)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    
    setActiveTimer(runningEntry);
  }, [auth?.user?.id, organizationId]);

  useEffect(() => {
    loadActiveTimer();
  }, [loadActiveTimer]);

  useEffect(() => {
    if (!activeTimer) {
      setLiveSeconds(0);
      return;
    }

    const tick = () => {
      const startedAtMs = new Date(activeTimer.started_at).getTime();
      const nowMs = Date.now();
      const diff = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
      setLiveSeconds(diff);
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

      const [boardData, listsData, cardsData] = await Promise.all([
        getBoard(boardId),
        getLists(boardId),
        getCards(organizationId, boardId),
      ]);

      if (!boardData) throw new Error(`Board not found (id: ${boardId})`);
      setBoard(boardData);

      const nextColumns = makeColumnViews(listsData);
      setColumns(nextColumns);
      const normalised = (cardsData as any[]).map(cardToTask);
      setTasks(normalised);
      setGroupedTasks(groupByColumn(normalised, nextColumns));

      // Stats non-critical
      getBoardStats(organizationId, boardId).then(setStats).catch(console.warn);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load board.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [boardId, organizationId]);

  useEffect(() => {
    void loadBoardData();
  }, [loadBoardData]);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, boardId, loadBoardData, loadActiveTimer]);

  function statusFromTrelloListName(name: string | null | undefined): TaskStatus {
    const normalized = name?.trim().toLowerCase() ?? "";
    if (normalized.includes("done") || normalized.includes("complete")) return "done";
    if (normalized.includes("review") || normalized.includes("approval")) return "review";
    if (normalized.includes("progress") || normalized.includes("doing")) return "in_progress";
    if (normalized.includes("backlog")) return "backlog";
    return "todo";
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

  function getWorkflowColumnIdForStatus(
    status: TaskStatus,
    boardColumns: BoardColumnView[] = columns,
  ) {
    const exact = boardColumns.find(
      (column) => column.status === status && column.columnId,
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
    },
    [tasks],
  );

  const handleUpdateTask = useCallback(
    (updates: Partial<TaskItem>) => {
      const taskId = selectedTask?.id;
      if (!taskId) return;

      const persistedUpdates: Partial<TaskItem> = withWorkflowColumnForStatus({
        ...updates,
      });
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
      setGroupedTasks((prev) =>
        groupByColumn(
          tasks.map((t) =>
            t.id === taskId ? ({ ...t, ...persistedUpdates } as Task) : t,
          ),
        ),
      );

      void updateCard(taskId, persistedUpdates as Partial<Card>).catch((err) => {
        console.error("Failed to save card updates:", err);
        void loadBoardData();
      });
    },
    [loadBoardData, selectedTask?.id, tasks],
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
    [boardId, loadBoardData, organizationId],
  );

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStatus: TaskStatus, targetColumnId?: string | null) => {
      e.preventDefault();
      const drag = dragRef.current;
      if (!drag) return;

      // Optimistic update
      setTasks((prev) =>
        prev.map((t) =>
          t.id === drag.id
            ? { ...t, status: targetStatus, column_id: targetColumnId ?? null }
            : t,
        ),
      );
      setGroupedTasks((prev) => {
        const next = { ...prev };
        const task = tasks.find((t) => t.id === drag.id);
        if (!task) return prev;
        const sourceKey = task.column_id ?? drag.status;
        const targetKey = targetColumnId ?? targetStatus;
        next[sourceKey] = (next[sourceKey] ?? []).filter((t) => t.id !== drag.id);
        next[targetKey] = [
          ...(next[targetKey] ?? []),
          { ...task, status: targetStatus, column_id: targetColumnId ?? null },
        ];
        return next;
      });

      try {
        await moveCard(drag.id, targetStatus, 0, targetColumnId ?? null);
      } catch (err) {
        console.error("Move failed, reverting", err);
        void loadBoardData();
      }
      dragRef.current = null;
    },
    [tasks, loadBoardData],
  );

  // ── Timer handlers ─────────────────────────────────────────────────────────────

  const handleTrack = useCallback(async (taskId: string, title: string) => {
    if (!auth?.user?.id || !organizationId) return;
    
    try {
      setTimerBusy(true);

      if (isAtOrAfterZimbabweCutoff()) {
        throw new Error("Timers stop at 7:00 PM Harare time. Add manual time for today if needed.");
      }

      // Check if there's already a running timer
      const { data: existingTimer } = await supabase
        .from("time_entries")
        .select("id")
        .eq("user_id", auth.user.id)
        .is("ended_at", null)
        .maybeSingle();

      if (existingTimer) {
        throw new Error("A timer is already running. Stop it first.");
      }

      const inProgressColumnId = getWorkflowColumnIdForStatus("in_progress");

      // Start new timer
      const { error } = await supabase.from("time_entries").insert({
        organization_id: organizationId,
        user_id: auth.user.id,
        client_id: boardId ?? null,
        task_id: taskId,
        description: `Working on ${title}`,
        started_at: new Date().toISOString(),
        ended_at: null,
        is_running: true,
        duration_seconds: 0,
      });

      if (error) throw error;

      await updateCard(taskId, {
        status: "in_progress",
        column_id: inProgressColumnId,
      } as Partial<Card>);

      // Reload active timer
      await loadActiveTimer();
      await loadBoardData();
    } catch (err: any) {
      console.error("Failed to start timer:", err);
      alert(err?.message || "Failed to start timer");
    } finally {
      setTimerBusy(false);
    }
  }, [auth?.user?.id, boardId, getWorkflowColumnIdForStatus, loadActiveTimer, loadBoardData, organizationId]);

  const isTrackingThisTask = useCallback((taskId: string) => {
    return activeTimer?.task_id === taskId;
  }, [activeTimer]);

  const handlePauseTimer = useCallback(async () => {
    if (!activeTimer?.id || !activeTimer?.started_at) return;

    try {
      setTimerBusy(true);

      const endedAt = clampToZimbabweCutoff(activeTimer.started_at);
      const startedAtMs = new Date(activeTimer.started_at).getTime();
      const endedAtMs = new Date(endedAt).getTime();
      const durationSeconds = Math.max(0, Math.floor((endedAtMs - startedAtMs) / 1000));

      const { error } = await supabase
        .from("time_entries")
        .update({
          ended_at: endedAt,
          is_running: false,
          duration_seconds: durationSeconds,
        })
        .eq("id", activeTimer.id);

      if (error) throw error;

      // Reload active timer
      await loadActiveTimer();
    } catch (err: any) {
      console.error("Failed to stop timer:", err);
      alert(err?.message || "Failed to stop timer");
    } finally {
      setTimerBusy(false);
    }
  }, [activeTimer, loadActiveTimer]);

  // ── Guards ───────────────────────────────────────────────────────────────────

  if (!auth?.user || !profile || !organizationId) return null;

  if (error) {
    return (
      <div className="flex min-h-screen bg-[#050505]">
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
    <div className="min-h-screen bg-[#050505] flex">
      <Sidebar role={profile.primary_role ?? "manager"} />

      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* ── Header ── */}
        <div className="border-b border-white/10 bg-[#080808] px-5 py-3 flex items-center justify-between gap-4 shrink-0">
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

          <div className="flex items-center gap-2 shrink-0">
            {!loading && stats && (
              <div className="hidden md:flex items-center gap-3 rounded-xl border border-white/10 bg-white/4 px-4 py-2 text-xs text-white/50">
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
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex rounded-xl p-2 text-white/40 hover:bg-white/10 hover:text-white transition"
            >
              <LayoutList size={17} />
            </button>
          </div>
        </div>

        {/* ── Board + Sidebar ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Kanban */}
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 size={26} className="text-orange-500 animate-spin" />
                  <p className="text-sm text-white/40">Loading board…</p>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 p-6 h-full items-start">
                {columns.map((col) => (
                  <KanbanColumn
                    key={col.id}
                    {...col}
                    tasks={groupedTasks[col.columnId ?? col.status] ?? []}
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
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar inline (desktop) */}
          {sidebarOpen && board && organizationId && (
            <div className="hidden lg:flex w-80 shrink-0 border-l border-white/10">
              <BoardSidebar
                board={board}
                organizationId={organizationId}
                isOpen={true}
                onClose={() => setSidebarOpen(false)}
              />
            </div>
          )}
        </div>
      </main>

      {/* Card Detail Modal */}
      {selectedTask && auth?.user && (
        <CardDetailModal
          cardId={selectedTask.id}
          card={selectedTask}
          isOpen={!!selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleUpdateTask}
          onDelete={(cardId) => handleDeleteTask(cardId, selectedTask.title, false)}
          onToggleTimer={(id, title) => console.log("timer", id, title)}
          hasRunningTimer={false}
          currentUserId={auth.user.id}
          organizationId={organizationId!}
        />
      )}
    </div>
  );
}
