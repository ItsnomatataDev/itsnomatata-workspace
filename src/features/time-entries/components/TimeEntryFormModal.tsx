import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, Clock, DollarSign, X } from "lucide-react";
import type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getBoards, getCards } from "../../boards/services/boardService";
import type { Board } from "../../boards/services/boardService";
import {
  getZimbabweDateKey,
  makeZimbabweLocalIso,
} from "../../../lib/utils/zimbabweCalendar";

export type EntryDraft = {
  description: string;
  startedAt: string;
  endedAt: string;
  isBillable: boolean;
  taskId: string;
  projectId: string;
  clientId: string;
  campaignId: string;
};

type CardOption = { id: string; title: string };

const labelClass =
  "mb-1.5 block text-[10px] uppercase tracking-widest text-white/35";
const fieldClass =
  "w-full rounded-2xl border border-white/10 bg-neutral-950 px-3 py-2.5 text-sm text-white outline-none transition focus:border-orange-500/40";

function durationPartsFromEntry(entry: TimeEntryItem) {
  const startMs = new Date(entry.started_at).getTime();
  const endMs = entry.ended_at
    ? new Date(entry.ended_at).getTime()
    : startMs;
  const totalMinutes = Math.max(
    1,
    Math.round(Math.max(0, endMs - startMs) / 60_000),
  );
  return {
    date: getZimbabweDateKey(entry.started_at),
    hours: String(Math.floor(totalMinutes / 60)),
    minutes: String(totalMinutes % 60),
  };
}

