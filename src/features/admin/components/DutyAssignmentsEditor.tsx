import { Shuffle } from "lucide-react";
import {
  buildDefaultDutyAssignments,
  buildEligiblePool,
  getCurrentDutyWeekStart,
  validateDutyAssignments,
  type DutyDefinitionRow,
  type ProfileRosterUserRow,
} from "../services/adminService";

type DutyAssignmentsEditorProps = {
  duties: DutyDefinitionRow[];
  selectedDutyIds: string[];
  selectedUserIds: string[];
  users: ProfileRosterUserRow[];
  assignments: Record<string, string | null>;
  onAssignmentsChange: (next: Record<string, string | null>) => void;
  showValidation?: boolean;
};

export default function DutyAssignmentsEditor({
  duties,
  selectedDutyIds,
  selectedUserIds,
  users,
  assignments,
  onAssignmentsChange,
  showValidation = true,
}: DutyAssignmentsEditorProps) {
  const selectedDuties = selectedDutyIds
    .map((dutyId) => duties.find((duty) => duty.id === dutyId))
    .filter((duty): duty is DutyDefinitionRow => Boolean(duty));

  const rosterMembers = selectedUserIds.map((userId, index) => ({
    user_id: userId,
    sort_order: index,
  }));
  const weekStart = getCurrentDutyWeekStart();

  const getAssignableUsers = (duty: DutyDefinitionRow) =>
    buildEligiblePool({
      users,
      rosterMembers,
      duty,
      overrides: [],
      allDuties: duties,
      weekStart,
    });

  const validationIssues = showValidation
    ? validateDutyAssignments({
        dutyIds: selectedDutyIds,
        assignments,
        userIds: selectedUserIds,
        duties,
      })
    : [];

  const handleAutoFill = () => {
    onAssignmentsChange(
      buildDefaultDutyAssignments({
        dutyIds: selectedDutyIds,
        userIds: selectedUserIds,
        duties,
      }),
    );
  };

  if (selectedDuties.length === 0) return null;

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">Week-one assignments</p>
          <p className="mt-1 text-xs text-white/40">
            Pick who starts on each duty. Later weeks rotate from this setup.
          </p>
        </div>
        <button
          type="button"
          onClick={handleAutoFill}
          disabled={selectedUserIds.length === 0}
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium text-white/75 hover:bg-white/5 disabled:opacity-40"
        >
          <Shuffle size={14} />
          Auto-fill
        </button>
      </div>

      {validationIssues.length > 0 ? (
        <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {validationIssues.map((issue) => (
            <p key={issue}>{issue}</p>
          ))}
        </div>
      ) : null}

      <div className="space-y-2">
        {selectedDuties.map((duty) => {
          const assignableUsers = getAssignableUsers(duty);
          const isFixedDuty = duty.category === "fixed_person";

          return (
            <label
              key={duty.id}
              className="grid gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,0.9fr)] sm:items-center"
            >
              <span>
                <span className="block text-sm font-medium text-white">
                  {duty.name}
                </span>
                <span className="block text-xs text-white/35">
                  {duty.category.replaceAll("_", " ")}
                  {isFixedDuty ? " - permanent owner" : ""}
                </span>
              </span>
              <select
                value={assignments[duty.id] ?? duty.fixed_user_id ?? ""}
                onChange={(event) =>
                  onAssignmentsChange({
                    ...assignments,
                    [duty.id]: event.target.value || null,
                  })
                }
                disabled={isFixedDuty}
                className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-500 disabled:opacity-70"
              >
                <option value="">Unassigned</option>
                {assignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name || user.email || "Unknown user"}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
    </section>
  );
}
