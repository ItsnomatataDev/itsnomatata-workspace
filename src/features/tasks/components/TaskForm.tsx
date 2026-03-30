import { useState } from "react";
import type { TaskPriority, TaskStatus } from "../../../lib/supabase/queries/tasks";

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  department: string;
}

export default function TaskForm({
  onSubmit,
  busy,
}: {
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
  busy?: boolean;
}) {
  const [values, setValues] = useState<TaskFormValues>({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    due_date: "",
    department: "",
  });

  const update = (field: keyof TaskFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values);
    setValues({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      due_date: "",
      department: "",
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-5"
    >
      <div>
        <label className="mb-2 block text-sm text-white/70">Title</label>
        <input
          value={values.title}
          onChange={(e) => update("title", e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          placeholder="Create reel content plan"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-white/70">Description</label>
        <textarea
          value={values.description}
          onChange={(e) => update("description", e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          rows={4}
          placeholder="Task details..."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-white/70">Status</label>
          <select
            value={values.status}
            onChange={(e) => update("status", e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          >
            <option value="backlog">Backlog</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-white/70">Priority</label>
          <select
            value={values.priority}
            onChange={(e) => update("priority", e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm text-white/70">Due Date</label>
          <input
            type="datetime-local"
            value={values.due_date}
            onChange={(e) => update("due_date", e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-white/70">Department</label>
          <input
            value={values.department}
            onChange={(e) => update("department", e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
            placeholder="social_media"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black"
      >
        {busy ? "Saving..." : "Create Task"}
      </button>
    </form>
  );
}