export default function TimeEntryFormModal({
  open,
  busy,
  title,
  initialEntry,
  onClose,
  onSaveManualEntry,
  onUpdateEntry,
}: {
  open: boolean;
  busy?: boolean;
  title: string;
  initialEntry?: TimeEntryItem | null;
  onClose: () => void;
  onSaveManualEntry: (values: EntryDraft) => Promise<void>;
  onUpdateEntry: (entryId: string, values: EntryDraft) => Promise<void>;
}) {
  const auth = useAuth();
  const organizationId =
    auth?.currentOrganization?.organization_id ??
    auth?.profile?.organization_id ??
    "";

  const [boards, setBoards] = useState<Board[]>([]);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [taskOptions, setTaskOptions] = useState<CardOption[]>([]);
  const [error, setError] = useState("");

  const [boardId, setBoardId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [date, setDate] = useState(getZimbabweDateKey(new Date()));
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("0");
  const [description, setDescription] = useState("");
  const [isBillable, setIsBillable] = useState(false);

  useEffect(() => {
    if (!open || !organizationId) return;

    let cancelled = false;
    setBoardsLoading(true);

    void getBoards(organizationId)
      .then((data) => {
        if (!cancelled) setBoards(data);
      })
      .catch(() => {
        if (!cancelled) setBoards([]);
      })
      .finally(() => {
        if (!cancelled) setBoardsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  useEffect(() => {
    if (!open) return;

    if (initialEntry) {
      const parts = durationPartsFromEntry(initialEntry);
      setBoardId(initialEntry.client_id || "");
      setTaskId(initialEntry.task_id || "");
      setDate(parts.date);
      setHours(parts.hours);
      setMinutes(parts.minutes);
      setDescription(initialEntry.description || "");
      setIsBillable(Boolean(initialEntry.is_billable));
      setError("");
      return;
    }

    setBoardId("");
    setTaskId("");
    setDate(getZimbabweDateKey(new Date()));
    setHours("");
    setMinutes("30");
    setDescription("");
    setIsBillable(false);
    setError("");
  }, [initialEntry, open]);

  useEffect(() => {
    if (!open || !organizationId || !boardId) {
      setTaskOptions([]);
      return;
    }

    let cancelled = false;
    setTasksLoading(true);

    void getCards(organizationId, boardId)
      .then((cards) => {
        if (cancelled) return;
        setTaskOptions(
          cards.map((card) => ({
            id: card.id,
            title: card.title || "Untitled task",
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setTaskOptions([]);
      })
      .finally(() => {
        if (!cancelled) setTasksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, organizationId, boardId]);

  useEffect(() => {
    if (!taskId) return;
    if (taskOptions.some((task) => task.id === taskId)) return;
    setTaskId("");
  }, [taskId, taskOptions]);

  const boardName = useMemo(
    () => boards.find((board) => board.id === boardId)?.name ?? "",
    [boards, boardId],
  );

  if (!open) return null;

  const buildDraft = (): EntryDraft | null => {
    const h = parseFloat(hours) || 0;
    const m = parseFloat(minutes) || 0;
    const totalSeconds = Math.round(h * 3600 + m * 60);

    if (!boardId) {
      setError("Select a board.");
      return null;
    }
    if (totalSeconds <= 0) {
      setError("Enter at least 1 minute of time.");
      return null;
    }
    if (!date) {
      setError("Select a date.");
      return null;
    }

    const startedAt = makeZimbabweLocalIso(date, "09:00:00");
    const endedAt = new Date(
      new Date(startedAt).getTime() + totalSeconds * 1000,
    ).toISOString();

    return {
      description: description.trim() || (taskId ? "Task time" : boardName ? `${boardName} time` : "Manual time"),
      startedAt,
      endedAt,
      isBillable,
      taskId,
      clientId: boardId,
      projectId: "",
      campaignId: "",
    };
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    const draft = buildDraft();
    if (!draft) return;

    try {
      if (initialEntry?.id) {
        await onUpdateEntry(initialEntry.id, draft);
      } else {
        await onSaveManualEntry(draft);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save time entry.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/10 bg-[#101010] shadow-2xl shadow-black/35">
        <div className="h-0.5 w-full bg-linear-to-r from-orange-500 to-amber-400" />

        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-2xl border border-orange-400/20 bg-orange-500/15">
              <Clock size={15} className="text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{title}</h2>
              <p className="text-xs text-white/40">
                Board, task, date, and duration in hours & minutes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-1.5 text-white/30 transition hover:bg-white/8 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {error ? (
            <div className="flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              <AlertTriangle size={12} />
              {error}
            </div>
          ) : null}

          <div>
            <label className={labelClass}>Board</label>
            <div className="relative">
              <select
                value={boardId}
                onChange={(e) => {
                  setBoardId(e.target.value);
                  setTaskId("");
                }}
                className={`${fieldClass} appearance-none pr-10`}
                required
              >
                <option value="" className="bg-[#111]">
                  {boardsLoading ? "Loading boards..." : "Select a board"}
                </option>
                {boards.map((board) => (
                  <option key={board.id} value={board.id} className="bg-[#111]">
                    {board.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Task (optional)</label>
            <div className="relative">
              <select
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
                disabled={!boardId}
                className={`${fieldClass} appearance-none pr-10 disabled:opacity-50`}
              >
                <option value="" className="bg-[#111]">
                  {!boardId
                    ? "Select a board first"
                    : tasksLoading
                      ? "Loading tasks..."
                      : "No specific task"}
                </option>
                {taskOptions.map((task) => (
                  <option key={task.id} value={task.id} className="bg-[#111]">
                    {task.title}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            </div>
          </div>

          <div>
            <label className={labelClass}>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${fieldClass} scheme-dark`}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Hours</label>
              <input
                type="number"
                min={0}
                step={1}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className={fieldClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Minutes</label>
              <input
                type="number"
                min={0}
                max={59}
                step={1}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="0"
                className={fieldClass}
                required
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Note</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you work on?"
              className={fieldClass}
            />
          </div>

          <button
            type="button"
            onClick={() => setIsBillable((value) => !value)}
            className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 transition ${
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

          <div className="flex flex-wrap justify-end gap-3 border-t border-white/8 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white/75 transition hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl border border-orange-500 bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
            >
              {busy ? "Saving..." : initialEntry ? "Save changes" : "Add time"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
