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
  Tag,
  Palette,
  Link2,
  Archive,
  Save,
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
  createManualTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  type TimeEntryItem,
} from "../../../lib/supabase/mutations/timeEntries";
import { uploadTaskSubmissionFile } from "../../../lib/supabase/storage";
import type { TaskSubmissionFileResult } from "../../../lib/supabase/storage";
import {
  notifyTaskAssigned,
  notifyTaskCommented,
} from "../../notifications/services/notificationOrchestrationService";
import {
  getTaskChecklists,
  type TaskChecklistWithItems,
  type TaskChecklistItem,
} from "../../../lib/supabase/queries/taskChecklists";
import {
  createTaskChecklist,
  createTaskChecklistItem,
  deleteTaskChecklistItem,
  toggleTaskChecklistItem,
} from "../../../lib/supabase/mutations/taskChecklists";

// ─── Props ────────────────────────────────────────────────────────────────────

interface CardDetailModalProps {
  cardId: string;
  card: TaskItem & {
    assignees?: TaskAssigneeItem[];
    commentsCount?: number;
    tracked_seconds_cache?: number | null;
    is_billable?: boolean;
    estimated_seconds?: number | null;
    archived_at?: string | null;
    archived_by?: string | null;
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

type FlatChecklistItem = TaskChecklistItem & {
  checklistTitle: string;
};

type TrelloLabel = {
  id: string;
  name: string;
  color: string;
};

type TrelloCustomField = {
  id: string;
  name: string;
  value: string;
};

type CardMetadata = Record<string, unknown> & {
  labels?: TrelloLabel[];
  coverColor?: string | null;
  watchedBy?: string[];
  customFields?: TrelloCustomField[];
};

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

function secondsToHoursMinutes(seconds?: number | null) {
  const totalMinutes = Math.max(0, Math.round(Number(seconds ?? 0) / 60));
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
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

function minutesToStartedEnded(minutes: number) {
  const endedAt = new Date();
  const startedAt = new Date(endedAt.getTime() - minutes * 60 * 1000);
  return {
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
  };
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
  onManualLog: (input: {
    hours: number;
    minutes: number;
    description: string;
    isBillable: boolean;
  }) => Promise<void>;
  onUpdateEntry: (
    entryId: string,
    input: {
      hours: number;
      minutes: number;
      description: string;
      isBillable: boolean;
    },
  ) => Promise<void>;
  onDeleteEntry: (entryId: string) => Promise<void>;
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
  onManualLog,
  onUpdateEntry,
  onDeleteEntry,
}: TimeEntriesPanelProps) {
  const completedEntries = entries.filter((e) => e.ended_at);
  const activeCount = activeEntries.length;
  const [manualOpen, setManualOpen] = useState(false);
  const [manualHours, setManualHours] = useState(0);
  const [manualMinutes, setManualMinutes] = useState(30);
  const [manualDescription, setManualDescription] = useState("");
  const [manualBillable, setManualBillable] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editHours, setEditHours] = useState(0);
  const [editMinutes, setEditMinutes] = useState(0);
  const [editDescription, setEditDescription] = useState("");
  const [editBillable, setEditBillable] = useState(false);
  const manualTotalMinutes = manualHours * 60 + manualMinutes;

  const submitManualTime = async () => {
    if (manualTotalMinutes <= 0 || mutating || loading) return;
    await onManualLog({
      hours: manualHours,
      minutes: manualMinutes,
      description: manualDescription,
      isBillable: manualBillable,
    });
    setManualHours(0);
    setManualMinutes(30);
    setManualDescription("");
    setManualBillable(false);
    setManualOpen(false);
  };

  const beginEditEntry = (entry: TimeEntryItem) => {
    const totalMinutes = Math.max(
      0,
      Math.round(Number(entry.duration_seconds ?? 0) / 60),
    );
    setEditingEntryId(entry.id);
    setEditHours(Math.floor(totalMinutes / 60));
    setEditMinutes(totalMinutes % 60);
    setEditDescription(entry.description ?? "");
    setEditBillable(entry.is_billable);
  };

  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setEditHours(0);
    setEditMinutes(0);
    setEditDescription("");
    setEditBillable(false);
  };

