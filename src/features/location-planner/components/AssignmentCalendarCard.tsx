import { useDraggable } from "@dnd-kit/core";
import type { AdminAssignmentRow } from "../types";
import { formatTimeRange } from "../utils/calendarDates";

type Props = {
  row: AdminAssignmentRow;
  selected?: boolean;
  draggable?: boolean;
  muted?: boolean;
  onSelect?: () => void;
};

export default function AssignmentCalendarCard({
  row,
  selected,
  draggable = false,
  muted,
  onSelect,
}: Props) {
  const { assignment } = row;
  const drag = useDraggable({
    id: `assignment-${assignment.id}`,
    data: { type: "assignment", assignmentId: assignment.id },
    disabled: !draggable,
  });

  const statusClass =
    assignment.status === "confirmed"
      ? "border-emerald-400/50 bg-emerald-50"
      : assignment.status === "cancelled"
        ? "border-gray-300 bg-gray-100 opacity-60"
        : "border-orange-300 bg-orange-50";

  return (
    <button
      ref={drag.setNodeRef}
      type="button"
      onClick={onSelect}
      style={
        drag.transform
          ? { transform: `translate3d(${drag.transform.x}px, ${drag.transform.y}px, 0)` }
          : undefined
      }
      className={[
        "mb-1 w-full rounded-lg border px-2 py-1.5 text-left text-[11px] transition",
        statusClass,
        selected ? "ring-2 ring-orange-500" : "",
        muted ? "opacity-70" : "",
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        drag.isDragging ? "opacity-40" : "",
      ].join(" ")}
      {...(draggable ? { ...drag.listeners, ...drag.attributes } : {})}
    >
      <p className="font-semibold text-gray-900">
        {row.employee_name || row.employee_email || "Employee"}
      </p>
      <p className="text-gray-600">{row.role_name ?? "Temporary role"}</p>
      <p className="text-gray-500">
        {formatTimeRange(assignment.start_time, assignment.end_time)}
      </p>
      <span className="mt-1 inline-block rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-bold uppercase text-gray-700">
        {assignment.status}
      </span>
    </button>
  );
}
