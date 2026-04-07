import { useState } from "react";
import TaskCard from "./TaskCard";
import type { TaskItem, TaskStatus } from "../../../lib/supabase/queries/tasks";

export default function TaskColumn({
  title,
  status,
  tasks,
  onTrack,
  onOpen,
  onMoveTask,
  taskRuntimeMap,
  taskInvitedCountMap,
}: {
  title: string;
  status: TaskStatus;
  tasks: TaskItem[];
  onTrack: (taskId: string, title: string) => void;
  onOpen: (taskId: string) => void;
  onMoveTask: (taskId: string, nextStatus: TaskStatus) => void;
  taskRuntimeMap: Map<string, boolean>;
  taskInvitedCountMap: Map<string, number>;
}) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsOver(true);
  };

  const handleDragLeave = () => {
    setIsOver(false);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsOver(false);

    const taskId = event.dataTransfer.getData("text/task-id");
    const currentStatus = event.dataTransfer.getData(
      "text/task-status",
    ) as TaskStatus;

    if (!taskId || !currentStatus) return;
    if (currentStatus === status) return;

    onMoveTask(taskId, status);
  };

  return (
    <div
      onDragOver={handleDragOver} 
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-85 shrink-0 rounded-2xl border p-4 transition ${
        isOver
          ? "border-orange-500 bg-orange-500/10"
          : "border-white/10 bg-white/5"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        <span className="rounded-full bg-black px-3 py-1 text-xs text-white/60">
          {tasks.length}
        </span>
      </div>

      <div className="max-h-[68vh] space-y-3 overflow-y-auto pr-1">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-white/35">
            Drop cards here
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
