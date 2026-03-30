import TaskCard from "./TaskCard";
import type { TaskItem } from "../../../lib/supabase/queries/tasks";

export default function TaskColumn({
  title,
  tasks,
  onMove,
  onTrack,
}: {
  title: string;
  tasks: TaskItem[];
  onMove: (taskId: string, status: TaskItem["status"]) => void;
  onTrack: (taskId: string, title: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold text-white">{title}</h2>
        <span className="rounded-full bg-black px-3 py-1 text-xs text-white/60">
          {tasks.length}
        </span>
      </div>

      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-sm text-white/35">
            No tasks
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onMove={onMove}
              onTrack={onTrack}
            />
          ))
        )}
      </div>
    </div>
  );
}
