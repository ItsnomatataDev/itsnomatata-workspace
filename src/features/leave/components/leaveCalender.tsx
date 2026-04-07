import { useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type Event as RBCEvent,
  type SlotInfo,
  Views,
  type View,
} from "react-big-calendar";
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfToday,
  startOfWeek as dfStartOfWeek,
  endOfWeek,
  addDays,
} from "date-fns";
import { enUS } from "date-fns/locale";
import {
  CalendarDays,
  Lock,
  Unlock,
  User,
  ClipboardList,
  X,
} from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";
import type {
  LeaveCalendarEventRow,
  LeaveCalendarRuleRow,
} from "../services/leaveCalendarService";

const locales = {
  "en-US": enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) =>
    startOfWeek(date, {
      weekStartsOn: 1,
      locale: enUS,
    }),
  getDay,
  locales,
});

export type LeaveCalendarEvent = RBCEvent & {
  id: string;
  type: "leave" | "rule";
  raw?: LeaveCalendarEventRow | LeaveCalendarRuleRow;
};

function toStartDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
}

function toEndInclusive(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 23, 59, 59, 999);
}

function formatDateOnly(value: Date) {
  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatDateRange(start: Date, end: Date) {
  return `${formatDateOnly(start)} → ${formatDateOnly(end)}`;
}

function getLeaveLengthDays(start: Date, end: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / msPerDay + 1),
  );
}

