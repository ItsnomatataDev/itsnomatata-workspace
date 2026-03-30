import { Link } from "react-router-dom";

export default function TaskOverviewCard({
  tasks,
}: {
  tasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
  }[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">My Recent Tasks</h2>
        <Link
          to="/tasks"
          className="text-sm text-orange-500 hover:text-orange-400"
        >
          View all
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-white/50">No assigned tasks found.</p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-xl border border-white/10 bg-black/40 px-4 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-white">{task.title}</p>
                  <p className="mt-1 text-xs uppercase tracking-wide text-white/50">
                    {task.status.replaceAll("_", " ")} · {task.priority}
                  </p>
                </div>
                {task.due_date ? (
                  <span className="text-xs text-orange-400">
                    {new Date(task.due_date).toLocaleDateString()}
                  </span>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
