import { supabase } from "../client";
import type { TaskBoardColumn } from "../queries/tasks";

const COLUMN_SELECT = `
  id,
  organization_id,
  project_id,
  name,
  color,
  position,
  created_at,
  updated_at
`;

export interface CreateTaskBoardColumnPayload {
    organizationId: string;
    projectId: string;
    name: string;
    color?: string | null;
    position?: number;
}

export interface UpdateTaskBoardColumnPayload {
    organizationId: string;
    projectId: string;
    columnId: string;
    name?: string;
    color?: string | null;
}

export interface ReorderTaskBoardColumnPayload {
    organizationId: string;
    projectId: string;
    columnId: string;
    toPosition: number;
}

export interface DeleteTaskBoardColumnPayload {
    organizationId: string;
    projectId: string;
    columnId: string;
    moveTasksToColumnId?: string | null;
}

function normalizeColumnName(name: string) {
    const trimmedName = name.trim();

    if (!trimmedName) {
        throw new Error("Column name is required");
    }

    return trimmedName;
}

function clampPosition(position: number, max: number) {
    return Math.max(0, Math.min(position, max));
}

async function getProjectColumns(
    organizationId: string,
    projectId: string,
): Promise<TaskBoardColumn[]> {
    const { data, error } = await supabase
        .from("task_board_columns")
        .select(COLUMN_SELECT)
        .eq("organization_id", organizationId)
        .eq("project_id", projectId)
        .order("position", { ascending: true });

    if (error) throw error;
    return (data ?? []) as TaskBoardColumn[];
}

async function resequenceProjectColumns(columns: TaskBoardColumn[]) {
    for (const [index, column] of columns.entries()) {
        if (column.position === index) {
            continue;
        }

        const { error } = await supabase
            .from("task_board_columns")
            .update({
                position: index,
                updated_at: new Date().toISOString(),
            })
            .eq("id", column.id)
            .eq("organization_id", column.organization_id);

        if (error) {
            throw error;
        }
    }
}

export async function ensureDefaultTaskBoardColumns(args: {
    organizationId: string;
    projectId: string;
}): Promise<TaskBoardColumn[]> {
    const { organizationId, projectId } = args;

    if (!organizationId) throw new Error("organizationId is required");
    if (!projectId) throw new Error("projectId is required");

    const existingColumns = await getProjectColumns(organizationId, projectId);

    if (existingColumns.length > 0) {
        return existingColumns;
    }

    const defaultColumns = [
        { name: "Backlog", color: "#64748b", position: 0 },
        { name: "To Do", color: "#f97316", position: 1 },
        { name: "In Progress", color: "#3b82f6", position: 2 },
        { name: "Review", color: "#a855f7", position: 3 },
        { name: "Done", color: "#22c55e", position: 4 },
    ];

    const { data, error } = await supabase
        .from("task_board_columns")
        .insert(
            defaultColumns.map((column) => ({
                organization_id: organizationId,
                project_id: projectId,
                name: column.name,
                color: column.color,
                position: column.position,
            })),
        )
        .select(COLUMN_SELECT)
        .order("position", { ascending: true });

    if (error) throw error;
    return (data ?? []) as TaskBoardColumn[];
}

