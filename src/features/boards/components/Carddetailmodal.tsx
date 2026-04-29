import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  X,
  Clock3,
  Users,
  CheckSquare,
  Paperclip,
  MessageSquare,
  CalendarClock,
  Trash2,
  Edit2,
  Plus,
  Loader2,
  Send,
  UserPlus,
  Check,
  Search,
  Play,
  Square,
  Timer,
  History,
  Circle,
} from "lucide-react";
import type {
  TaskItem,
  TaskAssigneeItem,
} from "../../../lib/supabase/queries/tasks";
import {
  getCardComments,
  addCardComment,
  updateCard,
  deleteCard,
} from "../services/boardService";
import { supabase } from "../../../lib/supabase/client";
import {
  startTimeEntry,
  stopTimeEntry,
  type TimeEntryItem,
} from "../../../lib/supabase/mutations/timeEntries";
import { uploadTaskSubmissionFile } from "../../../lib/supabase/storage";
import type { TaskSubmissionFileResult } from "../../../lib/supabase/storage";
import {
  notifyTaskAssigned,
  notifyTaskCommented,
} from "../../notifications/services/notificationOrchestrationService";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CardDetailModalProps {
  cardId: string;
  card: TaskItem & {
    assignees?: TaskAssigneeItem[];
    commentsCount?: number;
    tracked_seconds_cache?: number | null;
    is_billable?: boolean;
    created_by_full_name?: string | null;
    created_by_email?: string | null;
  };
  isOpen: boolean;
  onClose: () => void;
  onUpdate?: (updates: Partial<TaskItem>) => void;
  onToggleTimer?: (cardId: string, title: string) => void;
  hasRunningTimer?: boolean;
  currentUserId: string;
  organizationId: string;
}

// ─── Local types ──────────────────────────────────────────────────────────────

interface DBComment {
  id: string;
  task_id: string;
  user_id: string | null;
  comment: string;
  created_at: string;
  author_name: string | null;
  author_email: string | null;
}

interface InvitableUser {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
}

interface TimeEntryProfile {
  id: string;
  full_name: string | null;
  email: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurationHms(seconds?: number | null) {
  const total = Math.max(0, Math.floor(Number(seconds ?? 0)));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return [
    String(hrs).padStart(2, "0"),
    String(mins).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ].join(":");
}

function formatDurationShort(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return "just now";
}

function getLiveEntrySeconds(entry: TimeEntryItem, nowMs: number) {
  if (entry.ended_at) {
    return entry.duration_seconds ?? 0;
  }

  const startedMs = new Date(entry.started_at).getTime();
  if (Number.isNaN(startedMs)) return 0;
  return Math.max(0, Math.floor((nowMs - startedMs) / 1000));
}

function getInitials(name?: string | null, email?: string | null) {
  const src = name?.trim() || email?.trim() || "?";
  const parts = src.split(" ").filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : src.slice(0, 2).toUpperCase();
}

const STATUS_OPTIONS = [
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
  "blocked",
  "cancelled",
] as const;

const PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

const STATUS_COLORS: Record<string, string> = {
  backlog: "bg-white/10 text-white/60",
  todo: "bg-blue-500/20 text-blue-300",
  in_progress: "bg-orange-500/20 text-orange-300",
  review: "bg-yellow-500/20 text-yellow-300",
  done: "bg-green-500/20 text-green-300",
  blocked: "bg-red-500/20 text-red-300",
  cancelled: "bg-white/5 text-white/30",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-white/40",
  medium: "text-yellow-400",
  high: "text-orange-400",
  urgent: "text-red-400",
};

// ─── Time entries panel ───────────────────────────────────────────────────────

interface TimeEntriesPanelProps {
  entries: TimeEntryItem[];
  activeEntries: Array<
    TimeEntryItem & {
      liveSeconds: number;
      userName: string;
      userEmail: string | null;
      isCurrentUser: boolean;
    }
  >;
  currentUserActiveEntry: TimeEntryItem | null;
  currentUserLiveSeconds: number;
  totalSeconds: number;
  loading: boolean;
  mutating: boolean;
  onToggle: () => void;
}

function TimeEntriesPanel({
  entries,
  activeEntries,
  currentUserActiveEntry,
  currentUserLiveSeconds,
  totalSeconds,
  loading,
  mutating,
  onToggle,
}: TimeEntriesPanelProps) {
  const completedEntries = entries.filter((e) => e.ended_at);
  const activeCount = activeEntries.length;

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Timer size={15} className="text-orange-400" />
          <span className="text-sm font-semibold text-white">
            Time Tracking
          </span>
        </div>
        <div className="flex items-center gap-3">
          {activeCount > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-orange-400">
              <Circle size={7} className="fill-orange-400 animate-pulse" />
              Running x{activeCount}
            </span>
          )}
          <span className="text-xs font-mono text-white/60">
            Total: {formatDurationHms(totalSeconds)}
          </span>
        </div>
      </div>

