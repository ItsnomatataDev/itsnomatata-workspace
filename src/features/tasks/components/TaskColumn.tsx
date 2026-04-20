import { useState } from "react";
import TaskCard from "./TaskCard";
import type { TaskItem, TaskStatus } from "../../../lib/supabase/queries/tasks";

export default function TaskColumn({
  title,
  status,
  columnId,
  accentClass,
  tasks,
  onTrack,
  onOpen,
  onMoveTask,
  onMoveTaskToColumn,
  taskRuntimeMap,
  taskInvitedCountMap,
}: {
  title: string;
  status?: TaskStatus;
  columnId?: string;
  accentClass?: string;
  tasks: TaskItem[];
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
}) {
  const [isOver, setIsOver] = useState(false);
  const accent = accentClass ?? "";

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
    const currentColumnId = event.dataTransfer.getData("text/task-column-id");
    const currentPosition = Number(
      event.dataTransfer.getData("text/task-position") || "0",
    );

    if (!taskId) return;

    if (columnId && onMoveTaskToColumn) {
      if (!currentColumnId || currentColumnId === columnId) return;

      onMoveTaskToColumn({
        taskId,
        fromColumnId: currentColumnId,
        toColumnId: columnId,
        fromPosition: currentPosition,
        toPosition: tasks.length,
      });
      return;
    }

    if (!status || !currentStatus || currentStatus === status) return;
    onMoveTask(taskId, status);
  };

  return (
    <section
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`w-85 shrink-0 rounded-3xl border border-white/10 bg-[#0b0d0f] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.22)] transition ${
        isOver ? "border-orange-500/30 bg-orange-500/5" : accent
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-white">{title}</h2>
          <p className="text-xs text-white/35">
            {columnId ? "Board column" : "Workflow stage"}
          </p>
        </div>

        <span className="rounded-xl border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60">
          {tasks.length}
        </span>
      </div>

      <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
        {tasks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 px-4 py-8 text-center text-sm text-white/30">
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
    </section>
  );
}
