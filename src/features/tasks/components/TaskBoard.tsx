import TaskColumn from "./TaskColumn";
import type { TaskItem, TaskStatus } from "../../../lib/supabase/queries/tasks";

export default function TaskBoard({
  groupedTasks,
  onTrack,
  onOpen,
  onMoveTask,
  taskRuntimeMap,
  taskInvitedCountMap,
}: {
  groupedTasks: Record<string, TaskItem[]>;
  onTrack: (taskId: string, title: string) => void;
  onOpen: (taskId: string) => void;
  onMoveTask: (taskId: string, nextStatus: TaskStatus) => void;
  taskRuntimeMap: Map<string, boolean>;
  taskInvitedCountMap: Map<string, number>;
}) {
  const columns: { key: TaskStatus; title: string }[] = [
    { key: "backlog", title: "Backlog" },
    { key: "todo", title: "To Do" },
    { key: "in_progress", title: "In Progress" },
    { key: "review", title: "Review" },
    { key: "done", title: "Done" },
    { key: "blocked", title: "Blocked" },
  ];

  return (
    <div className="min-w-0 overflow-x-auto overflow-y-hidden pb-3">
      <div className="inline-flex min-w-max gap-4">
        {columns.map((column) => (
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
          />
        ))}
      </div>
    </div>
  );
}
