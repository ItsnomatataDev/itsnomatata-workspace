import { supabase } from '../../../lib/supabase/client';
import type {
  AttendanceSession,
  AttendanceStatus,
  DailyAttendanceSummary,
  TeamAttendanceStatus,
  ClockInParams,
  ClockOutParams,
  BreakStartParams,
  BreakEndParams,
} from '../types/attendance';

export const AttendanceService = {
  // Get active attendance session for user
  async getActiveSession(userId: string): Promise<AttendanceSession | null> {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('user_id', userId)
      .is('clock_out', null)
      .order('clock_in', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // No rows returned
      throw error;
    }
    return data;
  },

  // Clock in
  async clockIn(params: ClockInParams): Promise<AttendanceSession> {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert({
        user_id: params.userId,
        organization_id: params.organizationId,
        clock_in: new Date().toISOString(),
        source: params.source || 'web',
        notes: params.notes,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Clock out
  async clockOut(params: ClockOutParams): Promise<AttendanceSession> {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({
        clock_out: new Date().toISOString(),
        notes: params.notes,
      })
      .eq('id', params.sessionId)
      .eq('user_id', params.userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Start break
  async startBreak(params: BreakStartParams): Promise<AttendanceSession> {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({
        break_start: new Date().toISOString(),
      })
      .eq('id', params.sessionId)
      .eq('user_id', params.userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // End break
  async endBreak(params: BreakEndParams): Promise<AttendanceSession> {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({
        break_end: new Date().toISOString(),
      })
      .eq('id', params.sessionId)
      .eq('user_id', params.userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Get attendance history for user
  async getAttendanceHistory(params: {
    userId: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<{ sessions: AttendanceSession[] }> {
    let query = supabase
      .from('attendance_sessions')
      .select('*')
      .eq('user_id', params.userId)
      .order('clock_in', { ascending: false });

    if (params.startDate) {
      query = query.gte('clock_in', params.startDate);
    }
    if (params.endDate) {
      query = query.lte('clock_in', params.endDate);
    }
    if (params.limit) {
      query = query.limit(params.limit);
    }

    const { data, error } = await query;
    if (error) throw error;
    return { sessions: data || [] };
  },

  // Get today's attendance for user
  async getTodayAttendance(userId: string): Promise<AttendanceSession[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('user_id', userId)
      .gte('clock_in', today.toISOString())
      .lt('clock_in', tomorrow.toISOString())
      .order('clock_in', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Get team attendance status (for admin)
  async getTeamAttendanceStatus(organizationId: string): Promise<TeamAttendanceStatus[]> {
    const { data, error } = await supabase
      .from('team_attendance_status')
      .select('*')
      .eq('organization_id', organizationId);

    if (error) throw error;
    return data || [];
  },

  // Get daily attendance summary
  async getDailySummary(params: {
    userId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<DailyAttendanceSummary[]> {
    let query = supabase
      .from('daily_attendance_summary')
      .select('*')
      .eq('user_id', params.userId)
      .order('attendance_date', { ascending: false });

    if (params.startDate) {
      query = query.gte('attendance_date', params.startDate);
    }
    if (params.endDate) {
      query = query.lte('attendance_date', params.endDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  // Check if user is clocked in
  async isUserClockedIn(userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_user_clocked_in', {
      p_user_id: userId,
    });
    if (error) throw error;
    return data || false;
  },

  // Check if user is on break
  async isUserOnBreak(userId: string): Promise<boolean> {
    const { data, error } = await supabase.rpc('is_user_on_break', {
      p_user_id: userId,
    });
    if (error) throw error;
    return data || false;
  },
};
