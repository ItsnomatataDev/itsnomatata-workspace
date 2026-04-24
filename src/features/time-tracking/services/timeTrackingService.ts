import { supabase } from "../../../lib/supabase/client";
import type {
  TimeSession,
  TimeEntry,
  TimesheetSummary,
  ClockInParams,
  ClockOutParams,
  GetSessionsParams,
  GetTimesheetParams,
} from "../types/timeTracking";

export class TimeTrackingService {
  // Clock in - create a new active session
  static async clockIn(params: ClockInParams): Promise<TimeSession> {
    try {
      const { data, error } = await supabase
        .from("time_sessions")
        .insert({
          user_id: params.userId,
          organization_id: params.organizationId,
          location_ip: params.locationIp,
          location_coordinates: params.locationCoordinates,
          notes: params.notes,
          status: "active",
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapSessionRow(data);
    } catch (error) {
      console.error("Error clocking in:", error);
      throw new Error("Failed to clock in");
    }
  }

  // Clock out - complete an active session
  static async clockOut(params: ClockOutParams): Promise<TimeSession> {
    try {
      const { data, error } = await supabase
        .from("time_sessions")
        .update({
          clock_out: new Date().toISOString(),
          notes: params.notes,
          status: "completed",
        })
        .eq("id", params.sessionId)
        .eq("user_id", params.userId)
        .eq("status", "active")
        .select()
        .single();

      if (error) throw error;
      return this.mapSessionRow(data);
    } catch (error) {
      console.error("Error clocking out:", error);
      throw new Error("Failed to clock out");
    }
  }

  // Get active session for a user
  static async getActiveSession(userId: string): Promise<TimeSession | null> {
    try {
      const { data, error } = await supabase
        .from("time_sessions")
        .select()
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      if (error) {
        if (error.code === "PGRST116") return null; // No rows returned
        throw error;
      }
      return this.mapSessionRow(data);
    } catch (error) {
      console.error("Error getting active session:", error);
      return null;
    }
  }

  // Get user's time sessions
  static async getSessions(params: GetSessionsParams): Promise<{ sessions: TimeSession[] }> {
    try {
      let query = supabase
        .from("time_sessions")
        .select()
        .eq("user_id", params.userId)
        .order("clock_in", { ascending: false });

      if (params.organizationId) {
        query = query.eq("organization_id", params.organizationId);
      }

      if (params.status) {
        query = query.eq("status", params.status);
      }

      if (params.startDate) {
        query = query.gte("clock_in", params.startDate);
      }

      if (params.endDate) {
        query = query.lte("clock_in", params.endDate);
      }

      if (params.limit) {
        query = query.limit(params.limit);
      }

      if (params.offset) {
        query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { sessions: data?.map(this.mapSessionRow) || [] };
    } catch (error) {
      console.error("Error getting sessions:", error);
      return { sessions: [] };
    }
  }

  // Get all sessions for admin view (organization-wide)
  static async getAllOrganizationSessions(
    organizationId: string,
    params?: { startDate?: string; endDate?: string; userId?: string; limit?: number }
  ): Promise<{ sessions: TimeSession[] }> {
    try {
      let query = supabase
        .from("time_sessions")
        .select()
        .eq("organization_id", organizationId)
        .order("clock_in", { ascending: false });

      if (params?.userId) {
        query = query.eq("user_id", params.userId);
      }

      if (params?.startDate) {
        query = query.gte("clock_in", params.startDate);
      }

      if (params?.endDate) {
        query = query.lte("clock_in", params.endDate);
      }

      if (params?.limit) {
        query = query.limit(params.limit);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { sessions: data?.map(this.mapSessionRow) || [] };
    } catch (error) {
      console.error("Error getting organization sessions:", error);
      return { sessions: [] };
    }
  }

  // Get timesheet summaries
  static async getTimesheetSummaries(params: GetTimesheetParams): Promise<{ summaries: TimesheetSummary[] }> {
    try {
      let query = supabase
        .from("timesheet_summaries")
        .select()
        .eq("organization_id", params.organizationId)
        .gte("period_start", params.periodStart)
        .lte("period_end", params.periodEnd)
        .order("period_start", { ascending: false });

      if (params.userId) {
        query = query.eq("user_id", params.userId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { summaries: data?.map(this.mapSummaryRow) || [] };
    } catch (error) {
      console.error("Error getting timesheet summaries:", error);
      return { summaries: [] };
    }
  }

  // Approve timesheet summary (admin only)
  static async approveTimesheet(summaryId: string, adminId: string): Promise<TimesheetSummary> {
    try {
      const { data, error } = await supabase
        .from("timesheet_summaries")
        .update({
          status: "approved",
          approved_by: adminId,
          approved_at: new Date().toISOString(),
        })
        .eq("id", summaryId)
        .select()
        .single();

      if (error) throw error;
      return this.mapSummaryRow(data);
    } catch (error) {
      console.error("Error approving timesheet:", error);
      throw new Error("Failed to approve timesheet");
    }
  }

  // Reject timesheet summary (admin only)
  static async rejectTimesheet(summaryId: string, adminId: string, notes?: string): Promise<TimesheetSummary> {
    try {
      const { data, error } = await supabase
        .from("timesheet_summaries")
        .update({
          status: "rejected",
          approved_by: adminId,
          approved_at: new Date().toISOString(),
          notes: notes,
        })
        .eq("id", summaryId)
        .select()
        .single();

      if (error) throw error;
      return this.mapSummaryRow(data);
    } catch (error) {
      console.error("Error rejecting timesheet:", error);
      throw new Error("Failed to reject timesheet");
    }
  }

  // Submit timesheet for approval
  static async submitTimesheet(summaryId: string, userId: string): Promise<TimesheetSummary> {
    try {
      const { data, error } = await supabase
        .from("timesheet_summaries")
        .update({
          status: "submitted",
        })
        .eq("id", summaryId)
        .eq("user_id", userId)
        .select()
        .single();

      if (error) throw error;
      return this.mapSummaryRow(data);
    } catch (error) {
      console.error("Error submitting timesheet:", error);
      throw new Error("Failed to submit timesheet");
    }
  }

  // Add time entry to a session
  static async addTimeEntry(params: {
    sessionId: string;
    userId: string;
    projectId?: string;
    taskId?: string;
    description?: string;
    activityType?: string;
  }): Promise<TimeEntry> {
    try {
      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          session_id: params.sessionId,
          user_id: params.userId,
          project_id: params.projectId,
          task_id: params.taskId,
          description: params.description,
          activity_type: params.activityType,
        })
        .select()
        .single();

      if (error) throw error;
      return this.mapEntryRow(data);
    } catch (error) {
      console.error("Error adding time entry:", error);
      throw new Error("Failed to add time entry");
    }
  }

  // Get time entries for a session
  static async getTimeEntries(sessionId: string): Promise<{ entries: TimeEntry[] }> {
    try {
      const { data, error } = await supabase
        .from("time_entries")
        .select()
        .eq("session_id", sessionId)
        .order("start_time", { ascending: true });

      if (error) throw error;
      return { entries: data?.map(this.mapEntryRow) || [] };
    } catch (error) {
      console.error("Error getting time entries:", error);
      return { entries: [] };
    }
  }

  // Mapping functions
  private static mapSessionRow(row: any): TimeSession {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      clockIn: row.clock_in,
      clockOut: row.clock_out,
      durationMinutes: row.duration_minutes,
      locationIp: row.location_ip,
      locationCoordinates: row.location_coordinates,
      notes: row.notes,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapEntryRow(row: any): TimeEntry {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      projectId: row.project_id,
      taskId: row.task_id,
      description: row.description,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      durationMinutes: row.duration_minutes,
      activityType: row.activity_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private static mapSummaryRow(row: any): TimesheetSummary {
    return {
      id: row.id,
      userId: row.user_id,
      organizationId: row.organization_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      totalMinutes: row.total_minutes,
      totalHours: row.total_hours,
      breakMinutes: row.break_minutes,
      workMinutes: row.work_minutes,
      sessionsCount: row.sessions_count,
      status: row.status,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      notes: row.notes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
