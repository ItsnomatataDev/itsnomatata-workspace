import { Link } from "react-router-dom";
import { formatRelativeDate } from "../../../lib/utils/formatRelativeDate";

function getInitials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.trim() || "?";
  const parts = source.split(" ").filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : source.slice(0, 2).toUpperCase();
}

type DashboardTask = {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  created_by: string | null;
  created_by_full_name?: string | null;
  created_by_email?: string | null;
};

export default function TaskOverviewCard({
  tasks,
}: {
  tasks: DashboardTask[];
}) {
  const uniqueCreators = Array.from(
    new Set(tasks.map((task) => task.created_by_full_name).filter(Boolean)),
  ).length;

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

      {uniqueCreators > 0 && (
        <p className="mt-2 text-sm text-white/60">
          Created by {uniqueCreators} team member{uniqueCreators > 1 ? "s" : ""}
        </p>
      )}

      <div className="mt-4 space-y-3">
        {tasks.length === 0 ? (
          <p className="text-sm text-white/50">No assigned tasks found.</p>
        ) : (
          tasks.map((task) => {
            const creatorName =
              task.created_by_full_name || task.created_by_email || "Unknown";
            return (
              <div
                key={task.id}
                className="rounded-xl border border-white/10 bg-black/40 px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div
                        title={`Created by ${creatorName}`}
                        className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 border border-white/20 text-[10px] font-bold text-white"
                      >
                        {getInitials(
                          task.created_by_full_name,
                          task.created_by_email,
                        )}
                      </div>
                      <p className="font-medium text-white line-clamp-1">
                        {task.title}
                      </p>
                    </div>
                    <p className="text-xs uppercase tracking-wide text-white/50">
                      {task.status.replaceAll("_", " ")} · {task.priority}
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      Created {formatRelativeDate(task.created_at)}
                    </p>
                  </div>
                  {task.due_date ? (
                    <span className="text-xs text-orange-400">
                      {new Date(task.due_date).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
