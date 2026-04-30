import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Clock,
  DollarSign,
  Edit3,
  Eye,
  EyeOff,
  Layers,
  Loader2,
  Plus,
  Search,
  TrendingUp,
  Users,
  X,
  Check,
  AlertTriangle,
  LayoutGrid,
  Upload,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getBoards } from "../../boards/services/boardService";
import { useTeamTimesheetsRealtime } from "../../../lib/hooks/useTeamTimesheetsRealtime";
import { supabase } from "../../../lib/supabase/client";
import type { Board } from "../../../types/board";
import type { AdminTimeEntryRow } from "../../../lib/supabase/queries/adminTime";
import {
  importEverhourJson,
  importTrelloBoardJson,
  type EverhourImportResult,
  type TrelloBoardImportResult,
} from "../services/everhourImportService";
import {
  getZimbabweDateKey,
  makeZimbabweLocalIso,
} from "../../../lib/utils/zimbabweCalendar";



type BillingType = "fixed" | "hourly" | "non_billable";

interface BoardBillingConfig {
  boardId: string;
  budgetHours: number | null;
  billingType: BillingType;
  isVisible: boolean;
}

interface BoardWithTime extends Board {
  trackedSeconds: number;
  billableSeconds: number;
  memberIds: Set<string>;
  memberAvatars: Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>;
  billing: BoardBillingConfig;
}

interface GroupedBoards {
  groupName: string;
  boards: BoardWithTime[];
  totalTracked: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

function formatHoursShort(seconds: number): string {
  const h = seconds / 3600;
  return `${h.toFixed(0)}h`;
}

function getInitials(
  name: string | null | undefined,
  email?: string | null,
): string {
  const src = name?.trim() || email?.trim() || "?";
  const parts = src.split(" ").filter(Boolean);
  return parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : src.slice(0, 2).toUpperCase();
}

// Deterministic color per user
const AVATAR_COLORS = [
  "bg-orange-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-pink-500",
  "bg-cyan-500",
  "bg-lime-500",
];
function avatarColor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++)
    h = userId.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

const BILLING_LABELS: Record<BillingType, string> = {
  fixed: "Fixed",
  hourly: "Hourly",
  non_billable: "Non-billable",
};

const BILLING_COLORS: Record<BillingType, string> = {
  fixed: "text-green-400 border-green-500/25 bg-green-500/10",
  hourly: "text-blue-400 border-blue-500/25 bg-blue-500/10",
  non_billable: "text-white/30 border-white/10 bg-white/5",
};

// ── Local storage helpers for billing config (no DB migration needed) ──────────

const STORAGE_KEY = "everhour_board_billing_v1";

function loadBillingConfig(): Record<string, BoardBillingConfig> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBillingConfig(config: Record<string, BoardBillingConfig>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    /* ignore */
  }
}

// ── Budget Edit Inline ─────────────────────────────────────────────────────────