      {/* Active sessions */}
      {activeCount > 0 && (
        <div className="border-b border-orange-500/20 bg-orange-500/8 px-4 py-3">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-orange-400/70 mb-0.5">
                Active sessions
              </p>
              <p className="text-xs text-white/45">
                Multiple teammates can track this card at the same time.
              </p>
              {currentUserActiveEntry && (
                <p className="mt-1 text-xs font-mono text-orange-300">
                  Your live time: {formatDurationHms(currentUserLiveSeconds)}
                </p>
              )}
            </div>
            <button
              onClick={onToggle}
              disabled={mutating || loading}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50 transition-all"
            >
              {mutating ? (
                <Loader2 size={14} className="animate-spin" />
              ) : currentUserActiveEntry ? (
                <Square size={14} />
              ) : (
                <Play size={14} />
              )}
              {currentUserActiveEntry ? "Stop my timer" : "Start my timer"}
            </button>
          </div>

          <div className="space-y-2">
            {activeEntries.map((entry) => (
              <div
                key={entry.id}
                className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2 ${
                  entry.isCurrentUser
                    ? "border-orange-500/30 bg-orange-500/10"
                    : "border-white/10 bg-black/30"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold text-white">
                      {entry.userName}
                    </span>
                    {entry.isCurrentUser && (
                      <span className="rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] text-orange-300">
                        You
                      </span>
                    )}
                  </div>
                  <p className="truncate text-[11px] text-white/40">
                    {entry.description || "Timer session"}
                  </p>
                  <p className="text-[10px] text-white/30 mt-0.5">
                    Started {formatDateTime(entry.started_at)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-mono font-bold text-orange-400 tabular-nums">
                  {formatDurationHms(entry.liveSeconds)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Start button when nobody is tracking yet */}
      {activeCount === 0 && (
        <div className="px-4 py-3 border-b border-white/10">
          <button
            onClick={onToggle}
            disabled={mutating || loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-400 hover:bg-orange-500/20 disabled:opacity-50 transition-all"
          >
            {mutating || loading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {mutating ? "Starting…" : "Start timer"}
          </button>
        </div>
      )}

      {/* Entry history */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5 mb-3">
          <History size={12} className="text-white/30" />
          <p className="text-[10px] uppercase tracking-wider text-white/40">
            Entry history ({completedEntries.length})
          </p>
        </div>

        {loading && completedEntries.length === 0 ? (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin text-orange-400" />
          </div>
        ) : completedEntries.length === 0 ? (
          <p className="text-xs text-white/30 italic py-2">
            No completed sessions yet.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {completedEntries.map((entry) => {
              const dur = entry.duration_seconds ?? 0;
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-white/4 border border-white/8 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-white/70 truncate">
                      {entry.description || "Timer session"}
                    </p>
                    <p className="text-[10px] text-white/35 mt-0.5">
                      {formatDateTime(entry.started_at)}
                      {entry.ended_at && ` → ${formatDateTime(entry.ended_at)}`}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs font-mono font-semibold text-white/80">
                      {formatDurationShort(dur)}
                    </span>
                    <p
                      className={`text-[10px] mt-0.5 ${
                        entry.approval_status === "approved"
                          ? "text-green-400"
                          : entry.approval_status === "rejected"
                            ? "text-red-400"
                            : "text-white/30"
                      }`}
                    >
                      {entry.approval_status}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function CardDetailModal({
  cardId,
  card,
  isOpen,
  onClose,
  onUpdate,
  hasRunningTimer = false,
  currentUserId,
  organizationId,
}: CardDetailModalProps) {
  // Tabs
  const [activeTab, setActiveTab] = useState<
    "details" | "comments" | "checklist"
  >("details");

  // Editable fields
  const [title, setTitle] = useState(card.title);
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState(card.description ?? "");
  const [editingDesc, setEditingDesc] = useState(false);
  const [status, setStatus] = useState(card.status);
  const [priority, setPriority] = useState(card.priority);
  const [dueDate, setDueDate] = useState(
    card.due_date ? card.due_date.split("T")[0] : "",
  );

  // Comments
  const [comments, setComments] = useState<DBComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Assignees
  const [assignees, setAssignees] = useState<TaskAssigneeItem[]>(
    card.assignees ?? [],
  );
  const [showInvite, setShowInvite] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [invitableUsers, setInvitableUsers] = useState<InvitableUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [addingUser, setAddingUser] = useState<string | null>(null);

  // Checklist
  const [checklist, setChecklist] = useState<
    Array<{ id: string; title: string; completed: boolean }>
  >([]);
  const [newCheckItem, setNewCheckItem] = useState("");

  // Attachments
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<
    TaskSubmissionFileResult[]
  >([]);
  const titleRef = useRef<HTMLInputElement>(null);

  // ── Time tracking state ──────────────────────────────────────────────────────
  const [taskTimeEntries, setTaskTimeEntries] = useState<TimeEntryItem[]>([]);
  const [timeEntryProfiles, setTimeEntryProfiles] = useState<
    Record<string, TimeEntryProfile>
  >({});
  const [taskTimeLoading, setTaskTimeLoading] = useState(false);
  const [taskTimeMutating, setTaskTimeMutating] = useState(false);
  const [liveNow, setLiveNow] = useState(Date.now());

  const taskActiveEntries = useMemo(
    () => taskTimeEntries.filter((entry) => !entry.ended_at),
    [taskTimeEntries],
  );

  const currentUserActiveEntry = useMemo(
    () =>
      taskActiveEntries.find((entry) => entry.user_id === currentUserId) ??
      null,
    [taskActiveEntries, currentUserId],
  );

  const currentUserLiveSeconds = useMemo(
    () =>
      currentUserActiveEntry
        ? getLiveEntrySeconds(currentUserActiveEntry, liveNow)
        : 0,
    [currentUserActiveEntry, liveNow],
  );

  const activeSessionEntries = useMemo(
    () =>
      taskActiveEntries
        .map((entry) => {
          const profile = timeEntryProfiles[entry.user_id];
          return {
            ...entry,
            liveSeconds: getLiveEntrySeconds(entry, liveNow),
            userName: profile?.full_name || profile?.email || "Team member",
            userEmail: profile?.email ?? null,
            isCurrentUser: entry.user_id === currentUserId,
          };
        })
        .sort((a, b) => b.started_at.localeCompare(a.started_at)),
    [taskActiveEntries, timeEntryProfiles, liveNow, currentUserId],
  );

  const totalTrackedSeconds = useMemo(
    () =>
      taskTimeEntries.reduce(
        (sum, entry) => sum + getLiveEntrySeconds(entry, liveNow),
        0,
      ),
    [taskTimeEntries, liveNow],
  );

  // ── Load time entries for this card ─────────────────────────────────────────
  const loadTaskTime = useCallback(async () => {
    if (!cardId || !organizationId) return;
    setTaskTimeLoading(true);
    try {
      const { data: allEntries, error } = await supabase
        .from("time_entries")
        .select("*")
        .eq("task_id", cardId)
        .eq("organization_id", organizationId)
        .order("started_at", { ascending: false });

      if (error) throw error;

      const entries = (allEntries ?? []) as TimeEntryItem[];
      setTaskTimeEntries(entries);

      const userIds = [...new Set(entries.map((entry) => entry.user_id))];
      if (userIds.length === 0) {
        setTimeEntryProfiles({});
      } else {
        const { data: profiles, error: profilesError } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        if (profilesError) throw profilesError;

        setTimeEntryProfiles(
          Object.fromEntries(
            (profiles ?? []).map((profile) => [profile.id, profile]),
          ),
        );
      }
    } catch (e) {
      console.error("loadTaskTime error:", e);
    } finally {
      setTaskTimeLoading(false);
    }
  }, [cardId, organizationId]);

  // Load on open
  useEffect(() => {
    if (isOpen) loadTaskTime();
  }, [isOpen, loadTaskTime]);

  // ── Live ticker for active sessions ─────────────────────────────────────────
  useEffect(() => {
    if (taskActiveEntries.length === 0) {
      return;
    }

    const tick = () => {
      setLiveNow(Date.now());
    };

    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [taskActiveEntries.length]);

  // ── Realtime updates while modal is open ────────────────────────────────────
  useEffect(() => {
    if (!isOpen || !organizationId || !cardId) return;

    const channel = supabase
      .channel(`card-time-${cardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_entries",
          filter: `task_id=eq.${cardId}`,
        },
        () => {
          void loadTaskTime();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, organizationId, cardId, loadTaskTime]);

  // ── Toggle timer ─────────────────────────────────────────────────────────────
  const handleToggleTimer = async () => {
    if (!organizationId || !currentUserId || taskTimeMutating) return;
    setTaskTimeMutating(true);
    try {
      if (currentUserActiveEntry?.id) {
        await stopTimeEntry(currentUserActiveEntry.id);
      } else {
        await startTimeEntry({
          organizationId,
          userId: currentUserId,
          taskId: cardId,
          description: `Working on: ${card.title}`,
          source: "card_modal",
          metadata: { started_from: "card_modal", card_title: card.title },
        });
      }
      // Always refetch to get accurate state from DB
      await loadTaskTime();
    } catch (e) {
      console.error("Timer toggle error:", e);
    } finally {
      setTaskTimeMutating(false);
    }
  };

  // ── Comments ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isOpen || activeTab !== "comments") return;
    setLoadingComments(true);
    Promise.resolve(getCardComments(cardId))
      .then((data) => setComments(data as DBComment[]))
      .catch(console.error)
      .finally(() => setLoadingComments(false));
  }, [cardId, isOpen, activeTab]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments]);

  // ── Invite search ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!showInvite || !organizationId) return;
    setLoadingUsers(true);
    const search = inviteSearch.trim();
    let q = supabase
      .from("profiles")
      .select("id, full_name, email, primary_role")
      .eq("organization_id", organizationId)
      .order("full_name", { ascending: true })
      .limit(10);
    if (search) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    Promise.resolve(q)
      .then(({ data }) => setInvitableUsers((data ?? []) as InvitableUser[]))
      .catch(console.error)
      .finally(() => setLoadingUsers(false));
  }, [showInvite, inviteSearch, organizationId]);

  if (!isOpen) return null;

  // ── Field save handlers ───────────────────────────────────────────────────────
  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== card.title) onUpdate?.({ title: trimmed });
    setEditingTitle(false);
  };

  const saveDescription = () => {
    if (description !== card.description) onUpdate?.({ description });
    setEditingDesc(false);
  };

  const handleStatusChange = (val: string) => {
    setStatus(val as typeof status);
    onUpdate?.({ status: val as typeof status });
  };

  const handlePriorityChange = (val: string) => {
    setPriority(val as typeof priority);
    onUpdate?.({ priority: val as typeof priority });
  };

  const handleDueDateChange = (val: string) => {
    setDueDate(val);
    onUpdate?.({ due_date: val || null });
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || submittingComment) return;
    setSubmittingComment(true);
    try {
      const saved = await addCardComment(
        cardId,
        organizationId,
        currentUserId,
        newComment.trim(),
      );
      if (saved) {
        setComments((prev) => [
          ...prev,
          {
            id: saved.id,
            task_id: saved.task_id,
            user_id: saved.user_id ?? null,
            comment: saved.comment,
            created_at: saved.created_at,
            author_name: null,
            author_email: null,
          },
        ]);
        setNewComment("");

        // Notify assignees and watchers about the new comment
        void notifyTaskCommented({
          organizationId,
          taskId: cardId,
          commentId: saved.id,
          authorUserId: currentUserId,
          authorName: card.created_by_full_name || undefined,
          taskTitle: title,
        }).catch((err) => {
          console.error("CARD COMMENT NOTIFICATION ERROR:", err);
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleAddAssignee = async (user: InvitableUser) => {
    if (assignees.find((a) => a.user_id === user.id)) return;
    setAddingUser(user.id);
    try {
      await supabase.from("task_assignees").insert({
        task_id: cardId,
        user_id: user.id,
        organization_id: organizationId,
      });
      setAssignees((prev) => [
        ...prev,
        {
          id: user.id,
          task_id: cardId,
          user_id: user.id,
          created_at: new Date().toISOString(),
          full_name: user.full_name,
          email: user.email,
          primary_role: user.primary_role,
        },
      ]);

      // Notify the newly added assignee
      void notifyTaskAssigned({
        organizationId,
        userId: user.id,
        taskId: cardId,
        taskTitle: title,
      }).catch((err) => {
        console.error("ADD ASSIGNEE NOTIFICATION ERROR:", err);
      });
    } catch (e) {
      console.error(e);
    } finally {
      setAddingUser(null);
    }
  };

  const handleRemoveAssignee = async (userId: string) => {
    const { error } = await supabase
      .from("task_assignees")
      .delete()
      .eq("task_id", cardId)
      .eq("user_id", userId);
    if (!error)
      setAssignees((prev) => prev.filter((a) => a.user_id !== userId));
  };

  const handleFileUpload = async (file: File) => {
    setUploadingFile(true);
    try {
      const result = await uploadTaskSubmissionFile(cardId, file);
      setUploadedFiles((prev) => [...prev, result]);
    } catch (e) {
      console.error("Upload failed:", e);
    }
    setUploadingFile(false);
  };

  const addCheckItem = () => {
    if (!newCheckItem.trim()) return;
    setChecklist((prev) => [
      ...prev,
      { id: crypto.randomUUID(), title: newCheckItem.trim(), completed: false },
    ]);
    setNewCheckItem("");
  };

  const checklistDone = checklist.filter((i) => i.completed).length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-12">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl">
        {/* Orange top bar */}
        <div className="h-1 w-full rounded-t-2xl bg-linear-to-r from-orange-500 to-orange-400" />

        {/* Header */}
        <div className="flex items-start gap-3 border-b border-white/10 px-6 py-4">
          <div className="flex-1 min-w-0">
            {editingTitle ? (
              <input
                ref={titleRef}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveTitle();
                  if (e.key === "Escape") {
                    setTitle(card.title);
                    setEditingTitle(false);
                  }
                }}
                className="w-full rounded-lg bg-white/10 px-3 py-1.5 text-lg font-bold text-white outline-none focus:ring-1 focus:ring-orange-500"
                autoFocus
              />
            ) : (
              <h2
                onClick={() => setEditingTitle(true)}
                className="cursor-text text-lg font-bold text-white hover:text-orange-400 transition flex items-center gap-2 group"
              >
                <span className="line-clamp-2">{title}</span>
                <Edit2
                  size={14}
                  className="shrink-0 opacity-0 group-hover:opacity-60 transition"
                />
              </h2>
            )}
            <p className="mt-1 text-xs text-white/35">
              Created{" "}
              {new Date(card.created_at).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
              {card.created_by_full_name &&
                ` · by ${card.created_by_full_name}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-white/40 hover:bg-white/10 hover:text-white transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-white/10 px-6">
          {(["details", "comments", "checklist"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-4 text-xs font-semibold uppercase tracking-wider transition border-b-2 ${
                activeTab === tab
                  ? "border-orange-500 text-orange-400"
                  : "border-transparent text-white/40 hover:text-white"
              }`}
            >
              {tab === "comments"
                ? `Comments${comments.length > 0 ? ` (${comments.length})` : ""}`
                : tab}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[65vh] overflow-y-auto">
          {/* ── Details tab ── */}
          {activeTab === "details" && (
            <>
              {/* Status + Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
                    Status
                  </p>
                  <select
                    value={status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5">
                    Priority
                  </p>
                  <select
                    value={priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Due date */}
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 flex items-center gap-1">
                  <CalendarClock size={11} /> Due Date
                </p>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
                />
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] uppercase tracking-widest text-white/40">
                    Description
                  </p>
                  {!editingDesc && (
                    <button
                      onClick={() => setEditingDesc(true)}
                      className="text-[11px] text-white/40 hover:text-orange-400 transition flex items-center gap-1"
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                  )}
                </div>
                {editingDesc ? (
                  <div className="space-y-2">
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-orange-500/50 resize-none"
                      placeholder="Add a description..."
                      autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => {
                          setEditingDesc(false);
                          setDescription(card.description ?? "");
                        }}
                        className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:bg-white/10 transition"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={saveDescription}
                        className="rounded-lg bg-orange-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-orange-600 transition"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => setEditingDesc(true)}
                    className="min-h-20 cursor-text rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm text-white/70 hover:border-white/20 transition"
                  >
                    {description || (
                      <span className="text-white/25 italic">
                        Click to add a description…
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* ── Time Tracking Panel ── */}
              <TimeEntriesPanel
                entries={taskTimeEntries}
                activeEntries={activeSessionEntries}
                currentUserActiveEntry={currentUserActiveEntry}
                currentUserLiveSeconds={currentUserLiveSeconds}
                totalSeconds={totalTrackedSeconds}
                loading={taskTimeLoading}
                mutating={taskTimeMutating}
                onToggle={handleToggleTimer}
              />

              {/* Collaborators */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 flex items-center gap-1">
                    <Users size={11} /> Collaborators
                  </p>
                  <button
                    onClick={() => setShowInvite((v) => !v)}
                    className="flex items-center gap-1 text-[11px] text-orange-400 hover:text-orange-300 transition"
                  >
                    <UserPlus size={12} /> Invite
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mb-2">
                  {assignees.length === 0 && !showInvite && (
                    <p className="text-xs text-white/30 italic">
                      No collaborators yet
                    </p>
                  )}
                  {assignees.map((a) => (
                    <div
                      key={a.user_id}
                      className="group flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/20 border border-orange-500/30 text-[9px] font-bold text-orange-400">
                        {getInitials(a.full_name, a.email)}
                      </div>
                      <span className="text-xs text-white/80">
                        {a.full_name || a.email}
                      </span>
                      <button
                        onClick={() => handleRemoveAssignee(a.user_id)}
                        className="ml-1 text-white/20 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                      >
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                </div>
                {showInvite && (
                  <div className="rounded-xl border border-white/10 bg-[#0a0a0a] overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                      <Search size={13} className="text-white/30" />
                      <input
                        value={inviteSearch}
                        onChange={(e) => setInviteSearch(e.target.value)}
                        placeholder="Search team members…"
                        className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 outline-none"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {loadingUsers ? (
                        <div className="flex justify-center py-4">
                          <Loader2
                            size={16}
                            className="animate-spin text-orange-400"
                          />
                        </div>
                      ) : invitableUsers.length === 0 ? (
                        <p className="py-4 text-center text-xs text-white/30">
                          No users found
                        </p>
                      ) : (
                        invitableUsers.map((u) => {
                          const already = assignees.some(
                            (a) => a.user_id === u.id,
                          );
                          return (
                            <button
                              key={u.id}
                              onClick={() => !already && handleAddAssignee(u)}
                              disabled={already || addingUser === u.id}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition ${already ? "opacity-50 cursor-default" : "hover:bg-white/5"}`}
                            >
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[10px] font-bold text-orange-400">
                                {getInitials(u.full_name, u.email)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-white truncate">
                                  {u.full_name || u.email}
                                </p>
                                {u.primary_role && (
                                  <p className="text-[10px] text-white/30 truncate">
                                    {u.primary_role}
                                  </p>
                                )}
                              </div>
                              {already ? (
                                <Check size={13} className="text-green-400" />
                              ) : addingUser === u.id ? (
                                <Loader2
                                  size={13}
                                  className="animate-spin text-orange-400"
                                />
                              ) : (
                                <Plus size={13} className="text-white/30" />
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 flex items-center gap-1">
                  <Paperclip size={11} /> Attachments
                </p>
                <div className="space-y-2">
                  <input
                    type="file"
                    multiple
                    onChange={(e) =>
                      Array.from(e.target.files || []).forEach(handleFileUpload)
                    }
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="w-full rounded-xl border-2 border-dashed border-white/10 bg-white/5 py-6 text-center hover:border-orange-500/40 hover:bg-orange-500/5 transition cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Plus size={20} className="text-white/30" />
                    <p className="text-sm text-white/60">
                      Click to upload or drag files here
                    </p>
                    <p className="text-xs text-white/30">
                      PNG, JPG, PDF up to 10MB
                    </p>
                  </label>
                  {uploadingFile && (
                    <div className="flex items-center gap-2 p-3 bg-orange-500/10 rounded-xl">
                      <Loader2
                        size={16}
                        className="animate-spin text-orange-400"
                      />
                      <span className="text-sm text-orange-400">
                        Uploading...
                      </span>
                    </div>
                  )}
                  {uploadedFiles.length > 0 && (
                    <div className="space-y-1">
                      {uploadedFiles.map((file, idx) => (
                        <a
                          key={idx}
                          href={file.signed_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 p-2 bg-white/5 rounded-lg text-white/80 hover:bg-white/10 transition"
                        >
                          <Paperclip size={14} />
                          {file.file_name}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ── Comments tab ── */}
          {activeTab === "comments" && (
            <div className="space-y-4">
              {loadingComments ? (
                <div className="flex justify-center py-10">
                  <Loader2 size={20} className="animate-spin text-orange-400" />
                </div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center">
                  <MessageSquare
                    size={28}
                    className="mx-auto mb-3 text-white/15"
                  />
                  <p className="text-sm text-white/30">No comments yet</p>
                  <p className="text-xs text-white/20 mt-1">
                    Be the first to comment
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/70">
                        {getInitials(c.author_name, c.author_email)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-white">
                            {c.author_name || c.author_email || "Team member"}
                          </span>
                          <span className="text-[10px] text-white/30">
                            {timeAgo(c.created_at)}
                          </span>
                        </div>
                        <div className="rounded-xl rounded-tl-none bg-white/6 border border-white/8 px-3 py-2 text-sm text-white/80">
                          {c.comment}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
              )}
              <div className="flex gap-2 pt-2 border-t border-white/10 sticky bottom-0 bg-[#0f0f0f] pb-1">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void handleAddComment();
                    }
                  }}
                  placeholder="Write a comment… (Enter to send)"
                  rows={2}
                  className="flex-1 resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-500/50"
                />
                <button
                  onClick={handleAddComment}
                  disabled={!newComment.trim() || submittingComment}
                  className="self-end rounded-xl bg-orange-500 p-2.5 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  {submittingComment ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Send size={16} />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ── Checklist tab ── */}
          {activeTab === "checklist" && (
            <div className="space-y-4">
              {checklist.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white/50">
                      {checklistDone}/{checklist.length} completed
                    </span>
                    <span className="text-xs font-semibold text-white">
                      {Math.round((checklistDone / checklist.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all"
                      style={{
                        width: `${(checklistDone / checklist.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {checklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 group"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() =>
                        setChecklist((prev) =>
                          prev.map((i) =>
                            i.id === item.id
                              ? { ...i, completed: !i.completed }
                              : i,
                          ),
                        )
                      }
                      className="h-4 w-4 rounded cursor-pointer accent-orange-500"
                    />
                    <span
                      className={`flex-1 text-sm ${item.completed ? "line-through text-white/30" : "text-white/80"}`}
                    >
                      {item.title}
                    </span>
                    <button
                      onClick={() =>
                        setChecklist((prev) =>
                          prev.filter((i) => i.id !== item.id),
                        )
                      }
                      className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newCheckItem}
                  onChange={(e) => setNewCheckItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addCheckItem();
                  }}
                  placeholder="Add a checklist item…"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-500/50"
                />
                <button
                  onClick={addCheckItem}
                  disabled={!newCheckItem.trim()}
                  className="rounded-xl bg-white/10 px-3 py-2.5 text-white/60 hover:bg-orange-500 hover:text-white disabled:opacity-30 transition"
                >
                  <Plus size={16} />
                </button>
              </div>
              {checklist.length === 0 && (
                <div className="py-8 text-center">
                  <CheckSquare
                    size={28}
                    className="mx-auto mb-3 text-white/15"
                  />
                  <p className="text-sm text-white/30">
                    No checklist items yet
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/10 px-6 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${STATUS_COLORS[status] ?? "bg-white/10 text-white/60"}`}
            >
              {status.replace("_", " ")}
            </span>
            <span
              className={`text-xs font-medium ${PRIORITY_COLORS[priority] ?? "text-white/40"}`}
            >
              ● {priority}
            </span>
            {currentUserActiveEntry && (
              <span className="flex items-center gap-1 text-xs text-orange-400 font-mono">
                <Clock3 size={11} />
                {formatDurationHms(currentUserLiveSeconds)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-1.5 text-xs text-white/50 hover:bg-white/5 hover:text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
