import { useEffect, useState } from "react";
import { getTeamAttendanceToday } from "../services/attendanceService";
import type { AttendanceReportRow } from "../types/attendance";
import { formatDurationHms } from "../../../lib/utils/timeMath";

export default function TeamAttendancePanel({
  organizationId,
}: {
  organizationId: string;
}) {
  const [rows, setRows] = useState<AttendanceReportRow[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    void getTeamAttendanceToday(organizationId).then(setRows).catch(() => setRows([]));
  }, [organizationId]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-xl font-semibold text-white">Team Attendance</h3>
      <div className="mt-4 space-y-2">
        {rows.slice(0, 8).map((row) => (
          <div
            key={row.user_id}
            className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {row.full_name || row.email || "Team member"}
              </p>
              <p className="text-xs capitalize text-white/40">
                {row.status.replaceAll("_", " ")}
              </p>
            </div>
            <p className="font-mono text-xs text-orange-300">
              {formatDurationHms(row.work_seconds)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
