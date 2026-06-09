import { getBoards } from "../../boards/services/boardService";
import { getTasks } from "../../../lib/supabase/queries/tasks";
import type { AiRouterContext } from "../types/aiToolTypes";

export async function summarizeMyTasksFallback(context: AiRouterContext) {
  const tasks = await getTasks({
    organizationId: context.organizationId,
    assignedTo: context.userId,
    archiveMode: "active",
  });

  const open = tasks.filter(
    (task) => !["done", "cancelled", "approved"].includes(String(task.status ?? "")),
  );
  const overdue = open.filter((task) => {
    if (!task.due_date) return false;
    return new Date(task.due_date).getTime() < Date.now();
  });

  return {
    total: tasks.length,
    openCount: open.length,
    overdueCount: overdue.length,
    tasks: open.slice(0, 15).map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      due_date: task.due_date,
      client_id: task.client_id,
    })),
  };
}

export async function listBoardsFallback(context: AiRouterContext) {
  const boards = await getBoards(context.organizationId);
  return {
    boards: boards.slice(0, 25).map((board) => ({
      id: board.id,
      name: board.name,
      board_type: board.board_type,
    })),
    count: boards.length,
  };
}
