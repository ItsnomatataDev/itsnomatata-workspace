import { supabase } from "../../../lib/supabase/client";
import type {
  Board,
  BoardStats,
  BoardView,
  Card,
  List,
} from "../../../types/board";
import type { TaskStatus } from "../../../lib/supabase/queries/tasks";
import {
  notifyTaskAssigned,
  notifyTaskCommented,
} from "../../notifications/services/notificationOrchestrationService";
import { makeZimbabweLocalIso } from "../../../lib/utils/zimbabweCalendar";

type CardMetadata = Record<string, unknown>;
type CardAssignee = {
  id: string;
  task_id: string;
  user_id: string;
  created_at: string;
  full_name: string | null;
  email: string | null;
  primary_role?: string | null;
};

const POSTGREST_IN_FILTER_CHUNK_SIZE = 75;

function toMutationError(error: unknown, fallback: string) {
  if (error instanceof Error) return error;
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) return new Error(message);
  }
  return new Error(fallback);
}

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

type AssigneeProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role?: string | null;
};

function mergePrimaryAssigneeIntoList(
  taskAssignees: CardAssignee[],
  task: { id: string; assigned_to: string | null; created_at: string },
  profileMap: Map<string, AssigneeProfile>,
): CardAssignee[] {
  const primaryAssigneeId = task.assigned_to;

  if (
    !primaryAssigneeId ||
    taskAssignees.some((assignee) => assignee.user_id === primaryAssigneeId)
  ) {
    return taskAssignees;
  }

  const profile = profileMap.get(primaryAssigneeId);

  return [
    {
      id: `primary-${task.id}-${primaryAssigneeId}`,
      task_id: task.id,
      user_id: primaryAssigneeId,
      created_at: task.created_at,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      primary_role: profile?.primary_role ?? null,
    },
    ...taskAssignees,
  ];
}

export function markStatusManuallyUpdated(
  metadata: CardMetadata | null | undefined,
  userId?: string | null,
): CardMetadata {
  return {
    ...(metadata ?? {}),
    status_manually_updated: true,
    status_manually_updated_at: new Date().toISOString(),
    ...(userId ? { status_manually_updated_by: userId } : {}),
  };
}

export function shouldAlignImportedStatus(task: {
  metadata?: CardMetadata | null;
}): boolean {
  const metadata = task.metadata ?? {};
  if (metadata.status_manually_updated === true) return false;
  if (metadata.status_locked === true) return false;
  return metadata.imported_from === "trello_board_json";
}

async function getCardMetadata(cardId: string): Promise<CardMetadata> {
  const { data, error } = await supabase
    .from("tasks")
    .select("metadata")
    .eq("id", cardId)
    .maybeSingle();

  if (error) throw error;
  return ((data?.metadata ?? {}) as CardMetadata) ?? {};
}

// ─────────────────────────────────────────────
//  BOARDS  (boards = clients table)
// ─────────────────────────────────────────────

export async function getBoards(
  organizationId: string,
  options?: { officeId?: string | null; includeAllOffices?: boolean },
): Promise<Board[]> {
  let query = supabase
    .from("clients")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });

  if (!options?.includeAllOffices && options?.officeId) {
    query = query.eq("office_id", options.officeId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Board[];
}

export async function getBoard(boardId: string): Promise<Board | null> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", boardId)
    .maybeSingle();
  if (error) throw error;
  return data as Board | null;
}

// ─────────────────────────────────────────────
//  CARDS  (tasks with client_id = boardId)
//  Flat queries only — no nested PostgREST joins
// ─────────────────────────────────────────────

