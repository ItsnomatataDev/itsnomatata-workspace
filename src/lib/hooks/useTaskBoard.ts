import { useCallback, useEffect, useMemo, useState } from "react";
import { useTimeEntries } from "./useTimeEntries";
import {
    createTaskBoardColumn,
    type CreateTaskBoardColumnPayload,
    deleteTaskBoardColumn,
    type DeleteTaskBoardColumnPayload,
    ensureDefaultTaskBoardColumns,
    reorderTaskBoardColumn,
    type ReorderTaskBoardColumnPayload,
    updateTaskBoardColumn,
    type UpdateTaskBoardColumnPayload,
} from "../supabase/mutations/taskBoardColumns";
import {
    createTaskUpdate,
    logTaskMoved,
    logTaskStatusChange,
    logTaskTimeTracked,
} from "../supabase/mutations/taskUpdates";
import {
    addTaskWatcher,
    createTask,
    createTaskComment,
    moveTask,
    removeTaskWatcher,
    updateTask,
} from "../supabase/mutations/tasks";
import {
    createTaskChecklist,
    createTaskChecklistItem,
    deleteTaskChecklist,
    deleteTaskChecklistItem,
    toggleTaskChecklistItem,
} from "../supabase/mutations/taskChecklists";
import type { TimeEntryItem } from "../supabase/mutations/timeEntries";
import {
    getBoardColumns,
    getProjectTasks,
    getTaskById,
    getTaskComments,
    getTaskRuntimeInfo,
    getTaskWatchers,
    searchTaskInvitableUsers,
    type TaskBoardColumn,
    type TaskCommentItem,
    type TaskItem,
    type TaskPriority,
    type TaskStatus,
    type TaskWatcherItem,
} from "../supabase/queries/tasks";
import {
    getTaskChecklists,
    type TaskChecklistWithItems,
} from "../supabase/queries/taskChecklists";
import {
    getTaskUpdatesForProject,
    getTaskUpdatesForTask,
    type TaskUpdateItem,
} from "../supabase/queries/taskUpdates";

type BoardTaskItem = TaskItem & {
    column_id: string | null;
};

export interface UseTaskBoardParams {
    organizationId?: string | null;
    projectId?: string | null;
    userId?: string | null;
    autoLoad?: boolean;
}

export interface CreateBoardTaskInput {
    title: string;
    description?: string | null;
    columnId?: string | null;
    priority?: TaskPriority;
    dueDate?: string | null;
    assignedTo?: string | null;
    isBillable?: boolean;
    clientId?: string | null;
    campaignId?: string | null;
    metadata?: Record<string, unknown>;
}

export interface StartTaskTimerInput {
    taskId: string;
    description?: string | null;
    isBillable?: boolean;
}

export interface CreateManualTaskTimeInput {
    taskId: string;
    startedAt: string;
    endedAt: string;
    description?: string | null;
    isBillable?: boolean;
}

function getStatusForColumnName(name: string): TaskStatus {
    const normalized = name.trim().toLowerCase();

    if (normalized.includes("backlog")) return "backlog";
    if (normalized.includes("progress") || normalized.includes("doing")) {
        return "in_progress";
    }
    if (normalized.includes("review") || normalized.includes("qa")) {
        return "review";
    }
    if (normalized.includes("done") || normalized.includes("complete")) {
        return "done";
    }
    if (normalized.includes("block")) return "blocked";
    return "todo";
}

function getCompletedAt(status: TaskStatus) {
    return status === "done" ? new Date().toISOString() : null;
}

function findTaskInList(tasks: BoardTaskItem[], taskId: string) {
    return tasks.find((task) => task.id === taskId) ?? null;
}

