'use client';

import { useState } from "react";
import { Clock, DollarSign, Plus, X } from "lucide-react";
import { logTaskTime } from "../services/taskTimeService";
import type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";
import { formatZimbabweDate } from "../../../lib/utils/zimbabweCalendar";

interface Props {
  taskId: string;
  organizationId: string;
  userId: string;
  onLogSuccess?: (entry: TimeEntryItem) => void;
  className?: string;
}

export function ManualTimeDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(30);
  const [desc, setDesc] = useState("");
  const [isBillable, setIsBillable] = useState(false);
  const [loading, setLoading] = useState(false);

  const { taskId, organizationId, userId, onLogSuccess, className } = props;
  const totalMinutes = hours * 60 + minutes;

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (totalMinutes <= 0) return;

    setLoading(true);
    try {
      const entry = await logTaskTime({
        organizationId,
        userId,
        taskId,
        duration_minutes: totalMinutes,
        description: desc.trim() || undefined,
        isBillable,
      });
      setOpen(false);
      setHours(0);
      setMinutes(30);
      setDesc("");
      setIsBillable(false);
      onLogSuccess?.(entry);
    } catch (error) {
      alert("Log time failed");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-orange-400 ${className}`}
      >
        <Plus size={13} />
        Log Time
      </button>
      {open && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in-200">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#0b0b0b] shadow-2xl shadow-black/60">
            <div className="h-1 bg-linear-to-r from-orange-500 via-amber-400 to-emerald-400" />
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-2">
                  <Clock className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Log Manual Time</h3>
                  <p className="text-xs text-white/40">
                    {formatZimbabweDate(new Date(), {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}{" "}
                    · Zimbabwe calendar
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleLog} className="space-y-4 p-6">
              <div className="grid grid-cols-2 gap-3">
                <fieldset className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-white/45">
                    Hours
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={hours}
                    onChange={(e) => setHours(Math.max(0, Number(e.target.value)))}
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-3 font-mono text-lg text-white outline-none transition-all focus:border-orange-500 focus:ring-2 ring-orange-500/20"
                    required
                  />
                </fieldset>
                <fieldset className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-white/45">
                    Minutes
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={minutes}
                    onChange={(e) =>
                      setMinutes(Math.max(0, Math.min(59, Number(e.target.value))))
                    }
                    className="w-full rounded-xl border border-white/10 bg-white/5 p-3 font-mono text-lg text-white outline-none transition-all focus:border-orange-500 focus:ring-2 ring-orange-500/20"
                    required
                  />
                </fieldset>
              </div>

              <fieldset className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-wide text-white/45">
                  Description
                </label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Forgot to track design review..."
                  className="w-full rounded-xl border border-white/10 bg-white/5 p-3 text-white outline-none transition-all placeholder:text-white/20 focus:border-orange-500 focus:ring-2 ring-orange-500/20"
                  maxLength={100}
                />
              </fieldset>

              <button
                type="button"
                onClick={() => setIsBillable((value) => !value)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 transition ${
                  isBillable
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 bg-white/5 text-white/45"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <DollarSign size={14} />
                  {isBillable ? "Billable time" : "Non-billable time"}
                </span>
                <span
                  className={`h-5 w-9 rounded-full px-0.5 transition ${
                    isBillable ? "bg-emerald-500" : "bg-white/15"
                  }`}
                >
                  <span
                    className={`block h-4 w-4 translate-y-0.5 rounded-full bg-white transition ${
                      isBillable ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-semibold text-white/70 transition-all duration-150 hover:bg-white/10 active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={totalMinutes <= 0 || loading}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3 font-bold text-black shadow-lg shadow-orange-500/15 transition-all duration-150 hover:bg-orange-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-black/20 border-r-black" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Log {totalMinutes} min
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
