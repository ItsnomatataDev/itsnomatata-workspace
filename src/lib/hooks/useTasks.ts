import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getTaskById,
  getTaskComments,
  getTasks,
  getTaskWatchers,
  getTaskRuntimeInfo,
  getTaskWatcherCounts,
  searchTaskInvitableUsers,
  type TaskCommentItem,
  type TaskInvitableUser,
  type TaskItem,
  type TaskRuntimeInfo,
  type TaskStatus,
  type TaskWatcherCountItem,
  type TaskWatcherItem,
} from "../supabase/queries/tasks";
import {
  getTaskChecklists,
  type TaskChecklistWithItems,
} from "../supabase/queries/taskChecklists";
import {
  addTaskWatcher as addTaskWatcherMutation,
  createTask as createTaskMutation,
  createTaskComment as createTaskCommentMutation,
  deleteTask as deleteTaskMutation,
  removeTaskWatcher as removeTaskWatcherMutation,
  updateTask as updateTaskMutation,
  type CreateTaskInput,
  type UpdateTaskInput,
} from "../supabase/mutations/tasks";
import {
  createTaskChecklist,
  createTaskChecklistItem,
  deleteTaskChecklist,
  deleteTaskChecklistItem,
  toggleTaskChecklistItem,
} from "../supabase/mutations/taskChecklists";

const boardStatuses: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "approved",
  "done",
  "blocked",
];

