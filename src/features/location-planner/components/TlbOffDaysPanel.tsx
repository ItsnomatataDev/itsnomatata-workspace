import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { CalendarDays, Trash2 } from "lucide-react";
import type { PlannerAvailability, PlannerEmployee } from "../types";
import {
  addDays,
  assignmentOnDay,
  buildDayRange,
  formatDayLabel,
  startOfWeekDateKey,
} from "../utils/calendarDates";

type Props = {
  selectedDate: string;
  employees: PlannerEmployee[];
  availability: PlannerAvailability[];
  saving?: boolean;
  onCreateOffDay: (input: {
    userId: string;
    offDate: string;
    reason?: string | null;
  }) => Promise<void>;
  onDeleteOffDay: (offDayId: string) => Promise<void>;
};

export default function TlbOffDaysPanel({
  selectedDate,
  employees,
  availability,
  saving,
  onCreateOffDay,
  onDeleteOffDay,
}: Props) {
  const [employeeId, setEmployeeId] = useState("");
  const [offDate, setOffDate] = useState(selectedDate);
  const [reason, setReason] = useState("");

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetUserId = employeeId || employees[0]?.id;
    if (!targetUserId) return;
    await onCreateOffDay({
      userId: targetUserId,
      offDate,
      reason,
    });
    setReason("");
  }

  return (
    <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-950">
            <CalendarDays size={17} className="text-orange-500" />
            TLB availability
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Leave and off days for {formatDayLabel(selectedDate)}.
          </p>
        </div>
        <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
          {selectedDayAvailability.length}
        </span>
      </div>

      <form onSubmit={(event) => void handleSubmit(event)} className="mt-4 space-y-3">
        <select
          value={employeeId || employees[0]?.id || ""}
          onChange={(event) => setEmployeeId(event.target.value)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500"
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
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500"
        />
        <input
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason, for example Off day"
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-orange-500"
        />
        <button
          type="submit"
          disabled={saving || employees.length === 0}
          className="w-full rounded-xl bg-gray-950 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-60"
        >
          Add off day
        </button>
      </form>

      <div className="mt-5 space-y-3">
        {weekDays.map((day) => {
          const dayItems = availability.filter((item) =>
            assignmentOnDay(item.start_date, item.end_date, day),
          );
          return (
            <section key={day} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {formatDayLabel(day)}
                </p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                  {dayItems.length}
                </span>
              </div>
              {dayItems.length === 0 ? (
                <p className="text-xs text-gray-400">Everyone available.</p>
              ) : (
                <div className="space-y-2">
                  {dayItems.map((item) => (
                    <div
                      key={`${item.kind}-${item.id}`}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-950">
                            {item.employee_name || item.employee_email || "Employee"}
                          </p>
                          <p className="mt-1 text-gray-500">
                            {item.kind === "leave" ? "On leave" : "Off day"}
                            {item.reason ? ` · ${item.reason}` : ""}
                          </p>
                        </div>
                        {item.kind === "off_day" ? (
                          <button
                            type="button"
                            onClick={() => void onDeleteOffDay(item.id)}
                            className="rounded-lg p-1 text-red-500 hover:bg-red-50"
                            aria-label="Remove off day"
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
