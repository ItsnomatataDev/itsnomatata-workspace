import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getTasks,
  type TaskItem,
  type TaskStatus,
} from "../supabase/queries/tasks";
import {
  createTask as createTaskMutation,
  updateTask as updateTaskMutation,
  deleteTask as deleteTaskMutation,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "../supabase/mutations/tasks";

const boardStatuses: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
];

export const useTasks = ({
  assignedTo,
  organizationId,
}: {
  assignedTo?: string;
  organizationId?: string;
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getTasks({ assignedTo, organizationId });
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [assignedTo, organizationId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const createTask = async (payload: CreateTaskInput) => {
    const created = await createTaskMutation(payload);
    setTasks((prev) => [created, ...prev]);
    return created;
  };

  const updateTask = async (taskId: string, payload: UpdateTaskInput) => {
    const updated = await updateTaskMutation(taskId, payload);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    return updated;
  };

  const deleteTask = async (taskId: string) => {
    await deleteTaskMutation(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
  };

  const groupedTasks = useMemo(() => {
    return boardStatuses.reduce<Record<string, TaskItem[]>>((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status);
      return acc;
    }, {});
  }, [tasks]);

  return {
    tasks,
    groupedTasks,
    loading,
    error,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
  };
};
