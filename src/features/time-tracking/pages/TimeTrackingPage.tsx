import { Link } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import AttendanceClockCard from "../../attendance/components/AttendanceClockCard";

export default function TimeTrackingPage() {
  const auth = useAuth();
  const userId = auth?.user?.id ?? null;
  const organizationId = auth?.profile?.organization_id ?? null;
  const role = auth?.profile?.primary_role;
  const isAdmin = role === "admin" || role === "manager";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Attendance</h1>
            <p className="mt-2 text-sm text-white/55">
              Clock in for presence here. Task/card timers stay separate.
            </p>
          </div>
          {isAdmin ? (
            <Link
              to="/admin/attendance"
              className="inline-flex items-center justify-center rounded-2xl border border-orange-500/30 bg-orange-500/10 px-4 py-2 text-sm font-semibold text-orange-200 transition hover:bg-orange-500/15"
            >
              Admin attendance
            </Link>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <AttendanceClockCard organizationId={organizationId} userId={userId} />
          <div className="rounded-3xl border border-white/10 bg-neutral-950 p-5">
            <h2 className="text-lg font-semibold">How this works</h2>
            <div className="mt-4 space-y-3 text-sm text-white/55">
              <p>
                Attendance answers whether you are working today.
              </p>
              <p>
                Task timers answer what card, board, or client you are working on.
              </p>
              <p>
                You can stay clocked in while starting and stopping task timers.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
