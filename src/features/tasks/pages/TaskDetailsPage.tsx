import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Clock3,
  Flag,
  Globe,
  Image,
  Link as LinkIcon,
  MessageSquare,
  Radio,
  Search,
  Upload,
  Users,
  X,
  FileText,
} from "lucide-react";
import type {
  TaskCommentItem,
  TaskInvitableUser,
  TaskItem,
  TaskStatus,
  TaskWatcherItem,
} from "../../../lib/supabase/queries/tasks";
import type { TaskChecklistWithItems } from "../../../lib/supabase/queries/taskChecklists";
import type {
  TaskSubmissionItem,
  TaskSubmissionType,
} from "../../../lib/supabase/queries/taskSubmissions";
import TaskChecklistSection from "../components/TaskChecklistSection";

function formatDateTime(value?: string | null) {
  if (!value) return "Not set";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDurationHms(seconds?: number | null) {
  const total = Math.max(0, Math.floor(Number(seconds ?? 0)));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const hh = String(hrs).padStart(2, "0");
  const mm = String(mins).padStart(2, "0");
  const ss = String(secs).padStart(2, "0");

  return `${hh}:${mm}:${ss}`;
}

const STATUS_OPTIONS: TaskStatus[] = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "approved",
  "blocked",
];

export default function TaskDetailsModal({
  open,
  task,
  comments,
  watchers,
  checklists,
  loading,
  error,
  busy,
  currentUserId,
  trackedSeconds,
  hasRunningTimer,
  canEditDeadline,
  canEditStatus,
  organizationId: _organizationId,
  currentUserRole,
  submissions,
  onClose,
  onSaveDeadline,
  onSaveStatus,
  onToggleDone,
  onAddComment,
  onTrack,
  onSaveManualTime,
  onInviteUser,
  onRemoveInvitedUser,
  onSearchUsers,
  onCreateChecklist,
  onDeleteChecklist,
  onAddChecklistItem,
  onToggleChecklistItem,
  onDeleteChecklistItem,
  onCreateSubmission,
  onApproveSubmission,
  onRejectSubmission,
}: {
  open: boolean;
  task: TaskItem | null;
  comments: TaskCommentItem[];
  watchers: TaskWatcherItem[];
  checklists: TaskChecklistWithItems[];
  loading: boolean;
  error: string;
  busy?: boolean;
  currentUserId: string;
  trackedSeconds: number;
  hasRunningTimer: boolean;
  canEditDeadline: boolean;
  canEditStatus: boolean;
  organizationId: string;
  currentUserRole: string;
  submissions: TaskSubmissionItem[];
  onClose: () => void;
  onSaveDeadline: (taskId: string, dueDate: string | null) => Promise<void>;
  onSaveStatus: (taskId: string, status: TaskStatus) => Promise<void>;
  onToggleDone: (taskId: string, checked: boolean) => Promise<void>;
  onAddComment: (taskId: string, comment: string) => Promise<void>;
  onTrack: (taskId: string, title: string) => void;
  onSaveManualTime: (
    taskId: string,
    hours: number,
    minutes: number,
  ) => Promise<void>;
  onInviteUser: (taskId: string, userId: string) => Promise<void>;
  onRemoveInvitedUser: (taskId: string, userId: string) => Promise<void>;
  onSearchUsers: (search: string) => Promise<TaskInvitableUser[]>;
  onCreateChecklist: (title: string) => Promise<void>;
  onDeleteChecklist: (checklistId: string) => Promise<void>;
  onAddChecklistItem: (checklistId: string, content: string) => Promise<void>;
  onToggleChecklistItem: (itemId: string, checked: boolean) => Promise<void>;
  onDeleteChecklistItem: (itemId: string) => Promise<void>;
  onCreateSubmission: (params: {
    taskId: string;
    submissionType: TaskSubmissionType;
    title: string;
    notes?: string | null;
    linkUrl?: string | null;
    file?: File | null;
  }) => Promise<void>;
  onApproveSubmission: (
    submissionId: string,
    taskId: string,
    reviewNote?: string,
  ) => Promise<void>;
  onRejectSubmission: (
    submissionId: string,
    taskId: string,
    reviewNote?: string,
  ) => Promise<void>;
}) {
  const [deadline, setDeadline] = useState("");
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [manualHours, setManualHours] = useState("0");
  const [manualMinutes, setManualMinutes] = useState("30");

  const [userSearch, setUserSearch] = useState("");
  const [userResults, setUserResults] = useState<TaskInvitableUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [liveTrackedSeconds, setLiveTrackedSeconds] = useState(
    Number(trackedSeconds ?? 0),
  );

  const [submissionType, setSubmissionType] =
    useState<TaskSubmissionType>("website");
  const [submissionLink, setSubmissionLink] = useState("");
  const [submissionTitle, setSubmissionTitle] = useState("");
  const [submissionNotes, setSubmissionNotes] = useState("");
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const canReview =
    currentUserRole === "admin" || currentUserRole === "manager";

  useEffect(() => {
    setLiveTrackedSeconds(Number(trackedSeconds ?? 0));
  }, [trackedSeconds, task?.id]);

  useEffect(() => {
    if (!hasRunningTimer) return;

    const startedAt = Date.now();
    const baseSeconds = Number(trackedSeconds ?? 0);

    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      setLiveTrackedSeconds(baseSeconds + elapsed);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [hasRunningTimer, trackedSeconds]);

  const initialDeadline = useMemo(() => {
    if (!task?.due_date) return "";
    const date = new Date(task.due_date);
    const pad = (value: number) => String(value).padStart(2, "0");

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }, [task?.due_date]);

  useEffect(() => {
    if (task?.status && task.status !== "done") {
      setStatus(task.status);
    }
  }, [task?.status]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      const trimmed = userSearch.trim();

      if (!trimmed) {
        setUserResults([]);
        return;
      }

      try {
        setSearchingUsers(true);
        const results = await onSearchUsers(trimmed);
        if (active) {
          setUserResults(results);
        }
      } catch {
        if (active) {
          setUserResults([]);
        }
      } finally {
        if (active) {
          setSearchingUsers(false);
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
  }, [userSearch, onSearchUsers]);

  if (!open) return null;

  const effectiveDeadline = deadline || initialDeadline;
  const isDone = task?.status === "done";
  const trackButtonText = hasRunningTimer
    ? `Tracking ${formatDurationHms(liveTrackedSeconds)}`
    : "Start timer on this card";

  const handleSaveDeadline = async () => {
    if (!task) return;
    await onSaveDeadline(task.id, effectiveDeadline || null);
  };

  const handleSaveStatus = async () => {
    if (!task) return;
    await onSaveStatus(task.id, status);
  };

  const handleAddComment = async () => {
    if (!task || !comment.trim()) return;
    await onAddComment(task.id, comment.trim());
    setComment("");
  };

  const handleInviteUser = async (userId: string) => {
    if (!task) return;
    await onInviteUser(task.id, userId);
    setUserSearch("");
    setUserResults([]);
  };

  const handleSaveManualTime = async () => {
    if (!task) return;

    const hours = Number(manualHours || "0");
    const minutes = Number(manualMinutes || "0");

    await onSaveManualTime(task.id, hours, minutes);
    setManualHours("0");
    setManualMinutes("30");
  };

  const handleCreateSubmission = async () => {
    if (!task) return;

    const needsPhysicalFile =
      submissionType === "media" || submissionType === "document";

    if (!submissionTitle.trim()) {
      return;
    }

    if (needsPhysicalFile && !submissionFile) {
      alert("Please upload a file for media or document submissions.");
      return;
    }

    await onCreateSubmission({
      taskId: task.id,
      submissionType,
      title: submissionTitle,
      notes: submissionNotes || null,
      linkUrl: submissionLink || null,
      file: submissionFile,
    });

    setSubmissionTitle("");
    setSubmissionLink("");
    setSubmissionNotes("");
    setSubmissionFile(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 p-3 sm:p-4">
      <div className="mx-auto flex h-[95vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-white sm:text-2xl">
              {task?.title || "Task Details"}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              Trello-style workflow card
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="ml-4 rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/5 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="min-h-0 overflow-y-auto border-b border-white/10 p-5 xl:border-b-0 xl:border-r xl:border-white/10 sm:p-6">
            {loading ? (
              <p className="text-white/60">Loading task details...</p>
            ) : error ? (
              <p className="text-red-400">{error}</p>
            ) : !task ? (
              <p className="text-white/60">Task not found.</p>
            ) : (
              <div className="space-y-6 pb-8">
                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <p className="text-sm text-white/50">Description</p>
                  <p className="mt-3 whitespace-pre-wrap text-white/80">
                    {task.description || "No task description added yet."}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm text-white/50">Status</p>
                    <p className="mt-3 font-medium text-white">
                      {task.status.replaceAll("_", " ")}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm text-white/50">Priority</p>
                    <p className="mt-3 font-medium text-white">
                      {task.priority}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm text-white/50">Department</p>
                    <p className="mt-3 font-medium text-white">
                      {task.department || "Not set"}
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm text-white/50">Created</p>
                    <p className="mt-3 font-medium text-white">
                      {formatDateTime(task.created_at)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                    <p className="text-sm text-white/50">Completed</p>
                    <p className="mt-3 font-medium text-white">
                      {formatDateTime(task.completed_at)}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-center gap-2 text-orange-400">
                    <Clock3 size={16} />
                    <p className="font-medium">Time Tracking</p>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <div className="rounded-xl bg-white/5 px-4 py-3 text-white">
                      Total tracked: {formatDurationHms(liveTrackedSeconds)}
                    </div>

                    {hasRunningTimer ? (
                      <div className="inline-flex items-center gap-2 rounded-xl bg-orange-500/10 px-4 py-3 text-orange-300">
                        <Radio size={14} />
                        Running now
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onTrack(task.id, task.title)}
                      className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black"
                    >
                      {trackButtonText}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <input
                      type="number"
                      min="0"
                      value={manualHours}
                      onChange={(e) => setManualHours(e.target.value)}
                      className="rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                      placeholder="Hours"
                    />
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={manualMinutes}
                      onChange={(e) => setManualMinutes(e.target.value)}
                      className="rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                      placeholder="Minutes"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleSaveManualTime()}
                      className="rounded-xl bg-white/10 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      Save time
                    </button>
                  </div>

                  <p className="mt-3 text-sm text-white/45">
                    Add manual time in hours and minutes.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-center gap-2 text-orange-400">
                    <CalendarClock size={16} />
                    <p className="font-medium">Deadline</p>
                  </div>

                  <p className="mt-3 text-sm text-white/60">
                    Current: {formatDateTime(task.due_date)}
                  </p>

                  {canEditDeadline ? (
                    <div className="mt-4 flex flex-col gap-3 lg:flex-row">
                      <input
                        type="datetime-local"
                        value={effectiveDeadline}
                        onChange={(e) => setDeadline(e.target.value)}
                        className="flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                      />

                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleSaveDeadline()}
                        className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black disabled:opacity-60"
                      >
                        Save deadline
                      </button>
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-white/45">
                      Only the creator, admin, or manager can change the
                      deadline.
                    </p>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-center gap-2 text-orange-400">
                    <Flag size={16} />
                    <p className="font-medium">Workflow</p>
                  </div>

                  <div className="mt-4 space-y-4">
                    <label className="flex items-center gap-3 rounded-xl border border-white/10 bg-black px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isDone}
                        onChange={(e) => {
                          if (task) {
                            void onToggleDone(task.id, e.target.checked);
                          }
                        }}
                        className="h-4 w-4"
                      />
                      <span className="text-sm text-white">
                        Mark this card as done
                      </span>
                    </label>

                    {canEditStatus && !isDone ? (
                      <div className="flex flex-col gap-3 lg:flex-row">
                        <select
                          value={status}
                          onChange={(e) =>
                            setStatus(e.target.value as TaskStatus)
                          }
                          className="flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                        >
                          {STATUS_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                              {item.replaceAll("_", " ")}
                            </option>
                          ))}
                        </select>

                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void handleSaveStatus()}
                          className="rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black disabled:opacity-60"
                        >
                          Save status
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <TaskChecklistSection
                  taskId={task.id}
                  currentUserId={currentUserId}
                  checklists={checklists}
                  busy={busy}
                  onCreateChecklist={onCreateChecklist}
                  onDeleteChecklist={onDeleteChecklist}
                  onAddItem={onAddChecklistItem}
                  onToggleItem={onToggleChecklistItem}
                  onDeleteItem={onDeleteChecklistItem}
                />

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-center gap-2 text-orange-400">
                    <Users size={16} />
                    <p className="font-medium">Invited Users</p>
                  </div>

                  <div className="mt-4 space-y-4">
                    <div className="relative">
                      <Search
                        size={16}
                        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/35"
                      />
                      <input
                        value={userSearch}
                        onChange={(e) => setUserSearch(e.target.value)}
                        placeholder="Search users by email or name"
                        className="w-full rounded-xl border border-white/10 bg-black py-3 pl-11 pr-4 text-white outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="max-h-64 overflow-y-auto rounded-2xl border border-white/10 bg-black/40">
                      {searchingUsers ? (
                        <div className="px-4 py-4 text-sm text-white/50">
                          Searching users...
                        </div>
                      ) : userResults.length === 0 && userSearch.trim() ? (
                        <div className="px-4 py-4 text-sm text-white/50">
                          No matching users found.
                        </div>
                      ) : userResults.length > 0 ? (
                        <div className="divide-y divide-white/10">
                          {userResults.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center justify-between gap-3 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-white">
                                  {item.full_name || "Unnamed user"}
                                </p>
                                <p className="truncate text-xs text-white/45">
                                  {item.email || "No email"}
                                </p>
                                <p className="mt-1 text-xs text-orange-400">
                                  {item.primary_role || "no role"}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => void handleInviteUser(item.id)}
                                className="shrink-0 rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-black"
                              >
                                Invite
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="px-4 py-4 text-sm text-white/50">
                          Start typing a name or email to find registered users.
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      {watchers.length === 0 ? (
                        <p className="text-sm text-white/50">
                          No invited users yet.
                        </p>
                      ) : (
                        watchers.map((watcher) => (
                          <div
                            key={watcher.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black px-4 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-white">
                                {watcher.full_name ||
                                  watcher.email ||
                                  watcher.user_id}
                              </p>
                              <p className="truncate text-xs text-white/45">
                                {watcher.email || "No email"}
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                task &&
                                void onRemoveInvitedUser(
                                  task.id,
                                  watcher.user_id,
                                )
                              }
                              className="shrink-0 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300"
                            >
                              Remove
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
                  <div className="flex items-center gap-2 text-orange-400">
                    {submissionType === "website" ? (
                      <Globe size={16} />
                    ) : submissionType === "media" ? (
                      <Image size={16} />
                    ) : submissionType === "document" ? (
                      <FileText size={16} />
                    ) : (
                      <LinkIcon size={16} />
                    )}
                    <p className="font-medium">Work Submission</p>
                  </div>

                  <p className="mt-2 text-sm text-white/45">
                    Submit work here for admin or manager approval. Media and
                    document tasks can upload a real file.
                  </p>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <select
                      value={submissionType}
                      onChange={(e) =>
                        setSubmissionType(e.target.value as TaskSubmissionType)
                      }
                      className="rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                    >
                      <option value="website">Website</option>
                      <option value="media">Media</option>
                      <option value="document">Document</option>
                      <option value="general">General</option>
                    </select>

                    <input
                      value={submissionTitle}
                      onChange={(e) => setSubmissionTitle(e.target.value)}
                      className="rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                      placeholder="Submission title"
                    />
                  </div>

                  <div className="mt-3">
                    <input
                      value={submissionLink}
                      onChange={(e) => setSubmissionLink(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                      placeholder="Optional link"
                    />
                  </div>

                  <div className="mt-3">
                    <textarea
                      value={submissionNotes}
                      onChange={(e) => setSubmissionNotes(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                      placeholder="Submission notes"
                    />
                  </div>

                  {submissionType === "media" ||
                  submissionType === "document" ||
                  submissionType === "general" ? (
                    <div className="mt-3">
                      <label className="mb-2 flex items-center gap-2 text-sm text-white/60">
                        <Upload size={14} />
                        Upload file
                      </label>

                      <input
                        type="file"
                        onChange={(e) =>
                          setSubmissionFile(e.target.files?.[0] ?? null)
                        }
                        className="block w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white file:mr-4 file:rounded-lg file:border-0 file:bg-orange-500 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-black"
                      />

                      {submissionFile ? (
                        <p className="mt-2 text-xs text-white/50">
                          Selected: {submissionFile.name}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy || !submissionTitle.trim()}
                      onClick={() => void handleCreateSubmission()}
                      className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                    >
                      Submit for approval
                    </button>
                  </div>

                  <div className="mt-5 space-y-3">
                    {submissions.length === 0 ? (
                      <p className="text-sm text-white/45">
                        No submissions yet.
                      </p>
                    ) : (
                      submissions.map((submission) => (
                        <div
                          key={submission.id}
                          className="rounded-xl border border-white/10 bg-black px-4 py-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-medium text-white">
                                {submission.title}
                              </p>
                              <p className="mt-1 text-xs text-white/45">
                                {submission.submission_type} •{" "}
                                {submission.approval_status}
                              </p>
                            </div>

                            <div className="text-xs text-white/40">
                              {formatDateTime(submission.created_at)}
                            </div>
                          </div>

                          {submission.link_url ? (
                            <a
                              href={submission.link_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-3 block text-sm text-orange-400 underline"
                            >
                              Open link
                            </a>
                          ) : null}

                          {submission.signed_file_url ? (
                            <a
                              href={submission.signed_file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-2 block text-sm text-orange-400 underline"
                            >
                              Open file
                              {submission.file_name
                                ? ` (${submission.file_name})`
                                : ""}
                            </a>
                          ) : null}

                          {submission.notes ? (
                            <p className="mt-3 whitespace-pre-wrap text-sm text-white/70">
                              {submission.notes}
                            </p>
                          ) : null}

                          {canReview ? (
                            <div className="mt-4 space-y-3">
                              <textarea
                                value={reviewNote}
                                onChange={(e) => setReviewNote(e.target.value)}
                                rows={3}
                                className="w-full rounded-xl border border-white/10 bg-[#0b0d0f] px-4 py-3 text-white outline-none focus:border-orange-500"
                                placeholder="Optional review note"
                              />

                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={busy || !task}
                                  onClick={() =>
                                    task &&
                                    void onApproveSubmission(
                                      submission.id,
                                      task.id,
                                      reviewNote || undefined,
                                    )
                                  }
                                  className="rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                                >
                                  Approve
                                </button>

                                <button
                                  type="button"
                                  disabled={busy || !task}
                                  onClick={() =>
                                    task &&
                                    void onRejectSubmission(
                                      submission.id,
                                      task.id,
                                      reviewNote || undefined,
                                    )
                                  }
                                  className="rounded-xl bg-red-500 px-4 py-3 text-sm font-semibold text-black disabled:opacity-60"
                                >
                                  Send back
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="min-h-0 overflow-y-auto p-5 sm:p-6">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-5">
              <div className="flex items-center gap-2">
                <MessageSquare size={16} className="text-orange-400" />
                <h3 className="font-semibold text-white">Comments</h3>
              </div>

              <div className="mt-4 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
                {comments.length === 0 ? (
                  <p className="text-sm text-white/50">
                    No comments yet. Start the conversation here.
                  </p>
                ) : (
                  comments.map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl border border-white/10 bg-black px-4 py-3"
                    >
                      <p className="text-sm font-medium text-white">
                        {item.author_name ||
                          item.author_email ||
                          item.user_id ||
                          "Unknown user"}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-white/70">
                        {item.comment}
                      </p>
                      <p className="mt-2 text-xs text-white/40">
                        {formatDateTime(item.created_at)}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-5 space-y-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={5}
                  placeholder="Write a professional comment, review note, or approval feedback..."
                  className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                />

                <button
                  type="button"
                  disabled={!currentUserId || !comment.trim()}
                  onClick={() => void handleAddComment()}
                  className="w-full rounded-xl bg-orange-500 px-4 py-3 font-semibold text-black disabled:opacity-60"
                >
                  Add comment
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
