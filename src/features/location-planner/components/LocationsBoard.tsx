import { useDroppable } from "@dnd-kit/core";
import { MapPin, Plus, Trash2 } from "lucide-react";
import SimpleAssignmentCard from "./SimpleAssignmentCard";
import { formatTimeRange } from "../utils/calendarDates";
import type { PlannerLocationColumn, PlannerWorkStream } from "./plannerBoardTypes";

type Props = {
  locations: PlannerLocationColumn[];
  selectedDate: string;
  canEdit?: boolean;
  selectedAssignmentId?: string | null;
  onSelectAssignment?: (id: string) => void;
  onCreateSlot?: (locationId: string) => void;
  onDeleteSlot?: (slotId: string) => void;
};

function SlotDropZone({
  slot,
  canEdit,
  selectedAssignmentId,
  onSelectAssignment,
  onDeleteSlot,
}: {
  slot: PlannerWorkStream;
  canEdit?: boolean;
  selectedAssignmentId?: string | null;
  onSelectAssignment?: (id: string) => void;
  onDeleteSlot?: (slotId: string) => void;
}) {
  const isFull =
    slot.requiredCount !== null && slot.assignments.length >= slot.requiredCount;
  const { setNodeRef, isOver } = useDroppable({
    id: `location-slot-${slot.id}`,
    data: {
      type: "stream",
      streamId: slot.id,
      slotId: slot.slotId,
      locationId: slot.locationId,
      temporaryRoleId: slot.temporaryRoleId,
      startDate: slot.startDate,
      endDate: slot.endDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
    },
    disabled: !canEdit || !slot.locationId,
  });

  return (
    <div
      ref={setNodeRef}
      className={[
        "rounded-xl border border-dashed p-3 transition",
        isOver ? "border-orange-300 bg-orange-500/15" : "border-orange-300/25 bg-orange-500/10",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-orange-50">{slot.title}</p>
          <p className="mt-0.5 text-[10px] text-orange-100/65">
            {slot.subtitle} · {formatTimeRange(slot.startTime, slot.endTime)}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
              isFull ? "bg-emerald-400/15 text-emerald-200" : "bg-white/10 text-orange-100",
            ].join(" ")}
          >
            {slot.requiredCount === null
              ? `${slot.assignments.length} assigned`
              : `${slot.assignments.length} / ${slot.requiredCount}`}
          </span>
          {canEdit && slot.slotId ? (
            <button
              type="button"
              onClick={() => onDeleteSlot?.(slot.slotId ?? "")}
              aria-label={`Delete ${slot.title} shift requirement`}
              title="Delete shift requirement"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-red-400/20 bg-black/25 text-red-200 shadow-sm transition hover:border-red-300 hover:bg-red-500/10"
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {slot.assignments.length > 0 ? (
          slot.assignments.map((assignment) => (
            <SimpleAssignmentCard
              key={assignment.id}
              assignment={assignment}
              draggable={canEdit}
              selected={selectedAssignmentId === assignment.id}
              onSelect={onSelectAssignment ? () => onSelectAssignment(assignment.id) : undefined}
            />
          ))
        ) : (
          <p className="rounded-lg bg-black/20 px-3 py-4 text-center text-[11px] text-orange-100/65">
            Drop an available employee here
          </p>
        )}
      </div>
    </div>
  );
}

function LocationColumn({
  location,
  selectedDate,
  canEdit,
  selectedAssignmentId,
  onSelectAssignment,
  onCreateSlot,
  onDeleteSlot,
}: {
  location: PlannerLocationColumn;
  selectedDate: string;
  canEdit?: boolean;
  selectedAssignmentId?: string | null;
  onSelectAssignment?: (id: string) => void;
  onCreateSlot?: (locationId: string) => void;
  onDeleteSlot?: (slotId: string) => void;
}) {
  const closed = location.status === "closed";
  const slotAssignmentIds = new Set(
    (location.slots ?? []).flatMap((slot) =>
      slot.assignments.map((assignment) => assignment.id),
    ),
  );
  const looseAssignments = location.assignments.filter(
    (assignment) => !slotAssignmentIds.has(assignment.id),
  );
  const { setNodeRef, isOver } = useDroppable({
    id: `location-${location.id}`,
    data: {
      type: "location",
      locationId: location.id,
      startDate: selectedDate,
      endDate: selectedDate,
    },
    disabled: !canEdit || closed,
  });

  return (
    <section
      ref={setNodeRef}
      className={[
        "min-h-[280px] rounded-2xl border p-4 shadow-2xl shadow-black/25 transition",
        closed ? "border-gray-800 bg-gray-950 text-white" : "bg-white",
        isOver
          ? "border-orange-300 bg-orange-500/15 text-white"
          : closed
            ? "border-white/10"
            : "border-white/10 bg-white/[0.06] text-white",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{location.name}</p>
          <p className={["mt-1 text-xs", closed ? "text-white/50" : "text-white/45"].join(" ")}>
            {location.status} · cap {location.capacity ?? "none"}
          </p>
        </div>
        <span
          className={[
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            closed ? "bg-white/10 text-white" : "bg-white/10 text-white/70",
          ].join(" ")}
        >
          {location.assignments.length}
        </span>
      </div>

      {canEdit && !closed ? (
        <button
          type="button"
          onClick={() => onCreateSlot?.(location.id)}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-300/25 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-100 hover:bg-orange-500/15"
        >
          <Plus size={14} />
          Add shift requirement
        </button>
      ) : null}

      <div className="mt-4 space-y-3">
        {(location.slots ?? []).length > 0 ? (
          location.slots?.map((slot) => (
            <SlotDropZone
              key={slot.id}
              slot={slot}
              canEdit={canEdit && !closed}
              selectedAssignmentId={selectedAssignmentId}
              onSelectAssignment={onSelectAssignment}
              onDeleteSlot={onDeleteSlot}
            />
          ))
        ) : (
          <div
            className={[
              "rounded-xl border border-dashed px-3 py-8 text-center text-xs",
              closed ? "border-white/10 text-white/35" : "border-white/10 text-white/35",
            ].join(" ")}
          >
            {closed ? "Location closed" : "No shift requirements yet. Add a requirement, then assign employees."}
          </div>
        )}
      </div>

      {looseAssignments.length > 0 ? (
        <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
          <p className={["text-[10px] font-semibold uppercase tracking-wide", closed ? "text-white/45" : "text-white/35"].join(" ")}>
            Other assignments
          </p>
          {looseAssignments.map((assignment) => (
            <SimpleAssignmentCard
              key={assignment.id}
              assignment={assignment}
              draggable={canEdit && !closed}
              selected={selectedAssignmentId === assignment.id}
              onSelect={onSelectAssignment ? () => onSelectAssignment(assignment.id) : undefined}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

export default function LocationsBoard({
  locations,
  selectedDate,
  canEdit,
  selectedAssignmentId,
  onSelectAssignment,
  onCreateSlot,
  onDeleteSlot,
}: Props) {
  if (locations.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.06] px-6 py-14 text-center">
        <MapPin size={32} className="mx-auto mb-3 text-white/25" />
        <p className="font-semibold text-white">No locations yet</p>
        <p className="mt-1 text-sm text-white/45">Add locations to start planning assignments.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {locations.map((location) => (
        <LocationColumn
          key={location.id}
          location={location}
          selectedDate={selectedDate}
          canEdit={canEdit}
          selectedAssignmentId={selectedAssignmentId}
          onSelectAssignment={onSelectAssignment}
          onCreateSlot={onCreateSlot}
          onDeleteSlot={onDeleteSlot}
        />
      ))}
    </div>
  );
}
