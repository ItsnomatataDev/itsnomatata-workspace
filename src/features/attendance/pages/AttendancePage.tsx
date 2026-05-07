import { useAuth } from "../../../app/providers/AuthProvider";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import AttendanceClockCard from "../components/AttendanceClockCard";

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
          <div className="mb-6">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Presence
            </p>
            <h1 className="mt-2 text-3xl font-bold">Attendance</h1>
            <p className="mt-2 text-sm text-white/50">
              Clock in for working presence. Task timers remain separate.
            </p>
          </div>

          <div className="max-w-2xl">
            <AttendanceClockCard organizationId={organizationId} userId={userId} />
          </div>
        </main>
      </div>
    </div>
  );
}
