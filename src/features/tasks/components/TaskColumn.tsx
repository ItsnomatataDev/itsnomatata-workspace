import { useState } from "react";
import { Plus } from "lucide-react";
import EnhancedTaskCard from "./EnhancedTaskCard";
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
  onCreateCard,
  organizationId,
  userId,
  onTimeRefresh,
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
  onCreateCard?: (status: TaskStatus) => void;
  organizationId: string;
  userId: string;
  onTimeRefresh?: () => void;
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
          <div className="rounded-2xl border border-dashed border-white/20 bg-linear-to-br from-white/5 to-orange-500/5 px-6 py-8 text-center">
            <div className="mb-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <Plus className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-sm font-medium text-white/80 mb-1">
                No cards yet
              </h3>
              <p className="text-xs text-white/40">
                Get started by adding your first card
              </p>
            </div>
            <button
              onClick={() => onCreateCard?.(status || "todo")}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition"
            >
              <Plus size={14} />
              Add Card
            </button>
          </div>
        ) : (
          tasks.map((task) => (
            <EnhancedTaskCard
              key={task.id}
              task={task}
              onTrack={onTrack}
              onOpen={onOpen}
              hasRunningTimer={taskRuntimeMap.get(task.id) ?? false}
              invitedCount={taskInvitedCountMap.get(task.id) ?? 0}
              organizationId={organizationId}
              userId={userId}
              onTimeRefresh={onTimeRefresh}
            />
          ))
        )}
      </div>
    </section>
  );
}
