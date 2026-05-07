import { Clock3, Coffee } from "lucide-react";
import { formatDurationHms } from "../../../lib/utils/timeMath";
import { useAttendance } from "../hooks/useAttendance";

export default function TodayAttendanceCard({
  userId,
  organizationId,
}: {
  userId: string;
  organizationId?: string;
}) {
  const attendance = useAttendance({ userId, organizationId });

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-xl font-semibold text-white">Today's Attendance</h3>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-orange-500/10 p-4">
          <Clock3 className="mb-2 h-4 w-4 text-orange-300" />
          <p className="text-xs text-white/45">Worked</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {formatDurationHms(attendance.workedTodaySeconds)}
          </p>
        </div>
        <div className="rounded-xl bg-amber-500/10 p-4">
          <Coffee className="mb-2 h-4 w-4 text-amber-300" />
          <p className="text-xs text-white/45">Break</p>
          <p className="mt-1 font-mono text-lg font-semibold text-white">
            {formatDurationHms(attendance.breakSeconds)}
          </p>
        </div>
        <div className="rounded-xl bg-white/5 p-4">
          <p className="text-xs text-white/45">Sessions</p>
          <p className="mt-1 text-2xl font-semibold text-white">
            {attendance.sessions.length}
          </p>
        </div>
      </div>
    </div>
  );
}
