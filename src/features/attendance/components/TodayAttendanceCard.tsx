import { useState, useEffect } from 'react';
import { Clock, Coffee, TrendingUp, Calendar } from 'lucide-react';
import { AttendanceService } from '../services/attendanceService';
import type { AttendanceSession } from '../types/attendance';

interface TodayAttendanceCardProps {
  userId: string;
}

export default function TodayAttendanceCard({ userId }: TodayAttendanceCardProps) {
  const [todaySessions, setTodaySessions] = useState<AttendanceSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTodayAttendance();
  }, [userId]);

  const loadTodayAttendance = async () => {
    if (!userId) return;
    try {
      const sessions = await AttendanceService.getTodayAttendance(userId);
      setTodaySessions(sessions);
    } catch (error) {
      console.error('Error loading today attendance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateTotalWorked = () => {
    return todaySessions.reduce((total, session) => total + session.total_minutes, 0);
  };

  const calculateTotalBreak = () => {
    return todaySessions.reduce((total, session) => total + session.break_minutes, 0);
  };

  const getDailyStatus = () => {
    if (todaySessions.length === 0) return 'absent';
    const firstSession = todaySessions[todaySessions.length - 1];
    const clockInTime = new Date(firstSession.clock_in);
    const lateThreshold = new Date(clockInTime);
    lateThreshold.setHours(9, 15, 0, 0);
    
    if (clockInTime > lateThreshold) return 'late';
    return 'present';
  };

  const dailyStatus = getDailyStatus();

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/3" />
          <div className="h-20 bg-white/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">Today's Summary</h3>
        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
          dailyStatus === 'present' 
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            : dailyStatus === 'late'
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            : 'bg-slate-500/20 text-slate-300 border border-slate-500/30'
        }`}>
          {dailyStatus.charAt(0).toUpperCase() + dailyStatus.slice(1)}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Worked</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatDuration(calculateTotalWorked())}</p>
        </div>
        <div className="rounded-xl bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <Coffee className="w-4 h-4" />
            <span className="text-xs font-medium">Break</span>
          </div>
          <p className="text-2xl font-bold text-white">{formatDuration(calculateTotalBreak())}</p>
        </div>
        <div className="rounded-xl bg-blue-500/10 p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Calendar className="w-4 h-4" />
            <span className="text-xs font-medium">Sessions</span>
          </div>
          <p className="text-2xl font-bold text-white">{todaySessions.length}</p>
        </div>
      </div>

      {todaySessions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-white/60">Sessions</h4>
          {todaySessions.slice(0, 3).map((session) => (
            <div
              key={session.id}
              className="flex items-center justify-between rounded-lg bg-white/5 p-4 hover:bg-white/10 transition-all"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    !session.clock_out ? 'bg-emerald-400' : 
                    session.break_start && !session.break_end ? 'bg-amber-400' : 'bg-blue-400'
                  }`} />
                  <p className="text-sm font-medium text-white">
                    {new Date(session.clock_in).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' - '}
                    {session.clock_out
                      ? new Date(session.clock_out).toLocaleTimeString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : 'Active'}
                  </p>
                </div>
                {session.notes && (
                  <p className="text-xs text-white/60 mt-1 ml-5">{session.notes}</p>
                )}
              </div>
              <span className="text-sm font-semibold text-white ml-4">
                {formatDuration(session.total_minutes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
