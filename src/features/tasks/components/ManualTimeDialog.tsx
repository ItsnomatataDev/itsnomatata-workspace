'use client';

import { useState } from "react";
import { Clock, Plus, X } from "lucide-react";
import { logTaskTime } from "../services/taskTimeService";
import type { TimeEntryItem } from "../../../lib/supabase/mutations/timeEntries";

interface Props {
  taskId: string;
  organizationId: string;
  userId: string;
  onLogSuccess?: (entry: TimeEntryItem) => void;
  className?: string;
}

export function ManualTimeDialog(props: Props) {
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(30);
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const { taskId, organizationId, userId, onLogSuccess, className } = props;

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (minutes <= 0) return;
    setLoading(true);
    try {
      const entry = await logTaskTime({
        organizationId,
        userId,
        taskId,
        duration_minutes: minutes,
        description: desc.trim() || undefined,
      });
      setOpen(false);
      setMinutes(30);
      setDesc('');
      onLogSuccess?.(entry);
    } catch (error) {
      alert('Log time failed');
      console.error(error);
    }
    setLoading(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 hover:bg-blue-700 text-white transition-colors ${className}`}
      >
        +Log Time
      </button>
      {open && (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in-200">
          <div className="bg-zinc-900 w-full max-w-md rounded-2xl border border-zinc-700 p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-zinc-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-xl">
                  <Clock className="w-5 h-5 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Log Manual Time</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleLog} className="space-y-4">
              <fieldset className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">
                  Duration (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(1, Number(e.target.value)))}
                  className="w-full p-3 bg-zinc-800 border border-zinc-600 rounded-xl text-white focus:border-orange-500 focus:ring-2 ring-orange-500/20 outline-none transition-all font-mono text-lg"
                  required
                />
              </fieldset>
              <fieldset className="space-y-2">
                <label className="text-sm font-medium text-zinc-300">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                  placeholder="Forgot to track design review..."
                  className="w-full p-3 bg-zinc-800 border border-zinc-600 rounded-xl text-white focus:border-orange-500 focus:ring-2 ring-orange-500/20 outline-none transition-all"
                  maxLength={100}
                />
              </fieldset>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 px-6 py-3 border border-zinc-600 bg-zinc-800 hover:bg-zinc-700 active:scale-[0.98] rounded-xl text-zinc-200 font-semibold transition-all duration-150"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={minutes <= 0 || loading}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-bold text-black shadow-lg transition-all duration-150 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-r-white" />
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Log {minutes} minutes
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
