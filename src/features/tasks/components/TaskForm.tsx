import { useEffect, useState } from "react";
import { Search, UserPlus, X } from "lucide-react";
import type {
  TaskPriority,
  TaskStatus,
} from "../../../lib/supabase/queries/tasks";
import type { TaskAssignableUser } from "../../../lib/supabase/queries/taskAssignees";

export interface TaskFormValues {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  department: string;
  assigned_to: string;
}

export default function TaskForm({
  onSubmit,
  onSearchUsers,
  currentUserId,
  busy,
}: {
  onSubmit: (values: TaskFormValues) => Promise<void> | void;
  onSearchUsers: (search: string) => Promise<TaskAssignableUser[]>;
  currentUserId: string;
  busy?: boolean;
}) {
  const [values, setValues] = useState<TaskFormValues>({
    title: "",
    description: "",
    status: "todo",
    priority: "medium",
    due_date: "",
    department: "",
    assigned_to: currentUserId,
  });

  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [assigneeResults, setAssigneeResults] = useState<TaskAssignableUser[]>(
    [],
  );
  const [searching, setSearching] = useState(false);
  const [selectedAssignee, setSelectedAssignee] =
    useState<TaskAssignableUser | null>(null);

  const update = (field: keyof TaskFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        setSearching(true);
        const results = await onSearchUsers(assigneeSearch);
        if (active) {
          setAssigneeResults(results);
        }
      } catch {
        if (active) {
          setAssigneeResults([]);
        }
      } finally {
        if (active) {
          setSearching(false);
        }
      }
    };

    const timeout = window.setTimeout(() => {
      void run();
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [assigneeSearch, onSearchUsers]);

  const resetForm = () => {
    setValues({
      title: "",
      description: "",
      status: "todo",
      priority: "medium",
      due_date: "",
      department: "",
      assigned_to: currentUserId,
    });
    setAssigneeSearch("");
    setAssigneeResults([]);
    setSelectedAssignee(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit(values);
    resetForm();
  };

  const assignToMe = () => {
    setValues((prev) => ({ ...prev, assigned_to: currentUserId }));
    setSelectedAssignee(null);
    setAssigneeSearch("");
    setAssigneeResults([]);
  };

  const clearAssignment = () => {
    setValues((prev) => ({ ...prev, assigned_to: "" }));
    setSelectedAssignee(null);
    setAssigneeSearch("");
    setAssigneeResults([]);
  };

  const selectAssignee = (user: TaskAssignableUser) => {
    setValues((prev) => ({ ...prev, assigned_to: user.id }));
    setSelectedAssignee(user);
    setAssigneeSearch("");
    setAssigneeResults([]);
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
          placeholder="Task brief, post caption notes, design instructions..."
        />
      </div>

      <div>
        <label className="mb-2 block text-sm text-white/70">Assign To</label>

        <div className="mb-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={assignToMe}
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white/70 hover:border-orange-500"
          >
            Assign to me
          </button>

          <button
            type="button"
            onClick={clearAssignment}
            className="rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white/70 hover:border-orange-500"
          >
            Unassigned
          </button>
        </div>

        {values.assigned_to && selectedAssignee ? (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {selectedAssignee.full_name || "Unnamed user"}
              </p>
              <p className="truncate text-xs text-white/50">
                {selectedAssignee.email || "No email"}
              </p>
            </div>

            <button
              type="button"
              onClick={clearAssignment}
              className="rounded-lg border border-white/10 p-2 text-white/60 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        ) : values.assigned_to === currentUserId ? (
          <div className="mb-3 rounded-xl border border-orange-500/20 bg-orange-500/10 px-4 py-3 text-sm text-white">
            Assigned to you
          </div>
        ) : values.assigned_to === "" ? (
          <div className="mb-3 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white/55">
            This card will be created without an assignee
          </div>
        ) : null}

        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
          />
          <input
            value={assigneeSearch}
            onChange={(e) => setAssigneeSearch(e.target.value)}
            placeholder="Search team member by name or email"
            className="w-full rounded-xl border border-white/10 bg-black py-3 pl-11 pr-4 text-white outline-none focus:border-orange-500"
          />
        </div>

        <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-white/10 bg-black/40">
          {searching ? (
            <div className="px-4 py-4 text-sm text-white/50">
              Searching users...
            </div>
          ) : assigneeResults.length === 0 ? (
            <div className="px-4 py-4 text-sm text-white/50">
              No users found yet.
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {assigneeResults.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  onClick={() => selectAssignee(user)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-white/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-white">
                      {user.full_name || "Unnamed user"}
                    </p>
                    <p className="truncate text-xs text-white/45">
                      {user.email || "No email"}
                    </p>
                    <p className="mt-1 text-xs text-orange-400">
                      {user.primary_role || "no role"}
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black">
                    <UserPlus size={12} />
                    Assign
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
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
            <option value="blocked">Blocked</option>
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
        className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black disabled:opacity-60"
      >
        {busy ? "Saving..." : "Create Card"}
      </button>
    </form>
  );
}
