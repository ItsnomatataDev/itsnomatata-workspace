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
import { supabase } from "../../../lib/supabase/client";
import type { TaskItem } from "../../../lib/supabase/queries/tasks";
import { searchTaskAssignableUsers } from "../../../lib/supabase/queries/taskAssignees";
import type { TaskChecklistWithItems } from "../../../lib/supabase/queries/taskChecklists";
import {
  approveTaskSubmission,
  createTaskSubmission,
  rejectTaskSubmission,
} from "../../../lib/supabase/mutations/taskSubmissions";
import {
  getTaskSubmissions,
  type TaskSubmissionItem,
  type TaskSubmissionType,
} from "../../../lib/supabase/queries/taskSubmissions";
import { createCardInviteNotification } from "../../../lib/supabase/mutations/tasks";
import { useTimeEntries } from "../../../lib/hooks/useTimeEntries";
import {
  getTaskClientInvites,
  inviteClientToTask,
  removeTaskClientInvite,
  searchClients,
  type TaskClientInviteItem,
} from "../services/taskClientInviteService";

type BoardMode = "organization" | "mine";

export default function TasksWorkspacePage({
  defaultBoardMode = "organization",
  pageTitle,
  pageDescription,
  allowModeSwitch = true,
  projectId,
}: {
  defaultBoardMode?: BoardMode;
  pageTitle: string;
  pageDescription: string;
  allowModeSwitch?: boolean;
  projectId?: string | null;
}) {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);
  const [boardMode, setBoardMode] = useState<BoardMode>(defaultBoardMode);
  const [selectedTaskSubmissions, setSelectedTaskSubmissions] = useState<
    TaskSubmissionItem[]
  >([]);
  const [selectedTaskClientInvites, setSelectedTaskClientInvites] = useState<
    TaskClientInviteItem[]
  >([]);

  if (!auth?.user || !auth?.profile) return null;

  const { user, profile } = auth;
  const organizationId = profile.organization_id ?? null;

  if (!organizationId) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen">
          <Sidebar role={profile.primary_role ?? "manager"} />
          <main className="min-w-0 flex-1 overflow-hidden p-6 lg:p-8">
            <div className="border border-red-500/20 bg-red-500/10 p-5 text-red-300">
              Your account is not linked to an organization yet.
            </div>
          </main>
        </div>
      </div>
    );
  }

  const {
    tasks,
    boardColumns,
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
    moveTaskToColumn,
  } = useTasks({
    assignedTo: boardMode === "mine" && !projectId ? user.id : undefined,
    organizationId,
    projectId,
  });

  const {
    entries: taskTimeEntries,
    activeEntry: taskActiveEntry,
    loading: taskTimeLoading,
    mutating: taskTimeMutating,
    startEntry: startTaskEntry,
    stopActiveEntry: stopTaskActiveEntry,
    resumeEntry: resumeTaskEntry,
    deleteEntry: deleteTaskEntry,
    createManualEntry: createTaskManualEntry,
    refresh: refreshTaskEntries,
  } = useTimeEntries({
    organizationId,
    userId: user.id,
  });

  const filteredTaskTimeEntries = useMemo(() => {
    if (!selectedTask?.id) return [];
    return taskTimeEntries.filter((entry) => entry.task_id === selectedTask.id);
  }, [taskTimeEntries, selectedTask]);

  const filteredTaskActiveEntry = useMemo(() => {
    if (!selectedTask?.id) return null;
    if (!taskActiveEntry) return null;
    return taskActiveEntry.task_id === selectedTask.id ? taskActiveEntry : null;
  }, [taskActiveEntry, selectedTask]);

  const selectedTaskTrackedSeconds = useMemo(() => {
    if (!selectedTask) return 0;
    const liveTask = tasks.find((item) => item.id === selectedTask.id);
    return Number(
      liveTask?.tracked_seconds_cache ??
        selectedTask.tracked_seconds_cache ??
        0,
    );
  }, [selectedTask, tasks]);

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

  const handleLoadTaskSubmissions = async (taskId: string) => {
    const submissions = await getTaskSubmissions(taskId);
    setSelectedTaskSubmissions(submissions);
  };

  const handleLoadTaskClientInvites = async (taskId: string) => {
    const invites = await getTaskClientInvites(taskId);
    setSelectedTaskClientInvites(invites);
  };

  const handleOpenTaskWithExtras = async (taskId: string) => {
    await openTask(taskId);
    await handleLoadTaskSubmissions(taskId);
    await handleLoadTaskClientInvites(taskId);
    await refreshTaskEntries();
  };

  const handleCreateTask = async (values: TaskFormValues) => {
    try {
      setBusy(true);

      const assignedTo =
        values.assigned_to.trim() === "" ? null : values.assigned_to;

      const firstColumnId =
        projectId && boardColumns.length > 0 ? boardColumns[0].id : null;

      await createTask({
        organization_id: organizationId,
        project_id: projectId ?? null,
        column_id: firstColumnId,
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
        position: firstColumnId ? boardColumns[0].tasks.length : 0,
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
        organizationId,
        userId: user.id,
        taskId,
        projectId: projectId ?? undefined,
        description: `Working on ${title}`,
      });

      if (selectedTask?.id === taskId && selectedTask.status === "todo") {
        await updateTask(taskId, { status: "in_progress" });
      }

      await refetch();
      await refreshTaskEntries();

      if (selectedTask?.id === taskId) {
        await handleOpenTaskWithExtras(taskId);
      }

      alert("Timer started and linked to the main time tracking system");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start timer");
    }
  };

  const handleSaveManualTime = async (
    taskId: string,
    hours: number,
    minutes: number,
  ) => {
    const totalSeconds = Math.max(
      0,
      Math.floor(hours) * 3600 + Math.floor(minutes) * 60,
    );

    if (totalSeconds <= 0) {
      alert("Please enter at least 1 minute.");
      return;
    }

    try {
      setBusy(true);

      const task = tasks.find((item) => item.id === taskId) ?? selectedTask;
      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - totalSeconds * 1000);

      const { error: insertError } = await supabase
        .from("time_entries")
        .insert({
          organization_id: organizationId,
          user_id: user.id,
          task_id: taskId,
          project_id: task?.project_id ?? projectId ?? null,
          client_id: task?.client_id ?? null,
          campaign_id: task?.campaign_id ?? null,
          description: `Manual time added for ${task?.title ?? "task"}`,
          started_at: startedAt.toISOString(),
          ended_at: endedAt.toISOString(),
          is_running: false,
          duration_seconds: totalSeconds,
          source: "manual",
          is_billable: Boolean(task?.is_billable ?? false),
        });

      if (insertError) throw insertError;

      await refetch();
      await refreshTaskEntries();
      await handleOpenTaskWithExtras(taskId);
      alert("Manual time added successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save manual time");
    } finally {
      setBusy(false);
    }
  };

  const handleStartTaskTimer = async () => {
    if (!selectedTask) return;

    try {
      await startTaskEntry({
        taskId: selectedTask.id,
        projectId: selectedTask.project_id ?? projectId ?? undefined,
        clientId: selectedTask.client_id ?? undefined,
        campaignId: selectedTask.campaign_id ?? undefined,
        description: selectedTask.title,
        isBillable: Boolean(
          (selectedTask as TaskItem & { is_billable?: boolean }).is_billable,
        ),
        source: "timer",
        metadata: {
          started_from: "task_details_modal",
          task_title: selectedTask.title,
        },
      });

      if (selectedTask.status === "todo") {
        await updateTask(selectedTask.id, { status: "in_progress" });
      }

      await refetch();
      await refreshTaskEntries();
      await handleOpenTaskWithExtras(selectedTask.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start task timer");
    }
  };

  const handleStopTaskTimer = async () => {
    try {
      await stopTaskActiveEntry();
      await refetch();
      await refreshTaskEntries();

      if (selectedTask?.id) {
        await handleOpenTaskWithExtras(selectedTask.id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to stop task timer");
    }
  };

  const handleResumeTaskEntry = async (entryId: string) => {
    try {
      await resumeTaskEntry(entryId);
      await refetch();
      await refreshTaskEntries();

      if (selectedTask?.id) {
        await handleOpenTaskWithExtras(selectedTask.id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resume task entry");
    }
  };

  const handleDeleteTaskEntry = async (entryId: string) => {
    try {
      await deleteTaskEntry(entryId);
      await refetch();
      await refreshTaskEntries();

      if (selectedTask?.id) {
        await handleOpenTaskWithExtras(selectedTask.id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete task entry");
    }
  };

  const handleManualTaskTime = async (
    taskId: string,
    hours: number,
    minutes: number,
  ) => {
    if (!selectedTask) return;

    const totalSeconds = Math.max(
      0,
      Math.floor(hours) * 3600 + Math.floor(minutes) * 60,
    );

    if (totalSeconds <= 0) {
      alert("Please enter at least 1 minute.");
      return;
    }

    try {
      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - totalSeconds * 1000);

      await createTaskManualEntry({
        taskId,
        projectId: selectedTask.project_id ?? projectId ?? undefined,
        clientId: selectedTask.client_id ?? undefined,
        campaignId: selectedTask.campaign_id ?? undefined,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        description: selectedTask.title,
        isBillable: Boolean(
          (selectedTask as TaskItem & { is_billable?: boolean }).is_billable,
        ),
        source: "manual",
        metadata: {
          created_from: "task_details_modal_manual",
        },
      });

      await refetch();
      await refreshTaskEntries();
      await handleOpenTaskWithExtras(taskId);
      alert("Manual task time added successfully");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save task time");
    }
  };

  const handleCreateSubmission = async (params: {
    taskId: string;
    submissionType: TaskSubmissionType;
    title: string;
    notes?: string | null;
    linkUrl?: string | null;
    file?: File | null;
  }) => {
    try {
      setBusy(true);

      await createTaskSubmission({
        organizationId,
        taskId: params.taskId,
        submittedBy: user.id,
        submissionType: params.submissionType,
        title: params.title,
        notes: params.notes ?? null,
        linkUrl: params.linkUrl ?? null,
        file: params.file ?? null,
      });

      await updateTask(params.taskId, {
        status: "review",
      });

      await refetch();
      await handleOpenTaskWithExtras(params.taskId);

      alert("Submission uploaded and sent for review");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to submit work");
    } finally {
      setBusy(false);
    }
  };

  const handleApproveSubmission = async (
    submissionId: string,
    taskId: string,
    reviewNote?: string,
  ) => {
    try {
      setBusy(true);

      await approveTaskSubmission({
        submissionId,
        reviewedBy: user.id,
        reviewNote: reviewNote ?? null,
      });

    await updateTask(taskId, {
      status: "done",
      completed_at: new Date().toISOString(),
    });

      await refetch();
      await handleOpenTaskWithExtras(taskId);

      alert("Submission approved");
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to approve submission",
      );
    } finally {
      setBusy(false);
    }
  };

  const handleRejectSubmission = async (
    submissionId: string,
    taskId: string,
    reviewNote?: string,
  ) => {
    try {
      setBusy(true);

      await rejectTaskSubmission({
        submissionId,
        reviewedBy: user.id,
        reviewNote: reviewNote ?? null,
      });

      await updateTask(taskId, {
        status: "blocked",
      });

      await refetch();
      await handleOpenTaskWithExtras(taskId);

      alert("Submission sent back for revision");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to reject submission");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveDeadline = async (taskId: string, dueDate: string | null) => {
    try {
      await updateTask(taskId, {
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
      });

      await refetch();
      await handleOpenTaskWithExtras(taskId);
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
      await handleOpenTaskWithExtras(taskId);
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
      await handleOpenTaskWithExtras(taskId);
      alert(checked ? "Card marked done" : "Card reopened");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update card");
    }
  };

  const handleAddComment = async (taskId: string, comment: string) => {
    try {
      await addComment({
        taskId,
        organizationId,
        userId: user.id,
        comment,
      });

      await handleOpenTaskWithExtras(taskId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add comment");
    }
  };

  const handleInviteUser = async (taskId: string, invitedUserId: string) => {
    try {
      const currentTask =
        tasks.find((item) => item.id === taskId) ?? selectedTask;

      await addWatcher(taskId, invitedUserId);

      if (currentTask) {
        try {
          await createCardInviteNotification({
            organizationId,
            userId: invitedUserId,
            taskId,
            invitedBy: user.id,
            taskTitle: currentTask.title,
          });
        } catch (notificationError) {
          console.error("INVITE NOTIFICATION ERROR:", notificationError);
        }
      }

      await handleOpenTaskWithExtras(taskId);
      alert("User invited to card");
    } catch (err) {
      console.error("INVITE USER ERROR:", err);
      alert(err instanceof Error ? err.message : "Failed to invite user");
    }
  };

  const handleRemoveInvitedUser = async (
    taskId: string,
    invitedUserId: string,
  ) => {
    try {
      await removeWatcher(taskId, invitedUserId);
      await handleOpenTaskWithExtras(taskId);
      alert("User removed from card");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove user");
    }
  };

  const handleSearchClients = async (search: string) => {
    return searchClients({
      organizationId,
      search,
    });
  };

  const handleInviteClient = async (params: {
    taskId: string;
    clientId: string;
    clientName: string;
  }) => {
    try {
      await inviteClientToTask({
        taskId: params.taskId,
        organizationId,
        clientId: params.clientId,
        invitedName: params.clientName,
        invitedBy: user.id,
        canView: true,
        canComment: true,
        canReviewSubmissions: true,
        canApprove: false,
      });

      await handleLoadTaskClientInvites(params.taskId);
      alert("Client invited to card");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to invite client");
    }
  };

  const handleRemoveClientInvite = async (inviteId: string) => {
    try {
      await removeTaskClientInvite(inviteId);

      if (selectedTask?.id) {
        await handleLoadTaskClientInvites(selectedTask.id);
      }

      alert("Client access removed from card");
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to remove client invite",
      );
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
        await handleOpenTaskWithExtras(taskId);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to move card");
    }
  };

  const handleSearchAssignableUsers = async (search: string) => {
    return searchTaskAssignableUsers({
      organizationId,
      search,
    });
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role ?? "manager"} />

        <main className="min-w-0 flex-1 overflow-hidden p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Tasks
              </p>
              <h1 className="mt-2 text-3xl font-bold">{pageTitle}</h1>
              <p className="mt-2 text-sm text-white/50">{pageDescription}</p>
            </div>

            {allowModeSwitch && !projectId ? (
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
            <section className="border border-white/10 bg-[#050505] p-5">
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

            <section className="min-w-0 border border-white/10 bg-[#050505] p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                  <CheckSquare size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Board</h2>
                  <p className="text-sm text-white/50">
                    {projectId
                      ? "Real project board columns"
                      : boardMode === "organization"
                        ? "Shared board for the organization"
                        : "Only tasks assigned to you"}
                  </p>
                </div>
              </div>

              <div className="mb-5 border border-white/10 bg-black/40 px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-white/60">
                  <LayoutGrid size={14} />
                  <span>
                    Cards support invited users, invited clients, time tracking,
                    comments, checklists, and manual time editing.
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
                  boardColumns={boardColumns}
                  onTrack={handleTrack}
                  onOpen={(taskId) => {
                    void handleOpenTaskWithExtras(taskId);
                  }}
                  onMoveTask={handleMoveTask}
                  onMoveTaskToColumn={(params) => void moveTaskToColumn(params)}
                  taskRuntimeMap={taskRuntimeMap}
                  taskInvitedCountMap={taskInvitedCountMap}
                />
              ) : null}
            </section>
          </div>
        </main>
      </div>

      <TaskDetailsModal
        open={Boolean(selectedTask)}
        task={selectedTask}
        comments={selectedTaskComments}
        watchers={selectedTaskWatchers}
        checklists={selectedTaskChecklists as TaskChecklistWithItems[]}
        loading={detailsLoading}
        error={detailsError}
        busy={busy}
        currentUserId={user.id}
        trackedSeconds={selectedTaskTrackedSeconds}
        hasRunningTimer={Boolean(filteredTaskActiveEntry)}
        canEditDeadline={canEditSelectedTaskDeadline}
        canEditStatus={canEditSelectedTaskStatus}
        organizationId={organizationId}
        currentUserRole={profile.primary_role ?? "manager"}
        submissions={selectedTaskSubmissions}
        clientInvites={selectedTaskClientInvites}
        taskTimeEntries={filteredTaskTimeEntries}
        taskActiveEntry={filteredTaskActiveEntry}
        taskTimeLoading={taskTimeLoading}
        taskTimeMutating={taskTimeMutating}
        onClose={closeTask}
        onSaveDeadline={handleSaveDeadline}
        onSaveStatus={handleSaveStatus}
        onToggleDone={handleToggleDone}
        onAddComment={handleAddComment}
        onTrack={handleTrack}
        onSaveManualTime={handleManualTaskTime}
        onInviteUser={handleInviteUser}
        onRemoveInvitedUser={handleRemoveInvitedUser}
        onSearchUsers={searchInvitableUsers}
        onSearchClients={handleSearchClients}
        onInviteClient={handleInviteClient}
        onRemoveClientInvite={handleRemoveClientInvite}
        onCreateChecklist={handleCreateChecklist}
        onDeleteChecklist={handleDeleteChecklist}
        onAddChecklistItem={handleAddChecklistItem}
        onToggleChecklistItem={handleToggleChecklistItem}
        onDeleteChecklistItem={handleDeleteChecklistItem}
        onCreateSubmission={handleCreateSubmission}
        onApproveSubmission={handleApproveSubmission}
        onRejectSubmission={handleRejectSubmission}
        onStartTaskTimer={handleStartTaskTimer}
        onStopTaskTimer={handleStopTaskTimer}
        onResumeTaskEntry={handleResumeTaskEntry}
        onDeleteTaskEntry={handleDeleteTaskEntry}
      />
    </div>
  );
}
