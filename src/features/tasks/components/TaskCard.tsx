import { Clock3, Flag } from "lucide-react";
import type { TaskItem } from "../../../lib/supabase/queries/tasks";

export default function TaskCard({
  task,
  onMove,
  onTrack,
}: {
  task: TaskItem;
  onMove: (taskId: string, status: TaskItem["status"]) => void;
  onTrack: (taskId: string, title: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-white">{task.title}</h3>
        <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase text-white/60">
          {task.priority}
        </span>
      </div>

      {task.description ? (
        <p className="mt-3 line-clamp-3 text-sm text-white/55">
          {task.description}
        </p>
      ) : null}

      <div className="mt-4 flex items-center justify-between text-xs text-white/45">
        <div className="flex items-center gap-1">
          <Flag size={12} />
          <span>{task.status.replaceAll("_", " ")}</span>
        </div>

        {task.due_date ? (
          <div className="flex items-center gap-1 text-orange-400">
            <Clock3 size={12} />
            <span>{new Date(task.due_date).toLocaleDateString()}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => onTrack(task.id, task.title)}
          className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black"
        >
          Track time
        </button>

        {task.status !== "in_progress" ? (
          <button
            onClick={() => onMove(task.id, "in_progress")}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/75"
          >
            Move to Progress
          </button>
        ) : null}

        {task.status !== "review" ? (
          <button
            onClick={() => onMove(task.id, "review")}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/75"
          >
            Move to Review
          </button>
        ) : null}

        {task.status !== "done" ? (
          <button
            onClick={() => onMove(task.id, "done")}
            className="rounded-xl border border-white/10 px-3 py-2 text-xs text-white/75"
          >
            Mark Done
          </button>
        ) : null}
      </div>
    </div>
  );
}
