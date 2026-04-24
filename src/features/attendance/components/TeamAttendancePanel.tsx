import { useState, useEffect } from 'react';
import { Users, Clock, Coffee, LogOut, RefreshCw } from 'lucide-react';
import { AttendanceService } from '../services/attendanceService';
import type { TeamAttendanceStatus } from '../types/attendance';
import AttendanceStatusBadge from './AttendanceStatusBadge';

interface TeamAttendancePanelProps {
  organizationId: string;
}

export default function TeamAttendancePanel({ organizationId }: TeamAttendancePanelProps) {
  const [teamStatus, setTeamStatus] = useState<TeamAttendanceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'online' | 'on_break' | 'offline'>('all');

  useEffect(() => {
    loadTeamAttendance();
  }, [organizationId]);

  const loadTeamAttendance = async () => {
    if (!organizationId) return;
    try {
      const status = await AttendanceService.getTeamAttendanceStatus(organizationId);
      setTeamStatus(status);
    } catch (error) {
      console.error('Error loading team attendance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTeam = filter === 'all' 
    ? teamStatus 
    : teamStatus.filter(member => member.current_status === filter);

  const stats = {
    online: teamStatus.filter(m => m.current_status === 'online').length,
    on_break: teamStatus.filter(m => m.current_status === 'on_break').length,
    offline: teamStatus.filter(m => m.current_status === 'offline').length,
  };

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/10 rounded w-1/4" />
          <div className="grid grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-20 bg-white/10 rounded" />
            ))}
          </div>
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
        <div className="flex items-center gap-3">
          <Users className="w-6 h-6 text-white/60" />
          <h3 className="text-xl font-semibold text-white">Team Attendance</h3>
        </div>
        <button
          onClick={loadTeamAttendance}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5 text-white/60" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl bg-emerald-500/10 p-4">
          <div className="flex items-center gap-2 text-emerald-400 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Online</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.online}</p>
        </div>
        <div className="rounded-xl bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 text-amber-400 mb-2">
            <Coffee className="w-4 h-4" />
            <span className="text-xs font-medium">On Break</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.on_break}</p>
        </div>
        <div className="rounded-xl bg-slate-500/10 p-4">
          <div className="flex items-center gap-2 text-slate-400 mb-2">
            <LogOut className="w-4 h-4" />
            <span className="text-xs font-medium">Offline</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.offline}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        {(['all', 'online', 'on_break', 'offline'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === status
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/5 text-white/60 hover:bg-white/10'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Team List */}
      {filteredTeam.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <p className="text-white/40">No team members found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredTeam.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between rounded-lg bg-white/5 p-4 hover:bg-white/10 transition-all"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 flex items-center justify-center text-white font-semibold">
                  {member.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{member.full_name}</p>
                  <p className="text-xs text-white/60">{member.primary_role}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-white/60">Clocked In</p>
                  <p className="text-sm text-white/80">{formatTime(member.last_clock_in)}</p>
                </div>
                {member.current_status === 'on_break' && (
                  <div className="text-right">
                    <p className="text-xs text-white/60">Break Started</p>
                    <p className="text-sm text-amber-300">{formatTime(member.break_started_at)}</p>
                  </div>
                )}
                <AttendanceStatusBadge status={member.current_status} size="sm" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
