import { useEffect, useState } from "react";
import { getClientTasks } from "../services/clientTaskService";

export default function ClientWorkspacePage({
  clientId,
}: {
  clientId: string;
}) {
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      const data = await getClientTasks(clientId);
      setTasks(data);
    };

    load();
  }, [clientId]);

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl font-bold mb-4">Your Tasks</h1>

      {tasks.length === 0 ? (
        <p className="text-white/50">No tasks assigned yet.</p>
      ) : (
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="border border-white/10 p-4 bg-black">
              <h2 className="font-semibold">{task.title}</h2>
              <p className="text-sm text-white/60">Status: {task.status}</p>
              <p className="text-sm text-orange-400">
                Time: {Math.floor(task.tracked_seconds_cache / 3600)}h
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
