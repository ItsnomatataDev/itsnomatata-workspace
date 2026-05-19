import { Link } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import AttendanceClockCard from "../../attendance/components/AttendanceClockCard";
import { Bell, Clock3, ShieldCheck } from "lucide-react";

export default function TimeTrackingPage() {
  const auth = useAuth();
  const userId = auth?.user?.id ?? null;
  const organizationId = auth?.profile?.organization_id ?? null;
  const role = auth?.profile?.primary_role;
  const isAdmin = role === "admin" || role === "manager";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Workday control
            </p>
            <h1 className="mt-2 text-3xl font-bold">Time tracking</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/55">
              Clock in, track your day, and let the Harare schedule cleanly close anything left running at 6:00 PM.
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

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Bell size={16} className="text-sky-300" />
              Weekday reminder
            </div>
            <p className="mt-2 text-2xl font-semibold">08:00</p>
            <p className="mt-1 text-xs text-white/40">Clock in and start tracking.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm text-white/50">
              <Clock3 size={16} className="text-orange-300" />
              Auto stop
            </div>
            <p className="mt-2 text-2xl font-semibold">18:00</p>
            <p className="mt-1 text-xs text-white/40">Attendance and timers close.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2 text-sm text-white/50">
              <ShieldCheck size={16} className="text-emerald-300" />
              Coverage
            </div>
            <p className="mt-2 text-2xl font-semibold">All users</p>
            <p className="mt-1 text-xs text-white/40">Admins included.</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <AttendanceClockCard organizationId={organizationId} userId={userId} />
          <div className="rounded-3xl border border-white/10 bg-[#101010] p-5">
            <h2 className="text-lg font-semibold">Today’s rhythm</h2>
            <div className="mt-4 space-y-3 text-sm text-white/55">
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="font-medium text-white">Morning</p>
                <p className="mt-1">A weekday reminder goes out at 8:00 AM Harare time.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="font-medium text-white">Evening</p>
                <p className="mt-1">Open attendance sessions and running timers are stopped at 6:00 PM.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
