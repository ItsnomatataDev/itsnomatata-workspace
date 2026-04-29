import { supabase } from "../client";
import type {
  TaskChecklist,
  TaskChecklistItem,
} from "../queries/taskChecklists";

export const createTaskChecklist = async ({
  taskId,
  organizationId,
  title,
  createdBy,
  position = 0,
}: {
  taskId: string;
  organizationId: string;
  title: string;
  createdBy: string;
  position?: number;
}): Promise<TaskChecklist> => {
  console.log("Creating checklist:", { taskId, organizationId, title, createdBy, position });
  
  const { data, error } = await supabase
    .from("task_checklists")
    .insert({
      task_id: taskId,
      organization_id: organizationId,
      title,
      created_by: createdBy,
      position,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating checklist:", error);
    throw new Error(error.message);
  }
  
  console.log("Checklist created successfully:", data);
  return data as TaskChecklist;
};

export const updateTaskChecklist = async ({
  checklistId,
  title,
}: {
  checklistId: string;
  title: string;
}): Promise<TaskChecklist> => {
  const { data, error } = await supabase
    .from("task_checklists")
    .update({ title })
    .eq("id", checklistId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as TaskChecklist;
};

export const deleteTaskChecklist = async (checklistId: string) => {
  const { error } = await supabase
    .from("task_checklists")
    .delete()
    .eq("id", checklistId);

  if (error) throw new Error(error.message);
};

export const createTaskChecklistItem = async ({
  checklistId,
  taskId,
  organizationId,
  content,
  createdBy,
  position = 0,
}: {
  checklistId: string;
  taskId: string;
  organizationId: string;
  content: string;
  createdBy: string;
  position?: number;
}): Promise<TaskChecklistItem> => {
  console.log("Creating checklist item:", { checklistId, taskId, organizationId, content, createdBy, position });
  
  const { data, error } = await supabase
    .from("task_checklist_items")
    .insert({
      checklist_id: checklistId,
      task_id: taskId,
      organization_id: organizationId,
      content,
      created_by: createdBy,
      position,
    })
    .select("*")
    .single();

  if (error) {
    console.error("Error creating checklist item:", error);
    throw new Error(error.message);
  }
  
  console.log("Checklist item created successfully:", data);
  return data as TaskChecklistItem;
};

export const toggleTaskChecklistItem = async ({
  itemId,
  checked,
  userId,
}: {
  itemId: string;
  checked: boolean;
  userId: string;
}): Promise<TaskChecklistItem> => {
  const { data, error } = await supabase
    .from("task_checklist_items")
    .update({
      is_completed: checked,
      completed_at: checked ? new Date().toISOString() : null,
      completed_by: checked ? userId : null,
    })
    .eq("id", itemId)
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as TaskChecklistItem;
};

export const deleteTaskChecklistItem = async (itemId: string) => {
  const { error } = await supabase
    .from("task_checklist_items")
    .delete()
    .eq("id", itemId);

  if (error) throw new Error(error.message);
};