export async function getCards(
  organizationId: string,
  boardId: string,
): Promise<Card[]> {
  const { data: tasks, error: tasksError } = await supabase
    .from("tasks")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("client_id", boardId)
    .order("position", { ascending: true });

  if (tasksError) throw tasksError;
  if (!tasks || tasks.length === 0) return [];

  const taskIds = tasks.map((t) => t.id as string);

  const assignees = await getCardAssignees(taskIds);

  // Profiles for assignees
  const userIds = [
    ...new Set(
      [
        ...assignees.map((a) => a.user_id),
        ...tasks.map((task) => task.created_by as string | null).filter(Boolean),
        ...tasks.map((task) => task.assigned_to as string | null).filter(Boolean),
      ].filter(Boolean) as string[],
    ),
  ];
  const profileMap = new Map<
    string,
    { id: string; full_name: string | null; email: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id, {
        id: p.id,
        full_name: p.full_name ?? null,
        email: p.email ?? null,
      });
    }
  }

  // Comment counts
  const { data: commentRows } = await supabase
    .from("task_comments")
    .select("task_id")
    .in("task_id", taskIds);
  const commentCountMap = new Map<string, number>();
  for (const row of commentRows ?? []) {
    commentCountMap.set(
      row.task_id,
      (commentCountMap.get(row.task_id) ?? 0) + 1,
    );
  }

  // Group assignees by task
  const assigneesByTask = new Map<
    string,
    CardAssignee[]
  >();
  for (const a of assignees) {
    const list = assigneesByTask.get(a.task_id) ?? [];
    list.push(a);
    assigneesByTask.set(a.task_id, list);
  }

  return tasks.map((task) => {
    const creator = task.created_by
      ? profileMap.get(task.created_by as string)
      : null;
    const taskAssignees = mergePrimaryAssigneeIntoList(
      [...(assigneesByTask.get(task.id) ?? [])],
      {
        id: task.id as string,
        assigned_to: task.assigned_to as string | null,
        created_at: task.created_at as string,
      },
      profileMap,
    );

    return {
      ...task,
      assignees: taskAssignees,
      commentsCount: commentCountMap.get(task.id) ?? 0,
      created_by_full_name: creator?.full_name ?? null,
      created_by_email: creator?.email ?? null,
    };
  }) as Card[];
}

export async function getCardById(
  organizationId: string,
  cardId: string,
): Promise<Card | null> {
  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", cardId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw toMutationError(error, "Failed to load card.");
  if (!task) return null;

  const [assignees, commentRows] = await Promise.all([
    getCardAssignees(cardId),
    supabase.from("task_comments").select("task_id").eq("task_id", cardId),
  ]);

  const userIds = [
    ...new Set(
      [
        ...assignees.map((assignee) => assignee.user_id),
        task.created_by as string | null,
        task.assigned_to as string | null,
      ].filter(Boolean) as string[],
    ),
  ];

  const profileMap = new Map<
    string,
    { id: string; full_name: string | null; email: string | null }
  >();

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);

    for (const profile of profiles ?? []) {
      profileMap.set(profile.id, {
        id: profile.id,
        full_name: profile.full_name ?? null,
        email: profile.email ?? null,
      });
    }
  }

  const taskAssignees = mergePrimaryAssigneeIntoList(
    [...assignees],
    {
      id: task.id as string,
      assigned_to: task.assigned_to as string | null,
      created_at: task.created_at as string,
    },
    profileMap,
  );

  const creator = task.created_by
    ? profileMap.get(task.created_by as string)
    : null;

  return {
    ...task,
    assignees: taskAssignees,
    commentsCount: commentRows.data?.length ?? 0,
    created_by_full_name: creator?.full_name ?? null,
    created_by_email: creator?.email ?? null,
  } as Card;
}

