export type AttendanceSessionStatus =
  | "active"
  | "completed"
  | "missed_clock_out";

export type AttendanceBreakType = "break" | "lunch" | "personal";

export type AttendanceSession = {
  id: string;
  organization_id: string;
  office_id?: string | null;
  user_id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  status: AttendanceSessionStatus;
  work_seconds: number;
  clock_in_method: string;
  clock_out_method: string | null;
  notes: string | null;
  ip_address: string | null;
  device_info: Record<string, unknown>;
  location: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AttendanceBreak = {
  id: string;
  organization_id: string;
  attendance_session_id: string;
  user_id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number;
  break_type: AttendanceBreakType | string;
  notes: string | null;
  created_at: string;
};

export type AttendanceSettings = {
  id: string;
  organization_id: string;
  workday_start: string | null;
  workday_end: string | null;
  late_after_minutes: number;
  auto_mark_missed_clockout: boolean;
  require_location: boolean;
  allowed_geofence: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type AttendanceProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  office_id?: string | null;
  is_active?: boolean | null;
};

export type AttendanceReportRow = {
  user_id: string;
  active_session_id?: string | null;
  full_name: string | null;
  email: string | null;
  office_id?: string | null;
  daily_status?: "present" | "late" | "absent" | "on_leave" | "pending" | null;
  clock_in_at: string | null;
  clock_out_at: string | null;
  work_seconds: number;
  break_seconds: number;
  task_tracked_seconds: number;
  untracked_seconds: number;
  status: AttendanceSessionStatus | "offline" | "on_leave" | "off_day";
  is_late: boolean;
  missed_clock_out: boolean;
  clock_out_method?: string | null;
  leave_type_name?: string | null;
};

export type AttendanceToday = {
  activeSession: AttendanceSession | null;
  activeBreak: AttendanceBreak | null;
  sessions: AttendanceSession[];
  breaks: AttendanceBreak[];
  workedSeconds: number;
  breakSeconds: number;
};

export type ClockInInput = {
  organizationId: string;
  userId: string;
  method?: string;
  notes?: string | null;
  location?: Record<string, unknown>;
  deviceInfo?: Record<string, unknown>;
  ipAddress?: string | null;
};

export type ClockOutInput = {
  sessionId: string;
  userId: string;
  method?: string;
  notes?: string | null;
};

export type BreakStartInput = {
  organizationId: string;
  userId: string;
  sessionId: string;
  breakType?: AttendanceBreakType | string;
  notes?: string | null;
};

export type BreakEndInput = {
  breakId: string;
  userId: string;
};
