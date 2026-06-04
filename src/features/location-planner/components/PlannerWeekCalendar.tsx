import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type {
  AdminAssignmentRow,
  AssignmentSlot,
  CompanyLocation,
  LocationStatusEvent,
} from "../types";
import { assignmentOnDay, formatDayLabel } from "../utils/calendarDates";
import AssignmentCalendarCard from "./AssignmentCalendarCard";

type Props = {
  days: string[];
  locations: CompanyLocation[];
  assignments: AdminAssignmentRow[];
  slots: AssignmentSlot[];
  statusEvents: LocationStatusEvent[];
  selectedAssignmentId?: string | null;
  canEdit?: boolean;
  onSelectAssignment: (id: string) => void;
};

function DayCell({
  locationId,
  dayKey,
  canEdit,
  isClosed,
  children,
}: {
  locationId: string;
  dayKey: string;
  canEdit?: boolean;
  isClosed?: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `cell-${locationId}-${dayKey}`,
    data: { type: "cell", locationId, dayKey },
    disabled: !canEdit || isClosed,
  });

  return (
    <td
      ref={setNodeRef}
      className={[
        "min-w-[120px] align-top border-l border-gray-200 p-1.5 vertical-align-top",
        isClosed ? "bg-gray-900 text-white/70" : "bg-white",
        isOver ? "bg-orange-50 ring-1 ring-inset ring-orange-400" : "",
      ].join(" ")}
    >
      {children}
      {canEdit && !isClosed ? (
        <p className="mt-1 text-center text-[9px] text-gray-400">Drop here</p>
      ) : null}
    </td>
  );
}

export default function PlannerWeekCalendar({
  days,
  locations,
  assignments,
  slots,
  statusEvents,
  selectedAssignmentId,
  canEdit,
  onSelectAssignment,
}: Props) {
  function locationRestricted(locationId: string, dayKey: string) {
    const loc = locations.find((l) => l.id === locationId);
    if (loc?.status === "closed") return true;
    return statusEvents.some(
      (e) =>
        e.location_id === locationId &&
        e.status !== "open" &&
        assignmentOnDay(e.start_date, e.end_date, dayKey),
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="sticky left-0 z-10 min-w-[180px] bg-gray-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              Location
            </th>
            {days.map((day) => (
              <th
                key={day}
                className="min-w-[120px] px-2 py-3 text-center text-xs font-semibold text-gray-700"
              >
                {formatDayLabel(day)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {locations.map((location) => {
            const closedRow = location.status === "closed";
            return (
              <tr key={location.id} className="border-b border-gray-100">
                <td
                  className={[
                    "sticky left-0 z-10 px-3 py-3",
                    closedRow ? "bg-gray-900 text-orange-300" : "bg-gray-50",
                  ].join(" ")}
                >
                  <p className="font-semibold">{location.name}</p>
                  <p className="text-[11px] opacity-80">
                    {location.status} · cap {location.capacity ?? "—"}
                  </p>
                </td>
                {days.map((day) => {
                  const restricted = locationRestricted(location.id, day);
                  const dayAssignments = assignments.filter(
                    (row) =>
                      row.assignment.location_id === location.id &&
                      assignmentOnDay(
                        row.assignment.start_date,
                        row.assignment.end_date,
                        day,
                      ),
                  );
                  const daySlots = slots.filter(
                    (slot) =>
                      slot.location_id === location.id &&
                      assignmentOnDay(slot.start_date, slot.end_date, day) &&
                      slot.status === "open",
                  );

                  return (
                    <DayCell
                      key={`${location.id}-${day}`}
                      locationId={location.id}
                      dayKey={day}
                      canEdit={canEdit}
                      isClosed={restricted}
                    >
                      {daySlots.map((slot) => (
                        <div
                          key={slot.id}
                          className="mb-1 rounded border border-dashed border-orange-300 bg-orange-50/50 px-2 py-1 text-[10px] text-orange-800"
                        >
                          Open slot: {slot.title} ({slot.required_count} needed)
                        </div>
                      ))}
                      {dayAssignments.map((row) => (
                        <AssignmentCalendarCard
                          key={row.assignment.id}
                          row={row}
                          draggable={canEdit}
                          selected={selectedAssignmentId === row.assignment.id}
                          onSelect={() => onSelectAssignment(row.assignment.id)}
                        />
                      ))}
                    </DayCell>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
