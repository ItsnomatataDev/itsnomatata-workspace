import { useState } from "react";
import { ChevronDown, RefreshCw } from "lucide-react";
import DutyAssignmentsEditor from "./DutyAssignmentsEditor";
import type {
  DutyAssignmentHistoryRow,
  DutyDefinitionRow,
  ProfileRosterUserRow,
} from "../services/adminService";

type RosterAdvancedSettingsProps = {
  assignmentHistory: DutyAssignmentHistoryRow[];
  duties: DutyDefinitionRow[];
  selectedDutyIds: string[];
  selectedUserIds: string[];
  users: ProfileRosterUserRow[];
  assignments: Record<string, string | null>;
  onAssignmentsChange: (next: Record<string, string | null>) => void;
  onSaveAssignments: () => Promise<void>;
  onRegenerateWeek: () => Promise<void>;
  onGenerateFullRotation?: () => Promise<void>;
  savingAssignments?: boolean;
  regenerating?: boolean;
  generatingRotation?: boolean;
  rotationWeekCount?: number;
};

export default function RosterAdvancedSettings({
  assignmentHistory,
  duties,
  selectedDutyIds,
  selectedUserIds,
  users,
  assignments,
  onAssignmentsChange,
  onSaveAssignments,
  onRegenerateWeek,
  onGenerateFullRotation,
  savingAssignments = false,
  regenerating = false,
  generatingRotation = false,
  rotationWeekCount = 26,
}: RosterAdvancedSettingsProps) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-2xl border border-white/8#0f0f0f]">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div>
          <p className="font-semibold text-white">Advanced settings</p>
          <p className="text-sm text-white/45">
            Manual overrides, regeneration, and assignment history.
          </p>
        </div>
        <ChevronDown
          size={18}
          className={[
            "text-white/50 transition",
            open ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>

      {open ? (
        <div className="space-y-5 border-t border-white/8 py-5">
          <div className="flex flex-wrap gap-2">
            {onGenerateFullRotation ? (
              <button
                type="button"
                disabled={generatingRotation || regenerating}
                onClick={() => void onGenerateFullRotation()}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
              >
                <RefreshCw size={15} />
                {generatingRotation
                  ? `Generating ${rotationWeekCount} weeks...`
                  : `Generate ${rotationWeekCount}-week rotation`}
              </button>
            ) : null}
            <button
              type="button"
              disabled={regenerating || generatingRotation}
              onClick={() => void onRegenerateWeek()}
              className="inline-flex items-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm text-orange-100 hover:bg-orange-500/20 disabled:opacity-50"
            >
              <RefreshCw size={15} />
              {regenerating ? "Regenerating..." : "Regenerate current week"}
            </button>
          </div>

          <DutyAssignmentsEditor
            duties={duties}
            selectedDutyIds={selectedDutyIds}
            selectedUserIds={selectedUserIds}
            users={users}
            assignments={assignments}
            onAssignmentsChange={onAssignmentsChange}
            showValidation={false}
          />

          <button
            type="button"
            disabled={savingAssignments || selectedDutyIds.length === 0}
            onClick={() => void onSaveAssignments()}
            className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
          >
            {savingAssignments ? "Saving..." : "Save manual overrides"}
          </button>

          <div>
            <h4 className="mb-3 text-sm font-semibold text-white">
              Assignment history
            </h4>
            {assignmentHistory.length === 0 ? (
              <p className="text-sm text-white/45">No history recorded yet.</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {assignmentHistory.slice(0, 50).map((entry) => {
                  const duty = duties.find((item) => item.id === entry.duty_id);
                  const user = users.find((item) => item.id === entry.user_id);
                  return (
                    <div
                      key={entry.id}
                      className="rounded-xl border border-white/[0.08] bg-[#050505] px-3 py-2 text-sm"
                    >
                      <p className="text-white">
                        {duty?.name ?? "Duty"} - {entry.assignment_week}
                      </p>
                      <p className="text-xs text-white/40">
                        {user?.full_name || user?.email || "Unknown"} ({entry.source})
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
