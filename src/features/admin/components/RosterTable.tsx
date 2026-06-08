import { CalendarDays, Sparkles, UserRound } from "lucide-react";
import {
  getDutyCategoryLabel,
  getExcludedUsersForDuty,
  type DutyAssignmentPreview,
  type DutyDefinitionRow,
  type DutyEligibilityOverrideRow,
  type DutyRosterMemberRow,
  type ProfileRosterUserRow,
} from "../services/adminService";

type RosterTableProps = {
  assignments: DutyAssignmentPreview[];
  users: ProfileRosterUserRow[];
  duties?: DutyDefinitionRow[];
  rosterMembers?: DutyRosterMemberRow[];
  overridesByDuty?: Map<string, DutyEligibilityOverrideRow[]>;
  currentUserId?: string | null;
  nextAssignees?: Record<string, string | null>;
  showMeta?: boolean;
};

const DAY_LABELS: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

function initials(name?: string | null, email?: string | null) {
  const value = name || email || "?";
  const parts = value.split(" ").filter(Boolean);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return value.slice(0, 2).toUpperCase();
}

export default function RosterTable({
  assignments,
  users,
  duties = [],
  rosterMembers = [],
  overridesByDuty,
  currentUserId,
  nextAssignees = {},
  showMeta = true,
}: RosterTableProps) {
  const userMap = new Map(users.map((user) => [user.id, user]));
  const dutyMap = new Map(duties.map((duty) => [duty.id, duty]));

  if (assignments.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-white/60 sm:px-6">
        No duty assignments are available for this roster preview.
      </div>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {assignments.map((assignment) => {
        const user = userMap.get(assignment.user_id);
        const duty = dutyMap.get(assignment.duty_id);
        const isMe = assignment.user_id === currentUserId;
        const nextUserId = nextAssignees[assignment.duty_id];
        const nextUser = nextUserId ? userMap.get(nextUserId) : null;
        const excluded =
          duty && showMeta
            ? getExcludedUsersForDuty({
                users,
                rosterMembers,
                duty,
                overrides: overridesByDuty?.get(duty.id) ?? [],
                allDuties: duties,
                weekStart: assignment.week_start,
              })
            : [];

        return (
          <article
            key={assignment.id}
            className={[
              "rounded-2xl border p-4 transition",
              isMe
                ? "border-orange-500/40 bg-orange-500/12 shadow-lg shadow-orange-950/20"
                : assignment.is_special_day
                  ? "border-amber-500/30 bg-amber-500/10"
                  : "border-white/10 bg-white/5",
            ].join(" ")}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-white">
                    {assignment.duty_name}
                  </h3>
                  {assignment.is_special_day ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                      <Sparkles size={11} />
                      {assignment.day_of_week
                        ? DAY_LABELS[assignment.day_of_week] ?? "Special"
                        : "Special"}
                    </span>
                  ) : null}
                  {isMe ? (
                    <span className="rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-black">
                      You're on duty
                    </span>
                  ) : null}
                </div>
                {showMeta ? (
                  <p className="mt-1 text-xs text-white/45">
                    {getDutyCategoryLabel(assignment.duty_category)}
                  </p>
                ) : null}
              </div>
              <CalendarDays size={18} className="text-orange-400" />
            </div>

            {assignment.description ? (
              <p className="mb-4 text-sm text-white/55">
                {assignment.description}
              </p>
            ) : null}

            <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/30 px-3 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-sm font-bold text-orange-200">
                {user ? initials(user.full_name, user.email) : <UserRound size={16} />}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-white">
                  {user?.full_name || user?.email || "Unknown user"}
                </p>
                <p className="truncate text-xs text-white/35">
                  {assignment.shift_date
                    ? assignment.shift_date
                    : `Week of ${assignment.week_start}`}
                </p>
              </div>
            </div>

            {showMeta ? (
              <div className="mt-4 space-y-2 text-xs text-white/45">
                <div className="flex items-center justify-between gap-3">
                  <span>Rotation status</span>
                  <span className="text-white/70">{assignment.rotation_status}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Eligible pool</span>
                  <span className="text-white/70">{assignment.eligible_count}</span>
                </div>
                {excluded.length > 0 ? (
                  <div>
                    <span className="block text-white/35">Excluded</span>
                    <span className="mt-1 block text-white/60">
                      {excluded
                        .slice(0, 3)
                        .map((item) => item.full_name || item.email || "Unknown")
                        .join(", ")}
                      {excluded.length > 3 ? ` +${excluded.length - 3} more` : ""}
                    </span>
                  </div>
                ) : null}
                {nextUser ? (
                  <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                    <span className="block text-white/35">Next rotation preview</span>
                    <span className="mt-1 block text-orange-100">
                      {nextUser.full_name || nextUser.email || "Unknown user"}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
