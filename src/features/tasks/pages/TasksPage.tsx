import { useState } from "react";
import { CheckSquare, ClipboardPlus } from "lucide-react";
import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import TaskBoard from "../components/TaskBoard";
import TaskForm, {
  type TaskFormValues,
} from "../components/TaskForm";
import { useTasks } from "../../../lib/hooks/useTasks";
import { startTimeEntry } from "../../../lib/supabase/mutations/timeEntries";
import { updateTask } from "../../../lib/supabase/mutations/tasks";
import type { TaskItem } from "../../../lib/supabase/queries/tasks";

export default function TasksPage() {
  const auth = useAuth();
  const [busy, setBusy] = useState(false);

  if (!auth?.user || !auth?.profile) return null;

  const { user, profile } = auth;

  const { groupedTasks, loading, error, createTask, refetch } = useTasks({
    assignedTo: user.id,
    organizationId: profile.organization_id,
  });
const handleCreateTask = async (values: TaskFormValues) => {
  try {
    setBusy(true);

    if (!profile?.organization_id) {
      throw new Error("Your profile has no organization_id.");
    }

    console.log("AUTH USER:", user);
    console.log("PROFILE:", profile);
    console.log("TASK FORM VALUES:", values);

    await createTask({
      organization_id: profile.organization_id,
      assigned_to: user.id,
      assigned_by: user.id,
      title: values.title,
      description: values.description || null,
      status: values.status,
      priority: values.priority,
      due_date: values.due_date
        ? new Date(values.due_date).toISOString()
        : null,
      department: values.department || profile.primary_role || null,
    });

    alert("Task created successfully");
  } catch (err) {
    console.error("HANDLE CREATE TASK ERROR:", err);
    alert(err instanceof Error ? err.message : "Failed to create task");
  } finally {
    setBusy(false);
  }
};

  const handleMoveTask = async (taskId: string, status: TaskItem["status"]) => {
    try {
      await updateTask(taskId, {
        status,
        completed_at: status === "done" ? new Date().toISOString() : null,
      });
      await refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update task");
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
      alert("Timer started");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to start timer");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Tasks
              </p>
              <h1 className="mt-2 text-3xl font-bold">Task Management</h1>
              <p className="mt-2 text-sm text-white/50">
                Manage real assigned work connected to Supabase.
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                  <ClipboardPlus size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Create Task</h2>
                  <p className="text-sm text-white/50">
                    Add a real task to your board
                  </p>
                </div>
              </div>

              <TaskForm onSubmit={handleCreateTask} busy={busy} />
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                  <CheckSquare size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">My Board</h2>
                  <p className="text-sm text-white/50">
                    Role: {profile.primary_role}
                  </p>
                </div>
              </div>

              {loading ? (
                <p className="text-white/60">Loading tasks...</p>
              ) : null}
              {error ? <p className="text-red-400">{error}</p> : null}

              {!loading ? (
                <TaskBoard
                  groupedTasks={groupedTasks}
                  onMove={handleMoveTask}
                  onTrack={handleTrack}
                />
              ) : null}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
