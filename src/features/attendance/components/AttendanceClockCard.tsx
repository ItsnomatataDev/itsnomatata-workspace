import { useEffect, useState } from "react";
import { Coffee, LogIn, LogOut, TimerReset } from "lucide-react";
import { formatZimbabweDateTime } from "../../../lib/utils/zimbabweCalendar";
import { formatDurationHms } from "../../../lib/utils/timeMath";
import { useAttendance } from "../hooks/useAttendance";

export default function AttendanceClockCard({
  organizationId,
  userId,
}: {
  organizationId?: string | null;
  userId?: string | null;
}) {
  const [note, setNote] = useState("");
  const [clockLabel, setClockLabel] = useState(formatZimbabweDateTime(new Date()));
  const attendance = useAttendance({ organizationId, userId });

  useEffect(() => {
    const interval = window.setInterval(
      () => setClockLabel(formatZimbabweDateTime(new Date())),
      1000,
    );
    return () => window.clearInterval(interval);
  }, []);

  const status = attendance.activeBreak
    ? "On break"
    : attendance.activeSession
      ? "Clocked in"
      : "Clocked out";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-white">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-500/15 p-2 text-orange-400">
            <TimerReset size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Attendance</h2>
            <p className="text-sm text-white/50">Clocked in / working presence</p>
          </div>
        </div>
        <p className="text-right text-xs text-white/45">{clockLabel}</p>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-white/50">Status</span>
          <span
            className={[
              "rounded-full px-3 py-1 text-xs font-semibold",
              attendance.activeBreak
                ? "bg-amber-500/15 text-amber-300"
                : attendance.activeSession
                  ? "bg-green-500/15 text-green-300"
                  : "bg-white/10 text-white/60",
            ].join(" ")}
          >
            {status}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-white/40">Active session</p>
            <p className="mt-1 font-mono text-lg font-semibold text-orange-300">
              {formatDurationHms(attendance.activeSessionSeconds)}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40">Worked today</p>
            <p className="mt-1 font-mono text-lg font-semibold">
              {formatDurationHms(attendance.workedTodaySeconds)}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40">Break time today</p>
            <p className="mt-1 font-mono text-sm font-semibold text-white/75">
              {formatDurationHms(attendance.breakSeconds)}
            </p>
          </div>
          <div>
            <p className="text-xs text-white/40">Current break</p>
            <p className="mt-1 font-mono text-sm font-semibold text-amber-300">
              {formatDurationHms(attendance.activeBreakSeconds)}
            </p>
          </div>
        </div>
      </div>

      {attendance.error ? (
        <p className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {attendance.error}
        </p>
      ) : null}

      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional attendance note"
        rows={2}
        className="mt-4 w-full resize-none rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500/40"
      />

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {!attendance.activeSession ? (
          <button
            type="button"
            disabled={attendance.mutating || attendance.loading}
            onClick={() => {
              void attendance.clockInNow(note || null)
                .then(() => setNote(""))
                .catch(() => undefined);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60 sm:col-span-2"
          >
            <LogIn size={16} />
            Clock In
          </button>
        ) : (
          <>
            {attendance.activeBreak ? (
              <button
                type="button"
                disabled={attendance.mutating}
                onClick={() => {
                  void attendance.endBreakNow().catch(() => undefined);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/15 disabled:opacity-60"
              >
                <Coffee size={16} />
                End Break
              </button>
            ) : (
              <button
                type="button"
                disabled={attendance.mutating}
                onClick={() => {
                  void attendance.startBreakNow().catch(() => undefined);
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-60"
              >
                <Coffee size={16} />
                Start Break
              </button>
            )}
            <button
              type="button"
              disabled={attendance.mutating}
              onClick={() => {
                void attendance.clockOutNow(note || null)
                  .then(() => setNote(""))
                  .catch(() => undefined);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/85 disabled:opacity-60"
            >
              <LogOut size={16} />
              Clock Out
            </button>
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-white/35">
        Attendance is separate from task timers. Use task tracking for cards and client work.
      </p>
    </div>
  );
}
