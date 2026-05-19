import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import AttendanceClockCard from "../components/AttendanceClockCard";
import { Bell, Clock3, ShieldCheck } from "lucide-react";

export default function AttendancePage() {
  const auth = useAuth();
  const userId = auth?.user?.id ?? null;
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;

  if (!userId || !profile || !organizationId) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Loading attendance...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Presence
              </p>
              <h1 className="mt-2 text-3xl font-bold">Attendance</h1>
              <p className="mt-2 max-w-2xl text-sm text-white/50">
                Weekday workdays run on Africa/Harare time with morning nudges and automatic end-of-day protection.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white/70">
                <Bell size={14} className="text-sky-300" />
                08:00
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white/70">
                <Clock3 size={14} className="text-orange-300" />
                18:00
              </span>
              <span className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-white/70">
                <ShieldCheck size={14} className="text-emerald-300" />
                All roles
              </span>
            </div>
          </div>

          <div className="max-w-3xl">
            <AttendanceClockCard organizationId={organizationId} userId={userId} />
          </div>
        </main>
      </div>
    </div>
  );
}
