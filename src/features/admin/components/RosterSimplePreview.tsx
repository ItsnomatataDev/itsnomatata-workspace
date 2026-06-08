import { getDutyCategoryLabel, type DutyAssignmentPreview, type ProfileRosterUserRow } from "../services/adminService";

type RosterSimplePreviewProps = {
  title: string;
  assignments: DutyAssignmentPreview[];
  users: ProfileRosterUserRow[];
  emptyMessage?: string;
};

export default function RosterSimplePreview({
  title,
  assignments,
  users,
  emptyMessage = "No assignments yet. Save your roster setup and generate assignments.",
}: RosterSimplePreviewProps) {
  const userMap = new Map(users.map((user) => [user.id, user]));

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#0f0f0f] p-5">
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {assignments.length === 0 ? (
        <p className="mt-3 text-sm text-white/45">{emptyMessage}</p>
      ) : (
        <div className="mt-4 space-y-2">
          {assignments.map((assignment) => {
            const user = userMap.get(assignment.user_id);
            return (
              <div
                key={assignment.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#050505] px-4 py-3"
              >
                <div>
                  <p className="font-medium text-white">{assignment.duty_name}</p>
                  <p className="text-xs text-white/40">
                    {getDutyCategoryLabel(assignment.duty_category)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-orange-200">
                    {user?.full_name || user?.email || "Unassigned"}
                  </p>
                  <p className="text-xs text-white/35">
                    {assignment.shift_date ?? `Week of ${assignment.week_start}`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
