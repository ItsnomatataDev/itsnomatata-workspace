import { useState, useEffect } from 'react';
import { Clock, Play, Pause, Coffee, LogIn } from 'lucide-react';
import { AttendanceService } from '../services/attendanceService';
import type { AttendanceSession } from '../types/attendance';
import AttendanceStatusBadge from './AttendanceStatusBadge';

interface ClockInOutCardProps {
  userId: string;
  organizationId: string;
  onSessionChange?: (session: AttendanceSession | null) => void;
}

export default function ClockInOutCard({ userId, organizationId, onSessionChange }: ClockInOutCardProps) {
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    loadActiveSession();
  }, [userId]);

  useEffect(() => {
    let interval: number;
    if (activeSession && !activeSession.clock_out) {
      interval = setInterval(() => {
        const now = new Date();
        const clockIn = new Date(activeSession.clock_in);
        const elapsed = Math.floor((now.getTime() - clockIn.getTime()) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeSession]);

  const loadActiveSession = async () => {
    if (!userId) return;
    try {
      const session = await AttendanceService.getActiveSession(userId);
      setActiveSession(session);
      onSessionChange?.(session);
      if (session) {
        const now = new Date();
        const clockIn = new Date(session.clock_in);
        const elapsed = Math.floor((now.getTime() - clockIn.getTime()) / 1000);
        setElapsedTime(elapsed);
      }
    } catch (error) {
      console.error('Error loading active session:', error);
    }
  };

  const handleClockIn = async () => {
    if (!userId || !organizationId) return;
    setIsLoading(true);
    try {
      const session = await AttendanceService.clockIn({
        userId,
        organizationId,
        notes: notes || undefined,
      });
      setActiveSession(session);
      onSessionChange?.(session);
      setNotes('');
      setShowNotes(false);
    } catch (error) {
      console.error('Error clocking in:', error);
      alert('Failed to clock in. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!activeSession || !userId) return;
    setIsLoading(true);
    try {
      const session = await AttendanceService.clockOut({
        sessionId: activeSession.id,
        userId,
        notes: notes || undefined,
      });
      setActiveSession(null);
      setElapsedTime(0);
      onSessionChange?.(null);
      setNotes('');
      setShowNotes(false);
    } catch (error) {
      console.error('Error clocking out:', error);
      alert('Failed to clock out. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartBreak = async () => {
    if (!activeSession || !userId) return;
    setIsLoading(true);
    try {
      const session = await AttendanceService.startBreak({
        sessionId: activeSession.id,
        userId,
      });
      setActiveSession(session);
    } catch (error) {
      console.error('Error starting break:', error);
      alert('Failed to start break. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!activeSession || !userId) return;
    setIsLoading(true);
    try {
      const session = await AttendanceService.endBreak({
        sessionId: activeSession.id,
        userId,
      });
      setActiveSession(session);
    } catch (error) {
      console.error('Error ending break:', error);
      alert('Failed to end break. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
  };

  const isOnBreak = activeSession && activeSession.break_start && !activeSession.break_end;

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-8 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Attendance</h2>
          <p className="text-white/60 mt-1">{getCurrentDate()}</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-white">{getCurrentTime()}</p>
        </div>
      </div>

      {activeSession ? (
        <div className="rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/10 p-8">
          <div className="text-center mb-6">
            <AttendanceStatusBadge status={isOnBreak ? 'on_break' : 'online'} size="lg" />
            <div className="text-7xl font-bold text-white tracking-wider mt-4 mb-2">
              {formatTime(elapsedTime)}
            </div>
            <p className="text-white/60">
              Since {new Date(activeSession.clock_in).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          </div>

          <div className="flex gap-3">
            {!isOnBreak ? (
              <>
                <button
                  onClick={handleStartBreak}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-amber-500/20 border border-amber-500/30 px-6 py-4 text-base font-semibold text-amber-300 hover:bg-amber-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Coffee className="w-5 h-5" />
                  {isLoading ? 'Starting break...' : 'Start Break'}
                </button>
                <button
                  onClick={handleClockOut}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4 text-base font-semibold text-white shadow-xl shadow-red-500/30 transition-all hover:from-red-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pause className="w-5 h-5" />
                  {isLoading ? 'Clocking out...' : 'Clock Out'}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleEndBreak}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-6 py-4 text-base font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <LogIn className="w-5 h-5" />
                  {isLoading ? 'Ending break...' : 'End Break'}
                </button>
                <button
                  onClick={handleClockOut}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 px-6 py-4 text-base font-semibold text-white shadow-xl shadow-red-500/30 transition-all hover:from-red-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Pause className="w-5 h-5" />
                  {isLoading ? 'Clocking out...' : 'Clock Out'}
                </button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-white/10 bg-white/5 p-8">
          <div className="text-center mb-6">
            <AttendanceStatusBadge status="offline" size="lg" />
            <div className="text-7xl font-bold text-white tracking-wider mt-4 mb-2">
              00:00:00
            </div>
            <p className="text-white/60">Clock in to start tracking your attendance</p>
          </div>

          <button
            onClick={handleClockIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600 px-8 py-5 text-lg font-semibold text-white shadow-xl shadow-emerald-500/30 transition-all hover:from-emerald-600 hover:to-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Play className="w-6 h-6" />
            {isLoading ? 'Clocking in...' : 'Clock In'}
          </button>
        </div>
      )}

      <div className="mt-6 space-y-3">
        <button
          onClick={() => setShowNotes(!showNotes)}
          className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
        >
          {showNotes ? 'Hide Notes' : 'Add Notes'}
        </button>

        {showNotes && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note for this session..."
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 resize-none"
            rows={3}
          />
        )}
      </div>
    </div>
  );
}