export default function LeaveCalendar({
  approvedLeaves,
  rules,
  canManage = false,
  onSelectEvent,
  onSelectSlot,
  onManageLeave,
  onManageRule,
}: {
  approvedLeaves: LeaveCalendarEventRow[];
  rules: LeaveCalendarRuleRow[];
  canManage?: boolean;
  onSelectEvent?: (event: LeaveCalendarEvent) => void;
  onSelectSlot?: (params: { start: Date; end: Date }) => void;
  onManageLeave?: (event: LeaveCalendarEvent) => void;
  onManageRule?: (event: LeaveCalendarEvent) => void;
}) {
  const [selectedEvent, setSelectedEvent] = useState<LeaveCalendarEvent | null>(
    null,
  );
  const [selectedRange, setSelectedRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState<Date>(startOfToday());

  const events = useMemo<LeaveCalendarEvent[]>(() => {
    const leaveEvents: LeaveCalendarEvent[] = approvedLeaves.map((item) => ({
      id: item.id,
      title: `${item.requester_name || item.requester_email || "Employee"} on leave`,
      start: toStartDate(item.start_date),
      end: toEndInclusive(item.end_date),
      allDay: true,
      type: "leave",
      raw: item,
    }));

    const ruleEvents: LeaveCalendarEvent[] = rules.map((rule) => ({
      id: rule.id,
      title: `${rule.rule_type === "closed" ? "Closed" : "Open"}: ${rule.title}`,
      start: toStartDate(rule.start_date),
      end: toEndInclusive(rule.end_date),
      allDay: true,
      type: "rule",
      raw: rule,
    }));

    return [...leaveEvents, ...ruleEvents];
  }, [approvedLeaves, rules]);

  const visibleLeaveCount = useMemo(() => {
    if (currentView === Views.DAY) {
      return approvedLeaves.filter((leave) => {
        const start = toStartDate(leave.start_date);
        const end = toEndInclusive(leave.end_date);
        return currentDate >= start && currentDate <= end;
      }).length;
    }

    if (currentView === Views.WEEK) {
      const weekStart = dfStartOfWeek(currentDate, {
        weekStartsOn: 1,
        locale: enUS,
      });
      const weekEnd = endOfWeek(currentDate, {
        weekStartsOn: 1,
        locale: enUS,
      });

      return approvedLeaves.filter((leave) => {
        const start = toStartDate(leave.start_date);
        const end = toEndInclusive(leave.end_date);
        return start <= weekEnd && end >= weekStart;
      }).length;
    }

    return approvedLeaves.length;
  }, [approvedLeaves, currentDate, currentView]);

  function handleSelectEvent(event: LeaveCalendarEvent) {
    setSelectedRange(null);
    setSelectedEvent(event);
    onSelectEvent?.(event);
  }

  function handleSelectSlot(slotInfo: SlotInfo) {
    const start = slotInfo.start as Date;
    const end = slotInfo.end as Date;

    setSelectedEvent(null);
    setSelectedRange({ start, end });
    onSelectSlot?.({ start, end });
  }

  function goToToday() {
    setCurrentDate(startOfToday());
  }

  function goToThisWeek() {
    setCurrentView(Views.WEEK);
    setCurrentDate(startOfToday());
  }

  function goToThisMonth() {
    setCurrentView(Views.MONTH);
    setCurrentDate(startOfToday());
  }

  function goToNext7Days() {
    setCurrentView(Views.AGENDA);
    setCurrentDate(startOfToday());
  }

  const selectedLeave =
    selectedEvent?.type === "leave"
      ? (selectedEvent.raw as LeaveCalendarEventRow)
      : null;

  const selectedRule =
    selectedEvent?.type === "rule"
      ? (selectedEvent.raw as LeaveCalendarRuleRow)
      : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-orange-600" />
            <span>Approved leave</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-red-900" />
            <span>Closed / No leave days</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-green-900" />
            <span>Open rule</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={goToToday}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            Today
          </button>
          <button
            type="button"
            onClick={goToThisWeek}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            This Week
          </button>
          <button
            type="button"
            onClick={goToThisMonth}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            This Month
          </button>
          <button
            type="button"
            onClick={goToNext7Days}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white hover:bg-white/10"
          >
            Next 7 Days
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white">
          <p className="text-sm text-white/60">Current View</p>
          <p className="mt-2 font-semibold capitalize">{currentView}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white">
          <p className="text-sm text-white/60">Focused Date</p>
          <p className="mt-2 font-semibold">{formatDateOnly(currentDate)}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-white">
          <p className="text-sm text-white/60">Visible Leave Entries</p>
          <p className="mt-2 font-semibold">{visibleLeaveCount}</p>
        </div>
      </div>

      <div className="h-[700px] overflow-hidden rounded-2xl bg-white p-4 text-black">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={currentView}
          date={currentDate}
          views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
          popup
          selectable={canManage}
          onView={(view) => setCurrentView(view)}
          onNavigate={(date) => setCurrentDate(date)}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          eventPropGetter={(event: LeaveCalendarEvent) => {
            if (event.type === "rule") {
              const rule = event.raw as LeaveCalendarRuleRow;

              return {
                style: {
                  backgroundColor:
                    rule.rule_type === "closed" ? "#7f1d1d" : "#14532d",
                  color: "white",
                  borderRadius: "8px",
                  border: "none",
                  padding: "2px 6px",
                },
              };
            }

            return {
              style: {
                backgroundColor: "#ea580c",
                color: "white",
                borderRadius: "8px",
                border: "none",
                padding: "2px 6px",
              },
            };
          }}
          components={{
            event: ({ event }) => (
              <span className="block truncate text-xs font-medium">
                {event.title}
              </span>
            ),
          }}
        />
      </div>

      {selectedEvent && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-white">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">
                {selectedEvent.type === "leave"
                  ? "Leave Details"
                  : "Rule Details"}
              </div>
              <p className="mt-1 text-sm text-white/60">
                Click an action below to manage this selection.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-white/60">Title</p>
              <p className="mt-2 font-medium text-white">
                {selectedEvent.title}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
              <p className="text-sm text-white/60">Dates</p>
              <p className="mt-2 font-medium text-white">
                {selectedEvent.start instanceof Date &&
                selectedEvent.end instanceof Date
                  ? formatDateRange(selectedEvent.start, selectedEvent.end)
                  : ""}
              </p>
            </div>

            {selectedLeave ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="flex items-center gap-2 text-sm text-white/60">
                    <User size={14} />
                    Employee
                  </p>
                  <p className="mt-2 font-medium text-white">
                    {selectedLeave.requester_name ||
                      selectedLeave.requester_email ||
                      "Unknown"}
                  </p>
                  {selectedLeave.requester_email ? (
                    <p className="mt-1 text-sm text-white/50">
                      {selectedLeave.requester_email}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-sm text-white/60">Leave Length</p>
                  <p className="mt-2 font-medium text-white">
                    {selectedEvent.start instanceof Date &&
                    selectedEvent.end instanceof Date
                      ? `${getLeaveLengthDays(
                          selectedEvent.start,
                          selectedEvent.end,
                        )} day(s)`
                      : "N/A"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4 md:col-span-2">
                  <p className="flex items-center gap-2 text-sm text-white/60">
                    <ClipboardList size={14} />
                    Reason
                  </p>
                  <p className="mt-2 text-white/85">
                    {selectedLeave.reason || "No reason provided"}
                  </p>
                </div>
              </>
            ) : null}

            {selectedRule ? (
              <>
                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-sm text-white/60">Rule Type</p>
                  <p className="mt-2 font-medium capitalize text-white">
                    {selectedRule.rule_type}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                  <p className="text-sm text-white/60">Description</p>
                  <p className="mt-2 text-white/85">
                    {selectedRule.description || "No description"}
                  </p>
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Close
            </button>

            {canManage && selectedEvent.type === "rule" ? (
              <button
                type="button"
                onClick={() => {
                  onManageRule?.(selectedEvent);
                  onSelectEvent?.(selectedEvent);
                }}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
              >
                Manage Rule
              </button>
            ) : null}

            {canManage && selectedEvent.type === "leave" ? (
              <button
                type="button"
                onClick={() => {
                  onManageLeave?.(selectedEvent);
                  onSelectEvent?.(selectedEvent);
                }}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
              >
                Manage User Leave
              </button>
            ) : null}
          </div>
        </div>
      )}

      {selectedRange && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-white">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold">Selected Date Range</div>
              <p className="mt-1 text-sm text-white/60">
                Use this range to create or manage leave rules.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setSelectedRange(null)}
              className="rounded-xl border border-white/10 bg-white/5 p-2 text-white hover:bg-white/10"
            >
              <X size={16} />
            </button>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
            <p className="text-sm text-white/60">Range</p>
            <p className="mt-2 font-medium text-white">
              {formatDateRange(selectedRange.start, selectedRange.end)}
            </p>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setSelectedRange(null)}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
            >
              Clear
            </button>

            {canManage ? (
              <button
                type="button"
                onClick={() => onSelectSlot?.(selectedRange)}
                className="rounded-xl bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-500"
              >
                Use This Range
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
