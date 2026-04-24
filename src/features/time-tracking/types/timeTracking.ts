export interface TimeSession {
  id: string;
  userId: string;
  organizationId: string;
  clockIn: string;
  clockOut: string | null;
  durationMinutes: number | null;
  locationIp: string | null;
  locationCoordinates: { lat: number; lng: number } | null;
  notes: string | null;
  status: "active" | "completed" | "auto_clocked_out";
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  sessionId: string;
  userId: string;
  projectId: string | null;
  taskId: string | null;
  description: string | null;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number | null;
  activityType: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimesheetSummary {
  id: string;
  userId: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
  totalMinutes: number;
  totalHours: number;
  breakMinutes: number;
  workMinutes: number;
  sessionsCount: number;
  status: "draft" | "submitted" | "approved" | "rejected";
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClockInParams {
  userId: string;
  organizationId: string;
  locationIp?: string;
  locationCoordinates?: { lat: number; lng: number };
  notes?: string;
}

export interface ClockOutParams {
  sessionId: string;
  userId: string;
  notes?: string;
}

export interface GetSessionsParams {
  userId: string;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface GetTimesheetParams {
  userId?: string;
  organizationId: string;
  periodStart: string;
  periodEnd: string;
}
