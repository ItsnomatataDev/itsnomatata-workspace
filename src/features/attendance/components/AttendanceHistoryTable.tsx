import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Clock, Coffee } from 'lucide-react';
import { AttendanceService } from '../services/attendanceService';
import type { AttendanceSession } from '../types/attendance';

interface AttendanceHistoryTableProps {
  userId: string;
}

export default function AttendanceHistoryTable({ userId }: AttendanceHistoryTableProps) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const itemsPerPage = 10;

  useEffect(() => {
    loadAttendanceHistory();
  }, [userId, currentMonth]);

  const loadAttendanceHistory = async () => {
    if (!userId) return;
    try {
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

      const { sessions: allSessions } = await AttendanceService.getAttendanceHistory({
        userId,
        startDate: startOfMonth.toISOString(),
        endDate: endOfMonth.toISOString(),
        limit: 100,
      });

      setSessions(allSessions);
      setTotalPages(Math.ceil(allSessions.length / itemsPerPage));
      setCurrentPage(1);
    } catch (error) {
      console.error('Error loading attendance history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const changeMonth = (direction: 'prev' | 'next') => {
    const newMonth = new Date(currentMonth);
    newMonth.setMonth(newMonth.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentMonth(newMonth);
  };

  const paginatedSessions = sessions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: string) => {
    const config = {
      present: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      late: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      absent: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${config[status as keyof typeof config]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/4" />
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-white/10 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">Attendance History</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeMonth('prev')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-white/60" />
          </button>
          <span className="text-sm font-medium text-white/80 min-w-[140px] text-center">
            {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => changeMonth('next')}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">No attendance records for this month</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Clock In</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Clock Out</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Break</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Total</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-white/60">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedSessions.map((session) => (
                  <tr key={session.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 text-sm text-white">{formatDate(session.clock_in)}</td>
                    <td className="py-3 px-4 text-sm text-white/80">{formatTime(session.clock_in)}</td>
                    <td className="py-3 px-4 text-sm text-white/80">
                      {session.clock_out ? formatTime(session.clock_out) : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm text-white/80">
                      {session.break_minutes > 0 ? (
                        <div className="flex items-center gap-1">
                          <Coffee className="w-3 h-3 text-amber-400" />
                          {formatDuration(session.break_minutes)}
                        </div>
                      ) : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-white">
                      {formatDuration(session.total_minutes)}
                    </td>
                    <td className="py-3 px-4">{getStatusBadge(session.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
              <p className="text-sm text-white/60">
                Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
                {Math.min(currentPage * itemsPerPage, sessions.length)} of {sessions.length} entries
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-white/80">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 rounded-lg bg-white/5 text-white/60 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
