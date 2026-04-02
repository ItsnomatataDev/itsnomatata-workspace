import { useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  type Event as RBCEvent,
  type SlotInfo,
} from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { enUS } from "date-fns/locale";
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
  startOfWeek: (date) =>
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
  const date = new Date(dateString);
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndInclusive(dateString: string) {
  const date = new Date(dateString);
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatDateOnly(value: Date) {
  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function LeaveCalendar({
  approvedLeaves,
  rules,
  canManage = false,
  onSelectEvent,
  onSelectSlot,
}: {
  approvedLeaves: LeaveCalendarEventRow[];
  rules: LeaveCalendarRuleRow[];
  canManage?: boolean;
  onSelectEvent?: (event: LeaveCalendarEvent) => void;
  onSelectSlot?: (params: { start: Date; end: Date }) => void;
}) {
  const [selectedEvent, setSelectedEvent] = useState<LeaveCalendarEvent | null>(
    null,
  );
  const [selectedRange, setSelectedRange] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

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

  function handleSelectEvent(event: LeaveCalendarEvent) {
    setSelectedEvent(event);
    onSelectEvent?.(event);
  }

  function handleSelectSlot(slotInfo: SlotInfo) {
    const start = slotInfo.start as Date;
    const end = slotInfo.end as Date;

    setSelectedRange({ start, end });
    onSelectSlot?.({ start, end });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-white/80">
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

      <div className="h-[700px] overflow-hidden rounded-2xl bg-white p-4 text-black">
        <Calendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          defaultView="month"
          views={["month", "week", "day", "agenda"]}
          popup
          selectable={canManage}
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
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-white">
          <div className="mb-2 text-lg font-semibold">Selected event</div>
          <div className="space-y-1 text-sm text-white/80">
            <div>
              <span className="font-medium text-white">Title:</span>{" "}
              {selectedEvent.title}
            </div>
            <div>
              <span className="font-medium text-white">Type:</span>{" "}
              {selectedEvent.type === "leave" ? "Leave" : "Rule"}
            </div>
            <div>
              <span className="font-medium text-white">Start:</span>{" "}
              {selectedEvent.start instanceof Date
                ? formatDateOnly(selectedEvent.start)
                : ""}
            </div>
            <div>
              <span className="font-medium text-white">End:</span>{" "}
              {selectedEvent.end instanceof Date
                ? formatDateOnly(selectedEvent.end)
                : ""}
            </div>

            {selectedEvent.type === "leave" && (
              <>
                <div>
                  <span className="font-medium text-white">Employee:</span>{" "}
                  {(selectedEvent.raw as LeaveCalendarEventRow)
                    ?.requester_name ||
                    (selectedEvent.raw as LeaveCalendarEventRow)
                      ?.requester_email ||
                    "Unknown"}
                </div>
                <div>
                  <span className="font-medium text-white">Reason:</span>{" "}
                  {(selectedEvent.raw as LeaveCalendarEventRow)?.reason ||
                    "No reason"}
                </div>
              </>
            )}

            {selectedEvent.type === "rule" && (
              <>
                <div>
                  <span className="font-medium text-white">Rule title:</span>{" "}
                  {(selectedEvent.raw as LeaveCalendarRuleRow)?.title}
                </div>
                <div>
                  <span className="font-medium text-white">Rule type:</span>{" "}
                  {(selectedEvent.raw as LeaveCalendarRuleRow)?.rule_type}
                </div>
                <div>
                  <span className="font-medium text-white">Description:</span>{" "}
                  {(selectedEvent.raw as LeaveCalendarRuleRow)?.description ||
                    "No description"}
                </div>
              </>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedEvent(null)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
            >
              Close
            </button>

            {canManage && selectedEvent.type === "rule" && (
              <button
                type="button"
                onClick={() => onSelectEvent?.(selectedEvent)}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-500"
              >
                Manage rule
              </button>
            )}

            {canManage && selectedEvent.type === "leave" && (
              <button
                type="button"
                onClick={() => onSelectEvent?.(selectedEvent)}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-500"
              >
                Manage leave
              </button>
            )}
          </div>
        </div>
      )}

      {canManage && selectedRange && (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-white">
          <div className="mb-2 text-lg font-semibold">Selected date range</div>
          <div className="space-y-1 text-sm text-white/80">
            <div>
              <span className="font-medium text-white">Start:</span>{" "}
              {formatDateOnly(selectedRange.start)}
            </div>
            <div>
              <span className="font-medium text-white">End:</span>{" "}
              {formatDateOnly(selectedRange.end)}
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedRange(null)}
              className="rounded-lg bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20"
            >
              Clear
            </button>

            <button
              type="button"
              onClick={() => onSelectSlot?.(selectedRange)}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-500"
            >
              Use this range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