export async function getCardAssignees(
  taskIdsOrTaskId: string[] | string,
): Promise<CardAssignee[]> {
  const taskIds = Array.isArray(taskIdsOrTaskId)
    ? taskIdsOrTaskId.filter(Boolean)
    : [taskIdsOrTaskId].filter(Boolean);

  if (taskIds.length === 0) return [];

  const assigneeRows = [];

  for (const taskIdChunk of chunkArray(taskIds, POSTGREST_IN_FILTER_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("task_assignees")
      .select("id, task_id, user_id, created_at")
      .in("task_id", taskIdChunk)
      .order("created_at", { ascending: true });

    if (error) throw error;
    assigneeRows.push(...(data ?? []));
  }

  const assignees = assigneeRows;
  const userIds = [...new Set(assignees.map((a) => a.user_id as string))];

  const profileMap = new Map<
    string,
    {
      id: string;
      full_name: string | null;
      email: string | null;
      primary_role?: string | null;
    }
  >();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, primary_role")
      .in("id", userIds);

    if (profilesError) throw profilesError;

    for (const profile of profiles ?? []) {
      profileMap.set(profile.id, {
        id: profile.id,
        full_name: profile.full_name ?? null,
        email: profile.email ?? null,
        primary_role: profile.primary_role ?? null,
      });
    }
  }

  const mappedAssignees = assignees.map((assignee) => {
    const profile = profileMap.get(assignee.user_id as string);
    return {
      id: assignee.id as string,
      task_id: assignee.task_id as string,
      user_id: assignee.user_id as string,
      created_at: assignee.created_at as string,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
      primary_role: profile?.primary_role ?? null,
    };
  });

  if (Array.isArray(taskIdsOrTaskId)) {
    return mappedAssignees;
  }

  const taskId = taskIdsOrTaskId;
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, assigned_to, created_at")
    .eq("id", taskId)
    .maybeSingle();

  if (taskError) throw taskError;
  if (!task) return mappedAssignees;

  const primaryAssigneeId = task.assigned_to as string | null;

  if (primaryAssigneeId && !profileMap.has(primaryAssigneeId)) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, email, primary_role")
      .eq("id", primaryAssigneeId)
      .maybeSingle();

    if (profileError) throw profileError;

    if (profile) {
      profileMap.set(profile.id, {
        id: profile.id,
        full_name: profile.full_name ?? null,
        email: profile.email ?? null,
        primary_role: profile.primary_role ?? null,
      });
    }
  }

  return mergePrimaryAssigneeIntoList(
    mappedAssignees,
    {
      id: task.id as string,
      assigned_to: primaryAssigneeId,
      created_at: task.created_at as string,
    },
    profileMap,
  );
}

// ─────────────────────────────────────────────
//  STATS
// ─────────────────────────────────────────────

export async function getBoardStats(
  organizationId: string,
  boardId: string,
): Promise<BoardStats> {
  const { data: tasks, error } = await supabase
    .from("tasks")
    .select("id, status, tracked_seconds_cache")
    .eq("organization_id", organizationId)
    .eq("client_id", boardId);

  if (error) throw error;
  const all = tasks ?? [];
  return {
    totalCards: all.length,
    cardsInProgress: all.filter((t) => t.status === "in_progress").length,
    cardsDone: all.filter((t) => t.status === "done").length,
    totalTimeTracked: all.reduce(
      (s, t) => s + (Number(t.tracked_seconds_cache) || 0),
      0,
    ),
    activeMembersCount: 0,
    recentActivities: [],
  };
}

// ─────────────────────────────────────────────
// CREATE BOARD  (create new board/client)
// ─────────────────────────────────────

export async function createBoard(
  organizationId: string,
  input: {
    name: string;
    description?: string;
    officeId?: string | null;
  },
): Promise<Board> {
  let officeId = input.officeId ?? null;
  if (!officeId) {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id;
    if (userId) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("office_id")
        .eq("id", userId)
        .maybeSingle();
      if (profileError) throw profileError;
      officeId = profile?.office_id ?? null;
    }
  }

  const { data, error } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
      office_id: officeId,
      name: input.name,
      description: input.description,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;
  return data as Board;
}

// ─────────────────────────────────────────────
//  CREATE CARD  (title-only quick create)
// ─────────────────────────────────────

