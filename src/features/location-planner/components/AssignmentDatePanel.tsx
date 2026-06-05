import { CalendarDays } from "lucide-react";
import { formatDayLabel } from "../utils/calendarDates";
import SimpleAssignmentCard from "./SimpleAssignmentCard";
import type { PlannerAssignmentCardModel } from "./plannerBoardTypes";

type Props = {
  selectedDate: string;
  assignments: PlannerAssignmentCardModel[];
  onDateChange: (date: string) => void;
  selectedAssignmentId?: string | null;
  canEdit?: boolean;
  onSelectAssignment?: (id: string) => void;
};

export default function AssignmentDatePanel({
  selectedDate,
  assignments,
  onDateChange,
  selectedAssignmentId,
  canEdit,
  onSelectAssignment,
}: Props) {
  const byLocation = assignments.reduce<Record<string, PlannerAssignmentCardModel[]>>(
    (acc, assignment) => {
      const key = assignment.locationName || "No location";
      acc[key] = [...(acc[key] ?? []), assignment];
      return acc;
    },
    {},
  );

  return (
    <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-gray-950">
            <CalendarDays size={17} className="text-orange-500" />
            {formatDayLabel(selectedDate)}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {assignments.length} assignment{assignments.length === 1 ? "" : "s"} on this date
          </p>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={(event) => onDateChange(event.target.value)}
          className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-orange-500"
        />
      </div>

      <div className="mt-4 space-y-4">
        {assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-400">
            No one has been assigned on this date yet.
          </div>
        ) : (
          Object.entries(byLocation).map(([locationName, locationAssignments]) => (
            <section key={locationName}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {locationName}
                </p>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
                  {locationAssignments.length}
                </span>
              </div>
              <div className="space-y-2">
                {locationAssignments.map((assignment) => (
                  <SimpleAssignmentCard
                    key={assignment.id}
                    assignment={assignment}
                    draggable={canEdit}
                    selected={selectedAssignmentId === assignment.id}
                    onSelect={
                      onSelectAssignment ? () => onSelectAssignment(assignment.id) : undefined
                    }
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
