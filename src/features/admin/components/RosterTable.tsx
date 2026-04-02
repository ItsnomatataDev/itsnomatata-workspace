import type {
  DutyRosterEntryRow,
  ProfileRosterUserRow,
} from "../services/adminService";

type RosterTableProps = {
  entries: DutyRosterEntryRow[];
  users: ProfileRosterUserRow[];
};

function formatTime(value?: string | null) {
  if (!value) return "--";
  return value.slice(0, 5);
}

export default function RosterTable({ entries, users }: RosterTableProps) {
  const userMap = new Map(users.map((user) => [user.id, user]));

  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
        No roster entries found for this roster.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-white/80">
          <thead className="bg-white/5 text-white/50">
            <tr>
              <th className="px-4 py-3 font-medium">Employee</th>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Shift</th>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const user = userMap.get(entry.user_id);

              return (
                <tr key={entry.id} className="border-t border-white/10">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-white">
                        {user?.full_name || user?.email || "Unknown user"}
                      </p>
                      <p className="text-xs text-white/45">
                        {user?.primary_role || "No role"}
                      </p>
                    </div>
                  </td>
                  <td className="px-4 py-3">{entry.shift_date}</td>
                  <td className="px-4 py-3">{entry.shift_name}</td>
                  <td className="px-4 py-3 text-white/65">
                    {formatTime(entry.start_time)} -{" "}
                    {formatTime(entry.end_time)}
                  </td>
                  <td className="px-4 py-3 text-white/65">
                    {entry.notes || "No notes"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
