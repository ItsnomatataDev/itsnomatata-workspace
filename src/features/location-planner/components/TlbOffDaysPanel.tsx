import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CalendarDays, RefreshCcw, Trash2 } from "lucide-react";
import type { PlannerAvailability, PlannerEmployee, TlbEmployeeOffDay } from "../types";
import {
  addDays,
  assignmentOnDay,
  buildDayRange,
  formatDayLabel,
  startOfWeekDateKey,
} from "../utils/calendarDates";
import {
  formatAvailabilityKind,
  formatAvailabilityRange,
  formatDayCount,
} from "../utils/availabilityLabels";

type Props = {
  selectedDate: string;
  employees: PlannerEmployee[];
  availability: PlannerAvailability[];
  offDayHistory?: TlbEmployeeOffDay[];
  saving?: boolean;
  onCreateOffDay: (input: {
    userId: string;
    offDate: string;
    reason?: string | null;
  }) => Promise<void>;
  onCreateWeeklyOffDay?: (input: {
    userId: string;
    startDate: string;
    reason?: string | null;
  }) => Promise<void>;
  onDeleteOffDay: (offDayId: string) => Promise<void>;
  onDeleteWeeklyOffDay?: (ruleId: string) => Promise<void>;
};

export default function TlbOffDaysPanel({
  selectedDate,
  employees,
  availability,
  offDayHistory = [],
  saving,
  onCreateOffDay,
  onCreateWeeklyOffDay,
  onDeleteOffDay,
  onDeleteWeeklyOffDay,
}: Props) {
  const [employeeId, setEmployeeId] = useState("");
  const [offDate, setOffDate] = useState(selectedDate);
  const [reason, setReason] = useState("");
  const [repeatWeekly, setRepeatWeekly] = useState(true);

  useEffect(() => {
    setOffDate(selectedDate);
  }, [selectedDate]);

  const selectedDayAvailability = useMemo(
    () =>
      availability.filter((item) =>
        assignmentOnDay(item.start_date, item.end_date, selectedDate),
      ),
    [availability, selectedDate],
  );

  const weekDays = useMemo(() => {
    const weekStart = startOfWeekDateKey(selectedDate);
    return buildDayRange(weekStart, addDays(weekStart, 6));
  }, [selectedDate]);

  const rotatedEmployee = useMemo(() => {
    const unavailableOnDate = new Set(
      availability
        .filter((item) => assignmentOnDay(item.start_date, item.end_date, offDate))
        .map((item) => item.user_id),
    );
    const candidates = employees.filter((employee) => !unavailableOnDate.has(employee.id));
    if (candidates.length === 0) return null;

    const stats = offDayHistory.reduce<
      Record<string, { count: number; lastOffDate: string | null }>
    >((acc, item) => {
      const current = acc[item.user_id] ?? { count: 0, lastOffDate: null };
      acc[item.user_id] = {
        count: current.count + 1,
        lastOffDate:
          !current.lastOffDate || item.off_date > current.lastOffDate
            ? item.off_date
            : current.lastOffDate,
      };
      return acc;
    }, {});

    return [...candidates].sort((a, b) => {
      const aStats = stats[a.id] ?? { count: 0, lastOffDate: null };
      const bStats = stats[b.id] ?? { count: 0, lastOffDate: null };
      if (aStats.count !== bStats.count) return aStats.count - bStats.count;
      if (aStats.lastOffDate !== bStats.lastOffDate) {
        if (!aStats.lastOffDate) return -1;
        if (!bStats.lastOffDate) return 1;
        return aStats.lastOffDate.localeCompare(bStats.lastOffDate);
      }
      return (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? "");
    })[0];
  }, [availability, employees, offDate, offDayHistory]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetUserId = employeeId || employees[0]?.id;
    if (!targetUserId) return;
    if (repeatWeekly && onCreateWeeklyOffDay) {
      await onCreateWeeklyOffDay({
        userId: targetUserId,
        startDate: offDate,
        reason: reason || "Weekly off day",
      });
    } else {
      await onCreateOffDay({
        userId: targetUserId,
        offDate,
        reason,
      });
    }
    setReason("");
  }

  async function handleAutoRotate() {
    if (!rotatedEmployee) return;
    if (repeatWeekly && onCreateWeeklyOffDay) {
      await onCreateWeeklyOffDay({
        userId: rotatedEmployee.id,
        startDate: offDate,
        reason: reason || "Auto-rotated weekly off day",
      });
    } else {
      await onCreateOffDay({
        userId: rotatedEmployee.id,
        offDate,
        reason: reason || "Auto-rotated off day",
      });
    }
    setEmployeeId(rotatedEmployee.id);
    setReason("");
  }

  return (
    <aside className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 shadow-2xl shadow-black/25">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-white">
            <CalendarDays size={17} className="text-orange-500" />
            Employee availability
          </p>
          <p className="mt-1 text-xs text-white/45">
            Leave and off days for {formatDayLabel(selectedDate)}.
          </p>
        </div>
        <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-semibold text-orange-100">
          {selectedDayAvailability.length}
        </span>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-3">
        <select
          value={employeeId || employees[0]?.id || ""}
          onChange={(event) => setEmployeeId(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
        >
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.full_name || employee.email || "Employee"}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={offDate}
          onChange={(event) => setOffDate(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason, for example Off day"
          className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3 py-2 text-sm text-white outline-none placeholder:text-white/35 focus:border-orange-500"
        />
        <label className="flex items-start gap-2 rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white/55">
          <input
            type="checkbox"
            checked={repeatWeekly}
            onChange={(event) => setRepeatWeekly(event.target.checked)}
            className="mt-0.5"
          />
          <span>
            Repeat every week on this weekday until an admin changes it.
          </span>
        </label>
        <button
          type="submit"
          disabled={saving || employees.length === 0}
          className="w-full rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-60"
        >
          {repeatWeekly ? "Add weekly off day" : "Add one-day off"}
        </button>
        <button
          type="button"
          disabled={saving || !rotatedEmployee}
          onClick={() => void handleAutoRotate()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-300/25 bg-orange-500/10 px-3 py-2 text-sm font-semibold text-orange-100 hover:bg-orange-500/15 disabled:opacity-60"
        >
          <RefreshCcw size={15} />
          Auto rotate: {rotatedEmployee?.full_name || rotatedEmployee?.email || "No one available"}
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {weekDays.map((day) => {
          const dayItems = availability.filter((item) =>
            assignmentOnDay(item.start_date, item.end_date, day),
          );
          return (
            <section key={day} className="rounded-xl border border-white/10 bg-black/25 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
                  {formatDayLabel(day)}
                </p>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/50">
                  {dayItems.length}
                </span>
              </div>
              {dayItems.length === 0 ? (
                <p className="text-xs text-white/35">Everyone available.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-white/35">
                    People off / on leave
                  </p>
                  {dayItems.map((item) => (
                    <div
                      key={`${item.kind}-${item.id}`}
                      className="rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-white">
                            {item.employee_name || item.employee_email || "Employee"}
                          </p>
                          <p className="mt-1 text-white/55">
                            {formatAvailabilityKind(item)} · {formatDayCount(item.day_count)}
                            {item.source === "weekly" ? " · repeats weekly" : ""}
                          </p>
                          <p className="mt-1 text-[11px] text-white/35">
                            {formatAvailabilityRange(item)}
                            {item.reason ? ` · ${item.reason}` : ""}
                          </p>
                        </div>
                        {item.kind === "off_day" ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (item.source === "weekly") {
                                void onDeleteWeeklyOffDay?.(item.recurrence_rule_id ?? item.id);
                                return;
                              }
                              void onDeleteOffDay(item.id);
                            }}
                            className="rounded-lg p-1 text-red-300 hover:bg-red-500/10"
                            aria-label={item.source === "weekly" ? "Remove weekly off day" : "Remove off day"}
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </aside>
  );
}
