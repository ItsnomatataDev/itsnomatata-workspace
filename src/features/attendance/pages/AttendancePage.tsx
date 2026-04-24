import { useAuth } from '../../../app/providers/AuthProvider';
import ClockInOutCard from '../components/ClockInOutCard';
import TodayAttendanceCard from '../components/TodayAttendanceCard';
import AttendanceHistoryTable from '../components/AttendanceHistoryTable';
import TeamAttendancePanel from '../components/TeamAttendancePanel';

export default function AttendancePage() {
  const auth = useAuth();
  const userId = auth?.user?.id;
  const organizationId = auth?.profile?.organization_id;
  const userRole = auth?.profile?.primary_role;
  const isAdmin = userRole === 'admin' || userRole === 'it';

  if (!userId || !organizationId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/60">Please log in to access attendance tracking</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white">Attendance</h1>
          <p className="text-white/60 mt-2">Track your work presence</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Clock In/Out & Today */}
          <div className="lg:col-span-2 space-y-6">
            <ClockInOutCard
              userId={userId}
              organizationId={organizationId}
            />
            <TodayAttendanceCard userId={userId} />
            <AttendanceHistoryTable userId={userId} />
          </div>

          {/* Right Column - Team Panel (Admin/IT only) */}
          {isAdmin && (
            <div className="space-y-6">
              <TeamAttendancePanel organizationId={organizationId} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
