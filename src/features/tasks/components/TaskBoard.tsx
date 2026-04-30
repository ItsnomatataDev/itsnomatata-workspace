import TaskColumn from "./TaskColumn";
import type {
  BoardColumnWithTasks,
  TaskItem,
  TaskStatus,
} from "../../../lib/supabase/queries/tasks";

const STATUS_COLUMNS: { key: TaskStatus; title: string }[] = [
  { key: "backlog", title: "Backlog" },
  { key: "todo", title: "To Do" },
  { key: "in_progress", title: "In Progress" },
  { key: "review", title: "Review" },
  { key: "done", title: "Done" },
  { key: "blocked", title: "Blocked" },
];

export default function TaskBoard({
  groupedTasks,
  boardColumns,
  onTrack,
  onOpen,
  onMoveTask,
  onMoveTaskToColumn,
  taskRuntimeMap,
  taskInvitedCountMap,
  onCreateCard,
  organizationId,
  userId,
  onTimeRefresh,
}: {
  groupedTasks: Record<string, TaskItem[]>;
  boardColumns?: BoardColumnWithTasks[];
  onTrack: (taskId: string, title: string) => void;
  onOpen: (taskId: string) => void;
  onMoveTask: (taskId: string, nextStatus: TaskStatus) => void;
  onMoveTaskToColumn?: (params: {
    taskId: string;
    fromColumnId: string;
    toColumnId: string;
    fromPosition: number;
    toPosition: number;
  }) => void;
  taskRuntimeMap: Map<string, boolean>;
  taskInvitedCountMap: Map<string, number>;
  onCreateCard?: (status: TaskStatus) => void;
  organizationId: string;
  userId: string;
  onTimeRefresh?: () => void;
}) {
  const usingRealColumns = !!boardColumns && boardColumns.length > 0;

  const totalTasks = usingRealColumns
    ? boardColumns.reduce((sum, column) => sum + column.tasks.length, 0)
    : Object.values(groupedTasks).reduce((sum, items) => sum + items.length, 0);

  const totalRunning = Array.from(taskRuntimeMap.values()).filter(
    Boolean,
  ).length;

  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <h3 className="text-sm font-semibold capitalize tracking-[0.22em] text-orange-400">
            IT's No matata Task Board
          </h3>
          <p className="mt-1 text-xs text-white/45">
            {usingRealColumns
              ? "Drag cards between real Codex columns"
              : "Drag cards between workflow statuses"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-xl bg-white/5 px-3 py-2 text-white/70">
            {totalTasks} cards
          </span>
          <span className="rounded-xl bg-orange-500/10 px-3 py-2 text-orange-300">
            {totalRunning} running timers
          </span>
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-hidden pb-2">
        <div className="inline-flex min-w-max gap-5 align-top">
          {usingRealColumns
            ? boardColumns.map((column) => (
                <TaskColumn
                  key={column.id}
                  title={column.name}
                  columnId={column.id}
                  tasks={column.tasks}
                  onTrack={onTrack}
                  onOpen={onOpen}
                  onMoveTask={onMoveTask}
                  onMoveTaskToColumn={onMoveTaskToColumn}
                  taskRuntimeMap={taskRuntimeMap}
                  taskInvitedCountMap={taskInvitedCountMap}
                  onCreateCard={onCreateCard}
                  organizationId={organizationId}
                  userId={userId}
                  onTimeRefresh={onTimeRefresh}
                />
              ))
            : STATUS_COLUMNS.map((column) => (
                <TaskColumn
                  key={column.key}
                  title={column.title}
                  status={column.key}
                  tasks={groupedTasks[column.key] ?? []}
                  onTrack={onTrack}
                  onOpen={onOpen}
                  onMoveTask={onMoveTask}
                  taskRuntimeMap={taskRuntimeMap}
                  taskInvitedCountMap={taskInvitedCountMap}
                  onCreateCard={onCreateCard}
                  organizationId={organizationId}
                  userId={userId}
                  onTimeRefresh={onTimeRefresh}
                />
              ))}
        </div>
      </div>
    </div>
  );
}
