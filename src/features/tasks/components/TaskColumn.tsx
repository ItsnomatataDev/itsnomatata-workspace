import TaskCard from "./TaskCard";
import type { TaskItem } from "../../../lib/supabase/queries/tasks";

export default function TaskColumn({
  title,
  tasks,
  onTrack,
  onOpen,
  taskRuntimeMap,
  taskInvitedCountMap,
}: {
  title: string;
  tasks: TaskItem[];
  onTrack: (taskId: string, title: string) => void;
  onOpen: (taskId: string) => void;
  taskRuntimeMap: Map<string, boolean>;
  taskInvitedCountMap: Map<string, number>;
}) {
  return (
    <div className="w-85w-[340px] shrink-0 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="rounded-full bg-black px-3 py-1 text-xs text-white/60">
          {tasks.length}
        </span>
      </div>

      <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/35">
            No cards
          </div>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onTrack={onTrack}
              onOpen={onOpen}
              hasRunningTimer={taskRuntimeMap.get(task.id) ?? false}
              invitedCount={taskInvitedCountMap.get(task.id) ?? 0}
            />
          ))
        )}
      </div>
    </div>
  );
}
