import { useDraggable } from "@dnd-kit/core";
import { formatDayLabel, formatTimeRange } from "../utils/calendarDates";
import type { PlannerAssignmentCardModel } from "./plannerBoardTypes";

type Props = {
  assignment: PlannerAssignmentCardModel;
  draggable?: boolean;
  selected?: boolean;
  muted?: boolean;
  tone?: "dark" | "light";
  onSelect?: () => void;
};

export default function SimpleAssignmentCard({
  assignment,
  draggable = false,
  selected,
  muted,
  tone = "dark",
  onSelect,
}: Props) {
  const drag = useDraggable({
    id: `assignment-${assignment.id}`,
    data: { type: "assignment", assignmentId: assignment.id },
    disabled: !draggable,
  });

  const statusClass = tone === "light"
    ? assignment.status === "confirmed"
      ? "border-emerald-300 bg-emerald-50"
      : assignment.status === "cancelled"
        ? "border-gray-200 bg-gray-100 opacity-60"
        : "border-orange-300 bg-orange-50"
    : assignment.status === "confirmed"
      ? "border-emerald-300/30 bg-emerald-500/10"
      : assignment.status === "cancelled"
        ? "border-white/10 bg-white/5 opacity-60"
        : "border-orange-300/30 bg-orange-500/10";
  const primaryText = tone === "light" ? "text-gray-950" : "text-white";
  const secondaryText = tone === "light" ? "text-gray-700" : "text-white/55";
  const chipWrapText = tone === "light" ? "text-gray-700" : "text-white/60";
  const chipClass = tone === "light" ? "bg-white text-gray-800 shadow-sm" : "bg-white/10";

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
          <p className={["font-semibold", primaryText].join(" ")}>
            {assignment.employeeName || assignment.employeeEmail || "Employee"}
          </p>
          <p className={["mt-0.5", secondaryText].join(" ")}>
            {assignment.roleName ?? "Assignment"}
          </p>
        </div>
        {assignment.isMine ? (
          <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
            Mine
          </span>
        ) : null}
      </div>
      <div className={["mt-2 flex flex-wrap gap-1.5 text-[10px]", chipWrapText].join(" ")}>
        <span className={["rounded-full px-2 py-0.5", chipClass].join(" ")}>
          {assignment.locationName}
        </span>
        <span className={["rounded-full px-2 py-0.5", chipClass].join(" ")}>
          {formatDayLabel(assignment.startDate)}
        </span>
        <span className={["rounded-full px-2 py-0.5", chipClass].join(" ")}>
          {formatTimeRange(assignment.startTime, assignment.endTime)}
        </span>
      </div>
    </button>
  );
}