export function useTaskBoard({
    organizationId,
    projectId,
    userId,
    autoLoad = true,
}: UseTaskBoardParams) {
    const [columns, setColumns] = useState<TaskBoardColumn[]>([]);
    const [tasks, setTasks] = useState<BoardTaskItem[]>([]);
    const [projectUpdates, setProjectUpdates] = useState<TaskUpdateItem[]>([]);
    const [loading, setLoading] = useState(autoLoad);
    const [mutating, setMutating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selectedTask, setSelectedTask] = useState<BoardTaskItem | null>(
        null,
    );
    const [selectedTaskComments, setSelectedTaskComments] = useState<
        TaskCommentItem[]
    >([]);
    const [selectedTaskWatchers, setSelectedTaskWatchers] = useState<
        TaskWatcherItem[]
    >([]);
    const [selectedTaskChecklists, setSelectedTaskChecklists] = useState<
        TaskChecklistWithItems[]
    >([]);
    const [selectedTaskUpdates, setSelectedTaskUpdates] = useState<
        TaskUpdateItem[]
    >([]);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [detailsError, setDetailsError] = useState<string | null>(null);
    const [taskRuntimeMap, setTaskRuntimeMap] = useState<Map<string, boolean>>(
        new Map(),
    );

    const {
        entries,
        activeEntry,
        totals,
        mutating: timeMutating,
        error: timeError,
        refresh: refreshTimeEntries,
        startEntry,
        stopActiveEntry,
        createManualEntry,
    } = useTimeEntries({
        organizationId,
        userId,
        autoLoad,
    });

    const canQuery = Boolean(organizationId && projectId);

    const refreshTaskDetails = useCallback(
        async (taskId: string) => {
            if (!organizationId) {
                return null;
            }

            setDetailsLoading(true);
            setDetailsError(null);

            try {
                const [task, comments, watchers, checklists, updates] =
                    await Promise.all([
                        getTaskById(taskId),
                        getTaskComments(taskId),
                        getTaskWatchers(taskId),
                        getTaskChecklists(taskId),
                        getTaskUpdatesForTask({
                            organizationId,
                            taskId,
                            limit: 100,
                        }),
                    ]);

                const boardTask = task as BoardTaskItem;
                setSelectedTask(boardTask);
                setSelectedTaskComments(comments);
                setSelectedTaskWatchers(watchers);
                setSelectedTaskChecklists(checklists);
                setSelectedTaskUpdates(updates);
                return boardTask;
            } catch (err) {
                const message = err instanceof Error
                    ? err.message
                    : "Failed to load task details.";
                setDetailsError(message);
                throw err;
            } finally {
                setDetailsLoading(false);
            }
        },
        [organizationId],
    );

    const refetch = useCallback(async () => {
        if (!organizationId || !projectId) {
            setColumns([]);
            setTasks([]);
            setProjectUpdates([]);
            setSelectedTask(null);
            setSelectedTaskComments([]);
            setSelectedTaskWatchers([]);
            setSelectedTaskChecklists([]);
            setSelectedTaskUpdates([]);
            setTaskRuntimeMap(new Map());
            setLoading(false);
            return {
                columns: [] as TaskBoardColumn[],
                tasks: [] as BoardTaskItem[],
            };
        }

        setLoading(true);
        setError(null);

        try {
            let boardColumns = await getBoardColumns(organizationId, projectId);

            if (boardColumns.length === 0) {
                boardColumns = await ensureDefaultTaskBoardColumns({
                    organizationId,
                    projectId,
                });
            }

            const [projectTasks, updates, runtimeInfo] = await Promise.all([
                getProjectTasks(organizationId, projectId),
                getTaskUpdatesForProject({
                    organizationId,
                    projectId,
                    limit: 100,
                }),
                getTaskRuntimeInfo(organizationId),
            ]);

            if (userId) {
                await refreshTimeEntries();
            }

            setColumns(boardColumns);
            setTasks((projectTasks ?? []) as BoardTaskItem[]);
            setProjectUpdates(updates);

            const runtimeMap = new Map<string, boolean>();
            runtimeInfo.forEach((item) => {
                runtimeMap.set(item.task_id, item.has_running_timer);
            });
            setTaskRuntimeMap(runtimeMap);

            if (selectedTask?.id) {
                await refreshTaskDetails(selectedTask.id);
            }

            return {
                columns: boardColumns,
                tasks: (projectTasks ?? []) as BoardTaskItem[],
            };
        } catch (err) {
            const message = err instanceof Error
                ? err.message
                : "Failed to load board.";
            setError(message);
            throw err;
        } finally {
            setLoading(false);
        }
    }, [
        organizationId,
        projectId,
        refreshTaskDetails,
        refreshTimeEntries,
        selectedTask?.id,
        userId,
    ]);

    useEffect(() => {
        if (!autoLoad) return;
        void refetch();
    }, [autoLoad, refetch]);

    const tasksByColumn = useMemo(() => {
        const grouped: Record<string, BoardTaskItem[]> = {};

        columns.forEach((column) => {
            grouped[column.id] = [];
        });

        tasks.forEach((task) => {
            const key = task.column_id ?? "unassigned";
            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(task);
        });

        Object.values(grouped).forEach((items) => {
            items.sort((a, b) => a.position - b.position);
        });

        return grouped;
    }, [columns, tasks]);

    const flatTasks = useMemo(() => tasks, [tasks]);

    const taskCountByColumn = useMemo(() => {
        const counts = new Map<string, number>();

        columns.forEach((column) => {
            counts.set(column.id, tasksByColumn[column.id]?.length ?? 0);
        });

        return counts;
    }, [columns, tasksByColumn]);

    const activeTimerTaskId = activeEntry?.task_id ?? null;

    const projectTimeSummary = useMemo(() => {
        const projectEntries = entries.filter((entry) =>
            entry.project_id === projectId
        );
        const totalSeconds = projectEntries.reduce(
            (sum, entry) => sum + (entry.duration_seconds ?? 0),
            0,
        );
        const billableSeconds = projectEntries
            .filter((entry) => entry.is_billable)
            .reduce((sum, entry) => sum + (entry.duration_seconds ?? 0), 0);

        return {
            totalSeconds,
            billableSeconds,
            nonBillableSeconds: totalSeconds - billableSeconds,
        };
    }, [entries, projectId]);

    const closeTask = useCallback(() => {
        setSelectedTask(null);
        setSelectedTaskComments([]);
        setSelectedTaskWatchers([]);
        setSelectedTaskChecklists([]);
        setSelectedTaskUpdates([]);
        setDetailsError(null);
    }, []);

    const openTask = useCallback(
        async (taskId: string) => refreshTaskDetails(taskId),
        [refreshTaskDetails],
    );

    const createColumn = useCallback(
        async (
            payload: Omit<
                CreateTaskBoardColumnPayload,
                "organizationId" | "projectId"
            >,
        ) => {
            if (!organizationId || !projectId) {
                throw new Error("organizationId and projectId are required.");
            }

            setMutating(true);
            setError(null);

            try {
                const column = await createTaskBoardColumn({
                    organizationId,
                    projectId,
                    ...payload,
                });
                await refetch();
                return column;
            } finally {
                setMutating(false);
            }
        },
        [organizationId, projectId, refetch],
    );

    const renameColumn = useCallback(
        async (
            columnId: string,
            payload: Omit<
                UpdateTaskBoardColumnPayload,
                "organizationId" | "projectId" | "columnId"
            >,
        ) => {
            if (!organizationId || !projectId) {
                throw new Error("organizationId and projectId are required.");
            }

            setMutating(true);
            setError(null);

            try {
                const column = await updateTaskBoardColumn({
                    organizationId,
                    projectId,
                    columnId,
                    ...payload,
                });
                await refetch();
                return column;
            } finally {
                setMutating(false);
            }
        },
        [organizationId, projectId, refetch],
    );

    const reorderColumn = useCallback(
        async (
            columnId: string,
            toPosition: ReorderTaskBoardColumnPayload["toPosition"],
        ) => {
            if (!organizationId || !projectId) {
                throw new Error("organizationId and projectId are required.");
            }

            setMutating(true);
            setError(null);

            try {
                const column = await reorderTaskBoardColumn({
                    organizationId,
                    projectId,
                    columnId,
                    toPosition,
                });
                await refetch();
                return column;
            } finally {
                setMutating(false);
            }
        },
        [organizationId, projectId, refetch],
    );

    const removeColumn = useCallback(
        async (
            columnId: string,
            options?: Pick<DeleteTaskBoardColumnPayload, "moveTasksToColumnId">,
        ) => {
            if (!organizationId || !projectId) {
                throw new Error("organizationId and projectId are required.");
            }

            setMutating(true);
            setError(null);

            try {
                await deleteTaskBoardColumn({
                    organizationId,
                    projectId,
                    columnId,
                    moveTasksToColumnId: options?.moveTasksToColumnId ?? null,
                });
                await refetch();
                if (selectedTask?.column_id === columnId) {
                    closeTask();
                }
            } finally {
                setMutating(false);
            }
        },
        [
            closeTask,
            organizationId,
            projectId,
            refetch,
            selectedTask?.column_id,
        ],
    );

    const createBoardTask = useCallback(
        async (input: CreateBoardTaskInput) => {
            if (!organizationId || !projectId) {
                throw new Error("organizationId and projectId are required.");
            }

            setMutating(true);
            setError(null);

            try {
                const currentColumns = columns.length > 0
                    ? columns
                    : await ensureDefaultTaskBoardColumns({
                        organizationId,
                        projectId,
                    });
                const targetColumn = currentColumns.find((column) =>
                    column.id === input.columnId
                ) ??
                    currentColumns[0];

                if (!targetColumn) {
                    throw new Error("No board columns found for this project.");
                }

                const nextStatus = getStatusForColumnName(targetColumn.name);
                const created = await createTask({
                    organizationId,
                    projectId,
                    columnId: targetColumn.id,
                    title: input.title,
                    description: input.description ?? null,
                    status: nextStatus,
                    priority: input.priority ?? "medium",
                    position: tasksByColumn[targetColumn.id]?.length ?? 0,
                    assigned_to: input.assignedTo ?? null,
                    assigned_by: userId ?? null,
                    created_by: userId ?? null,
                    due_date: input.dueDate ?? null,
                    isBillable: input.isBillable ?? false,
                    clientId: input.clientId ?? null,
                    campaignId: input.campaignId ?? null,
                    metadata: {
                        ...(input.metadata ?? {}),
                        board_view: true,
                        time_tracking_mode: "everhour",
                    },
                });

                await createTaskUpdate({
                    organizationId,
                    taskId: created.id,
                    userId: userId ?? null,
                    projectId,
                    type: "manual",
                    message: "Task created from board",
                    metadata: {
                        column_id: targetColumn.id,
                        everhour_style: true,
                    },
                });

                await refetch();
                return created;
            } finally {
                setMutating(false);
            }
        },
        [columns, organizationId, projectId, refetch, tasksByColumn, userId],
    );

    const moveBoardTask = useCallback(
        async (args: {
            taskId: string;
            toColumnId: string;
            toPosition?: number;
        }) => {
            if (!organizationId) {
                throw new Error("organizationId is required.");
            }

            setMutating(true);
            setError(null);

            try {
                const currentTask = findTaskInList(tasks, args.taskId) ??
                    (await getTaskById(args.taskId) as BoardTaskItem);
                const destinationColumn = columns.find((column) =>
                    column.id === args.toColumnId
                );

                if (!destinationColumn) {
                    throw new Error("Destination column not found.");
                }

                const previousStatus = currentTask.status;
                const nextStatus = getStatusForColumnName(
                    destinationColumn.name,
                );
                const fromColumnId = currentTask.column_id ?? args.toColumnId;
                const fromPosition = currentTask.position ?? 0;
                const destinationTasks = tasksByColumn[args.toColumnId] ?? [];
                const toPosition = args.toPosition ?? destinationTasks.length;

                const movedTask = await moveTask({
                    taskId: args.taskId,
                    organizationId,
                    toColumnId: args.toColumnId,
                    toPosition,
                    fromColumnId,
                    fromPosition,
                });

                if (
                    previousStatus !== nextStatus ||
                    currentTask.completed_at !== getCompletedAt(nextStatus)
                ) {
                    await updateTask(args.taskId, {
                        organizationId,
                        status: nextStatus,
                        completed_at: getCompletedAt(nextStatus),
                    });

                    await logTaskStatusChange({
                        organizationId,
                        taskId: args.taskId,
                        userId: userId ?? null,
                        projectId: currentTask.project_id ?? projectId ?? null,
                        previousStatus,
                        nextStatus,
                    });
                }

                await logTaskMoved({
                    organizationId,
                    taskId: args.taskId,
                    userId: userId ?? null,
                    projectId: currentTask.project_id ?? projectId ?? null,
                    fromColumnId,
                    toColumnId: args.toColumnId,
                    fromPosition,
                    toPosition,
                });

                await refetch();
                return movedTask;
            } finally {
                setMutating(false);
            }
        },
        [
            columns,
            organizationId,
            projectId,
            refetch,
            tasks,
            tasksByColumn,
            userId,
        ],
    );

    const addComment = useCallback(
        async (taskId: string, comment: string) => {
            if (!organizationId || !userId) {
                throw new Error("organizationId and userId are required.");
            }

            await createTaskComment({
                organizationId,
                taskId,
                userId,
                comment,
            });

            await createTaskUpdate({
                organizationId,
                taskId,
                userId,
                projectId: projectId ?? null,
                type: "comment",
                message: "Comment added to task",
            });

            if (selectedTask?.id === taskId) {
                await refreshTaskDetails(taskId);
            }
        },
        [
            organizationId,
            projectId,
            refreshTaskDetails,
            selectedTask?.id,
            userId,
        ],
    );

    const addWatcherToTask = useCallback(
        async (taskId: string, watcherUserId: string) => {
            if (!organizationId || !userId) {
                throw new Error("organizationId and userId are required.");
            }

            await addTaskWatcher({
                organizationId,
                taskId,
                userId: watcherUserId,
            });

            await createTaskUpdate({
                organizationId,
                taskId,
                userId,
                projectId: projectId ?? null,
                type: "watcher_added",
                message: "Watcher added to task",
                metadata: {
                    watcher_user_id: watcherUserId,
                },
            });

            if (selectedTask?.id === taskId) {
                await refreshTaskDetails(taskId);
            }
        },
        [
            organizationId,
            projectId,
            refreshTaskDetails,
            selectedTask?.id,
            userId,
        ],
    );

    const removeWatcherFromTask = useCallback(
        async (taskId: string, watcherUserId: string) => {
            if (!organizationId || !userId) {
                throw new Error("organizationId and userId are required.");
            }

            await removeTaskWatcher({
                taskId,
                userId: watcherUserId,
            });

            await createTaskUpdate({
                organizationId,
                taskId,
                userId,
                projectId: projectId ?? null,
                type: "watcher_removed",
                message: "Watcher removed from task",
                metadata: {
                    watcher_user_id: watcherUserId,
                },
            });

            if (selectedTask?.id === taskId) {
                await refreshTaskDetails(taskId);
            }
        },
        [
            organizationId,
            projectId,
            refreshTaskDetails,
            selectedTask?.id,
            userId,
        ],
    );

    const searchInvitableUsers = useCallback(
        async (search: string) => {
            if (!organizationId) return [];

            const excludeUserIds = selectedTaskWatchers.map((item) =>
                item.user_id
            );
            return searchTaskInvitableUsers({
                organizationId,
                search,
                excludeUserIds,
            });
        },
        [organizationId, selectedTaskWatchers],
    );

    const addChecklist = useCallback(
        async (args: { taskId: string; title: string }) => {
            if (!organizationId || !userId) {
                throw new Error("organizationId and userId are required.");
            }

            const task = findTaskInList(tasks, args.taskId) ??
                (await getTaskById(args.taskId) as BoardTaskItem);
            const existing = await getTaskChecklists(args.taskId);

            const checklist = await createTaskChecklist({
                taskId: args.taskId,
                organizationId,
                title: args.title,
                createdBy: userId,
                position: existing.length,
            });

            await createTaskUpdate({
                organizationId,
                taskId: args.taskId,
                userId,
                projectId: task.project_id,
                type: "checklist_updated",
                message: "Checklist created",
                metadata: {
                    checklist_id: checklist.id,
                    title: checklist.title,
                },
            });

            if (selectedTask?.id === args.taskId) {
                await refreshTaskDetails(args.taskId);
            }

            return checklist;
        },
        [organizationId, refreshTaskDetails, selectedTask?.id, tasks, userId],
    );

    const removeChecklist = useCallback(
        async (args: { taskId: string; checklistId: string }) => {
            if (!organizationId || !userId) {
                throw new Error("organizationId and userId are required.");
            }

            const task = findTaskInList(tasks, args.taskId) ??
                (await getTaskById(args.taskId) as BoardTaskItem);

            await deleteTaskChecklist(args.checklistId);

            await createTaskUpdate({
                organizationId,
                taskId: args.taskId,
                userId,
                projectId: task.project_id,
                type: "checklist_updated",
                message: "Checklist removed",
                metadata: {
                    checklist_id: args.checklistId,
                },
            });

            if (selectedTask?.id === args.taskId) {
                await refreshTaskDetails(args.taskId);
            }
        },
        [organizationId, refreshTaskDetails, selectedTask?.id, tasks, userId],
    );

    const addChecklistItem = useCallback(
        async (
            args: { taskId: string; checklistId: string; content: string },
        ) => {
            if (!organizationId || !userId) {
                throw new Error("organizationId and userId are required.");
            }

            const task = findTaskInList(tasks, args.taskId) ??
                (await getTaskById(args.taskId) as BoardTaskItem);
            const checklists = await getTaskChecklists(args.taskId);
            const parentChecklist = checklists.find(
                (checklist) => checklist.id === args.checklistId,
            );

            const item = await createTaskChecklistItem({
                checklistId: args.checklistId,
                taskId: args.taskId,
                organizationId,
                content: args.content,
                createdBy: userId,
                position: parentChecklist?.items.length ?? 0,
            });

            await createTaskUpdate({
                organizationId,
                taskId: args.taskId,
                userId,
                projectId: task.project_id,
                type: "checklist_updated",
                message: "Checklist item added",
                metadata: {
                    checklist_id: args.checklistId,
                    checklist_item_id: item.id,
                },
            });

            if (selectedTask?.id === args.taskId) {
                await refreshTaskDetails(args.taskId);
            }

            return item;
        },
        [organizationId, refreshTaskDetails, selectedTask?.id, tasks, userId],
    );

    const toggleChecklistItem = useCallback(
        async (args: { taskId: string; itemId: string; checked: boolean }) => {
            if (!organizationId || !userId) {
                throw new Error("organizationId and userId are required.");
            }

            const task = findTaskInList(tasks, args.taskId) ??
                (await getTaskById(args.taskId) as BoardTaskItem);

            const item = await toggleTaskChecklistItem({
                itemId: args.itemId,
                checked: args.checked,
                userId,
            });

            await createTaskUpdate({
                organizationId,
                taskId: args.taskId,
                userId,
                projectId: task.project_id,
                type: "checklist_updated",
                message: args.checked
                    ? "Checklist item completed"
                    : "Checklist item reopened",
                metadata: {
                    checklist_item_id: args.itemId,
                    is_completed: args.checked,
                },
            });

            if (selectedTask?.id === args.taskId) {
                await refreshTaskDetails(args.taskId);
            }

            return item;
        },
        [organizationId, refreshTaskDetails, selectedTask?.id, tasks, userId],
    );

    const removeChecklistItem = useCallback(
        async (args: { taskId: string; itemId: string }) => {
            if (!organizationId || !userId) {
                throw new Error("organizationId and userId are required.");
            }

            const task = findTaskInList(tasks, args.taskId) ??
                (await getTaskById(args.taskId) as BoardTaskItem);

            await deleteTaskChecklistItem(args.itemId);

            await createTaskUpdate({
                organizationId,
                taskId: args.taskId,
                userId,
                projectId: task.project_id,
                type: "checklist_updated",
                message: "Checklist item removed",
                metadata: {
                    checklist_item_id: args.itemId,
                },
            });

            if (selectedTask?.id === args.taskId) {
                await refreshTaskDetails(args.taskId);
            }
        },
        [organizationId, refreshTaskDetails, selectedTask?.id, tasks, userId],
    );

    const startTimerForTask = useCallback(
        async (input: StartTaskTimerInput): Promise<TimeEntryItem> => {
            if (!organizationId || !userId) {
                throw new Error("organizationId and userId are required.");
            }

            setMutating(true);
            setError(null);

            try {
                const task = findTaskInList(tasks, input.taskId) ??
                    (await getTaskById(input.taskId) as BoardTaskItem);

                if (activeEntry?.task_id === task.id) {
                    return activeEntry;
                }

                if (activeEntry?.id) {
                    const stoppedEntry = await stopActiveEntry();

                    if (stoppedEntry?.task_id) {
                        await logTaskTimeTracked({
                            organizationId,
                            taskId: stoppedEntry.task_id,
                            userId,
                            projectId: stoppedEntry.project_id,
                            timeEntryId: stoppedEntry.id,
                            durationSeconds: stoppedEntry.duration_seconds,
                            isBillable: stoppedEntry.is_billable,
                        });
                    }
                }

                const entry = await startEntry({
                    taskId: task.id,
                    projectId: task.project_id,
                    clientId: task.client_id,
                    campaignId: task.campaign_id,
                    description: input.description ??
                        `Working on ${task.title}`,
                    isBillable: input.isBillable ?? false,
                    source: "task_timer",
                    metadata: {
                        origin: "task_board",
                        behavior: "everhour",
                    },
                });

                if (task.status === "todo" || task.status === "backlog") {
                    await updateTask(task.id, {
                        organizationId,
                        status: "in_progress",
                        completed_at: null,
                    });

                    await logTaskStatusChange({
                        organizationId,
                        taskId: task.id,
                        userId,
                        projectId: task.project_id,
                        previousStatus: task.status,
                        nextStatus: "in_progress",
                    });
                }

                await refetch();
                return entry;
            } finally {
                setMutating(false);
            }
        },
        [
            activeEntry,
            organizationId,
            refetch,
            startEntry,
            stopActiveEntry,
            tasks,
            userId,
        ],
    );

    const stopTimer = useCallback(async () => {
        if (!organizationId || !userId) {
            throw new Error("organizationId and userId are required.");
        }

        setMutating(true);
        setError(null);

        try {
            const stoppedEntry = await stopActiveEntry();

            if (stoppedEntry?.task_id) {
                await logTaskTimeTracked({
                    organizationId,
                    taskId: stoppedEntry.task_id,
                    userId,
                    projectId: stoppedEntry.project_id,
                    timeEntryId: stoppedEntry.id,
                    durationSeconds: stoppedEntry.duration_seconds,
                    isBillable: stoppedEntry.is_billable,
                });
            }

            await refetch();
            return stoppedEntry;
        } finally {
            setMutating(false);
        }
    }, [organizationId, refetch, stopActiveEntry, userId]);

    const addManualTaskTime = useCallback(
        async (input: CreateManualTaskTimeInput): Promise<TimeEntryItem> => {
            if (!organizationId || !userId) {
                throw new Error("organizationId and userId are required.");
            }

            setMutating(true);
            setError(null);

            try {
                const task = findTaskInList(tasks, input.taskId) ??
                    (await getTaskById(input.taskId) as BoardTaskItem);

                const entry = await createManualEntry({
                    taskId: task.id,
                    projectId: task.project_id,
                    clientId: task.client_id,
                    campaignId: task.campaign_id,
                    startedAt: input.startedAt,
                    endedAt: input.endedAt,
                    description: input.description ??
                        `Manual time for ${task.title}`,
                    isBillable: input.isBillable ?? false,
                    source: "manual_task",
                    metadata: {
                        origin: "task_board",
                        behavior: "everhour",
                    },
                });

                await logTaskTimeTracked({
                    organizationId,
                    taskId: task.id,
                    userId,
                    projectId: task.project_id,
                    timeEntryId: entry.id,
                    durationSeconds: entry.duration_seconds,
                    isBillable: entry.is_billable,
                });

                await refetch();
                return entry;
            } finally {
                setMutating(false);
            }
        },
        [createManualEntry, organizationId, refetch, tasks, userId],
    );

    return {
        columns,
        tasks,
        flatTasks,
        tasksByColumn,
        taskCountByColumn,
        projectUpdates,
        taskRuntimeMap,
        activeEntry,
        activeTimerTaskId,
        totals,
        projectTimeSummary,
        loading,
        detailsLoading,
        mutating: mutating || timeMutating,
        error: error ?? timeError,
        detailsError,
        canQuery,
        selectedTask,
        selectedTaskComments,
        selectedTaskWatchers,
        selectedTaskChecklists,
        selectedTaskUpdates,
        refetch,
        openTask,
        closeTask,
        createColumn,
        renameColumn,
        reorderColumn,
        removeColumn,
        createTask: createBoardTask,
        moveTask: moveBoardTask,
        addComment,
        addWatcher: addWatcherToTask,
        removeWatcher: removeWatcherFromTask,
        searchInvitableUsers,
        addChecklist,
        removeChecklist,
        addChecklistItem,
        toggleChecklistItem,
        removeChecklistItem,
        startTimerForTask,
        stopTimer,
        addManualTaskTime,
        setSelectedTask,
    };
}
