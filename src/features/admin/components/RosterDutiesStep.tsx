import { ChevronRight, Edit2, Plus } from "lucide-react";
import DutyAssignmentsEditor from "./DutyAssignmentsEditor";
import { DUTY_TYPE_OPTIONS } from "../services/dutyRosterEngine";
import type { DutyDefinitionRow, ProfileRosterUserRow } from "../services/adminService";

type RosterDutiesStepProps = {
  duties: DutyDefinitionRow[];
  activeDutyIds: string[];
  participantIds: string[];
  users: ProfileRosterUserRow[];
  assignments: Record<string, string | null>;
  onAssignmentsChange: (next: Record<string, string | null>) => void;
  onActiveDutyIdsChange: (next: string[]) => void;
  onEditDuty: (duty: DutyDefinitionRow) => void;
  onCreateDuty: () => void;
  onSave: () => Promise<void>;
  onSaveAndGenerate: () => Promise<void>;
  saving?: boolean;
  generating?: boolean;
  dirty?: boolean;
  participantsDirty?: boolean;
  rotationWeekCount?: number;
};

function getDutyTypeLabel(category: DutyDefinitionRow["category"]) {
  return (
    DUTY_TYPE_OPTIONS.find((option) => option.value === category)?.label ??
    category.replaceAll("_", " ")
  );
}

export default function RosterDutiesStep({
  duties,
  activeDutyIds,
  participantIds,
  users,
  assignments,
  onAssignmentsChange,
  onActiveDutyIdsChange,
  onEditDuty,
  onCreateDuty,
  onSave,
  onSaveAndGenerate,
  saving = false,
  generating = false,
  dirty = false,
  participantsDirty = false,
  rotationWeekCount = 4,
}: RosterDutiesStepProps) {
  const activeSet = new Set(activeDutyIds);

  const toggleDuty = (dutyId: string) => {
    onActiveDutyIdsChange(
      activeSet.has(dutyId)
        ? activeDutyIds.filter((id) => id !== dutyId)
        : [...activeDutyIds, dutyId],
    );
  };

  const canGenerate =
    !participantsDirty &&
    !saving &&
    !generating &&
    participantIds.length > 0 &&
    activeDutyIds.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Configure duties</h3>
          <p className="mt-1 text-sm text-white/45">
            Activate duties, assign who starts on each one, then generate the
            monthly rotation.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateDuty}
          className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-white hover:bg-white/5"
        >
          <Plus size={16} />
          New duty
        </button>
      </div>

      {participantsDirty ? (
        <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Save participants in step 1 before generating the rotation.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onActiveDutyIdsChange(duties.map((duty) => duty.id))}
          className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-white/75 hover:bg-white/5"
        >
          Activate all
        </button>
        <button
          type="button"
          onClick={() => onActiveDutyIdsChange([])}
          className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-white/75 hover:bg-white/5"
        >
          Deactivate all
        </button>
        <button
          type="button"
          disabled={!dirty || saving || activeDutyIds.length === 0}
          onClick={() => void onSave()}
          className="rounded-xl border border-white/[0.08] px-4 py-2 text-sm text-white/75 hover:bg-white/5 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save duties only"}
        </button>
        <button
          type="button"
          disabled={!canGenerate}
          onClick={() => void onSaveAndGenerate()}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
        >
          {generating
            ? `Generating ${rotationWeekCount} weeks...`
            : `Save & generate ${rotationWeekCount}-week rotation`}
          <ChevronRight size={16} />
        </button>
      </div>

      {duties.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0f0f0f] p-8 text-center">
          <p className="text-white/70">No duties created for this office yet.</p>
          <button
            type="button"
            onClick={onCreateDuty}
            className="mt-4 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400"
          >
            Create your first duty
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {duties.map((duty) => {
            const isActive = activeSet.has(duty.id);
            return (
              <div
                key={duty.id}
                className={[
                  "rounded-2xl border p-4",
                  isActive
                    ? "border-orange-500/25 bg-orange-500/5"
                    : "border-white/[0.08] bg-[#0f0f0f]",
                ].join(" ")}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => toggleDuty(duty.id)}
                      className="mt-1 h-4 w-4 accent-orange-500"
                    />
                    <span>
                      <span className="block text-base font-semibold text-white">
                        {duty.name}
                      </span>
                      <span className="mt-1 block text-sm text-white/45">
                        {getDutyTypeLabel(duty.category)}
                        {!duty.is_active ? " - inactive in office" : ""}
                      </span>
                      {duty.description ? (
                        <span className="mt-1 block text-xs text-white/35">
                          {duty.description}
                        </span>
                      ) : null}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => onEditDuty(duty)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] px-3 py-2 text-xs text-white/70 hover:bg-white/5"
                  >
                    <Edit2 size={14} />
                    Edit duty
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeDutyIds.length > 0 && participantIds.length > 0 ? (
        <DutyAssignmentsEditor
          duties={duties}
          selectedDutyIds={activeDutyIds}
          selectedUserIds={participantIds}
          users={users}
          assignments={assignments}
          onAssignmentsChange={onAssignmentsChange}
        />
      ) : null}
    </div>
  );
}
