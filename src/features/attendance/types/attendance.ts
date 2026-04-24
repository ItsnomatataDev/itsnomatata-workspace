export interface AttendanceSession {
  id: string;
  organization_id: string;
  user_id: string;
  clock_in: string;
  clock_out: string | null;
  break_start: string | null;
  break_end: string | null;
  total_minutes: number;
  break_minutes: number;
  status: 'present' | 'late' | 'absent';
  source: 'web' | 'mobile' | 'api';
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceStatus {
  current_status: 'online' | 'on_break' | 'offline';
  last_clock_in: string | null;
  break_started_at: string | null;
  active_session_id: string | null;
}

export interface DailyAttendanceSummary {
  user_id: string;
  organization_id: string;
  attendance_date: string;
  sessions_count: number;
  total_worked_minutes: number;
  total_break_minutes: number;
  first_clock_in: string;
  last_clock_out: string;
  daily_status: 'present' | 'late' | 'absent';
}

export interface TeamAttendanceStatus {
  user_id: string;
  full_name: string;
  email: string;
  primary_role: string;
  organization_id: string;
  current_status: 'online' | 'on_break' | 'offline';
  last_clock_in: string | null;
  break_started_at: string | null;
  active_session_id: string | null;
}

export interface ClockInParams {
  userId: string;
  organizationId: string;
  notes?: string;
  source?: 'web' | 'mobile' | 'api';
}

export interface ClockOutParams {
  sessionId: string;
  userId: string;
  notes?: string;
}

export interface BreakStartParams {
  sessionId: string;
  userId: string;
}

export interface BreakEndParams {
  sessionId: string;
  userId: string;
}
