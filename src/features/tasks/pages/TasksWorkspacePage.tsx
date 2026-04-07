import { useMemo, useState } from "react";
import { CheckSquare, ClipboardPlus, LayoutGrid } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import TaskBoard from "../components/TaskBoard";
import TaskForm, { type TaskFormValues } from "../components/TaskForm";
import TaskDetailsModal from "./TaskDetailsPage";
import { useTasks } from "../../../lib/hooks/useTasks";
import { startTimeEntry } from "../../../lib/supabase/mutations/timeEntries";
import { updateTask } from "../../../lib/supabase/mutations/tasks";
import type { TaskItem } from "../../../lib/supabase/queries/tasks";
import { searchTaskAssignableUsers } from "../../../lib/supabase/queries/taskAssignees";
type BoardMode = "organization" | "mine";

export default function TasksWorkspacePage({
  defaultBoardMode = "organization",
  pageTitle,
  pageDescription,
  allowModeSwitch = true,
}: {
  defaultBoardMode?: BoardMode;
  pageTitle: string;
  pageDescription: string;
  allowModeSwitch?: boolean;
}) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [boardMode, setBoardMode] = useState<BoardMode>(defaultBoardMode);

  if (!auth?.user || !auth?.profile) return null;

  const { user, profile } = auth;

  const {
    groupedTasks,
    taskRuntimeMap,
    taskInvitedCountMap,
    loading,
    error,
    createTask,
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
    removeWatcher,
    searchInvitableUsers,
    addChecklist,
    removeChecklist,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
  } = useTasks({
    assignedTo: boardMode === "mine" ? user.id : undefined,
    organizationId: profile.organization_id,
  });

  const canEditSelectedTaskDeadline = useMemo(() => {
    if (!selectedTask) return false;

    return (
      selectedTask.created_by === user.id ||
      profile.primary_role === "admin" ||
      profile.primary_role === "manager"
    );
  }, [selectedTask, user.id, profile.primary_role]);

  const canEditSelectedTaskStatus = useMemo(() => {
    if (!selectedTask) return false;

    return (
      selectedTask.created_by === user.id ||
      selectedTask.assigned_to === user.id ||
      profile.primary_role === "admin" ||
      profile.primary_role === "manager"
    );
  }, [selectedTask, user.id, profile.primary_role]);

   const handleCreateTask = async (values: TaskFormValues) => {
     try {
       setBusy(true);

       if (!profile.organization_id) {
         throw new Error("Your profile has no organization_id.");
       }

       const assignedTo =
         values.assigned_to.trim() === "" ? null : values.assigned_to;

       await createTask({
         organization_id: profile.organization_id,
         assigned_to: assignedTo,
         assigned_by: user.id,
         created_by: user.id,
         title: values.title,
         description: values.description || null,
         status: values.status,
         priority: values.priority,
         due_date: values.due_date
           ? new Date(values.due_date).toISOString()
           : null,
         department: values.department || profile.primary_role || null,
       });

       alert("Task card created successfully");
     } catch (err) {
       console.error("HANDLE CREATE TASK ERROR:", err);
       alert(err instanceof Error ? err.message : "Failed to create task");
     } finally {
       setBusy(false);
     }
   };

  const handleTrack = async (taskId: string, title: string) => {
    try {
      await startTimeEntry({
        organizationId: profile.organization_id,
        userId: user.id,
        taskId,
        description: `Working on ${title}`,
      });

      if (selectedTask?.id === taskId && selectedTask.status === "todo") {
        await updateTask(taskId, { status: "in_progress" });
      }

      await refetch();
      if (selectedTask?.id === taskId) {
        await openTask(taskId);
      }

      alert("Timer started and linked to the main time tracking system");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start timer");
    }
  };

  const handleSaveDeadline = async (taskId: string, dueDate: string | null) => {
    try {
      await updateTask(taskId, {
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      });

      await refetch();
      await openTask(taskId);
      alert("Deadline updated");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update deadline");
    }
  };

  const handleSaveStatus = async (
    taskId: string,
    status: TaskItem["status"],
  ) => {
    try {
      await updateTask(taskId, {
        status,
        completed_at: status === "done" ? new Date().toISOString() : null,
      });

      await refetch();
      await openTask(taskId);
      alert("Task status updated");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    }
  };

  const handleToggleDone = async (taskId: string, checked: boolean) => {
    try {
      await updateTask(taskId, {
        status: checked ? "done" : "todo",
        completed_at: checked ? new Date().toISOString() : null,
      });

      await refetch();
      await openTask(taskId);
      alert(checked ? "Card marked done" : "Card reopened");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update card");
    }
  };

  const handleAddComment = async (taskId: string, comment: string) => {
    try {
      await addComment({
        taskId,
        organizationId: profile.organization_id,
        userId: user.id,
        comment,
      });

      await openTask(taskId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add comment");
    }
  };

  const handleInviteUser = async (taskId: string, invitedUserId: string) => {
    try {
      await addWatcher(taskId, invitedUserId);
      await openTask(taskId);
      alert("User invited to card");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to invite user");
    }
  };

  const handleRemoveInvitedUser = async (
    taskId: string,
    invitedUserId: string,
  ) => {
    try {
      await removeWatcher(taskId, invitedUserId);
      await openTask(taskId);
      alert("User removed from card");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove user");
    }
  };

  const handleCreateChecklist = async (title: string) => {
    if (!selectedTask) return;

    try {
      await addChecklist({
        taskId: selectedTask.id,
        title,
        userId: user.id,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create checklist");
    }
  };

  const handleDeleteChecklist = async (checklistId: string) => {
    if (!selectedTask) return;

    try {
      await removeChecklist({
        taskId: selectedTask.id,
        checklistId,
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete checklist");
    }
  };

  const handleAddChecklistItem = async (
    checklistId: string,
    content: string,
  ) => {
    if (!selectedTask) return;

    try {
      await addChecklistItem({
        taskId: selectedTask.id,
        checklistId,
        content,
        userId: user.id,
      });
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to add checklist item",
      );
    }
  };

  const handleToggleChecklistItem = async (
    itemId: string,
    checked: boolean,
  ) => {
    if (!selectedTask) return;

    try {
      await toggleChecklistItem({
        taskId: selectedTask.id,
        itemId,
        checked,
        userId: user.id,
      });
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to update checklist item",
      );
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!selectedTask) return;

    try {
      await removeChecklistItem({
        taskId: selectedTask.id,
        itemId,
      });
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to delete checklist item",
      );
    }
  };
      const handleMoveTask = async (
        taskId: string,
        nextStatus: TaskItem["status"],
      ) => {
        try {
          const payload: {
            status: TaskItem["status"];
            completed_at?: string | null;
          } = {
            status: nextStatus,
          };

          if (nextStatus === "done") {
            payload.completed_at = new Date().toISOString();
          } else {
            payload.completed_at = null;
          }

          await updateTask(taskId, payload);
          await refetch();

          if (selectedTask?.id === taskId) {
            await openTask(taskId);
          }
        } catch (err) {
          alert(err instanceof Error ? err.message : "Failed to move card");
        }
      };

      const handleSearchAssignableUsers = async (search: string) => {
        return searchTaskAssignableUsers({
          organizationId: profile.organization_id,
          search,
        });
      };
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 overflow-hidden p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Tasks
              </p>
              <h1 className="mt-2 text-3xl font-bold">{pageTitle}</h1>
              <p className="mt-2 text-sm text-white/50">{pageDescription}</p>
            </div>

            {allowModeSwitch ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setBoardMode("organization")}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                    boardMode === "organization"
                      ? "bg-orange-500 text-black"
                      : "border border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  Organization Board
                </button>

                <button
                  type="button"
                  onClick={() => setBoardMode("mine")}
                  className={`rounded-xl px-4 py-3 text-sm font-medium transition ${
                    boardMode === "mine"
                      ? "bg-orange-500 text-black"
                      : "border border-white/10 bg-white/5 text-white/70"
                  }`}
                >
                  My Tasks
                </button>
              </div>
            ) : null}
          </div>

          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                  <ClipboardPlus size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Create Card</h2>
                  <p className="text-sm text-white/50">
                    Add a real task card to the board
                  </p>
                </div>
              </div>
              <TaskForm
                onSubmit={handleCreateTask}
                onSearchUsers={handleSearchAssignableUsers}
                currentUserId={user.id}
                busy={busy}
              />
            </section>

            <section className="min-w-0 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                  <CheckSquare size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Board</h2>
                  <p className="text-sm text-white/50">
                    {boardMode === "organization"
                      ? "Shared board for the organization"
                      : "Only tasks assigned to you"}
                  </p>
                </div>
              </div>

              <div className="mb-5 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <LayoutGrid size={14} />
                  <span>
                    Cards support invited users, time tracking, comments, and
                    checklists.
                  </span>
                </div>
              </div>

              {loading ? (
                <p className="text-white/60">Loading tasks...</p>
              ) : null}
              {error ? <p className="text-red-400">{error}</p> : null}

              {!loading ? (
                <TaskBoard
                  groupedTasks={groupedTasks}
                  onTrack={handleTrack}
                  onOpen={(taskId) => void openTask(taskId)}
                  onMoveTask={handleMoveTask}
                  taskRuntimeMap={taskRuntimeMap}
                  taskInvitedCountMap={taskInvitedCountMap}
                />
              ) : null}
            </section>
          </div>
        </main>
      </div>

      <TaskDetailsModal
        open={!!selectedTask}
        task={selectedTask}
        comments={selectedTaskComments}
        watchers={selectedTaskWatchers}
        checklists={selectedTaskChecklists}
        loading={detailsLoading}
        error={detailsError}
        busy={busy}
        currentUserId={user.id}
        canEditDeadline={canEditSelectedTaskDeadline}
        canEditStatus={canEditSelectedTaskStatus}
        onClose={closeTask}
        onSaveDeadline={handleSaveDeadline}
        onSaveStatus={handleSaveStatus}
        onToggleDone={handleToggleDone}
        onAddComment={handleAddComment}
        onTrack={handleTrack}
        onInviteUser={handleInviteUser}
        onRemoveInvitedUser={handleRemoveInvitedUser}
        onSearchUsers={searchInvitableUsers}
        onCreateChecklist={handleCreateChecklist}
        onDeleteChecklist={handleDeleteChecklist}
        onAddChecklistItem={handleAddChecklistItem}
        onToggleChecklistItem={handleToggleChecklistItem}
        onDeleteChecklistItem={handleDeleteChecklistItem}
      />
    </div>
  );
}
