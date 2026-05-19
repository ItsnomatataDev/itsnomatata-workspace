import { useEffect, useState } from "react";
import { Clock3, LogIn, LogOut, ShieldCheck, Sunrise, Sunset, TimerReset } from "lucide-react";
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

  const status = attendance.activeSession ? "Clocked in" : "Clocked out";

  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#101010] text-white shadow-2xl shadow-black/35">
      <div className="border-b border-white/10 bg-linear-to-br from-white/10 via-white/[0.04] to-transparent p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-orange-400/20 bg-orange-500/15 p-3 text-orange-300">
              <TimerReset size={20} />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Workday clock</h2>
              <p className="text-sm text-white/50">Africa/Harare schedule</p>
            </div>
          </div>
          <p className="text-right text-xs text-white/45">{clockLabel}</p>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
            <div className="flex items-center gap-2 text-xs text-white/45">
              <Sunrise size={14} className="text-sky-300" />
              Reminder
            </div>
            <p className="mt-1 text-sm font-semibold text-white">08:00 AM</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
            <div className="flex items-center gap-2 text-xs text-white/45">
              <Sunset size={14} className="text-orange-300" />
              Auto stop
            </div>
            <p className="mt-1 text-sm font-semibold text-white">06:00 PM</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/25 px-3 py-3">
            <div className="flex items-center gap-2 text-xs text-white/45">
              <ShieldCheck size={14} className="text-emerald-300" />
              Applies to
            </div>
            <p className="mt-1 text-sm font-semibold text-white">All users</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-center gap-3">
          <span
            className={[
              "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold",
              attendance.activeSession
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-white/10 text-white/60",
            ].join(" ")}
          >
            <Clock3 size={13} />
            {status}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-white/40">Active session</p>
            <p className="mt-2 font-mono text-2xl font-semibold text-orange-300">
              {formatDurationHms(attendance.activeSessionSeconds)}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs text-white/40">Worked today</p>
            <p className="mt-2 font-mono text-2xl font-semibold">
              {formatDurationHms(attendance.workedTodaySeconds)}
            </p>
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
            <button
              type="button"
              disabled={attendance.mutating}
              onClick={() => {
                void attendance.clockOutNow(note || null)
                  .then(() => setNote(""))
                  .catch(() => undefined);
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-white/85 disabled:opacity-60 sm:col-span-2"
            >
              <LogOut size={16} />
              Clock Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