  const saveEditEntry = async (entryId: string) => {
    const totalMinutes = editHours * 60 + editMinutes;
    if (totalMinutes <= 0 || mutating || loading) return;
    await onUpdateEntry(entryId, {
      hours: editHours,
      minutes: editMinutes,
      description: editDescription,
      isBillable: editBillable,
    });
    cancelEditEntry();
  };

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

      {activeCount > 0 && (
        <div className="px-4 py-3 border-b border-white/10">
          <button
            type="button"
            onClick={() => setManualOpen((value) => !value)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/60 transition-all hover:bg-white/10 hover:text-white"
          >
            <Plus size={14} />
            {manualOpen ? "Hide manual time" : "Add manual time"}
          </button>
        </div>
      )}

      {/* Start button when nobody is tracking yet */}
      {activeCount === 0 && (
        <div className="space-y-2 px-4 py-3 border-b border-white/10">
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
          <button
            type="button"
            onClick={() => setManualOpen((value) => !value)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/60 transition-all hover:bg-white/10 hover:text-white"
          >
            <Plus size={14} />
            {manualOpen ? "Hide manual time" : "Add manual time"}
          </button>
        </div>
      )}

      {manualOpen && (
        <div className="border-b border-white/10 bg-white/3 px-4 py-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-white/35">
                Hours
              </span>
              <input
                type="number"
                min={0}
                max={24}
                value={manualHours}
                onChange={(event) =>
                  setManualHours(Math.max(0, Number(event.target.value)))
                }
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] uppercase tracking-wider text-white/35">
                Minutes
              </span>
              <input
                type="number"
                min={0}
                max={59}
                value={manualMinutes}
                onChange={(event) =>
                  setManualMinutes(
                    Math.max(0, Math.min(59, Number(event.target.value))),
                  )
                }
                className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
              />
            </label>
          </div>

          <input
            value={manualDescription}
            onChange={(event) => setManualDescription(event.target.value)}
            placeholder="What did you work on?"
            className="mt-2 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none placeholder:text-white/25 focus:border-orange-500/50"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setManualBillable((value) => !value)}
              className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                manualBillable
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-white/10 bg-black/30 text-white/45"
              }`}
            >
              {manualBillable ? "Billable" : "Non-billable"}
            </button>
            <button
              type="button"
              onClick={() => void submitManualTime()}
              disabled={manualTotalMinutes <= 0 || mutating || loading}
              className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-black transition hover:bg-orange-400 disabled:opacity-50"
            >
              Log {manualTotalMinutes} min
            </button>
          </div>
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
              const isEditing = editingEntryId === entry.id;
              return (
                <div
                  key={entry.id}
                  className="rounded-lg bg-white/4 border border-white/8 px-3 py-2"
                >
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="number"
                          min={0}
                          max={24}
                          value={editHours}
                          onChange={(event) =>
                            setEditHours(Math.max(0, Number(event.target.value)))
                          }
                          className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500/50"
                          aria-label="Edit hours"
                        />
                        <input
                          type="number"
                          min={0}
                          max={59}
                          value={editMinutes}
                          onChange={(event) =>
                            setEditMinutes(
                              Math.max(0, Math.min(59, Number(event.target.value))),
                            )
                          }
                          className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500/50"
                          aria-label="Edit minutes"
                        />
                      </div>
                      <input
                        value={editDescription}
                        onChange={(event) => setEditDescription(event.target.value)}
                        className="w-full rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs text-white outline-none focus:border-orange-500/50"
                        placeholder="Time entry note"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setEditBillable((value) => !value)}
                          className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${
                            editBillable
                              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                              : "border-white/10 bg-black/30 text-white/45"
                          }`}
                        >
                          {editBillable ? "Billable" : "Non-billable"}
                        </button>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={cancelEditEntry}
                            className="rounded-lg border border-white/10 px-2 py-1 text-[10px] text-white/50 hover:text-white"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() => void saveEditEntry(entry.id)}
                            disabled={mutating}
                            className="inline-flex items-center gap-1 rounded-lg bg-orange-500 px-2 py-1 text-[10px] font-bold text-black disabled:opacity-50"
                          >
                            <Save size={10} />
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-white/70 truncate">
                          {entry.description || "Timer session"}
                        </p>
                        <p className="text-[10px] text-white/35 mt-0.5">
                          {formatDateTime(entry.started_at)}
                          {entry.ended_at && ` -> ${formatDateTime(entry.ended_at)}`}
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
                          {entry.is_billable ? "billable" : entry.approval_status}
                        </p>
                        <div className="mt-1 flex justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => beginEditEntry(entry)}
                            className="rounded-md p-1 text-white/30 hover:bg-white/10 hover:text-white"
                            title="Edit time"
                          >
                            <Edit2 size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => void onDeleteEntry(entry.id)}
                            className="rounded-md p-1 text-white/30 hover:bg-red-500/10 hover:text-red-300"
                            title="Delete time"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
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
  const [startDate, setStartDate] = useState(
    card.start_date ? card.start_date.split("T")[0] : "",
  );
  const [cardMetadata, setCardMetadata] = useState<CardMetadata>(
    (card.metadata ?? {}) as CardMetadata,
  );
  const [newLabelName, setNewLabelName] = useState("");
  const [newLabelColor, setNewLabelColor] = useState("#f97316");
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldValue, setNewFieldValue] = useState("");
  const initialEstimate = secondsToHoursMinutes(card.estimated_seconds);
  const [estimateHours, setEstimateHours] = useState(initialEstimate.hours);
  const [estimateMinutes, setEstimateMinutes] = useState(initialEstimate.minutes);

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
  const [checklists, setChecklists] = useState<TaskChecklistWithItems[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
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
  const estimatedSeconds = estimateHours * 3600 + estimateMinutes * 60;
  const remainingEstimateSeconds = estimatedSeconds - totalTrackedSeconds;
  const estimateProgress = estimatedSeconds > 0
    ? Math.min(100, Math.round((totalTrackedSeconds / estimatedSeconds) * 100))
    : 0;
  const isOverEstimate = estimatedSeconds > 0 && remainingEstimateSeconds < 0;

  // ── Load time entries for this card ─────────────────────────────────────────
  const loadTaskTime = useCallback(async () => {
    if (!cardId || !organizationId) return null;
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
      const completedSeconds = entries.reduce(
        (sum, entry) => sum + Number(entry.duration_seconds ?? 0),
        0,
      );

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

      return completedSeconds;
    } catch (e) {
      console.error("loadTaskTime error:", e);
      return null;
    } finally {
      setTaskTimeLoading(false);
    }
  }, [cardId, organizationId]);

  const refreshTaskTimeAndCache = useCallback(async () => {
    const completedSeconds = await loadTaskTime();
    if (completedSeconds !== null) {
      onUpdate?.({
        tracked_seconds_cache: completedSeconds,
      } as Partial<TaskItem>);
    }
  }, [loadTaskTime, onUpdate]);

  // Load on open
  useEffect(() => {
    if (isOpen) loadTaskTime();
  }, [isOpen, loadTaskTime]);

  useEffect(() => {
    if (!isOpen) return;
    const nextEstimate = secondsToHoursMinutes(card.estimated_seconds);
    setEstimateHours(nextEstimate.hours);
    setEstimateMinutes(nextEstimate.minutes);
  }, [card.estimated_seconds, isOpen]);

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
          void refreshTaskTimeAndCache();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, organizationId, cardId, refreshTaskTimeAndCache]);

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
      await refreshTaskTimeAndCache();
    } catch (e) {
      console.error("Timer toggle error:", e);
    } finally {
      setTaskTimeMutating(false);
    }
  };

  const handleManualTimeLog = async (input: {
    hours: number;
    minutes: number;
    description: string;
    isBillable: boolean;
  }) => {
    if (!organizationId || !currentUserId || taskTimeMutating) return;
    const durationSeconds = (input.hours * 60 + input.minutes) * 60;
    if (durationSeconds <= 0) return;

    setTaskTimeMutating(true);
    try {
      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);
      await createManualTimeEntry({
        organizationId,
        userId: currentUserId,
        taskId: cardId,
        description:
          input.description.trim() ||
          `Manual time entry - ${input.hours}h ${input.minutes}m`,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        isBillable: input.isBillable,
        source: "card_modal_manual",
        metadata: {
          origin: "board_card_detail_modal",
          reason: "forgot_to_track",
        },
      });
      await refreshTaskTimeAndCache();
    } catch (e) {
      console.error("Manual time log error:", e);
    } finally {
      setTaskTimeMutating(false);
    }
  };

  const handleUpdateTimeEntry = async (
    entryId: string,
    input: {
      hours: number;
      minutes: number;
      description: string;
      isBillable: boolean;
    },
  ) => {
    if (!organizationId || taskTimeMutating) return;
    const totalMinutes = input.hours * 60 + input.minutes;
    if (totalMinutes <= 0) return;

    setTaskTimeMutating(true);
    try {
      const { startedAt, endedAt } = minutesToStartedEnded(totalMinutes);
      await updateTimeEntry({
        entryId,
        payload: {
          started_at: startedAt,
          ended_at: endedAt,
          description: input.description.trim() || "Manual time entry",
          is_billable: input.isBillable,
        },
      });
      await refreshTaskTimeAndCache();
    } catch (e) {
      console.error("Update time entry error:", e);
    } finally {
      setTaskTimeMutating(false);
    }
  };

  const handleDeleteTimeEntry = async (entryId: string) => {
    if (taskTimeMutating) return;
    setTaskTimeMutating(true);
    try {
      await deleteTimeEntry(entryId);
      await refreshTaskTimeAndCache();
    } catch (e) {
      console.error("Delete time entry error:", e);
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

  // ── Checklist ────────────────────────────────────────────────────────────────
  const loadChecklist = useCallback(async () => {
    if (!cardId) return;
    setLoadingChecklist(true);
    try {
      const data = await getTaskChecklists(cardId);
      setChecklists(data);
    } catch (e) {
      console.error("loadChecklist error:", e);
    } finally {
      setLoadingChecklist(false);
    }
  }, [cardId]);

  useEffect(() => {
    if (!isOpen || activeTab !== "checklist") return;
    void loadChecklist();
  }, [activeTab, isOpen, loadChecklist]);

  useEffect(() => {
    if (!isOpen || !organizationId || !cardId) return;

    const checklistChannel = supabase
      .channel(`card-checklists-${cardId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_checklists",
          filter: `task_id=eq.${cardId}`,
        },
        () => void loadChecklist(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_checklist_items",
          filter: `task_id=eq.${cardId}`,
        },
        () => void loadChecklist(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(checklistChannel);
    };
  }, [cardId, isOpen, loadChecklist, organizationId]);

  const flatChecklistItems = useMemo<FlatChecklistItem[]>(
    () =>
      checklists.flatMap((checklist) =>
        checklist.items.map((item) => ({
          ...item,
          checklistTitle: checklist.title,
        })),
      ),
    [checklists],
  );

  const addCheckItem = async () => {
    const content = newCheckItem.trim();
    if (!content || savingChecklist) return;

    setSavingChecklist(true);
    try {
      let targetChecklist = checklists[0];
      if (!targetChecklist) {
        targetChecklist = {
          ...(await createTaskChecklist({
            taskId: cardId,
            organizationId,
            title: "Checklist",
            createdBy: currentUserId,
            position: 0,
          })),
          items: [],
        };
      }

      await createTaskChecklistItem({
        checklistId: targetChecklist.id,
        taskId: cardId,
        organizationId,
        content,
        createdBy: currentUserId,
        position: targetChecklist.items.length,
      });

      setNewCheckItem("");
      await loadChecklist();
    } catch (e) {
      console.error("addCheckItem error:", e);
    } finally {
      setSavingChecklist(false);
    }
  };

  const handleToggleCheckItem = async (item: FlatChecklistItem) => {
    if (savingChecklist) return;
    setSavingChecklist(true);
    try {
      await toggleTaskChecklistItem({
        itemId: item.id,
        checked: !item.is_completed,
        userId: currentUserId,
      });
      await loadChecklist();
    } catch (e) {
      console.error("toggleChecklistItem error:", e);
    } finally {
      setSavingChecklist(false);
    }
  };

  const handleDeleteCheckItem = async (itemId: string) => {
    if (savingChecklist) return;
    setSavingChecklist(true);
    try {
      await deleteTaskChecklistItem(itemId);
      await loadChecklist();
    } catch (e) {
      console.error("deleteChecklistItem error:", e);
    } finally {
      setSavingChecklist(false);
    }
  };

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

  const handleStartDateChange = (val: string) => {
    setStartDate(val);
    onUpdate?.({ start_date: val || null });
  };

  const handleDueCompleteChange = (checked: boolean) => {
    const completedAt = checked ? new Date().toISOString() : null;
    onUpdate?.({
      completed_at: completedAt,
      status: checked ? "done" : status,
    } as Partial<TaskItem>);
    if (checked) setStatus("done");
  };

  const saveEstimate = (nextSeconds = estimatedSeconds) => {
    const safeSeconds = Math.max(0, Math.round(nextSeconds));
    const next = secondsToHoursMinutes(safeSeconds);
    setEstimateHours(next.hours);
    setEstimateMinutes(next.minutes);
    onUpdate?.({ estimated_seconds: safeSeconds } as Partial<TaskItem>);
  };

  const adjustEstimate = (deltaMinutes: number) => {
    saveEstimate(estimatedSeconds + deltaMinutes * 60);
  };

  const persistMetadata = (next: CardMetadata) => {
    setCardMetadata(next);
    onUpdate?.({ metadata: next } as Partial<TaskItem>);
  };

  const handleAddLabel = () => {
    const name = newLabelName.trim();
    if (!name) return;
    const next = {
      ...cardMetadata,
      labels: [
        ...(cardMetadata.labels ?? []),
        { id: crypto.randomUUID(), name, color: newLabelColor },
      ],
    };
    persistMetadata(next);
    setNewLabelName("");
  };

  const handleRemoveLabel = (labelId: string) => {
    persistMetadata({
      ...cardMetadata,
      labels: (cardMetadata.labels ?? []).filter((label) => label.id !== labelId),
    });
  };

  const handleCoverChange = (color: string | null) => {
    persistMetadata({
      ...cardMetadata,
      coverColor: color,
    });
  };

  const handleToggleWatch = () => {
    const watchedBy = cardMetadata.watchedBy ?? [];
    const nextWatchedBy = watchedBy.includes(currentUserId)
      ? watchedBy.filter((id) => id !== currentUserId)
      : [...watchedBy, currentUserId];
    persistMetadata({
      ...cardMetadata,
      watchedBy: nextWatchedBy,
    });
  };

  const handleAddCustomField = () => {
    const name = newFieldName.trim();
    if (!name) return;
    persistMetadata({
      ...cardMetadata,
      customFields: [
        ...(cardMetadata.customFields ?? []),
        {
          id: crypto.randomUUID(),
          name,
          value: newFieldValue.trim(),
        },
      ],
    });
    setNewFieldName("");
    setNewFieldValue("");
  };

  const handleRemoveCustomField = (fieldId: string) => {
    persistMetadata({
      ...cardMetadata,
      customFields: (cardMetadata.customFields ?? []).filter(
        (field) => field.id !== fieldId,
      ),
    });
  };

  const handleCopyCardLink = async () => {
    const href = `${window.location.origin}${window.location.pathname}?card=${cardId}`;
    await navigator.clipboard?.writeText(href);
  };

  const handleArchiveCard = () => {
    setStatus("cancelled");
    onUpdate?.({
      status: "cancelled",
      archived_at: new Date().toISOString(),
      archived_by: currentUserId,
    } as Partial<TaskItem>);
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

  const checklistDone = flatChecklistItems.filter((i) => i.is_completed).length;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm p-4 pt-12">
      <div className="relative w-full max-w-2xl rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl">
        {/* Orange top bar */}
        <div
          className="h-2 w-full rounded-t-2xl"
          style={{
            background:
              cardMetadata.coverColor ??
              "linear-gradient(to right, #f97316, #fb923c)",
          }}
        />

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
              Created by{" "}
              <span className="text-white/55">
                {card.created_by_full_name ||
                  card.created_by_email ||
                  card.created_by ||
                  "Unknown"}
              </span>{" "}
              on{" "}
              {new Date(card.created_at).toLocaleDateString("en-ZW", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}{" "}
              at{" "}
              {new Date(card.created_at).toLocaleTimeString("en-ZW", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            {(cardMetadata.labels ?? []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {(cardMetadata.labels ?? []).map((label) => (
                  <span
                    key={label.id}
                    className="rounded-md px-2 py-1 text-[10px] font-bold text-white"
                    style={{ backgroundColor: label.color }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            )}
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

              {/* Cover + Labels */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 flex items-center gap-1">
                    <Palette size={11} /> Cover
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {["#f97316", "#22c55e", "#3b82f6", "#a855f7", "#ef4444", "#0f172a"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleCoverChange(color)}
                        className="h-8 w-8 rounded-lg border border-white/15 transition hover:scale-105"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => handleCoverChange(null)}
                      className="rounded-lg border border-white/10 px-3 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2 flex items-center gap-1">
                    <Tag size={11} /> Labels
                  </p>
                  <div className="space-y-2">
                    <div className="flex flex-wrap gap-1.5">
                      {(cardMetadata.labels ?? []).length === 0 ? (
                        <span className="text-xs text-white/30">No labels</span>
                      ) : (
                        (cardMetadata.labels ?? []).map((label) => (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => handleRemoveLabel(label.id)}
                            className="rounded-md px-2 py-1 text-[10px] font-bold text-white"
                            style={{ backgroundColor: label.color }}
                            title="Click to remove"
                          >
                            {label.name}
                          </button>
                        ))
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={newLabelName}
                        onChange={(event) => setNewLabelName(event.target.value)}
                        placeholder="Label name"
                        className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-orange-500/50"
                      />
                      <input
                        type="color"
                        value={newLabelColor}
                        onChange={(event) => setNewLabelColor(event.target.value)}
                        className="h-9 w-10 rounded-lg border border-white/10 bg-white/5"
                      />
                      <button
                        type="button"
                        onClick={handleAddLabel}
                        disabled={!newLabelName.trim()}
                        className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Due date */}
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 flex items-center gap-1">
                    <CalendarClock size={11} /> Start Date
                  </p>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => handleStartDateChange(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
                  />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1.5 flex items-center gap-1">
                    <CalendarClock size={11} /> Due Date
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => handleDueDateChange(e.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
                    />
                    <button
                      type="button"
                      onClick={() => handleDueCompleteChange(!card.completed_at)}
                      className={`rounded-xl border px-3 py-2 text-xs font-semibold ${
                        card.completed_at
                          ? "border-green-500/25 bg-green-500/10 text-green-300"
                          : "border-white/10 bg-white/5 text-white/45"
                      }`}
                    >
                      {card.completed_at ? "Done" : "Mark done"}
                    </button>
                  </div>
                </div>
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

              {/* Everhour-style estimate */}
              <div className="rounded-xl border border-white/10 bg-black/35 p-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-white/40">
                      <Clock3 size={11} /> Estimate
                    </p>
                    <p className="mt-1 text-xs text-white/35">
                      Tracked {formatDurationShort(totalTrackedSeconds)} of{" "}
                      {estimatedSeconds > 0
                        ? formatDurationShort(estimatedSeconds)
                        : "no estimate"}
                    </p>
                  </div>
                  <div
                    className={`rounded-xl border px-3 py-2 text-right ${
                      isOverEstimate
                        ? "border-red-500/20 bg-red-500/10"
                        : "border-white/10 bg-white/5"
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wider text-white/35">
                      {isOverEstimate ? "Over" : "Remaining"}
                    </p>
                    <p
                      className={`text-sm font-bold ${
                        isOverEstimate ? "text-red-300" : "text-emerald-300"
                      }`}
                    >
                      {formatDurationShort(Math.abs(remainingEstimateSeconds))}
                    </p>
                  </div>
                </div>

                <div className="mb-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOverEstimate ? "bg-red-500" : "bg-orange-500"
                    }`}
                    style={{ width: `${estimatedSeconds > 0 ? estimateProgress : 0}%` }}
                  />
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]">
                  <input
                    type="number"
                    min={0}
                    value={estimateHours}
                    onChange={(event) =>
                      setEstimateHours(Math.max(0, Number(event.target.value)))
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
                    aria-label="Estimated hours"
                  />
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={estimateMinutes}
                    onChange={(event) =>
                      setEstimateMinutes(
                        Math.max(0, Math.min(59, Number(event.target.value))),
                      )
                    }
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-orange-500/50"
                    aria-label="Estimated minutes"
                  />
                  <button
                    type="button"
                    onClick={() => adjustEstimate(-30)}
                    disabled={estimatedSeconds <= 0}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10 disabled:opacity-40"
                  >
                    -30m
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustEstimate(30)}
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10"
                  >
                    +30m
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEstimate()}
                    className="rounded-xl bg-orange-500 px-4 py-2 text-xs font-bold text-black hover:bg-orange-400"
                  >
                    Save
                  </button>
                </div>
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
                onManualLog={handleManualTimeLog}
                onUpdateEntry={handleUpdateTimeEntry}
                onDeleteEntry={handleDeleteTimeEntry}
              />

              {/* Custom fields + actions */}
              <div className="grid gap-4 lg:grid-cols-[1fr_180px]">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                    Custom Fields
                  </p>
                  <div className="space-y-2">
                    {(cardMetadata.customFields ?? []).map((field) => (
                      <div
                        key={field.id}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-white/70">
                            {field.name}
                          </p>
                          <p className="truncate text-xs text-white/40">
                            {field.value || "Empty"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomField(field.id)}
                          className="rounded-lg p-1 text-white/25 hover:bg-red-500/10 hover:text-red-300"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                      <input
                        value={newFieldName}
                        onChange={(event) => setNewFieldName(event.target.value)}
                        placeholder="Field"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-orange-500/50"
                      />
                      <input
                        value={newFieldValue}
                        onChange={(event) => setNewFieldValue(event.target.value)}
                        placeholder="Value"
                        className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none focus:border-orange-500/50"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomField}
                        disabled={!newFieldName.trim()}
                        className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-black disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">
                    Actions
                  </p>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={handleToggleWatch}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <Circle size={10} />
                      {(cardMetadata.watchedBy ?? []).includes(currentUserId)
                        ? "Watching"
                        : "Watch"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopyCardLink()}
                      className="flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/60 hover:bg-white/10 hover:text-white"
                    >
                      <Link2 size={13} />
                      Copy link
                    </button>
                    <button
                      type="button"
                      onClick={handleArchiveCard}
                      className="flex w-full items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                    >
                      <Archive size={13} />
                      Archive
                    </button>
                  </div>
                </div>
              </div>

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
              {flatChecklistItems.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-white/50">
                      {checklistDone}/{flatChecklistItems.length} completed
                    </span>
                    <span className="text-xs font-semibold text-white">
                      {Math.round((checklistDone / flatChecklistItems.length) * 100)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-orange-500 transition-all"
                      style={{
                        width: `${(checklistDone / flatChecklistItems.length) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                {loadingChecklist ? (
                  <div className="flex items-center justify-center rounded-xl border border-white/10 bg-white/3 px-3 py-8 text-white/40">
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Loading checklist...
                  </div>
                ) : flatChecklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/3 px-3 py-2.5 group"
                  >
                    <input
                      type="checkbox"
                      checked={item.is_completed}
                      disabled={savingChecklist}
                      onChange={() => void handleToggleCheckItem(item)}
                      className="h-4 w-4 rounded cursor-pointer accent-orange-500"
                    />
                    <span
                      className={`flex-1 text-sm ${item.is_completed ? "line-through text-white/30" : "text-white/80"}`}
                    >
                      {item.content}
                    </span>
                    <button
                      onClick={() => void handleDeleteCheckItem(item.id)}
                      disabled={savingChecklist}
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
                    if (e.key === "Enter") void addCheckItem();
                  }}
                  placeholder="Add a checklist item…"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-500/50"
                />
                <button
                  onClick={() => void addCheckItem()}
                  disabled={!newCheckItem.trim() || savingChecklist}
                  className="rounded-xl bg-white/10 px-3 py-2.5 text-white/60 hover:bg-orange-500 hover:text-white disabled:opacity-30 transition"
                >
                  {savingChecklist ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Plus size={16} />
                  )}
                </button>
              </div>
              {!loadingChecklist && flatChecklistItems.length === 0 && (
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
