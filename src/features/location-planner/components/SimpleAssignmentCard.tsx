import { useDraggable } from "@dnd-kit/core";
import { formatDayLabel, formatTimeRange } from "../utils/calendarDates";
import type { PlannerAssignmentCardModel } from "./plannerBoardTypes";

type Props = {
  assignment: PlannerAssignmentCardModel;
  draggable?: boolean;
  selected?: boolean;
  muted?: boolean;
  onSelect?: () => void;
};

export default function SimpleAssignmentCard({
  assignment,
  draggable = false,
  selected,
  muted,
  onSelect,
}: Props) {
  const drag = useDraggable({
    id: `assignment-${assignment.id}`,
    data: { type: "assignment", assignmentId: assignment.id },
    disabled: !draggable,
  });

  const statusClass =
    assignment.status === "confirmed"
      ? "border-emerald-300 bg-emerald-50"
      : assignment.status === "cancelled"
        ? "border-gray-200 bg-gray-100 opacity-60"
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
        "w-full rounded-xl border px-3 py-2 text-left text-xs transition",
        statusClass,
        selected ? "ring-2 ring-orange-500" : "",
        muted ? "opacity-70" : "",
        draggable ? "cursor-grab active:cursor-grabbing" : onSelect ? "cursor-pointer" : "cursor-default",
        drag.isDragging ? "opacity-40" : "",
        assignment.isMine ? "shadow-sm ring-1 ring-orange-300" : "",
      ].join(" ")}
      {...(draggable ? { ...drag.listeners, ...drag.attributes } : {})}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-950">
            {assignment.employeeName || assignment.employeeEmail || "Employee"}
          </p>
          <p className="mt-0.5 text-gray-600">{assignment.roleName ?? "Work stream"}</p>
        </div>
        {assignment.isMine ? (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
            Mine
          </span>
        ) : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-gray-600">
        <span className="rounded-full bg-white/80 px-2 py-0.5">
          {assignment.locationName}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5">
          {formatDayLabel(assignment.startDate)}
        </span>
        <span className="rounded-full bg-white/80 px-2 py-0.5">
          {formatTimeRange(assignment.startTime, assignment.endTime)}
        </span>
      </div>
    </button>
  );
}