export async function createCard(
  organizationId: string,
  boardId: string,
  input: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: string;
    assignedTo?: string;
    assigneeIds?: string[];
    dueDate?: string;
    createdBy?: string | null;
    assignedBy?: string | null;
    estimatedSeconds?: number | null;
    columnId?: string | null;
  },
): Promise<Card> {
  const selectedAssigneeIds = [
    ...new Set(
      [input.assignedTo, ...(input.assigneeIds ?? [])]
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const assigneeIds = [
    ...new Set(
      [...selectedAssigneeIds, input.createdBy]
        .map((id) => id?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const primaryAssigneeId = selectedAssigneeIds[0] ?? input.createdBy ?? null;
  const { data: board, error: boardError } = await supabase
    .from("clients")
    .select("id, office_id")
    .eq("id", boardId)
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (boardError) throw toMutationError(boardError, "Failed to load board for card creation.");

  let officeId = board?.office_id ?? null;
  if (!officeId && input.createdBy) {
    const { data: creatorProfile } = await supabase
      .from("profiles")
      .select("office_id")
      .eq("id", input.createdBy)
      .maybeSingle();
    officeId = creatorProfile?.office_id ?? null;
  }
  if (!officeId) {
    const { data: primaryOffice } = await supabase
      .from("company_offices")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_primary", true)
      .maybeSingle();
    officeId = primaryOffice?.id ?? null;
  }

  const { data: card, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      office_id: officeId,
      client_id: boardId,
      column_id: input.columnId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      assigned_to: primaryAssigneeId,
      assigned_by: input.assignedBy ?? input.createdBy ?? null,
      created_by: input.createdBy ?? null,
      estimated_seconds: input.estimatedSeconds ?? 0,
      due_date: input.dueDate
        ? makeZimbabweLocalIso(input.dueDate.slice(0, 10), "17:00:00")
        : null,
      position: 0,
    })
    .select()
    .single();

  if (error) throw toMutationError(error, "Failed to create card.");

  if (assigneeIds.length > 0) {
    const { error: assigneeError } = await supabase.from("task_assignees").upsert(
      assigneeIds.map((userId) => ({
        organization_id: organizationId,
        task_id: card.id,
        user_id: userId,
      })),
      { onConflict: "organization_id,task_id,user_id", ignoreDuplicates: true },
    );

    if (assigneeError) {
      throw toMutationError(
        assigneeError,
        "Card was created but assigning users failed. Check office permissions.",
      );
    }

    try {
      await Promise.all(
        assigneeIds
          .filter((userId) => userId !== input.createdBy && userId !== input.assignedBy)
          .map((userId) =>
            notifyTaskAssigned({
              organizationId,
              userId,
              taskId: card.id,
              taskTitle: input.title,
              boardId,
              actorUserId: input.createdBy ?? input.assignedBy ?? null,
            }),
          ),
      );
    } catch (notifError) {
      console.error("CREATE CARD ASSIGNMENT NOTIFICATION ERROR:", notifError);
    }
  }

  return {
    ...card,
    assignees: await getCardAssignees(card.id),
    commentsCount: 0,
  } as Card;
}

export async function updateCard(
  cardId: string,
  updates: Partial<Card>,
  options?: {
    markStatusAsManual?: boolean;
    userId?: string | null;
  },
): Promise<Card> {
  let nextUpdates = updates;

  if (options?.markStatusAsManual && updates.status !== undefined) {
    const currentMetadata = await getCardMetadata(cardId);
    const updateMetadata = (updates.metadata ?? {}) as CardMetadata;
    nextUpdates = {
      ...updates,
      metadata: markStatusManuallyUpdated(
        {
          ...currentMetadata,
          ...updateMetadata,
        },
        options.userId,
      ),
    };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update(nextUpdates)
    .eq("id", cardId)
    .select()
    .single();
  if (error) throw error;
  return data as Card;
}

export async function moveCard(
  cardId: string,
  targetStatus: TaskStatus,
  position: number,
  columnId?: string | null,
  options?: {
    markStatusAsManual?: boolean;
    userId?: string | null;
  },
): Promise<void> {
  const updates: Record<string, unknown> = { status: targetStatus, position };
  if (columnId !== undefined) updates.column_id = columnId;
  if (options?.markStatusAsManual) {
    updates.metadata = markStatusManuallyUpdated(
      await getCardMetadata(cardId),
      options.userId,
    );
  }

  const { error } = await supabase
    .from("tasks")
    .update(updates)
    .eq("id", cardId);
  if (error) throw error;
}

export async function deleteCard(cardId: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", cardId);
  if (error) throw error;
}

export async function deleteBoard(
  organizationId: string,
  boardId: string,
): Promise<void> {
  const { error } = await supabase.from("clients").delete().eq("id", boardId)
    .eq("organization_id", organizationId);
  if (error) throw error;
}

// ─────────────────────────────────────────────
//  COMMENTS
// ─────────────────────────────────────────────

export async function getCardComments(taskId: string) {
  const { data, error } = await supabase
    .from("task_comments")
    .select(
      "id, task_id, organization_id, user_id, comment, is_internal, created_at, updated_at",
    )
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const comments = data ?? [];
  const userIds = [
    ...new Set(comments.map((c) => c.user_id).filter(Boolean)),
  ] as string[];
  const profileMap = new Map<
    string,
    { full_name: string | null; email: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    for (const p of profiles ?? []) profileMap.set(p.id, p);
  }

  return comments.map((c) => {
    const author = c.user_id ? profileMap.get(c.user_id) : null;
    return {
      ...c,
      author_name: author?.full_name ?? null,
      author_email: author?.email ?? null,
    };
  });
}

export async function addCardComment(
  taskId: string,
  organizationId: string,
  userId: string,
  comment: string,
) {
  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      task_id: taskId,
      organization_id: organizationId,
      user_id: userId,
      comment,
      is_internal: false,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

function getFallbackLists(boardId: string): List[] {
  const now = new Date().toISOString();
  return [
    {
      id: "list-backlog",
      organization_id: "",
      project_id: "",
      name: "Backlog",
      color: "#94a3b8",
      position: 0,
      created_at: now,
      updated_at: now,
      boardId,
      taskCount: 0,
    },
    {
      id: "list-todo",
      organization_id: "",
      project_id: "",
      name: "To Do",
      color: "#3b82f6",
      position: 1,
      created_at: now,
      updated_at: now,
      boardId,
      taskCount: 0,
    },
    {
      id: "list-in_progress",
      organization_id: "",
      project_id: "",
      name: "In Progress",
      color: "#f97316",
      position: 2,
      created_at: now,
      updated_at: now,
      boardId,
      taskCount: 0,
    },
    {
      id: "list-review",
      organization_id: "",
      project_id: "",
      name: "Review",
      color: "#eab308",
      position: 3,
      created_at: now,
      updated_at: now,
      boardId,
      taskCount: 0,
    },
    {
      id: "list-done",
      organization_id: "",
      project_id: "",
      name: "Done",
      color: "#22c55e",
      position: 4,
      created_at: now,
      updated_at: now,
      boardId,
      taskCount: 0,
    },
  ];
}

function normalizeBoardListName(name: string | null | undefined) {
  return (name ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toBoardList(column: Record<string, unknown>, boardId: string): List {
  return {
    ...column,
    boardId,
    taskCount: 0,
  } as List;
}

export async function getLists(boardId: string): Promise<List[]> {
  const { data, error } = await supabase
    .from("task_board_columns")
    .select("*")
    .eq("client_id", boardId)
    .order("position", { ascending: true });

  if (error) throw error;

  if (data && data.length > 0) {
    const existing = data.map((column) => toBoardList(column, boardId));
    const usedColumnIds = new Set<string>();
    const defaultLists = getFallbackLists(boardId);

    const workflowLists = defaultLists.map((fallback) => {
      const exactMatch = existing.find(
        (column) =>
          normalizeBoardListName(column.name) ===
          normalizeBoardListName(fallback.name),
      );
      if (exactMatch?.id) {
        usedColumnIds.add(exactMatch.id);
        return {
          ...exactMatch,
          name: fallback.name,
          position: fallback.position,
        };
      }
      return fallback;
    });

    const importedLists = existing
      .filter((column) => !usedColumnIds.has(column.id))
      .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
      .map((column, index) => ({
        ...column,
        position: defaultLists.length + index,
      }));

    return [...workflowLists, ...importedLists] as List[];
  }

  return getFallbackLists(boardId);
}

export async function getBoardView(
  organizationId: string,
  boardId: string,
): Promise<BoardView> {
  const [board, lists, cards] = await Promise.all([
    getBoard(boardId),
    getLists(boardId),
    getCards(organizationId, boardId),
  ]);
  if (!board) throw new Error(`Board not found: ${boardId}`);
  const cardsByList: Record<string, Card[]> = {};
  lists.forEach((list) => {
    const statusKey = list.id.replace("list-", "") as TaskStatus;
    cardsByList[list.id] = cards.filter((c) => c.status === statusKey);
  });
  return { board, lists, cards: cardsByList };
}

export type { Board, BoardStats, BoardView, Card, List };
