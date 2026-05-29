import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Save, Search, X } from "lucide-react";
import type {
  TaskPriority,
  TaskStatus,
} from "../../../lib/supabase/queries/tasks";
import type { Board, List } from "../../../types/board";
import { getLists } from "../services/boardService";

type AssignableUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
};

type CreateCardPayload = {
  boardId: string;
  columnId?: string | null;
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: string;
  assigneeIds: string[];
  dueDate?: string;
  estimatedHours?: number | null;
};

interface CreateCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (cardData: CreateCardPayload) => Promise<void>;
  boards: Board[];
  users: AssignableUser[];
  currentBoardId: string;
  currentColumns: Array<{
    id: string;
    columnId: string | null;
    status: TaskStatus;
    label: string;
  }>;
}

const FALLBACK_STATUSES: Array<{ status: TaskStatus; label: string }> = [
  { status: "backlog", label: "Backlog" },
  { status: "todo", label: "To Do" },
  { status: "in_progress", label: "In Progress" },
  { status: "review", label: "Review" },
  { status: "done", label: "Done" },
];

function statusFromColumnName(name: string | null | undefined): TaskStatus {
  const normalized = name?.trim().toLowerCase() ?? "";
  if (normalized.includes("done") || normalized.includes("complete")) return "done";
  if (normalized.includes("review") || normalized.includes("approval")) return "review";
  if (normalized.includes("progress") || normalized.includes("doing")) return "in_progress";
  if (normalized.includes("backlog") || normalized.includes("pending")) return "backlog";
  return "todo";
}

function listToOption(list: List) {
  const status = list.id.startsWith("list-")
    ? (list.id.replace("list-", "") as TaskStatus)
    : statusFromColumnName(list.name);

  return {
    id: list.id,
    columnId: list.id.startsWith("list-") ? null : list.id,
    status,
    label: list.name,
  };
}

export default function CreateCardModal({
  isOpen,
  onClose,
  onCreate,
  boards,
  users,
  currentBoardId,
  currentColumns,
}: CreateCardModalProps) {
  const [selectedBoardId, setSelectedBoardId] = useState(currentBoardId);
  const [columns, setColumns] = useState(currentColumns);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedBoardId(currentBoardId);
    setColumns(currentColumns);
    setStatus(currentColumns[0]?.status ?? "todo");
  }, [currentBoardId, currentColumns, isOpen]);

  useEffect(() => {
    if (!isOpen || !selectedBoardId) return;
    if (selectedBoardId === currentBoardId) {
      setColumns(currentColumns);
      return;
    }

    let cancelled = false;
    setColumnsLoading(true);
    getLists(selectedBoardId)
      .then((lists) => {
        if (cancelled) return;
        const nextColumns = lists.map(listToOption);
        setColumns(nextColumns);
        setStatus(nextColumns[0]?.status ?? "todo");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load board columns.");
      })
      .finally(() => {
        if (!cancelled) setColumnsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentBoardId, currentColumns, isOpen, selectedBoardId]);

  const selectedColumn = useMemo(
    () => columns.find((column) => column.status === status) ?? columns[0] ?? null,
    [columns, status],
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.full_name, user.email, user.primary_role]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [userSearch, users]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setStatus("todo");
    setPriority("medium");
    setDueDate("");
    setEstimatedHours("");
    setAssigneeIds([]);
    setUserSearch("");
    setError("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !selectedBoardId) return;

    const parsedEstimate = estimatedHours.trim()
      ? Number(estimatedHours)
      : null;

    if (parsedEstimate !== null && (Number.isNaN(parsedEstimate) || parsedEstimate < 0)) {
      setError("Estimated hours must be a positive number.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    try {
      await onCreate({
        boardId: selectedBoardId,
        columnId: selectedColumn?.columnId ?? null,
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        assigneeIds,
        dueDate: dueDate || undefined,
        estimatedHours: parsedEstimate,
      });
      reset();
      onClose();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : err && typeof err === "object" && "message" in err
            ? String((err as { message?: unknown }).message || "")
            : "";
      setError(message || "Failed to create card.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92dvh] w-full max-w-3xl overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-white">
              Create Card / Assign Task
            </h2>
            <p className="mt-1 text-sm text-white/45">
              Add a board card and assign it to one or more workspace members.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-xl p-2 text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            aria-label="Close create card modal"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[calc(92dvh-5.5rem)] overflow-y-auto p-6">
          {error ? (
            <div className="mb-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-white/80">Board / client</span>
              <select
                value={selectedBoardId}
                onChange={(event) => setSelectedBoardId(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-orange-500/50"
                disabled={isSubmitting}
              >
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-white/80">Column / status</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as TaskStatus)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-orange-500/50"
                disabled={isSubmitting || columnsLoading}
              >
                {(columns.length ? columns : FALLBACK_STATUSES).map((column) => (
                  <option key={`${column.status}:${"id" in column ? column.id : column.label}`} value={column.status}>
                    {columnsLoading ? "Loading columns..." : column.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_12rem]">
            <label className="space-y-2">
              <span className="text-sm font-medium text-white/80">Title</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Card title"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500/50"
                required
                disabled={isSubmitting}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-white/80">Priority</span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as TaskPriority)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-orange-500/50"
                disabled={isSubmitting}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block space-y-2">
            <span className="text-sm font-medium text-white/80">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="What needs to be done?"
              rows={4}
              className="w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500/50"
              disabled={isSubmitting}
            />
          </label>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-white/80">Due date</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none focus:border-orange-500/50"
                disabled={isSubmitting}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-white/80">Estimated hours</span>
              <input
                type="number"
                min="0"
                step="0.25"
                value={estimatedHours}
                onChange={(event) => setEstimatedHours(event.target.value)}
                placeholder="Optional"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500/50"
                disabled={isSubmitting}
              />
            </label>
          </div>

          <div className="mt-5 rounded-3xl border border-white/10 bg-white/3 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-white">Assignees</p>
              <p className="text-xs text-white/40">{assigneeIds.length} selected</p>
            </div>

            <div className="relative mb-3">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search users"
                className="w-full rounded-2xl border border-white/10 bg-black/30 py-2.5 pl-9 pr-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-500/50"
              />
            </div>

            <div className="grid max-h-48 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {filteredUsers.map((user) => {
                const checked = assigneeIds.includes(user.id);
                return (
                  <label
                    key={user.id}
                    className={[
                      "flex cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2.5 transition",
                      checked
                        ? "border-orange-500/45 bg-orange-500/15"
                        : "border-white/10 bg-black/20 hover:border-white/20",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(event) => {
                        setAssigneeIds((current) =>
                          event.target.checked
                            ? [...current, user.id]
                            : current.filter((id) => id !== user.id),
                        );
                      }}
                      className="h-4 w-4 rounded border-white/20 bg-black text-orange-500"
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-white">
                        {user.full_name || user.email || "Unnamed user"}
                      </span>
                      <span className="block truncate text-xs text-white/40">
                        {user.email || user.primary_role || "Workspace member"}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="flex-1 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim() || isSubmitting || columnsLoading}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Create card
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
