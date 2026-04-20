import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  BoardColumnWithTasks,
  BoardTask,
  ProjectBoardData,
  TaskCommentItem,
  TaskInvitableUser,
  TaskItem,
  TaskWatcherCountItem,
  TaskWatcherItem,
} from "../supabase/queries/tasks";
import {
  getProjectBoardData,
  getTaskById,
  getTaskComments,
  getTaskRuntimeInfo,
  getTasks,
  getTaskWatcherCounts,
  getTaskWatchers,
  getTrackedTimeByTask,
  searchTaskInvitableUsers,
} from "../supabase/queries/tasks";
import {
  addTaskWatcher,
  createTask,
  createTaskComment,
  moveTask,
  removeTaskWatcher,
  updateTask,
} from "../supabase/mutations/tasks";

type UseTasksParams = {
  assignedTo?: string;
  organizationId?: string | null;
  projectId?: string | null;
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

function buildRuntimeMap(tasks: Array<TaskItem | BoardTask>) {
  const runtimeMap = new Map<string, boolean>();

  tasks.forEach((task) => {
    const hasRunningTimer =
      "has_running_timer" in task ? Boolean(task.has_running_timer) : false;
    runtimeMap.set(task.id, hasRunningTimer);
  });

  return runtimeMap;
}

function buildInvitedMap(tasks: Array<TaskItem | BoardTask>) {
  const invitedMap = new Map<string, number>();

  tasks.forEach((task) => {
    const watchersCount =
      "watchers_count" in task ? Number(task.watchers_count ?? 0) : 0;
    invitedMap.set(task.id, watchersCount);
  });

  return invitedMap;
}

export function useTasks(params: UseTasksParams) {
  const { assignedTo, organizationId, projectId } = params;

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [boardColumns, setBoardColumns] = useState<BoardColumnWithTasks[]>([]);
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
      setBoardColumns([]);
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


      if (projectId) {
        const boardData: ProjectBoardData = await getProjectBoardData(
          organizationId,
          projectId,
        );

        const nextBoardColumns = boardData.columns.map((column) => ({
          ...column,
          tasks: [...column.tasks].sort((a, b) => a.position - b.position),
        }));

        const flatTasks = nextBoardColumns.flatMap((column) => column.tasks);

        setBoardColumns(nextBoardColumns);
        setTasks(flatTasks);
        setTaskRuntimeMap(buildRuntimeMap(flatTasks));
        setTaskInvitedCountMap(buildInvitedMap(flatTasks));

        return flatTasks;
      }

  
      const [items, runtimeInfo, watcherCounts, trackedTime] = await Promise.all(
        [
          getTasks({ assignedTo, organizationId }),
          getTaskRuntimeInfo(organizationId),
          getTaskWatcherCounts(organizationId),
          getTrackedTimeByTask(organizationId),
        ],
      );

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

      const trackedMap = new Map<string, number>();
      trackedTime.forEach((item) => {
        trackedMap.set(item.task_id, item.tracked_seconds);
      });

      const enrichedTasks: TaskItem[] = items.map((task) => ({
        ...task,
        tracked_seconds_cache:
          trackedMap.get(task.id) ?? Number(task.tracked_seconds_cache ?? 0),
      }));

      setTasks(enrichedTasks);
      setBoardColumns([]);

      return enrichedTasks;
    } catch (err: any) {
      console.error("LOAD TASKS ERROR:", err);
      setError(err?.message || "Failed to load tasks.");
      return [] as TaskItem[];
    } finally {
      setLoading(false);
    }
  }, [assignedTo, organizationId, projectId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const groupedTasks = useMemo(() => {
    return tasks.reduce<Record<string, TaskItem[]>>((acc, task) => {
      const key = task.column_id || task.status || "todo";
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      acc[key].sort((a, b) => a.position - b.position);
      return acc;
    }, {});
  }, [tasks]);

  const openTask = useCallback(
    async (taskId: string) => {
      try {
        setDetailsLoading(true);
        setDetailsError("");

        const [task, comments, watchers] = await Promise.all([
          getTaskById(taskId),
          getTaskComments(taskId),
          getTaskWatchers(taskId),
        ]);

        const liveTask = tasks.find((item) => item.id === taskId);

        setSelectedTask(liveTask ? { ...task, ...liveTask } : (task ?? null));
        setSelectedTaskComments(comments ?? []);
        setSelectedTaskWatchers(watchers ?? []);
        setSelectedTaskChecklists([]);

        return liveTask ? { ...task, ...liveTask } : (task ?? null);
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
    },
    [tasks],
  );

  const closeTask = useCallback(() => {
    setSelectedTask(null);
    setSelectedTaskComments([]);
    setSelectedTaskWatchers([]);
    setSelectedTaskChecklists([]);
    setDetailsError("");
  }, []);

const createTaskCard = useCallback(
  async (input: {
    values: any;
    organizationId: string;
    userId: string;
  }) => {
    const { values, organizationId, userId } = input;

    if (!organizationId) throw new Error("organizationId is required");
    if (!userId) throw new Error("userId is required");

    const created = await createTask({
      organizationId,
      title: values.title,
      description: values.description || null,
      status: values.status || "todo",
      priority: values.priority || "medium",
      due_date: values.due_date || null,
      department: values.department || null,
      assigned_to: values.assigned_to || null,
      project_id: values.project_id || null,
      column_id: values.column_id || null,
      position: values.position ?? 0,
      created_by: userId,
      assigned_by: userId,
      is_billable: false,
      metadata: {},
    });

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
        taskId: params.taskId,
        organizationId: params.organizationId,
        userId: params.userId,
        comment: params.comment,
        isInternal: false,
      });

      if (selectedTask?.id === params.taskId) {
        const comments = await getTaskComments(params.taskId);
        setSelectedTaskComments(comments);
      }

      await refetch();
    },
    [refetch, selectedTask?.id],
  );

  const addWatcher = useCallback(
    async (taskId: string, userId: string) => {
      if (!organizationId) return;

      await addTaskWatcher({
        organizationId,
        taskId,
        userId,
      });

      if (selectedTask?.id === taskId) {
        const watchers = await getTaskWatchers(taskId);
        setSelectedTaskWatchers(watchers);
      }

      await refetch();
    },
    [organizationId, refetch, selectedTask?.id],
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

  const moveTaskToColumn = useCallback(
    async (params: {
      taskId: string;
      fromColumnId: string;
      toColumnId: string;
      fromPosition: number;
      toPosition: number;
    }) => {
      if (!organizationId) return null;

      await moveTask({
        taskId: params.taskId,
        organizationId,
        fromColumnId: params.fromColumnId,
        toColumnId: params.toColumnId,
        fromPosition: params.fromPosition,
        toPosition: params.toPosition,
      });

      const refreshedItems = await refetch();
      const updatedTask =
        refreshedItems.find((task) => task.id === params.taskId) ?? null;

      setSelectedTask((prev) =>
        prev?.id === params.taskId ? updatedTask : prev,
      );

      return updatedTask;
    },
    [organizationId, refetch],
  );

  const moveTaskByStatus = useCallback(
    async (taskId: string, nextStatus: TaskItem["status"]) => {
      if (!organizationId) return null;

      await updateTask({
        taskId,
        organizationId,
        status: nextStatus,
      });

      const refreshedItems = await refetch();
      const updatedTask =
        refreshedItems.find((task) => task.id === taskId) ?? null;

      setSelectedTask((prev) => (prev?.id === taskId ? updatedTask : prev));
      return updatedTask;
    },
    [organizationId, refetch],
  );

  return {
    tasks,
    boardColumns,
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

    moveTask: moveTaskByStatus,
    moveTaskToColumn,
    setSelectedTask,
  };
}