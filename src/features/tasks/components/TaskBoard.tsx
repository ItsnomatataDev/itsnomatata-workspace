import TaskColumn from "./TaskColumn";
import type { TaskItem } from "../../../lib/supabase/queries/tasks";

export default function TaskBoard({
  groupedTasks,
  onMove,
  onTrack,
}: {
  groupedTasks: Record<string, TaskItem[]>;
  onMove: (taskId: string, status: TaskItem["status"]) => void;
  onTrack: (taskId: string, title: string) => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-5">
      <TaskColumn
        title="Backlog"
        tasks={groupedTasks.backlog ?? []}
        onMove={onMove}
        onTrack={onTrack}
      />
      <TaskColumn
        title="To Do"
        tasks={groupedTasks.todo ?? []}
        onMove={onMove}
        onTrack={onTrack}
      />
      <TaskColumn
        title="In Progress"
        tasks={groupedTasks.in_progress ?? []}
        onMove={onMove}
        onTrack={onTrack}
      />
      <TaskColumn
        title="Review"
        tasks={groupedTasks.review ?? []}
        onMove={onMove}
        onTrack={onTrack}
      />
      <TaskColumn
        title="Done"
        tasks={groupedTasks.done ?? []}
        onMove={onMove}
        onTrack={onTrack}
      />
    </div>
  );
}