function BudgetEditor({
  current,
  onSave,
  onCancel,
}: {
  current: number | null;
  onSave: (hours: number | null) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(current != null ? String(current) : "");

  return (
    <div
      className="flex items-center gap-1"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="number"
        min={0}
        step={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const n = parseFloat(value);
            onSave(isNaN(n) || n <= 0 ? null : n);
          }
          if (e.key === "Escape") onCancel();
        }}
        autoFocus
        placeholder="Hours"
        className="w-20 rounded-lg border border-orange-500/40 bg-black px-2 py-1 text-xs text-white outline-none focus:border-orange-500"
      />
      <button
        type="button"
        onClick={() => {
          const n = parseFloat(value);
          onSave(isNaN(n) || n <= 0 ? null : n);
        }}
        className="rounded-lg bg-orange-500 p-1 text-white hover:bg-orange-400"
      >
        <Check size={11} />
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg bg-white/10 p-1 text-white/50 hover:text-white"
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ── Billing Type Selector ──────────────────────────────────────────────────────

function BillingSelector({
  current,
  onChange,
}: {
  current: BillingType;
  onChange: (type: BillingType) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition hover:opacity-80 ${BILLING_COLORS[current]}`}
      >
        <DollarSign size={10} />
        {BILLING_LABELS[current]}
        <ChevronDown size={10} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 w-36 rounded-xl border border-white/10 bg-[#111] shadow-2xl shadow-black/60">
          {(["fixed", "hourly", "non_billable"] as BillingType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs transition hover:bg-white/5 ${
                current === t ? "text-white font-semibold" : "text-white/60"
              }`}
            >
              <DollarSign size={10} />
              {BILLING_LABELS[t]}
              {current === t && (
                <Check size={10} className="ml-auto text-orange-400" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Board Row ──────────────────────────────────────────────────────────────────

function BoardRow({
  board,
  onUpdateBilling,
}: {
  board: BoardWithTime;
  onUpdateBilling: (
    boardId: string,
    patch: Partial<BoardBillingConfig>,
  ) => void;
}) {
  const [editingBudget, setEditingBudget] = useState(false);
  const { billing, trackedSeconds, billableSeconds, memberAvatars } = board;

  const budgetSeconds =
    billing.budgetHours != null ? billing.budgetHours * 3600 : null;
  const pct =
    budgetSeconds != null && budgetSeconds > 0
      ? Math.min((trackedSeconds / budgetSeconds) * 100, 110)
      : null;
  const isOverBudget = pct != null && pct > 100;
  const displayedMembers = memberAvatars.slice(0, 4);
  const extraCount = memberAvatars.length - displayedMembers.length;

  return (
    <div
      className={`group grid items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/3 ${
        !billing.isVisible ? "opacity-40" : ""
      }`}
      style={{ gridTemplateColumns: "1fr 160px 240px 120px 100px" }}
    >
      {/* Name */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/20">
          <LayoutGrid size={12} className="text-blue-400" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {board.name}
          </p>
          <p className="text-[10px] text-white/30">
            {board.industry ?? "Stand Alone"}
          </p>
        </div>
      </div>

      {/* Member avatars */}
      <div className="flex items-center gap-1.5">
        <div className="flex -space-x-1.5">
          {displayedMembers.map((m) => (
            <div
              key={m.id}
              title={m.name ?? m.email ?? m.id}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-[#080808] ${avatarColor(m.id)}`}
            >
              {getInitials(m.name, m.email)}
            </div>
          ))}
          {extraCount > 0 && (
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-white/60 ring-2 ring-[#080808]">
              +{extraCount}
            </div>
          )}
        </div>
        {memberAvatars.length > 0 && (
          <span className="text-xs text-white/30">{memberAvatars.length}</span>
        )}
      </div>

      {/* Time progress */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs">
            <Clock size={11} className="text-white/30" />
            <span
              className={
                isOverBudget ? "text-red-400 font-semibold" : "text-white/70"
              }
            >
              {formatHours(trackedSeconds)}
            </span>
            {budgetSeconds != null && (
              <span className="text-white/30">
                of {formatHoursShort(budgetSeconds)} ({Math.round(pct!)}%)
              </span>
            )}
          </div>

          {/* Budget edit */}
          {editingBudget ? (
            <BudgetEditor
              current={billing.budgetHours}
              onSave={(h) => {
                onUpdateBilling(board.id, { budgetHours: h });
                setEditingBudget(false);
              }}
              onCancel={() => setEditingBudget(false)}
            />
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setEditingBudget(true);
              }}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] text-white/25 opacity-0 transition hover:bg-white/8 hover:text-white/60 group-hover:opacity-100"
            >
              <Edit3 size={9} />
              {billing.budgetHours != null
                ? `${billing.budgetHours}h budget`
                : "Set budget"}
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          {pct != null ? (
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverBudget
                  ? "bg-red-500"
                  : pct > 80
                    ? "bg-amber-500"
                    : "bg-green-500"
              }`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          ) : (
            <div
              className="h-full rounded-full bg-orange-500/40"
              style={{ width: trackedSeconds > 0 ? "100%" : "0%" }}
            />
          )}
        </div>
      </div>

      {/* Visibility toggle */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onUpdateBilling(board.id, { isVisible: !billing.isVisible });
          }}
          className="rounded-lg p-1.5 text-white/25 transition hover:bg-white/8 hover:text-white/70"
          title={billing.isVisible ? "Hide from reports" : "Show in reports"}
        >
          {billing.isVisible ? <Eye size={14} /> : <EyeOff size={14} />}
        </button>
      </div>

      {/* Billing type */}
      <div className="flex justify-end">
        <BillingSelector
          current={billing.billingType}
          onChange={(t) => onUpdateBilling(board.id, { billingType: t })}
        />
      </div>
    </div>
  );
}

// ── Group Row ──────────────────────────────────────────────────────────────────

function GroupSection({
  group,
  onUpdateBilling,
}: {
  group: GroupedBoards;
  onUpdateBilling: (
    boardId: string,
    patch: Partial<BoardBillingConfig>,
  ) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#080808]">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setCollapsed((p) => !p)}
        className="flex w-full items-center gap-3 border-b border-white/8 px-4 py-3 text-left transition hover:bg-white/3"
      >
        {collapsed ? (
          <ChevronRight size={14} className="text-white/40 shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-white/40 shrink-0" />
        )}
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-white/8">
          <Users size={12} className="text-white/50" />
        </div>
        <span className="text-sm font-semibold text-white">
          {group.groupName}
        </span>
        <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-white/40">
          {group.boards.length}
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-white/30">
          <Clock size={11} />
          {formatHours(group.totalTracked)}
        </div>
      </button>

      {/* Column headers */}
      {!collapsed && (
        <>
          <div
            className="grid items-center gap-3 border-b border-white/5 px-4 py-2 text-[10px] uppercase tracking-widest text-white/20"
            style={{ gridTemplateColumns: "1fr 160px 240px 120px 100px" }}
          >
            <span>Board / Client</span>
            <span>Members</span>
            <span>Time tracked</span>
            <span className="text-center">Visible</span>
            <span className="text-right">Billing</span>
          </div>

          {group.boards.map((board) => (
            <BoardRow
              key={board.id}
              board={board}
              onUpdateBilling={onUpdateBilling}
            />
          ))}
        </>
      )}
    </div>
  );
}

// ── Add Hours Modal ────────────────────────────────────────────────────────────

function AddHoursModal({
  boards,
  organizationId,
  onClose,
  onAdded,
}: {
  boards: BoardWithTime[];
  organizationId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [boardId, setBoardId] = useState(boards[0]?.id ?? "");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("0");
  const [isBillable, setIsBillable] = useState(true);
  const [note, setNote] = useState("");
  const [date, setDate] = useState(getZimbabweDateKey(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const auth = useAuth();
  const userId = auth?.user?.id ?? null;

  const handleSave = async () => {
    const h = parseFloat(hours) || 0;
    const m = parseFloat(minutes) || 0;
    const totalSeconds = Math.round(h * 3600 + m * 60);

    if (!boardId) return setError("Select a board.");
    if (totalSeconds <= 0) return setError("Enter at least 1 minute.");
    if (!userId) return setError("Not authenticated.");

    setSaving(true);
    setError("");

    try {
      const startedAt = makeZimbabweLocalIso(date, "09:00:00");
      const endedAt = new Date(
        new Date(startedAt).getTime() + totalSeconds * 1000,
      ).toISOString();

      const { error: dbError } = await supabase.from("time_entries").insert({
        organization_id: organizationId,
        user_id: userId,
        client_id: boardId,
        duration_seconds: totalSeconds,
        started_at: startedAt,
        ended_at: endedAt,
        description: note.trim() || null,
        is_billable: isBillable,
        is_running: false,
      });

      if (dbError) throw dbError;
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add hours.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0f0f0f] shadow-2xl">
        <div className="h-0.5 w-full rounded-t-2xl bg-linear-to-r from-orange-500 to-amber-400" />

        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/15">
              <Clock size={15} className="text-orange-400" />
            </div>
            <h2 className="text-sm font-bold text-white">Add Hours to Board</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/30 hover:bg-white/8 hover:text-white transition"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertTriangle size={12} />
              {error}
            </div>
          )}

          {/* Board select */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-white/35">
              Board / Client
            </label>
            <select
              value={boardId}
              onChange={(e) => setBoardId(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50 transition"
            >
              {boards.map((b) => (
                <option key={b.id} value={b.id} className="bg-[#111]">
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-white/35">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50 transition scheme-dark"
            />
          </div>

          {/* Hours + Minutes */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-white/35">
                Hours
              </label>
              <input
                type="number"
                min={0}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50 transition"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-white/35">
                Minutes
              </label>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-orange-500/50 transition"
              />
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="mb-1.5 block text-[10px] uppercase tracking-widest text-white/35">
              Note (optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was worked on?"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-white/20 outline-none focus:border-orange-500/50 transition"
            />
          </div>

          {/* Billable toggle */}
          <button
            type="button"
            onClick={() => setIsBillable((p) => !p)}
            className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 transition ${
              isBillable
                ? "border-green-500/25 bg-green-500/8 text-green-400"
                : "border-white/8 bg-white/4 text-white/40"
            }`}
          >
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign size={14} />
              {isBillable ? "Billable" : "Non-billable"}
            </div>
            <div
              className={`flex h-5 w-9 items-center rounded-full px-0.5 transition-colors ${
                isBillable ? "bg-green-500" : "bg-white/15"
              }`}
            >
              <div
                className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  isBillable ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
          </button>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 hover:bg-white/5 transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 py-2.5 text-sm font-semibold text-white hover:bg-orange-400 disabled:opacity-50 transition"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Check size={14} />
              )}
              Add Hours
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function EverhourAdminPage() {
  const auth = useAuth();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? "";

  const [boards, setBoards] = useState<Board[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(true);
  const [billingConfig, setBillingConfig] = useState<
    Record<string, BoardBillingConfig>
  >({});
  const [membersByBoard, setMembersByBoard] = useState<
    Record<
      string,
      Array<{ id: string; name: string | null; email: string | null }>
    >
  >({});
  const [searchValue, setSearchValue] = useState("");
  const [showAddHours, setShowAddHours] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingTrello, setImportingTrello] = useState(false);
  const [importResult, setImportResult] = useState<EverhourImportResult | null>(null);
  const [trelloImportResult, setTrelloImportResult] =
    useState<TrelloBoardImportResult | null>(null);
  const [importError, setImportError] = useState("");

  const {
    entries,
    loading: loadingEntries,
    refetch,
  } = useTeamTimesheetsRealtime({
    organizationId,
  });


  useEffect(() => {
    if (!organizationId) return;
    setLoadingBoards(true);
    getBoards(organizationId)
      .then(setBoards)
      .catch(console.error)
      .finally(() => setLoadingBoards(false));
  }, [organizationId]);

 
  useEffect(() => {
    setBillingConfig(loadBillingConfig());
  }, []);

  useEffect(() => {
    if (!organizationId || boards.length === 0) return;

    const boardIds = boards.map((b) => b.id);

    (async () => {
      try {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, client_id")
        .eq("organization_id", organizationId)
        .in("client_id", boardIds);

      if (!tasks || tasks.length === 0) return;

      const taskIds = tasks.map((t) => t.id as string);
      const taskToBoard = new Map(
        tasks.map((t) => [t.id as string, t.client_id as string]),
      );

      const { data: assignees } = await supabase
        .from("task_assignees")
        .select("task_id, user_id, profiles:user_id(id, full_name, email)")
        .in("task_id", taskIds);

      const byBoard: Record<
        string,
        Array<{ id: string; name: string | null; email: string | null }>
      > = {};

      const seen = new Map<string, Set<string>>();

      for (const row of assignees ?? []) {
        const boardId = taskToBoard.get(row.task_id);
        if (!boardId) continue;
        if (!seen.has(boardId)) seen.set(boardId, new Set());
        const profile = (row as any).profiles as {
          id: string;
          full_name: string | null;
          email: string | null;
        } | null;
        if (profile && !seen.get(boardId)!.has(profile.id)) {
          seen.get(boardId)!.add(profile.id);
          if (!byBoard[boardId]) byBoard[boardId] = [];
          byBoard[boardId].push({
            id: profile.id,
            name: profile.full_name,
            email: profile.email,
          });
        }
      }

      setMembersByBoard(byBoard);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [organizationId, boards]);

  const timeTotalsByBoard = useMemo(() => {
    const map = new Map<string, { tracked: number; billable: number }>();

    for (const entry of entries) {
      const clientId = (entry as any).client_id as string | null;
      const boardName = entry.board_name;

      let boardId: string | null = clientId ?? null;

      if (!boardId && boardName) {
        const matched = boards.find(
          (b) => b.name.toLowerCase() === boardName.toLowerCase(),
        );
        boardId = matched?.id ?? null;
      }

      if (!boardId) continue;

      const cur = map.get(boardId) ?? { tracked: 0, billable: 0 };
      const dur = Number(entry.duration_seconds ?? 0);
      cur.tracked += dur;
      if (entry.is_billable) cur.billable += dur;
      map.set(boardId, cur);
    }

    return map;
  }, [entries, boards]);

  const boardsWithTime = useMemo((): BoardWithTime[] => {
    return boards.map((board) => {
      const times = timeTotalsByBoard.get(board.id) ?? {
        tracked: 0,
        billable: 0,
      };
      const memberAvatars = membersByBoard[board.id] ?? [];

      const defaultBilling: BoardBillingConfig = {
        boardId: board.id,
        budgetHours: null,
        billingType: "hourly",
        isVisible: true,
      };

      return {
        ...board,
        trackedSeconds: times.tracked,
        billableSeconds: times.billable,
        memberIds: new Set(memberAvatars.map((m) => m.id)),
        memberAvatars,
        billing: billingConfig[board.id] ?? defaultBilling,
      };
    });
  }, [boards, timeTotalsByBoard, membersByBoard, billingConfig]);

  const groups = useMemo((): GroupedBoards[] => {
    const q = searchValue.trim().toLowerCase();
    const filtered = q
      ? boardsWithTime.filter(
          (b) =>
            b.name.toLowerCase().includes(q) ||
            (b.industry ?? "").toLowerCase().includes(q),
        )
      : boardsWithTime;

    const groupMap = new Map<string, BoardWithTime[]>();
    for (const board of filtered) {
      const key = board.industry?.trim() || "Stand Alone";
      const arr = groupMap.get(key) ?? [];
      arr.push(board);
      groupMap.set(key, arr);
    }

    return Array.from(groupMap.entries())
      .map(([groupName, gBoards]) => ({
        groupName,
        boards: gBoards.sort((a, b) => a.name.localeCompare(b.name)),
        totalTracked: gBoards.reduce((s, b) => s + b.trackedSeconds, 0),
      }))
      .sort((a, b) => a.groupName.localeCompare(b.groupName));
  }, [boardsWithTime, searchValue]);


  const summary = useMemo(() => {
    const totalTracked = boardsWithTime.reduce(
      (s, b) => s + b.trackedSeconds,
      0,
    );
    const totalBillable = boardsWithTime.reduce(
      (s, b) => s + b.billableSeconds,
      0,
    );
    const overBudget = boardsWithTime.filter((b) => {
      if (!b.billing.budgetHours) return false;
      return b.trackedSeconds > b.billing.budgetHours * 3600;
    }).length;
    return {
      totalTracked,
      totalBillable,
      overBudget,
      boardCount: boards.length,
    };
  }, [boardsWithTime, boards.length]);

  const handleUpdateBilling = useCallback(
    (boardId: string, patch: Partial<BoardBillingConfig>) => {
      setBillingConfig((prev) => {
        const existing: BoardBillingConfig = prev[boardId] ?? {
          boardId,
          budgetHours: null,
          billingType: "hourly",
          isVisible: true,
        };
        const updated = { ...existing, ...patch };
        const next = { ...prev, [boardId]: updated };
        saveBillingConfig(next);
        return next;
      });
    },
    [],
  );

  const handleImportJson = useCallback(
    async (file: File | null) => {
      if (!file || !organizationId || !auth?.user?.id) return;

      setImporting(true);
      setImportError("");
      setImportResult(null);
      setTrelloImportResult(null);

      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);
        const result = await importEverhourJson({
          organizationId,
          importedBy: auth.user.id,
          json: parsed,
          boards,
        });
        setImportResult(result);
        await Promise.all([refetch(), getBoards(organizationId).then(setBoards)]);
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : "Failed to import Everhour JSON.",
        );
      } finally {
        setImporting(false);
      }
    },
    [auth?.user?.id, boards, organizationId, refetch],
  );

  const handleImportTrelloJson = useCallback(
    async (file: File | null) => {
      if (!file || !organizationId || !auth?.user?.id) return;

      setImportingTrello(true);
      setImportError("");
      setImportResult(null);
      setTrelloImportResult(null);

      try {
        const raw = await file.text();
        const parsed = JSON.parse(raw);
        const result = await importTrelloBoardJson({
          organizationId,
          importedBy: auth.user.id,
          json: parsed,
          boards,
          fileName: file.name,
        });
        setTrelloImportResult(result);
        await Promise.all([refetch(), getBoards(organizationId).then(setBoards)]);
      } catch (error) {
        setImportError(
          error instanceof Error ? error.message : "Failed to import Trello board JSON.",
        );
      } finally {
        setImportingTrello(false);
      }
    },
    [auth?.user?.id, boards, organizationId, refetch],
  );

  const loading = loadingBoards || loadingEntries;

  if (!auth?.user || !profile) return null;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role ?? "admin"} />

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="border-b border-white/8 bg-linear-to-b from-white/3 to-transparent px-8 py-7">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.35em] text-orange-500">
                  Admin · Time Management
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
                  Client Boards
                </h1>
                <p className="mt-1 text-sm text-white/40">
                  Manage hours, budgets, and billing types across all client
                  boards.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 transition hover:bg-white/10 hover:text-white">
                  <Upload size={15} />
                  {importing ? "Importing..." : "Import Everhour JSON"}
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    disabled={importing}
                    onChange={(event) => {
                      void handleImportJson(event.target.files?.[0] ?? null);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-orange-500/25 bg-orange-500/10 px-4 py-2.5 text-sm font-semibold text-orange-100 transition hover:bg-orange-500/15">
                  <LayoutGrid size={15} />
                  {importingTrello ? "Importing..." : "Import Trello Board"}
                  <input
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    disabled={importingTrello}
                    onChange={(event) => {
                      void handleImportTrelloJson(event.target.files?.[0] ?? null);
                      event.currentTarget.value = "";
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddHours(true)}
                  className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400"
                >
                  <Plus size={15} />
                  Add Hours
                </button>
              </div>
            </div>

            {(importResult || trelloImportResult || importError) && (
              <div
                className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                  importError
                    ? "border-red-500/25 bg-red-500/10 text-red-200"
                    : "border-emerald-500/20 bg-emerald-500/10 text-emerald-100"
                }`}
              >
                {importError ? (
                  <p>{importError}</p>
                ) : trelloImportResult ? (
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Trello board imported: {trelloImportResult.boardName}
                    </p>
                    <p className="text-xs text-white/55">
                      {trelloImportResult.cardsImported} cards ·{" "}
                      {trelloImportResult.listsImported} new lists ·{" "}
                      {trelloImportResult.duplicates} duplicates ·{" "}
                      {trelloImportResult.assigneesLinked} assignees linked.
                    </p>
                    <p className="text-xs text-white/45">
                      Checklists: {trelloImportResult.checklistsImported} · items:{" "}
                      {trelloImportResult.checklistItemsImported} · attachments:{" "}
                      {trelloImportResult.attachmentsImported} · comments:{" "}
                      {trelloImportResult.commentsImported}
                      {trelloImportResult.unmatchedMembers.length > 0
                        ? ` · ${trelloImportResult.unmatchedMembers.length} Trello members need profile matching.`
                        : ""}
                    </p>
                    {trelloImportResult.errors.length > 0 && (
                      <p className="text-xs text-amber-200">
                        {trelloImportResult.errors.slice(0, 2).join(" ")}
                      </p>
                    )}
                  </div>
                ) : importResult ? (
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Everhour import complete: {importResult.imported} imported,
                      {" "}{importResult.duplicates} duplicates, {importResult.skipped} skipped.
                    </p>
                    <p className="text-xs text-white/55">
                      Scanned {importResult.scanned} records · created{" "}
                      {importResult.boardsCreated} boards and {importResult.tasksCreated} tasks.
                      {importResult.unmatchedUsers.length > 0
                        ? ` ${importResult.unmatchedUsers.length} records need matching profiles by email or full name.`
                        : ""}
                    </p>
                    {importResult.errors.length > 0 && (
                      <p className="text-xs text-amber-200">
                        {importResult.errors.slice(0, 2).join(" ")}
                      </p>
                    )}
                  </div>
                ) : null}
              </div>
            )}

            {/* Summary strip */}
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                {
                  label: "Total Boards",
                  value: summary.boardCount,
                  icon: LayoutGrid,
                  accent: "text-white",
                  bg: "bg-white/8",
                },
                {
                  label: "Hours Tracked",
                  value: formatHours(summary.totalTracked),
                  icon: Clock,
                  accent: "text-orange-400",
                  bg: "bg-orange-500/10",
                },
                {
                  label: "Billable Hours",
                  value: formatHours(summary.totalBillable),
                  icon: DollarSign,
                  accent: "text-green-400",
                  bg: "bg-green-500/10",
                },
                {
                  label: "Over Budget",
                  value: summary.overBudget,
                  icon: TrendingUp,
                  accent:
                    summary.overBudget > 0 ? "text-red-400" : "text-white/40",
                  bg: summary.overBudget > 0 ? "bg-red-500/10" : "bg-white/5",
                },
              ].map(({ label, value, icon: Icon, accent, bg }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/3 px-4 py-3"
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${bg}`}
                  >
                    <Icon size={16} className={accent} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-white/30">
                      {label}
                    </p>
                    <p className={`text-lg font-bold ${accent}`}>{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Toolbar ── */}
          <div className="flex items-center gap-3 border-b border-white/6 px-8 py-4">
            <div className="relative flex-1 max-w-sm">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/25"
              />
              <input
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search boards or clients…"
                className="w-full rounded-xl border border-white/8 bg-white/4 py-2 pl-9 pr-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-orange-500/40 transition"
              />
            </div>
            <span className="text-xs text-white/25">
              {boards.length} boards · {groups.length} groups
            </span>
          </div>

          {/* ── Content ── */}
          <div className="space-y-3 p-8">
            {loading && (
              <div className="flex items-center justify-center py-20">
                <Loader2 size={24} className="animate-spin text-orange-400" />
              </div>
            )}

            {!loading && groups.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-white/8 py-20 text-center">
                <Layers size={32} className="mb-4 text-white/15" />
                <p className="text-sm font-medium text-white/40">
                  {searchValue
                    ? "No boards match your search"
                    : "No boards yet"}
                </p>
              </div>
            )}

            {!loading &&
              groups.map((group) => (
                <GroupSection
                  key={group.groupName}
                  group={group}
                  onUpdateBilling={handleUpdateBilling}
                />
              ))}
          </div>
        </main>
      </div>

      {showAddHours && organizationId && (
        <AddHoursModal
          boards={boardsWithTime}
          organizationId={organizationId}
          onClose={() => setShowAddHours(false)}
          onAdded={refetch}
        />
      )}
    </div>
  );
}