export const useTasks = ({
  assignedTo,
  organizationId,
}: {
  assignedTo?: string;
  organizationId?: string;
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [runtimeInfo, setRuntimeInfo] = useState<TaskRuntimeInfo[]>([]);
  const [taskWatcherCounts, setTaskWatcherCounts] = useState<
    TaskWatcherCountItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);
  const [selectedTaskComments, setSelectedTaskComments] = useState<
    TaskCommentItem[]
  >([]);
  const [selectedTaskWatchers, setSelectedTaskWatchers] = useState<
    TaskWatcherItem[]
  >([]);
  const [selectedTaskChecklists, setSelectedTaskChecklists] = useState<
    TaskChecklistWithItems[]
  >([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState("");

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [taskData, runtimeData, watcherCountData] = await Promise.all([
        getTasks({ assignedTo, organizationId }),
        organizationId
          ? getTaskRuntimeInfo(organizationId)
          : Promise.resolve([]),
        organizationId
          ? getTaskWatcherCounts(organizationId)
          : Promise.resolve([]),
      ]);

      setTasks(taskData);
      setRuntimeInfo(runtimeData);
      setTaskWatcherCounts(watcherCountData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [assignedTo, organizationId]);

  useEffect(() => {
    void fetchTasks();
  }, [fetchTasks]);

  const createTask = async (payload: CreateTaskInput) => {
    const created = await createTaskMutation(payload);
    setTasks((prev) => [created, ...prev]);
    return created;
  };

  const updateTask = async (taskId: string, payload: UpdateTaskInput) => {
    const updated = await updateTaskMutation(taskId, payload);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));

    if (selectedTask?.id === taskId) {
      setSelectedTask(updated);
    }

    return updated;
  };

  const deleteTask = async (taskId: string) => {
    await deleteTaskMutation(taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));

    if (selectedTask?.id === taskId) {
      setSelectedTask(null);
      setSelectedTaskComments([]);
      setSelectedTaskWatchers([]);
      setSelectedTaskChecklists([]);
    }
  };

  const openTask = useCallback(async (taskId: string) => {
    try {
      setDetailsLoading(true);
      setDetailsError("");

      const [task, comments, watchers, checklists] = await Promise.all([
        getTaskById(taskId),
        getTaskComments(taskId),
        getTaskWatchers(taskId),
        getTaskChecklists(taskId),
      ]);

      setSelectedTask(task);
      setSelectedTaskComments(comments);
      setSelectedTaskWatchers(watchers);
      setSelectedTaskChecklists(checklists);
    } catch (err) {
      setDetailsError(
        err instanceof Error ? err.message : "Failed to load task details",
      );
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

  const addComment = async ({
    taskId,
    organizationId: orgId,
    userId,
    comment,
  }: {
    taskId: string;
    organizationId: string;
    userId: string;
    comment: string;
  }) => {
    const created = await createTaskCommentMutation({
      task_id: taskId,
      organization_id: orgId,
      user_id: userId,
      comment,
      is_internal: true,
    });

    const comments = await getTaskComments(taskId);
    setSelectedTaskComments(comments);

    return created;
  };

  const addWatcher = async (taskId: string, userId: string) => {
    await addTaskWatcherMutation({ taskId, userId });

    const [watchers, watcherCountData] = await Promise.all([
      getTaskWatchers(taskId),
      organizationId
        ? getTaskWatcherCounts(organizationId)
        : Promise.resolve([]),
    ]);

    setSelectedTaskWatchers(watchers);
    setTaskWatcherCounts(watcherCountData);
  };

  const removeWatcher = async (taskId: string, userId: string) => {
    await removeTaskWatcherMutation({ taskId, userId });

    const [watchers, watcherCountData] = await Promise.all([
      getTaskWatchers(taskId),
      organizationId
        ? getTaskWatcherCounts(organizationId)
        : Promise.resolve([]),
    ]);

    setSelectedTaskWatchers(watchers);
    setTaskWatcherCounts(watcherCountData);
  };

  const searchInvitableUsers = async (
    search: string,
  ): Promise<TaskInvitableUser[]> => {
    if (!organizationId || !selectedTask) return [];

    const excludeUserIds = selectedTaskWatchers.map((item) => item.user_id);

    return searchTaskInvitableUsers({
      organizationId,
      search,
      excludeUserIds,
    });
  };

  const addChecklist = async ({
    taskId,
    title,
    userId,
  }: {
    taskId: string;
    title: string;
    userId: string;
  }) => {
    if (!organizationId) throw new Error("Missing organization id");

    await createTaskChecklist({
      taskId,
      organizationId,
      title,
      createdBy: userId,
    });

    const checklists = await getTaskChecklists(taskId);
    setSelectedTaskChecklists(checklists);
  };

  const removeChecklist = async ({
    taskId,
    checklistId,
  }: {
    taskId: string;
    checklistId: string;
  }) => {
    await deleteTaskChecklist(checklistId);
    const checklists = await getTaskChecklists(taskId);
    setSelectedTaskChecklists(checklists);
  };

  const addChecklistItem = async ({
    taskId,
    checklistId,
    content,
    userId,
  }: {
    taskId: string;
    checklistId: string;
    content: string;
    userId: string;
  }) => {
    if (!organizationId) throw new Error("Missing organization id");

    await createTaskChecklistItem({
      checklistId,
      taskId,
      organizationId,
      content,
      createdBy: userId,
    });

    const checklists = await getTaskChecklists(taskId);
    setSelectedTaskChecklists(checklists);
  };

  const toggleChecklistItem = async ({
    taskId,
    itemId,
    checked,
    userId,
  }: {
    taskId: string;
    itemId: string;
    checked: boolean;
    userId: string;
  }) => {
    await toggleTaskChecklistItem({
      itemId,
      checked,
      userId,
    });

    const checklists = await getTaskChecklists(taskId);
    setSelectedTaskChecklists(checklists);
  };

  const removeChecklistItem = async ({
    taskId,
    itemId,
  }: {
    taskId: string;
    itemId: string;
  }) => {
    await deleteTaskChecklistItem(itemId);
    const checklists = await getTaskChecklists(taskId);
    setSelectedTaskChecklists(checklists);
  };

  const taskRuntimeMap = useMemo(() => {
    return new Map(
      runtimeInfo.map((item) => [item.task_id, item.has_running_timer]),
    );
  }, [runtimeInfo]);

  const taskInvitedCountMap = useMemo(() => {
    return new Map(
      taskWatcherCounts.map((item) => [item.task_id, item.invited_count]),
    );
  }, [taskWatcherCounts]);

  const groupedTasks = useMemo(() => {
    return boardStatuses.reduce<Record<string, TaskItem[]>>((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status);
      return acc;
    }, {});
  }, [tasks]);

  return {
    tasks,
    groupedTasks,
    taskRuntimeMap,
    taskInvitedCountMap,
    loading,
    error,
    refetch: fetchTasks,
    createTask,
    updateTask,
    deleteTask,
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
    removeWatcher,
    searchInvitableUsers,
    addChecklist,
    removeChecklist,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
  };
};
