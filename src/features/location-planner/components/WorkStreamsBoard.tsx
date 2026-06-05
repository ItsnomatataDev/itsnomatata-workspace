import { useDroppable } from "@dnd-kit/core";
import { BriefcaseBusiness } from "lucide-react";
import { formatDayLabel, formatTimeRange } from "../utils/calendarDates";
import SimpleAssignmentCard from "./SimpleAssignmentCard";
import type { PlannerWorkStream } from "./plannerBoardTypes";

type Props = {
  streams: PlannerWorkStream[];
  canEdit?: boolean;
  selectedAssignmentId?: string | null;
  onSelectAssignment?: (id: string) => void;
};

function StreamColumn({
  stream,
  canEdit,
  selectedAssignmentId,
  onSelectAssignment,
}: {
  stream: PlannerWorkStream;
  canEdit?: boolean;
  selectedAssignmentId?: string | null;
  onSelectAssignment?: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stream-${stream.id}`,
    data: {
      type: "stream",
      streamId: stream.id,
      slotId: stream.slotId,
      locationId: stream.locationId,
      temporaryRoleId: stream.temporaryRoleId,
      startDate: stream.startDate,
      endDate: stream.endDate,
      startTime: stream.startTime,
      endTime: stream.endTime,
    },
    disabled: !canEdit || !stream.locationId,
  });

  return (
    <section
      ref={setNodeRef}
      className={[
        "min-h-[280px] rounded-2xl border bg-white p-4 shadow-sm transition",
        isOver ? "border-orange-400 bg-orange-50" : "border-gray-200",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-950">{stream.title}</p>
          <p className="mt-1 text-xs text-gray-500">{stream.subtitle}</p>
        </div>
        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
          {stream.assignments.length}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-gray-500">
        <span className="rounded-full bg-gray-100 px-2 py-0.5">
          {formatDayLabel(stream.startDate)}
        </span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5">
          {formatTimeRange(stream.startTime, stream.endTime)}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {stream.assignments.length > 0 ? (
          stream.assignments.map((assignment) => (
            <SimpleAssignmentCard
              key={assignment.id}
              assignment={assignment}
              draggable={canEdit}
              selected={selectedAssignmentId === assignment.id}
              onSelect={onSelectAssignment ? () => onSelectAssignment(assignment.id) : undefined}
            />
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-gray-200 px-3 py-8 text-center text-xs text-gray-400">
            Drop an employee assignment here
          </div>
        )}
      </div>
    </section>
  );
}

export default function WorkStreamsBoard({
  streams,
  canEdit,
  selectedAssignmentId,
  onSelectAssignment,
}: Props) {
  if (streams.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
        <BriefcaseBusiness size={32} className="mx-auto mb-3 text-gray-300" />
        <p className="font-semibold text-gray-900">No work streams for this date</p>
        <p className="mt-1 text-sm text-gray-500">Create slots like Editor or Social Media to start assigning people.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {streams.map((stream) => (
        <StreamColumn
          key={stream.id}
          stream={stream}
          canEdit={canEdit}
          selectedAssignmentId={selectedAssignmentId}
          onSelectAssignment={onSelectAssignment}
        />
      ))}
    </div>
  );
}
