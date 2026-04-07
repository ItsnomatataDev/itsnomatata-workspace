import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  TaskCommentItem,
  TaskItem,
  TaskStatus,
  TaskWatcherCountItem,
  TaskWatcherItem,
} from "../supabase/queries/tasks";
import {
  getTaskById,
  getTaskComments,
  getTasks,
  getTaskRuntimeInfo,
  getTaskWatcherCounts,
  getTaskWatchers,
  searchTaskInvitableUsers,
  type TaskInvitableUser,
} from "../supabase/queries/tasks";
import {
  createTask,
  createTaskComment,
  addTaskWatcher,
  removeTaskWatcher,
  updateTask,
} from "../supabase/mutations/tasks";

type UseTasksParams = {
  assignedTo?: string;
  organizationId?: string | null;
};

type TaskChecklistItem = {
  id: string;
  checklist_id: string;
  content: string;
  is_completed: boolean;
  completed_at?: string | null;
  completed_by?: string | null;
  created_at?: string;
};

type TaskChecklist = {
  id: string;
  task_id: string;
  title: string;
  created_at?: string;
  items: TaskChecklistItem[];
};

export function useTasks(params: UseTasksParams) {
  const { assignedTo, organizationId } = params;

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const [selectedTaskComments, setSelectedTaskComments] = useState<
    TaskCommentItem[]
  >([]);
  const [selectedTaskWatchers, setSelectedTaskWatchers] = useState<
    TaskWatcherItem[]
  >([]);
  const [selectedTaskChecklists, setSelectedTaskChecklists] = useState<
    TaskChecklist[]
  >([]);

  const [taskRuntimeMap, setTaskRuntimeMap] = useState<Map<string, boolean>>(
    new Map(),
  );
  const [taskInvitedCountMap, setTaskInvitedCountMap] = useState<
    Map<string, number>
  >(new Map());

  const [loading, setLoading] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState("");
  const [detailsError, setDetailsError] = useState("");

  const refetch = useCallback(async () => {
    if (!organizationId) {
      setTasks([]);
      setSelectedTask(null);
      setSelectedTaskComments([]);
      setSelectedTaskWatchers([]);
      setSelectedTaskChecklists([]);
      setTaskRuntimeMap(new Map());
      setTaskInvitedCountMap(new Map());
      return [] as TaskItem[];
    }

    try {
      setLoading(true);
      setError("");

      const [items, runtimeInfo, watcherCounts] = await Promise.all([
        getTasks({ assignedTo, organizationId }),
        getTaskRuntimeInfo(organizationId),
        getTaskWatcherCounts(organizationId),
      ]);

      setTasks(items);

      const runtimeMap = new Map<string, boolean>();
      runtimeInfo.forEach((item) => {
        runtimeMap.set(item.task_id, item.has_running_timer);
      });
      setTaskRuntimeMap(runtimeMap);

      const invitedMap = new Map<string, number>();
      watcherCounts.forEach((item: TaskWatcherCountItem) => {
        invitedMap.set(item.task_id, item.invited_count);
      });
      setTaskInvitedCountMap(invitedMap);

      return items;
    } catch (err: any) {
      console.error("LOAD TASKS ERROR:", err);
      setError(err?.message || "Failed to load tasks.");
      return [] as TaskItem[];
    } finally {
      setLoading(false);
    }
  }, [assignedTo, organizationId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const groupedTasks = useMemo(() => {
    return tasks.reduce<Record<string, TaskItem[]>>((acc, task) => {
      const key = task.status || "todo";
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {});
  }, [tasks]);

  const openTask = useCallback(async (taskId: string) => {
    try {
      setDetailsLoading(true);
      setDetailsError("");

      const [task, comments, watchers] = await Promise.all([
        getTaskById(taskId),
        getTaskComments(taskId),
        getTaskWatchers(taskId),
      ]);

      setSelectedTask(task ?? null);
      setSelectedTaskComments(comments ?? []);
      setSelectedTaskWatchers(watchers ?? []);
      setSelectedTaskChecklists([]);

      return task ?? null;
    } catch (err: any) {
      console.error("OPEN TASK ERROR:", err);
      setDetailsError(err?.message || "Failed to open task.");
      setSelectedTask(null);
      setSelectedTaskComments([]);
      setSelectedTaskWatchers([]);
      setSelectedTaskChecklists([]);
      return null;
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const closeTask = useCallback(() => {
    setSelectedTask(null);
    setSelectedTaskComments([]);
    setSelectedTaskWatchers([]);
    setSelectedTaskChecklists([]);
    setDetailsError("");
  }, []);

  const createTaskCard = useCallback(
    async (input: Parameters<typeof createTask>[0]) => {
      const created = await createTask(input);
      await refetch();
      return created;
    },
    [refetch],
  );

  const addComment = useCallback(
    async (params: {
      taskId: string;
      organizationId: string;
      userId: string;
      comment: string;
    }) => {
      await createTaskComment({
        task_id: params.taskId,
        organization_id: params.organizationId,
        user_id: params.userId,
        comment: params.comment,
        is_internal: false,
      });

      if (selectedTask?.id === params.taskId) {
        const comments = await getTaskComments(params.taskId);
        setSelectedTaskComments(comments);
      }
    },
    [selectedTask?.id],
  );

  const addWatcher = useCallback(
    async (taskId: string, userId: string) => {
      await addTaskWatcher({
        taskId,
        userId,
      });

      if (selectedTask?.id === taskId) {
        const watchers = await getTaskWatchers(taskId);
        setSelectedTaskWatchers(watchers);
      }

      await refetch();
    },
    [refetch, selectedTask?.id],
  );

  const removeWatcherFromTask = useCallback(
    async (taskId: string, userId: string) => {
      await removeTaskWatcher({
        taskId,
        userId,
      });

      if (selectedTask?.id === taskId) {
        const watchers = await getTaskWatchers(taskId);
        setSelectedTaskWatchers(watchers);
      }

      await refetch();
    },
    [refetch, selectedTask?.id],
  );

  const searchInvitableUsers = useCallback(
    async (search: string): Promise<TaskInvitableUser[]> => {
      if (!organizationId) return [];

      const excludeUserIds = selectedTaskWatchers.map((item) => item.user_id);

      return searchTaskInvitableUsers({
        organizationId,
        search,
        excludeUserIds,
      });
    },
    [organizationId, selectedTaskWatchers],
  );

  const addChecklist = useCallback(
    async (_params: { taskId: string; title: string; userId: string }) => {
      throw new Error("Checklist service is not wired yet.");
    },
    [],
  );

  const removeChecklist = useCallback(
    async (_params: { taskId: string; checklistId: string }) => {
      throw new Error("Checklist service is not wired yet.");
    },
    [],
  );

  const addChecklistItem = useCallback(
    async (_params: {
      taskId: string;
      checklistId: string;
      content: string;
      userId: string;
    }) => {
      throw new Error("Checklist item service is not wired yet.");
    },
    [],
  );

  const toggleChecklistItem = useCallback(
    async (_params: {
      taskId: string;
      itemId: string;
      checked: boolean;
      userId: string;
    }) => {
      throw new Error("Checklist item service is not wired yet.");
    },
    [],
  );

  const removeChecklistItem = useCallback(
    async (_params: { taskId: string; itemId: string }) => {
      throw new Error("Checklist item service is not wired yet.");
    },
    [],
  );

  const moveTask = useCallback(
    async (taskId: string, nextStatus: TaskStatus) => {
      await updateTask(taskId, {
        status: nextStatus,
        completed_at: nextStatus === "done" ? new Date().toISOString() : null,
      });

      const refreshedItems = await refetch();
      const updatedTask =
        refreshedItems.find((task) => task.id === taskId) ?? null;

      setSelectedTask((prev) => (prev?.id === taskId ? updatedTask : prev));
      return updatedTask;
    },
    [refetch],
  );

  return {
    tasks,
    groupedTasks,
    taskRuntimeMap,
    taskInvitedCountMap,

    loading,
    error,

    createTask: createTaskCard,
    refetch,

    selectedTask,
    selectedTaskComments,
    selectedTaskWatchers,
    selectedTaskChecklists,

    detailsLoading,
    detailsError,

    openTask,
    closeTask,

    addComment,
    addWatcher,
    removeWatcher: removeWatcherFromTask,
    searchInvitableUsers,

    addChecklist,
    removeChecklist,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,

    moveTask,
    setSelectedTask,
  };
}