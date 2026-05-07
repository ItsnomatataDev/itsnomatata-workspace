import { formatDurationHms } from "../../../lib/utils/timeMath";
import { useAttendance } from "../hooks/useAttendance";

export default function AttendanceHistoryTable({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId?: string;
}) {
  const attendance = useAttendance({ userId, organizationId });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-xl font-semibold text-white">Today's Sessions</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-[0.18em] text-white/40">
            <tr>
              <th className="py-3">Clock in</th>
              <th className="py-3">Clock out</th>
              <th className="py-3">Worked</th>
              <th className="py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {attendance.sessions.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-6 text-center text-white/45">
                  No attendance sessions today.
                </td>
              </tr>
            ) : (
              attendance.sessions.map((session) => (
                <tr key={session.id}>
                  <td className="py-3">
                    {new Date(session.clock_in_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="py-3">
                    {session.clock_out_at
                      ? new Date(session.clock_out_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Active"}
                  </td>
                  <td className="py-3 font-mono">
                    {formatDurationHms(session.work_seconds)}
                  </td>
                  <td className="py-3 capitalize">{session.status.replaceAll("_", " ")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
