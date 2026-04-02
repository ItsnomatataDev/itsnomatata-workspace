import { supabase } from "../client";

export interface TaskChecklist {
  id: string;
  task_id: string;
  organization_id: string;
  title: string;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskChecklistItem {
  id: string;
  checklist_id: string;
  task_id: string;
  organization_id: string;
  content: string;
  is_completed: boolean;
  completed_at: string | null;
  completed_by: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskChecklistWithItems extends TaskChecklist {
  items: TaskChecklistItem[];
}

export const getTaskChecklists = async (
  taskId: string,
): Promise<TaskChecklistWithItems[]> => {
  const { data: checklistData, error: checklistError } = await supabase
    .from("task_checklists")
    .select("*")
    .eq("task_id", taskId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (checklistError) throw checklistError;

  const checklists = (checklistData ?? []) as TaskChecklist[];

  if (checklists.length === 0) return [];

  const checklistIds = checklists.map((item) => item.id);

  const { data: itemData, error: itemError } = await supabase
    .from("task_checklist_items")
    .select("*")
    .in("checklist_id", checklistIds)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });

  if (itemError) throw itemError;

  const items = (itemData ?? []) as TaskChecklistItem[];

  return checklists.map((checklist) => ({
    ...checklist,
    items: items.filter((item) => item.checklist_id === checklist.id),
  }));
};