export async function createTaskBoardColumn(
    payload: CreateTaskBoardColumnPayload,
): Promise<TaskBoardColumn> {
    const { organizationId, projectId, color = null } = payload;
    const name = normalizeColumnName(payload.name);

    if (!organizationId) throw new Error("organizationId is required");
    if (!projectId) throw new Error("projectId is required");

    const existingColumns = await getProjectColumns(organizationId, projectId);
    const targetPosition = clampPosition(
        payload.position ?? existingColumns.length,
        existingColumns.length,
    );

    const shiftResults = await Promise.all(
        existingColumns
            .filter((column) => column.position >= targetPosition)
            .map((column) =>
                supabase
                    .from("task_board_columns")
                    .update({
                        position: column.position + 1,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", column.id)
                    .eq("organization_id", organizationId)
            ),
    );

    const shiftError = shiftResults.find((result) => result.error)?.error;
    if (shiftError) throw shiftError;

    const { data, error } = await supabase
        .from("task_board_columns")
        .insert({
            organization_id: organizationId,
            project_id: projectId,
            name,
            color,
            position: targetPosition,
        })
        .select(COLUMN_SELECT)
        .single();

    if (error) throw error;
    return data as TaskBoardColumn;
}

export async function updateTaskBoardColumn(
    payload: UpdateTaskBoardColumnPayload,
): Promise<TaskBoardColumn> {
    const { organizationId, projectId, columnId } = payload;

    if (!organizationId) throw new Error("organizationId is required");
    if (!projectId) throw new Error("projectId is required");
    if (!columnId) throw new Error("columnId is required");

    const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
    };

    if (payload.name !== undefined) {
        updatePayload.name = normalizeColumnName(payload.name);
    }

    if (payload.color !== undefined) {
        updatePayload.color = payload.color;
    }

    if (Object.keys(updatePayload).length === 1) {
        throw new Error("At least one column field is required");
    }

    const { data, error } = await supabase
        .from("task_board_columns")
        .update(updatePayload)
        .eq("id", columnId)
        .eq("organization_id", organizationId)
        .eq("project_id", projectId)
        .select(COLUMN_SELECT)
        .single();

    if (error) throw error;
    return data as TaskBoardColumn;
}

export async function reorderTaskBoardColumn(
    payload: ReorderTaskBoardColumnPayload,
): Promise<TaskBoardColumn> {
    const { organizationId, projectId, columnId } = payload;

    if (!organizationId) throw new Error("organizationId is required");
    if (!projectId) throw new Error("projectId is required");
    if (!columnId) throw new Error("columnId is required");

    const columns = await getProjectColumns(organizationId, projectId);
    const currentIndex = columns.findIndex((column) => column.id === columnId);

    if (currentIndex === -1) {
        throw new Error("Column not found");
    }

    const targetIndex = clampPosition(payload.toPosition, columns.length - 1);

    if (currentIndex === targetIndex) {
        return columns[currentIndex];
    }

    const orderedColumns = [...columns];
    const [movedColumn] = orderedColumns.splice(currentIndex, 1);
    orderedColumns.splice(targetIndex, 0, movedColumn);

    await resequenceProjectColumns(orderedColumns);

    const { data, error } = await supabase
        .from("task_board_columns")
        .select(COLUMN_SELECT)
        .eq("id", columnId)
        .eq("organization_id", organizationId)
        .eq("project_id", projectId)
        .single();

    if (error) throw error;
    return data as TaskBoardColumn;
}

export async function deleteTaskBoardColumn(
    payload: DeleteTaskBoardColumnPayload,
): Promise<void> {
    const { organizationId, projectId, columnId, moveTasksToColumnId = null } =
        payload;

    if (!organizationId) throw new Error("organizationId is required");
    if (!projectId) throw new Error("projectId is required");
    if (!columnId) throw new Error("columnId is required");

    const columns = await getProjectColumns(organizationId, projectId);
    const columnToDelete = columns.find((column) => column.id === columnId);

    if (!columnToDelete) {
        throw new Error("Column not found");
    }

    const remainingColumns = columns.filter((column) => column.id !== columnId);

    const { data: columnTasks, error: columnTasksError } = await supabase
        .from("tasks")
        .select("id, position")
        .eq("organization_id", organizationId)
        .eq("column_id", columnId)
        .order("position", { ascending: true });

    if (columnTasksError) throw columnTasksError;

    const tasksInColumn = columnTasks ?? [];

    if (tasksInColumn.length > 0) {
        if (!moveTasksToColumnId) {
            throw new Error(
                "Column has tasks. Provide moveTasksToColumnId before deleting it.",
            );
        }

        if (moveTasksToColumnId === columnId) {
            throw new Error(
                "moveTasksToColumnId must be different from columnId",
            );
        }

        const targetColumn = remainingColumns.find(
            (column) => column.id === moveTasksToColumnId,
        );

        if (!targetColumn) {
            throw new Error("Destination column not found in this project");
        }

        const { data: destinationTasks, error: destinationTasksError } =
            await supabase
                .from("tasks")
                .select("id")
                .eq("organization_id", organizationId)
                .eq("column_id", moveTasksToColumnId)
                .order("position", { ascending: true });

        if (destinationTasksError) throw destinationTasksError;

        const startingPosition = destinationTasks?.length ?? 0;

        const moveResults = await Promise.all(
            tasksInColumn.map((task, index) =>
                supabase
                    .from("tasks")
                    .update({
                        column_id: moveTasksToColumnId,
                        position: startingPosition + index,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", task.id)
                    .eq("organization_id", organizationId)
            ),
        );

        const moveError = moveResults.find((result) => result.error)?.error;
        if (moveError) throw moveError;
    }

    const { error } = await supabase
        .from("task_board_columns")
        .delete()
        .eq("id", columnId)
        .eq("organization_id", organizationId)
        .eq("project_id", projectId);

    if (error) throw error;

    await resequenceProjectColumns(remainingColumns);
}
