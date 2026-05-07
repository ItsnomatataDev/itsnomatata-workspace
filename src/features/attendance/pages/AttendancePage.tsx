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
      <div className="min-h-screen bg-black p-6 text-white">
        Loading attendance...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />
        <main className="min-w-0 flex-1 p-6 lg:p-8">
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
