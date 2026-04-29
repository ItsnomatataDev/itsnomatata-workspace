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

// ─────────────────────────────────────────────
//  BOARDS  (boards = clients table)
// ─────────────────────────────────────────────

export async function getBoards(organizationId: string): Promise<Board[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("organization_id", organizationId)
    .order("updated_at", { ascending: false });
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

  // Assignee rows
  const { data: assigneeRows } = await supabase
    .from("task_assignees")
    .select("id, task_id, user_id")
    .in("task_id", taskIds);

  // Profiles for assignees
  const userIds = [
    ...new Set((assigneeRows ?? []).map((a) => a.user_id as string)),
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
    Array<{ id: string; full_name: string | null; email: string | null }>
  >();
  for (const a of assigneeRows ?? []) {
    const profile = profileMap.get(a.user_id);
    const list = assigneesByTask.get(a.task_id) ?? [];
    list.push({
      id: a.user_id,
      full_name: profile?.full_name ?? null,
      email: profile?.email ?? null,
    });
    assigneesByTask.set(a.task_id, list);
  }

  return tasks.map((task) => ({
    ...task,
    assignees: assigneesByTask.get(task.id) ?? [],
    commentsCount: commentCountMap.get(task.id) ?? 0,
  })) as Card[];
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
  },
): Promise<Board> {
  const { data, error } = await supabase
    .from("clients")
    .insert({
      organization_id: organizationId,
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
    dueDate?: string;
  },
): Promise<Card> {
  const { data: card, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      client_id: boardId,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      assigned_to: input.assignedTo ?? null,
      due_date: input.dueDate ?? null,
      position: 0,
    })
    .select()
    .single();

  if (error) throw error;

  // If assigned to a user, create task_assignee row and notify
  if (input.assignedTo) {
    try {
      await supabase.from("task_assignees").insert({
        organization_id: organizationId,
        task_id: card.id,
        user_id: input.assignedTo,
      });

      await notifyTaskAssigned({
        organizationId,
        userId: input.assignedTo,
        taskId: card.id,
        taskTitle: input.title,
      });
    } catch (notifError) {
      console.error("CREATE CARD ASSIGNMENT NOTIFICATION ERROR:", notifError);
    }
  }

  return { ...card, assignees: [], commentsCount: 0 } as Card;
}

export async function updateCard(
  cardId: string,
  updates: Partial<Card>,
): Promise<Card> {
  const { data, error } = await supabase
    .from("tasks")
    .update(updates)
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
): Promise<void> {
  const { error } = await supabase
    .from("tasks")
    .update({ status: targetStatus, position })
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

export async function getLists(boardId: string): Promise<List[]> {
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
