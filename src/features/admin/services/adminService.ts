import { supabase } from "../../../lib/supabase/client";
import {
  isAppRole,
  isSuperAdminAllowedEmail,
} from "../../../lib/constants/roles";
import {
  getEntrySeconds,
  startOfTodayISO,
  startOfWeekISO,
} from "../../../lib/utils/timeMath";
import {
  notifyLeaveRequestDecision,
  notifyUser,
} from "../../notifications/services/notificationOrchestrationService";
import { runAdminUserAction } from "../../it-workspace/services/warRoomService";
import {
  OFFICE_SLUGS,
  type CompanyOffice,
  isITsNomatataOfficeProfile,
} from "../../../lib/offices";

export { isITsNomatataOfficeProfile } from "../../../lib/offices";
import { getCompanyOfficeBySlug } from "../../../lib/supabase/queries/offices";
import { createOrganizationInvitation } from "../../platform-admin/services/platformAdminService";

type NotificationSummary = {
  ok?: boolean;
  failed?: number;
};

function normalizeAccountStatus(profile: {
  account_status?: string | null;
  is_active?: boolean | null;
  is_suspended?: boolean | null;
  deleted_at?: string | null;
}): AccountStatus {
  if (profile.account_status) return profile.account_status as AccountStatus;
  if (profile.deleted_at) return "deleted";
  if (profile.is_suspended) return "suspended";
  if (profile.is_active) return "active";
  return "pending";
}

async function logAdminAudit(params: {
  organizationId: string;
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: string;
  reason?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("admin_audit_logs").insert({
    organization_id: params.organizationId,
    actor_user_id: params.actorUserId ?? null,
    target_user_id: params.targetUserId ?? null,
    action: params.action,
    reason: params.reason ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("ADMIN AUDIT LOG ERROR:", error);
  }
}

async function assertCanModifyUser(params: {
  organizationId: string;
  targetUserId: string;
  actorUserId?: string | null;
  nextRole?: string | null;
}) {
  if (params.actorUserId && params.actorUserId === params.targetUserId) {
    throw new Error("You cannot perform this action on your own account.");
  }

  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, email, primary_role, organization_id, account_status")
    .eq("id", params.targetUserId)
    .eq("organization_id", params.organizationId)
    .maybeSingle();

  if (targetError) throw targetError;
  if (!target) throw new Error("User was not found in this organization.");

  const isTargetAdmin = target.primary_role === "admin";
  const isDemotingAdmin = params.nextRole && params.nextRole !== "admin";

  if (isTargetAdmin && (!params.nextRole || isDemotingAdmin)) {
    const { count, error } = await supabase
      .from("profiles")
      .select("id", { head: true, count: "exact" })
      .eq("organization_id", params.organizationId)
      .eq("primary_role", "admin")
      .eq("account_status", "active");

    if (error) throw error;
    if ((count ?? 0) <= 1) {
      throw new Error("You cannot remove or demote the last active admin.");
    }
  }

  if (
    params.nextRole === "admin" &&
    !isSuperAdminAllowedEmail(target.email)
  ) {
    throw new Error(
      "This email is not allowed to receive the Super Admin role.",
    );
  }
}

async function notifyEmployeeAccountChange(params: {
  organizationId: string;
  userId: string;
  actorUserId?: string | null;
  status: AccountStatus | "unsuspended" | "removed";
  reason?: string | null;
}) {
  const titleMap: Record<string, string> = {
    active: "Account approved",
    rejected: "Signup request rejected",
    suspended: "Account suspended",
    unsuspended: "Account restored",
    deleted: "Account removed",
    removed: "Removed from organization",
    pending: "Account pending approval",
  };

  const messageMap: Record<string, string> = {
    active: "Your account has been approved. You can now access the workspace.",
    rejected: `Your signup request was rejected.${params.reason ? ` Reason: ${params.reason}` : ""}`,
    suspended: `Your account has been suspended.${params.reason ? ` Reason: ${params.reason}` : ""}`,
    unsuspended: "Your account has been restored.",
    deleted: `Your account has been removed.${params.reason ? ` Reason: ${params.reason}` : ""}`,
    removed: "You have been removed from this organization.",
    pending: "Your account is waiting for approval.",
  };

  try {
    await notifyUser({
      organizationId: params.organizationId,
      userId: params.userId,
      type:
        params.status === "active" || params.status === "unsuspended"
          ? "approval_decision"
          : "system_alert",
      title: titleMap[params.status],
      message: messageMap[params.status],
      entityType: "profile",
      entityId: params.userId,
      actionUrl: "/dashboard",
      priority:
        params.status === "suspended" ||
        params.status === "rejected" ||
        params.status === "deleted"
          ? "high"
          : "medium",
      actorUserId: params.actorUserId ?? null,
      category: "admin",
      dedupeKey: `account-${params.status}:${params.userId}:${Date.now()}`,
      metadata: {
        accountStatus: params.status,
        reason: params.reason ?? null,
      },
      sendEmail: true,
    });
  } catch (error) {
    console.error("ACCOUNT STATUS NOTIFICATION ERROR:", error);
  }
}

export type AdminDashboardStats = {
  totalEmployees: number;
  pendingLeaveRequests: number;
  activeCRMDeals: number;
  lowStockItems: number;
  openTasks: number;
  activeChannels: number;
};

export type LeaveRequestRow = {
  id: string;
  organization_id: string;
  office_id?: string | null;
  user_id: string;
  leave_type_id: string | null;
  start_date: string;
  end_date: string;
  requested_days: number;
  request_department?: string | null;
  request_role?: string | null;
  office?: string | null;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  balance_deducted_at?: string | null;
  admin_notes?: string | null;
  edited_by?: string | null;
  edited_at?: string | null;
  cancelled_at?: string | null;
  cancelled_by?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_department?: string | null;
  requester_role?: string | null;
  requester_office_id?: string | null;
};

const ADMIN_LEAVE_REQUEST_SELECT =
  "id, organization_id, office_id, user_id, leave_type_id, start_date, end_date, requested_days, request_department, request_role, office, reason, status, approved_by, approved_at, rejection_reason, balance_deducted_at, admin_notes, edited_by, edited_at, cancelled_at, cancelled_by, cancellation_reason, created_at";

const LEGACY_ADMIN_LEAVE_REQUEST_SELECT =
  "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_department, request_role, reason, status, approved_by, approved_at, rejection_reason, balance_deducted_at, created_at";

function isMissingLeaveLifecycleColumn(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? "")
    .toLowerCase();

  return [
    "leave_requests.office",
    "leave_requests.office_id",
    "column office",
    "column office_id",
    "admin_notes",
    "edited_by",
    "edited_at",
    "cancelled_at",
    "cancelled_by",
    "cancellation_reason",
  ].some((column) => message.includes(column));
}

function normalizeAdminLeaveRequest(
  row: Partial<LeaveRequestRow>,
): LeaveRequestRow {
  return {
    ...(row as LeaveRequestRow),
    office_id: row.office_id ?? null,
    office: row.office ?? row.request_department ?? null,
    admin_notes: row.admin_notes ?? null,
    edited_by: row.edited_by ?? null,
    edited_at: row.edited_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    cancelled_by: row.cancelled_by ?? null,
    cancellation_reason: row.cancellation_reason ?? null,
  };
}

async function getLeaveRequestRows(params: {
  organizationId: string;
  limit?: number;
  officeId?: string | null;
}) {
  let query = supabase
    .from("leave_requests")
    .select(ADMIN_LEAVE_REQUEST_SELECT)
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false });

  if (params.officeId) query = query.eq("office_id", params.officeId);
  if (params.limit) query = query.limit(params.limit);

  const current = await query;

  if (!current.error) {
    return (current.data ?? []).map(normalizeAdminLeaveRequest);
  }

  if (!isMissingLeaveLifecycleColumn(current.error)) throw current.error;

  let legacyQuery = supabase
    .from("leave_requests")
    .select(LEGACY_ADMIN_LEAVE_REQUEST_SELECT)
    .eq("organization_id", params.organizationId)
    .order("created_at", { ascending: false });

  if (params.officeId) {
    const { data: officeProfiles, error: officeProfilesError } = await supabase
      .from("profiles")
      .select("id")
      .eq("organization_id", params.organizationId)
      .eq("office_id", params.officeId);

    if (officeProfilesError) throw officeProfilesError;
    const officeUserIds = (officeProfiles ?? []).map((item) => item.id);
    if (officeUserIds.length === 0) return [];
    legacyQuery = legacyQuery.in("user_id", officeUserIds);
  }

  if (params.limit) legacyQuery = legacyQuery.limit(params.limit);

  const legacy = await legacyQuery;
  if (legacy.error) throw legacy.error;
  return (legacy.data ?? []).map(normalizeAdminLeaveRequest);
}

export type LeaveTypeRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  default_days: number;
  created_at: string;
};

export type DutyRosterRow = {
  id: string;
  organization_id: string;
  office_id?: string | null;
  title: string;
  department: string | null;
  week_start: string;
  status?: "active" | "paused" | "archived" | string;
  rotation_seed?: number | null;
  notes?: string | null;
  created_by: string | null;
  archived_at?: string | null;
  archived_by?: string | null;
  created_at: string;
};

export type DutyRosterEntryRow = {
  id: string;
  roster_id: string;
  user_id: string;
  shift_date: string;
  shift_name: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  created_at: string;
};

export type WeeklyDutyInput = {
  rosterId: string;
  userId: string;
  weekStart: string;
  shiftName: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string;
};

export type ProfileRosterUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  department: string | null;
  office_id?: string | null;
};

export type LocationPlannerOfficeRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  is_primary: boolean;
};

export type LocationPlannerUserRow = {
  id: string;
  organization_id: string | null;
  office_id: string | null;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  department: string | null;
  account_status?: string | null;
  is_active?: boolean | null;
};

export type LocationPlannerAssignmentRow = {
  id: string;
  organization_id: string;
  week_start: string;
  user_id: string;
  location_office_id: string;
  assigned_by: string | null;
  assigned_at: string;
  notes: string | null;
};

export type DutyType = "weekly_rotating" | "single_day";

export type DutyDefinitionRow = {
  id: string;
  organization_id: string;
  office_id: string | null;
  name: string;
  description: string | null;
  duty_type: DutyType;
  day_of_week: number | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DutyRosterMemberRow = {
  id: string;
  roster_id: string;
  user_id: string;
  sort_order: number;
  created_at: string;
};

export type DutyRosterDutyRow = {
  id: string;
  roster_id: string;
  duty_id: string;
  rotation_offset: number;
  sort_order: number;
  created_at: string;
};

export type DutyAssignmentPreview = {
  id: string;
  roster_id: string;
  duty_id: string;
  duty_name: string;
  description: string | null;
  duty_type: DutyType;
  day_of_week: number | null;
  shift_date: string | null;
  week_start: string;
  user_id: string;
  is_fat_friday: boolean;
};

export type EmployeeRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  primary_role: string | null;
  organization_id: string | null;
  office_id: string | null;
  office?: CompanyOffice | null;
  department: string | null;
  last_seen_at: string | null;
  is_active: boolean;
  is_suspended?: boolean;
  suspended_at?: string | null;
  account_status?: AccountStatus | null;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
  suspended_by?: string | null;
  suspension_reason?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
};

export type EmployeeTimesheetSummaryRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  last_seen_at: string | null;
  today_seconds: number;
  week_seconds: number;
  has_active_timer: boolean;
};

export type EmployeeOverviewRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  primary_role: string | null;
  organization_id: string | null;
  office_id: string | null;
  office?: CompanyOffice | null;
  department: string | null;
  last_seen_at: string | null;
  is_active: boolean;
  today_seconds: number;
  week_seconds: number;
  has_active_timer: boolean;
  is_suspended?: boolean;
  suspended_at?: string | null;
  account_status: AccountStatus;
  approved_at?: string | null;
  approved_by?: string | null;
  rejected_at?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
  suspended_by?: string | null;
  suspension_reason?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deletion_reason?: string | null;
};

export type AccountStatus =
  | "pending"
  | "pending_approval"
  | "active"
  | "suspended"
  | "rejected"
  | "deleted";

export type EmployeeInviteResult =
  | {
      status: "linked";
      userId: string;
      message: string;
    }
  | {
      status: "invite_created";
      invitationId: string;
      message: string;
    };

export type AdminPeopleStats = {
  totalUsers: number;
  activeUsers: number;
  currentlyTracking: number;
  totalTodayHours: number;
  totalWeekHours: number;
};

export type EmployeeDetailRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  primary_role: string | null;
  organization_id: string | null;
  department: string | null;
  last_seen_at: string | null;
  is_active: boolean;
};

export type TimeEntryRow = {
  id: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  description: string | null;
  task_id?: string | null;
};

export type StockItemRow = {
  id: string;
  organization_id: string;
  name: string;
  quantity: number;
  reorder_level: number;
  unit_price?: number | null;
  category?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type CRMDealRow = {
  id: string;
  organization_id: string;
  company_id?: string | null;
  contact_id?: string | null;
  title: string;
  value: number;
  stage: string;
  expected_close_date?: string | null;
  owner_id?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
};

export async function getEmployeeById(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, primary_role, organization_id, department, last_seen_at, is_active, is_suspended, account_status, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, suspended_at, suspended_by, suspension_reason, deleted_at, deleted_by, deletion_reason",
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as EmployeeDetailRow | null;
}

export async function getEmployeeTimeEntries(params: {
  organizationId: string;
  userId: string;
}) {
  const { data, error } = await supabase
    .from("time_entries")
    .select(
      "id, organization_id, user_id, task_id, started_at, ended_at, duration_seconds, description, created_at",
    )
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId)
    .order("started_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as TimeEntryRow[];
}

export async function getLeaveRequests(params: {
  organizationId: string;
  officeId?: string | null;
}) {
  const requests = await getLeaveRequestRows(params);

  const userIds = [
    ...new Set(requests.map((item) => item.user_id).filter(Boolean)),
  ];

  if (userIds.length === 0) return requests;

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, department, primary_role, office_id")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profilesData ?? []).map((profile) => [profile.id, profile]),
  );

  return requests.map((request) => {
    const requester = profileMap.get(request.user_id);

    return {
      ...request,
      requester_name: requester?.full_name ?? null,
      requester_email: requester?.email ?? null,
      requester_department:
        request.office ?? request.request_department ?? requester?.department ?? null,
      requester_role: request.request_role ?? requester?.primary_role ?? null,
      requester_office_id: request.office_id ?? requester?.office_id ?? null,
    };
  });
}

export async function getRecentLeaveRequests(
  organizationId: string,
): Promise<LeaveRequestRow[]> {
  const requests = await getLeaveRequestRows({ organizationId, limit: 5 });

  const userIds = [
    ...new Set(requests.map((item) => item.user_id).filter(Boolean)),
  ];

  if (userIds.length === 0) return requests;

  const { data: profilesData, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, department, primary_role")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profilesData ?? []).map((profile) => [profile.id, profile]),
  );

  return requests.map((request) => {
    const requester = profileMap.get(request.user_id);

    return {
      ...request,
      requester_name: requester?.full_name ?? null,
      requester_email: requester?.email ?? null,
      requester_department:
        request.office ?? request.request_department ?? requester?.department ?? null,
      requester_role: request.request_role ?? requester?.primary_role ?? null,
    };
  });
}

export async function getLeaveTypes(organizationId: string) {
  const { data, error } = await supabase
    .from("leave_types")
    .select("id, organization_id, name, description, default_days, created_at")
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LeaveTypeRow[];
}

export async function updateLeaveRequestStatus(params: {
  leaveRequestId: string;
  organizationId: string;
  status: "approved" | "rejected";
  approvedBy: string;
  rejectionReason?: string;
}) {
  const approvedAt = new Date().toISOString();

  let updateResult = await supabase
    .from("leave_requests")
    .update({
      status: params.status,
      approved_by: params.approvedBy,
      approved_at: approvedAt,
      rejection_reason: params.status === "rejected"
        ? (params.rejectionReason ?? "")
        : null,
    })
    .eq("id", params.leaveRequestId)
    .eq("organization_id", params.organizationId)
    .select(ADMIN_LEAVE_REQUEST_SELECT)
    .single();

  if (updateResult.error && isMissingLeaveLifecycleColumn(updateResult.error)) {
    updateResult = await supabase
      .from("leave_requests")
      .update({
        status: params.status,
        approved_by: params.approvedBy,
        approved_at: approvedAt,
        rejection_reason: params.status === "rejected"
          ? (params.rejectionReason ?? "")
          : null,
      })
      .eq("id", params.leaveRequestId)
      .eq("organization_id", params.organizationId)
      .select(LEGACY_ADMIN_LEAVE_REQUEST_SELECT)
      .single();
  }

  if (updateResult.error) {
    console.error("UPDATE LEAVE REQUEST STATUS ERROR:", updateResult.error);
    throw new Error(updateResult.error.message);
  }

  try {
    const request = normalizeAdminLeaveRequest(updateResult.data);

    const [{ data: approver }, { data: leaveType }] = await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, email")
        .eq("id", params.approvedBy)
        .maybeSingle(),
      request.leave_type_id
        ? supabase
          .from("leave_types")
          .select("name")
          .eq("id", request.leave_type_id)
          .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    const approved = params.status === "approved";
    const leaveTypeName = leaveType?.name || "Leave";
    const approverName =
      approver?.full_name?.trim() ||
      approver?.email?.trim() ||
      "an administrator";
    const message = approved
      ? `Your ${leaveTypeName} request from ${request.start_date} to ${request.end_date} was approved.`
      : `Your ${leaveTypeName} request from ${request.start_date} to ${request.end_date} was rejected.${params.rejectionReason ? ` Reason: ${params.rejectionReason}` : ""}`;

    const sendDecisionFallback = async (reason: unknown) => {
      console.warn(
        "LEAVE DECISION PRIMARY PIPELINE FAILED, USING EDGE FALLBACK:",
        reason,
      );
      const { error: fallbackError } = await supabase.functions.invoke(
        "create-notification",
        {
          body: {
            organizationId: params.organizationId,
            userId: request.user_id,
            type: approved
              ? "leave_request_approved"
              : "leave_request_rejected",
            title: approved
              ? "Leave request approved"
              : "Leave request rejected",
            message,
            actionUrl: "/leave",
            priority: approved ? "medium" : "high",
            entityType: "leave_request",
            entityId: request.id,
            referenceId: request.id,
            referenceType: "leave_request",
            actorUserId: params.approvedBy,
            category: "leave",
            dedupeKey: `leave-${params.status}:${request.id}`,
            metadata: {
              leaveRequestId: request.id,
              requesterId: request.user_id,
              decidedByUserId: params.approvedBy,
              decidedByName: approverName,
              status: params.status,
              leaveTypeName,
              startDate: request.start_date,
              endDate: request.end_date,
              rejectionReason: params.rejectionReason ?? null,
            },
          },
        },
      );

      if (fallbackError) throw fallbackError;
    };

    try {
      const decisionResult = await notifyLeaveRequestDecision({
        organizationId: params.organizationId,
        requesterId: request.user_id,
        leaveRequestId: request.id,
        status: params.status,
        leaveTypeId: request.leave_type_id,
        startDate: request.start_date,
        endDate: request.end_date,
        rejectionReason: params.rejectionReason ?? null,
        decidedByUserId: params.approvedBy,
        sendEmail: true,
      }) as NotificationSummary;

      if (decisionResult?.ok === false || (decisionResult?.failed ?? 0) > 0) {
        await sendDecisionFallback(decisionResult);
      }
    } catch (primaryNotifyError) {
      await sendDecisionFallback(primaryNotifyError);
    }

    if (params.status === "approved") {
      console.info(
        "LEAVE APPROVED:",
        `${leaveType?.name || "General Leave"} for ${request.requested_days} day(s) approved by ${
          approver?.full_name?.trim() || approver?.email?.trim() || "an administrator"
        }.`,
      );
    }
  } catch (notifyErr) {
    console.error("LEAVE APPROVAL/REJECTION NOTIFY ERROR:", notifyErr);
  }

  return normalizeAdminLeaveRequest(updateResult.data);
}
export async function createLeaveType(params: {
  organizationId: string;
  name: string;
  description?: string;
  defaultDays?: number;
}) {
  const { data, error } = await supabase
    .from("leave_types")
    .insert({
      organization_id: params.organizationId,
      name: params.name,
      description: params.description ?? "",
      default_days: params.defaultDays ?? 0,
    })
    .select("id, organization_id, name, description, default_days, created_at")
    .single();

  if (error) throw error;
  return data as LeaveTypeRow;
}

export async function getAdminPeopleStats(
  organizationId: string,
): Promise<AdminPeopleStats> {
  const [usersRes, todayEntriesRes, weekEntriesRes, activeTimerRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, last_seen_at, is_active")
        .eq("organization_id", organizationId),

      supabase
        .from("time_entries")
        .select("user_id, started_at, ended_at, duration_seconds")
        .eq("organization_id", organizationId)
        .gte("started_at", startOfTodayISO()),

      supabase
        .from("time_entries")
        .select("user_id, started_at, ended_at, duration_seconds")
        .eq("organization_id", organizationId)
        .gte("started_at", startOfWeekISO()),

      supabase
        .from("time_entries")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .is("ended_at", null),
    ]);

  const errors = [
    usersRes.error,
    todayEntriesRes.error,
    weekEntriesRes.error,
    activeTimerRes.error,
  ].filter(Boolean);

  if (errors.length > 0) throw errors[0];

  const users = usersRes.data ?? [];
  const now = Date.now();

  const activeUsers = users.filter((user) => {
    if (!user.last_seen_at || user.is_active === false) return false;
    return now - new Date(user.last_seen_at).getTime() <= 24 * 60 * 60 * 1000;
  }).length;

  const totalTodaySeconds = (todayEntriesRes.data ?? []).reduce(
    (sum, entry) => sum + getEntrySeconds(entry),
    0,
  );

  const totalWeekSeconds = (weekEntriesRes.data ?? []).reduce(
    (sum, entry) => sum + getEntrySeconds(entry),
    0,
  );

  return {
    totalUsers: users.length,
    activeUsers,
    currentlyTracking: activeTimerRes.count ?? 0,
    totalTodayHours: Math.round((totalTodaySeconds / 3600) * 10) / 10,
    totalWeekHours: Math.round((totalWeekSeconds / 3600) * 10) / 10,
  };
}

export async function getEmployeeTimesheetSummaries(
  organizationId: string,
): Promise<EmployeeTimesheetSummaryRow[]> {
  const [profilesRes, todayEntriesRes, weekEntriesRes, activeEntriesRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, primary_role, last_seen_at, is_active")
        .eq("organization_id", organizationId)
        .order("full_name", { ascending: true }),

      supabase
        .from("time_entries")
        .select("user_id, started_at, ended_at, duration_seconds")
        .eq("organization_id", organizationId)
        .gte("started_at", startOfTodayISO()),

      supabase
        .from("time_entries")
        .select("user_id, started_at, ended_at, duration_seconds")
        .eq("organization_id", organizationId)
        .gte("started_at", startOfWeekISO()),

      supabase
        .from("time_entries")
        .select("user_id")
        .eq("organization_id", organizationId)
        .is("ended_at", null),
    ]);

  const errors = [
    profilesRes.error,
    todayEntriesRes.error,
    weekEntriesRes.error,
    activeEntriesRes.error,
  ].filter(Boolean);

  if (errors.length > 0) throw errors[0];

  const todayMap = new Map<string, number>();
  for (const entry of todayEntriesRes.data ?? []) {
    todayMap.set(
      entry.user_id,
      (todayMap.get(entry.user_id) ?? 0) + getEntrySeconds(entry),
    );
  }

  const weekMap = new Map<string, number>();
  for (const entry of weekEntriesRes.data ?? []) {
    weekMap.set(
      entry.user_id,
      (weekMap.get(entry.user_id) ?? 0) + getEntrySeconds(entry),
    );
  }

  const activeSet = new Set(
    (activeEntriesRes.data ?? []).map((entry) => entry.user_id),
  );

  return (profilesRes.data ?? []).map((profile) => ({
    user_id: profile.id,
    full_name: profile.full_name,
    email: profile.email,
    primary_role: profile.primary_role,
    last_seen_at: profile.last_seen_at,
    today_seconds: todayMap.get(profile.id) ?? 0,
    week_seconds: weekMap.get(profile.id) ?? 0,
    has_active_timer: activeSet.has(profile.id),
  }));
}

export async function getOrganizationEmployees(organizationId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, primary_role, organization_id, office_id, department, last_seen_at, is_active, is_suspended, account_status, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, suspended_at, suspended_by, suspension_reason, deleted_at, deleted_by, deletion_reason, office:company_offices!profiles_office_id_fkey (id, organization_id, name, slug, is_primary, created_at)",
    )
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<Omit<EmployeeRow, "office"> & {
    office?: CompanyOffice | CompanyOffice[] | null;
  }>).map((employee) => ({
    ...employee,
    office: Array.isArray(employee.office)
      ? employee.office[0] ?? null
      : employee.office ?? null,
  }));
}

export async function getEmployeeOverview(
  organizationId: string,
  statusFilter?: AccountStatus | "all",
): Promise<EmployeeOverviewRow[]> {
  const [employees, timesheets] = await Promise.all([
    getOrganizationEmployees(organizationId),
    getEmployeeTimesheetSummaries(organizationId),
  ]);

  const timesheetMap = new Map(timesheets.map((item) => [item.user_id, item]));

  return employees.map((employee) => {
    const summary = timesheetMap.get(employee.id);
    const accountStatus = normalizeAccountStatus(employee);

    return {
      ...employee,
      account_status: accountStatus,
      is_active: accountStatus === "active",
      is_suspended: accountStatus === "suspended",
      today_seconds: summary?.today_seconds ?? 0,
      week_seconds: summary?.week_seconds ?? 0,
      has_active_timer: summary?.has_active_timer ?? false,
      suspended_at: employee.suspended_at ?? null,
    };
  }).filter((employee) =>
    !statusFilter || statusFilter === "all"
      ? true
      : employee.account_status === statusFilter
  );
}

export async function getPendingUsers(organizationId: string) {
  return getEmployeeOverview(organizationId, "pending_approval");
}

export async function approveUser(params: {
  organizationId: string;
  userId: string;
  role: string;
  approvedBy: string;
}) {
  const normalizedRole = params.role.trim().toLowerCase();

  if (!isAppRole(normalizedRole)) {
    throw new Error("Invalid role selected.");
  }

  await assertCanModifyUser({
    organizationId: params.organizationId,
    targetUserId: params.userId,
    actorUserId: params.approvedBy,
    nextRole: normalizedRole,
  });

  const now = new Date().toISOString();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      primary_role: normalizedRole,
      account_status: "active",
      is_active: true,
      is_suspended: false,
      approved_at: now,
      approved_by: params.approvedBy,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
      suspended_at: null,
      suspended_by: null,
      suspension_reason: null,
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (profileError) throw profileError;

  const { error: memberError } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id: params.organizationId,
        user_id: params.userId,
        role: normalizedRole,
        status: "active",
        joined_at: now,
        removed_at: null,
        removed_by: null,
      },
      {
        onConflict: "organization_id,user_id",
      },
    );

  if (memberError) throw memberError;

  await logAdminAudit({
    organizationId: params.organizationId,
    actorUserId: params.approvedBy,
    targetUserId: params.userId,
    action: "user_approved",
    metadata: {
      role: normalizedRole,
    },
  });

  await notifyEmployeeAccountChange({
    organizationId: params.organizationId,
    userId: params.userId,
    actorUserId: params.approvedBy,
    status: "active",
  });

  return true;
}

export async function rejectUser(params: {
  organizationId: string;
  userId: string;
  rejectedBy: string;
  reason?: string;
}) {
  await assertCanModifyUser({
    organizationId: params.organizationId,
    targetUserId: params.userId,
    actorUserId: params.rejectedBy,
  });

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      account_status: "rejected",
      is_active: false,
      is_suspended: false,
      rejected_at: new Date().toISOString(),
      rejected_by: params.rejectedBy,
      rejection_reason: params.reason ?? null,
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (profileError) throw profileError;

  const { error: memberError } = await supabase
    .from("organization_members")
    .update({ status: "removed", removed_at: new Date().toISOString() })
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId);

  if (memberError) throw memberError;

  await logAdminAudit({
    organizationId: params.organizationId,
    actorUserId: params.rejectedBy,
    targetUserId: params.userId,
    action: "user_rejected",
    reason: params.reason ?? null,
  });

  await notifyEmployeeAccountChange({
    organizationId: params.organizationId,
    userId: params.userId,
    actorUserId: params.rejectedBy,
    status: "rejected",
    reason: params.reason,
  });

  return true;
}

export async function updateEmployeeRole(params: {
  organizationId: string;
  userId: string;
  role: string;
  updatedBy?: string;
  reason?: string;
}) {
  const normalizedRole = params.role.trim().toLowerCase();

  if (!isAppRole(normalizedRole)) {
    throw new Error("Invalid role selected.");
  }

  await runAdminUserAction({
    action: "change_role",
    targetUserId: params.userId,
    newRole: normalizedRole,
    reason: params.reason ?? null,
  });
  return true;
}

export async function updateEmployeeOffice(params: {
  organizationId: string;
  userId: string;
  officeId: string | null;
  updatedBy?: string | null;
  reason?: string;
}) {
  await assertCanModifyUser({
    organizationId: params.organizationId,
    targetUserId: params.userId,
    actorUserId: params.updatedBy,
  });

  const { data, error } = await supabase.rpc("admin_transfer_employee_office", {
    target_user_id: params.userId,
    target_office_id: params.officeId,
    change_reason: params.reason ?? null,
  });

  if (error) throw error;

  const result = (data ?? {}) as {
    changed?: boolean;
    old_office_name?: string;
    new_office_name?: string;
  };

  if (result.changed === false) {
    return true;
  }

  try {
    await notifyUser({
      organizationId: params.organizationId,
      userId: params.userId,
      actorUserId: params.updatedBy ?? null,
      type: "general",
      title: "Office assignment updated",
      message: `Your office was changed from ${result.old_office_name ?? "your previous office"} to ${result.new_office_name ?? "a new office"}. Refresh or sign in again if navigation does not update immediately.`,
      actionUrl: "/dashboard",
      category: "account",
      priority: "medium",
      metadata: {
        old_office_name: result.old_office_name ?? null,
        new_office_name: result.new_office_name ?? null,
      },
      dedupeKey: `office-updated:${params.userId}:${params.officeId ?? "none"}`,
    });
  } catch (notifyError) {
    console.error("OFFICE UPDATE NOTIFICATION ERROR:", notifyError);
  }

  return true;
}

export async function removeEmployeeFromOrganization(params: {
  organizationId: string;
  userId: string;
  removedBy?: string;
  reason?: string;
}) {
  await assertCanModifyUser({
    organizationId: params.organizationId,
    targetUserId: params.userId,
    actorUserId: params.removedBy,
  });

  const now = new Date().toISOString();

  const { error: memberUpdateError } = await supabase
    .from("organization_members")
    .update({
      status: "removed",
      removed_at: now,
      removed_by: params.removedBy ?? null,
    })
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId);

  if (memberUpdateError) throw memberUpdateError;

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      is_active: false,
      is_suspended: false,
      account_status: "deleted",
      deleted_at: now,
      deleted_by: params.removedBy ?? null,
      deletion_reason: params.reason ?? "Removed from organization",
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (profileUpdateError) throw profileUpdateError;

  await logAdminAudit({
    organizationId: params.organizationId,
    actorUserId: params.removedBy ?? null,
    targetUserId: params.userId,
    action: "removed_from_organization",
    reason: params.reason ?? null,
  });

  await notifyEmployeeAccountChange({
    organizationId: params.organizationId,
    userId: params.userId,
    actorUserId: params.removedBy,
    status: "removed",
    reason: params.reason,
  });

  return true;
}

export async function suspendUser(params: {
  organizationId: string;
  userId: string;
  suspendedBy: string;
  reason?: string;
}) {
  await runAdminUserAction({
    action: "suspend",
    targetUserId: params.userId,
    reason: params.reason,
  });

  await notifyEmployeeAccountChange({
    organizationId: params.organizationId,
    userId: params.userId,
    actorUserId: params.suspendedBy,
    status: "suspended",
    reason: params.reason,
  });

  return true;
}

export async function unsuspendUser(params: {
  organizationId: string;
  userId: string;
  unsuspendedBy?: string;
}) {
  await runAdminUserAction({
    action: "reactivate",
    targetUserId: params.userId,
  });

  await notifyEmployeeAccountChange({
    organizationId: params.organizationId,
    userId: params.userId,
    actorUserId: params.unsuspendedBy,
    status: "unsuspended",
  });

  return true;
}

export async function softDeleteUser(params: {
  organizationId: string;
  userId: string;
  deletedBy?: string;
  reason?: string;
}) {
  await runAdminUserAction({
    action: "soft_delete",
    targetUserId: params.userId,
    reason: params.reason,
  });

  await notifyEmployeeAccountChange({
    organizationId: params.organizationId,
    userId: params.userId,
    actorUserId: params.deletedBy,
    status: "deleted",
    reason: params.reason,
  });

  return true;
}


export async function inviteEmployeeToOrganization(params: {
  organizationId: string;
  email: string;
  fullName: string;
  role: string;
  invitedBy?: string;
}): Promise<EmployeeInviteResult> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const normalizedRole = params.role.trim().toLowerCase();
  const profileRole = isAppRole(normalizedRole) ? normalizedRole : "user";

  if (normalizedRole === "admin" && !isSuperAdminAllowedEmail(normalizedEmail)) {
    throw new Error(
      "This email is not allowed to be invited as Super Admin.",
    );
  }

  const { data: matchingProfiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, primary_role, organization_id, is_active")
    .ilike("email", normalizedEmail);

  if (profileError) throw profileError;

  if (!matchingProfiles || matchingProfiles.length === 0) {
    const invitation = await createOrganizationInvitation({
      organizationId: params.organizationId,
      email: normalizedEmail,
      fullName: params.fullName,
      roleKey: normalizedRole,
    });

    await logAdminAudit({
      organizationId: params.organizationId,
      actorUserId: params.invitedBy ?? null,
      action: "employee_invitation_created",
      metadata: {
        email: normalizedEmail,
        role: normalizedRole,
      },
    });

    return {
      status: "invite_created",
      invitationId: invitation.id,
      message:
        "Invite created. The user can sign up with this email and will be linked to your organization.",
    };
  }

  if (matchingProfiles.length > 1) {
    throw new Error(
      "Multiple profiles were found for this email. Clean up duplicate profile rows first.",
    );
  }

  const existingProfile = matchingProfiles[0];

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      full_name: existingProfile.full_name || params.fullName,
      primary_role: profileRole,
      organization_role_key: normalizedRole,
      organization_id: params.organizationId,
      is_active: true,
      is_suspended: false,
      account_status: "active",
      approved_at: new Date().toISOString(),
      approved_by: params.invitedBy ?? null,
      rejected_at: null,
      rejected_by: null,
      rejection_reason: null,
      deleted_at: null,
      deleted_by: null,
      deletion_reason: null,
    })
    .eq("id", existingProfile.id);

  if (profileUpdateError) throw profileUpdateError;

  const { error: memberUpsertError } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id: params.organizationId,
        user_id: existingProfile.id,
        role: normalizedRole,
        status: "active",
        joined_at: new Date().toISOString(),
        removed_at: null,
        removed_by: null,
      },
      {
        onConflict: "organization_id,user_id",
      },
    );

  if (memberUpsertError) throw memberUpsertError;

  await logAdminAudit({
    organizationId: params.organizationId,
    actorUserId: params.invitedBy ?? null,
    targetUserId: existingProfile.id,
    action: "employee_linked",
    metadata: {
      email: normalizedEmail,
      role: normalizedRole,
    },
  });

  await notifyEmployeeAccountChange({
    organizationId: params.organizationId,
    userId: existingProfile.id,
    actorUserId: params.invitedBy,
    status: "active",
  });

  return {
    status: "linked",
    userId: existingProfile.id,
    message: "User linked successfully and marked active.",
  };
}

export async function getLowStockItems(
  organizationId: string,
): Promise<StockItemRow[]> {
  const { data, error } = await supabase
    .from("stock_items")
    .select(
      "id, organization_id, name, quantity, reorder_level, unit_price, category, status, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("name", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as StockItemRow[]).filter(
    (item) =>
      typeof item.quantity === "number" &&
      typeof item.reorder_level === "number" &&
      item.quantity <= item.reorder_level,
  );
}

export async function getRecentCRMDeals(
  organizationId: string,
): Promise<CRMDealRow[]> {
  const { data, error } = await supabase
    .from("crm_deals")
    .select(
      "id, organization_id, company_id, contact_id, title, value, stage, expected_close_date, owner_id, notes, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  return (data ?? []) as CRMDealRow[];
}

const DUTY_ROSTER_SELECT =
  "id, organization_id, office_id, title, department, week_start, status, rotation_seed, notes, created_by, archived_at, archived_by, created_at";

const DUTY_DEFINITION_SELECT =
  "id, organization_id, office_id, name, description, duty_type, day_of_week, is_active, created_by, created_at, updated_at";

function getWeekStartFromDate(date: Date) {
  const next = new Date(date);
  const day = next.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  next.setDate(next.getDate() + diffToMonday);
  next.setHours(0, 0, 0, 0);
  return toDateKey(next);
}

function getWeekDifference(fromWeekStart: string, toWeekStart: string) {
  return Math.round(
    (new Date(`${toWeekStart}T00:00:00.000Z`).getTime() -
      new Date(`${fromWeekStart}T00:00:00.000Z`).getTime()) /
      (7 * 86400000),
  );
}

function dayOfWeekToDate(weekStart: string, dayOfWeek: number | null) {
  if (!dayOfWeek) return null;
  return addDays(weekStart, dayOfWeek - 1);
}

export function getCurrentDutyWeekStart() {
  return getWeekStartFromDate(new Date());
}

export function getUpcomingDutyWeekStarts(count = 4, from = new Date()) {
  const start = getWeekStartFromDate(from);
  return Array.from({ length: count }, (_, index) => addDays(start, index * 7));
}

export function getDutyAssignmentsForWeek(params: {
  roster: DutyRosterRow;
  weekStart: string;
  rosterMembers: DutyRosterMemberRow[];
  rosterDuties: DutyRosterDutyRow[];
  duties: DutyDefinitionRow[];
}): DutyAssignmentPreview[] {
  const members = [...params.rosterMembers].sort(
    (a, b) => a.sort_order - b.sort_order,
  );
  const rosterDuties = [...params.rosterDuties].sort(
    (a, b) => a.sort_order - b.sort_order,
  );

  if (members.length === 0 || rosterDuties.length === 0) return [];

  const dutyMap = new Map(params.duties.map((duty) => [duty.id, duty]));
  const weekOffset = getWeekDifference(
    params.roster.week_start,
    params.weekStart,
  );
  const seed = params.roster.rotation_seed ?? 0;

  return rosterDuties
    .map((rosterDuty, dutyIndex) => {
      const duty = dutyMap.get(rosterDuty.duty_id);
      if (!duty || !duty.is_active) return null;

      const memberIndex =
        (((seed + rosterDuty.rotation_offset + dutyIndex + weekOffset) %
          members.length) +
          members.length) %
        members.length;
      const member = members[memberIndex];
      const isFatFriday = duty.name.toLowerCase().includes("fat friday");

      return {
        id: `${params.roster.id}:${params.weekStart}:${duty.id}`,
        roster_id: params.roster.id,
        duty_id: duty.id,
        duty_name: duty.name,
        description: duty.description,
        duty_type: duty.duty_type,
        day_of_week: duty.day_of_week,
        shift_date:
          duty.duty_type === "single_day"
            ? dayOfWeekToDate(params.weekStart, duty.day_of_week)
            : null,
        week_start: params.weekStart,
        user_id: member.user_id,
        is_fat_friday: isFatFriday,
      } satisfies DutyAssignmentPreview;
    })
    .filter((assignment): assignment is DutyAssignmentPreview => Boolean(assignment));
}

export async function getITsNomatataOffice(organizationId: string) {
  return getCompanyOfficeBySlug({
    organizationId,
    slug: OFFICE_SLUGS.itsNoMatata,
  });
}

export function canManageITDutyRoster(profile?: {
  primary_role?: string | null;
  office?: { slug?: string | null } | null;
} | null) {
  return (
    isITsNomatataOfficeProfile(profile) &&
    ["admin", "manager", "it-superadmin", "superadmin"].includes(
      String(profile?.primary_role ?? ""),
    )
  );
}

export async function getDutyRosters(
  organizationId: string,
  officeId?: string | null,
) {
  let query = supabase
    .from("duty_rosters")
    .select(DUTY_ROSTER_SELECT)
    .eq("organization_id", organizationId)
    .order("week_start", { ascending: false });

  if (officeId) query = query.eq("office_id", officeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DutyRosterRow[];
}

export async function getDutyRosterEntries(rosterId: string) {
  const { data, error } = await supabase
    .from("duty_roster_entries")
    .select(
      "id, roster_id, user_id, shift_date, shift_name, start_time, end_time, notes, created_at",
    )
    .eq("roster_id", rosterId)
    .order("shift_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DutyRosterEntryRow[];
}

export async function getOrganizationUsersForRoster(
  organizationId: string,
  officeId?: string | null,
) {
  let query = supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, department, office_id")
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });

  if (officeId) query = query.eq("office_id", officeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProfileRosterUserRow[];
}

export async function getOrganizationLocationsForPlanner(organizationId: string) {
  const { data, error } = await supabase
    .from("company_offices")
    .select("id, organization_id, name, slug, is_primary")
    .eq("organization_id", organizationId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LocationPlannerOfficeRow[];
}

export async function getOrganizationUsersForPlanner(organizationId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, organization_id, office_id, full_name, email, primary_role, department, account_status, is_active",
    )
    .eq("organization_id", organizationId)
    .neq("account_status", "deleted")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LocationPlannerUserRow[];
}

export async function getLocationPlannerAssignments(params: {
  organizationId: string;
  weekStart: string;
}) {
  const { data, error } = await supabase
    .from("location_planner_assignments")
    .select(
      "id, organization_id, week_start, user_id, location_office_id, assigned_by, assigned_at, notes",
    )
    .eq("organization_id", params.organizationId)
    .eq("week_start", params.weekStart);

  if (error) throw error;
  return (data ?? []) as LocationPlannerAssignmentRow[];
}

export async function upsertLocationPlannerAssignment(params: {
  organizationId: string;
  weekStart: string;
  userId: string;
  locationOfficeId: string;
  assignedBy?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await supabase
    .from("location_planner_assignments")
    .upsert(
      {
        organization_id: params.organizationId,
        week_start: params.weekStart,
        user_id: params.userId,
        location_office_id: params.locationOfficeId,
        assigned_by: params.assignedBy ?? null,
        assigned_at: new Date().toISOString(),
        notes: params.notes ?? null,
      },
      {
        onConflict: "organization_id,week_start,user_id",
      },
    )
    .select(
      "id, organization_id, week_start, user_id, location_office_id, assigned_by, assigned_at, notes",
    )
    .single();

  if (error) throw error;
  return data as LocationPlannerAssignmentRow;
}

export async function getITsNomatataUsersForRoster(organizationId: string) {
  const office = await getITsNomatataOffice(organizationId);
  if (!office) return [];
  return getOrganizationUsersForRoster(organizationId, office.id);
}

export async function createDutyRoster(params: {
  organizationId: string;
  officeId?: string | null;
  title: string;
  department?: string;
  weekStart: string;
  notes?: string;
  rotationSeed?: number;
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from("duty_rosters")
    .insert({
      organization_id: params.organizationId,
      office_id: params.officeId ?? null,
      title: params.title,
      department: params.department ?? null,
      week_start: params.weekStart,
      notes: params.notes ?? null,
      rotation_seed: params.rotationSeed ?? 0,
      status: "active",
      created_by: params.createdBy ?? null,
    })
    .select(DUTY_ROSTER_SELECT)
    .single();

  if (error) throw error;
  return data as DutyRosterRow;
}

export async function updateDutyRoster(params: {
  rosterId: string;
  title?: string;
  department?: string | null;
  notes?: string | null;
  status?: "active" | "paused" | "archived";
  actorUserId?: string | null;
}) {
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (params.title !== undefined) patch.title = params.title;
  if (params.department !== undefined) patch.department = params.department;
  if (params.notes !== undefined) patch.notes = params.notes;
  if (params.status !== undefined) {
    patch.status = params.status;
    if (params.status === "archived") {
      patch.archived_at = new Date().toISOString();
      patch.archived_by = params.actorUserId ?? null;
    }
  }

  const { data, error } = await supabase
    .from("duty_rosters")
    .update(patch)
    .eq("id", params.rosterId)
    .select(DUTY_ROSTER_SELECT)
    .single();

  if (error) throw error;
  return data as DutyRosterRow;
}

export async function deleteDutyRosterSafely(rosterId: string) {
  await supabase.from("duty_roster_entries").delete().eq("roster_id", rosterId);
  await supabase.from("duty_roster_members").delete().eq("roster_id", rosterId);
  await supabase.from("duty_roster_duties").delete().eq("roster_id", rosterId);

  const { error } = await supabase
    .from("duty_rosters")
    .delete()
    .eq("id", rosterId);

  if (error) throw error;
}

export async function getDutyDefinitions(
  organizationId: string,
  officeId?: string | null,
) {
  let query = supabase
    .from("duty_definitions")
    .select(DUTY_DEFINITION_SELECT)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (officeId) query = query.eq("office_id", officeId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DutyDefinitionRow[];
}

export async function upsertDutyDefinition(params: {
  id?: string;
  organizationId: string;
  officeId: string;
  name: string;
  description?: string | null;
  dutyType: DutyType;
  dayOfWeek?: number | null;
  isActive: boolean;
  createdBy?: string | null;
}) {
  const payload = {
    organization_id: params.organizationId,
    office_id: params.officeId,
    name: params.name.trim(),
    description: params.description?.trim() || null,
    duty_type: params.dutyType,
    day_of_week: params.dutyType === "single_day" ? params.dayOfWeek ?? 5 : null,
    is_active: params.isActive,
    created_by: params.createdBy ?? null,
    updated_at: new Date().toISOString(),
  };

  const query = params.id
    ? supabase.from("duty_definitions").update(payload).eq("id", params.id)
    : supabase.from("duty_definitions").insert(payload);

  const { data, error } = await query
    .select(DUTY_DEFINITION_SELECT)
    .single();

  if (error) throw error;
  return data as DutyDefinitionRow;
}

export async function getDutyRosterMembers(rosterId: string) {
  const { data, error } = await supabase
    .from("duty_roster_members")
    .select("id, roster_id, user_id, sort_order, created_at")
    .eq("roster_id", rosterId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DutyRosterMemberRow[];
}

export async function setDutyRosterMembers(rosterId: string, userIds: string[]) {
  const { error: deleteError } = await supabase
    .from("duty_roster_members")
    .delete()
    .eq("roster_id", rosterId);
  if (deleteError) throw deleteError;

  if (userIds.length === 0) return [];

  const { data, error } = await supabase
    .from("duty_roster_members")
    .insert(
      userIds.map((userId, index) => ({
        roster_id: rosterId,
        user_id: userId,
        sort_order: index,
      })),
    )
    .select("id, roster_id, user_id, sort_order, created_at");

  if (error) throw error;
  return (data ?? []) as DutyRosterMemberRow[];
}

export async function getDutyRosterDuties(rosterId: string) {
  const { data, error } = await supabase
    .from("duty_roster_duties")
    .select("id, roster_id, duty_id, rotation_offset, sort_order, created_at")
    .eq("roster_id", rosterId)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  return (data ?? []) as DutyRosterDutyRow[];
}

export async function setDutyRosterDuties(rosterId: string, dutyIds: string[]) {
  const { error: deleteError } = await supabase
    .from("duty_roster_duties")
    .delete()
    .eq("roster_id", rosterId);
  if (deleteError) throw deleteError;

  if (dutyIds.length === 0) return [];

  const { data, error } = await supabase
    .from("duty_roster_duties")
    .insert(
      dutyIds.map((dutyId, index) => ({
        roster_id: rosterId,
        duty_id: dutyId,
        rotation_offset: index,
        sort_order: index,
      })),
    )
    .select("id, roster_id, duty_id, rotation_offset, sort_order, created_at");

  if (error) throw error;
  return (data ?? []) as DutyRosterDutyRow[];
}

export async function createDutyRosterWithSetup(params: {
  organizationId: string;
  office: CompanyOffice;
  title: string;
  department?: string;
  weekStart: string;
  notes?: string;
  createdBy?: string | null;
  userIds: string[];
  dutyIds: string[];
}) {
  const roster = await createDutyRoster({
    organizationId: params.organizationId,
    officeId: params.office.id,
    title: params.title,
    department: params.department,
    weekStart: params.weekStart,
    notes: params.notes,
    createdBy: params.createdBy,
  });

  await Promise.all([
    setDutyRosterMembers(roster.id, params.userIds),
    setDutyRosterDuties(roster.id, params.dutyIds),
  ]);

  try {
    const [members, rosterDuties, duties] = await Promise.all([
      getDutyRosterMembers(roster.id),
      getDutyRosterDuties(roster.id),
      getDutyDefinitions(params.organizationId, params.office.id),
    ]);
    const assignments = getDutyAssignmentsForWeek({
      roster,
      weekStart: getCurrentDutyWeekStart(),
      rosterMembers: members,
      rosterDuties,
      duties,
    });
    const assignmentsByUser = new Map<string, string[]>();
    for (const assignment of assignments) {
      const current = assignmentsByUser.get(assignment.user_id) ?? [];
      current.push(assignment.duty_name);
      assignmentsByUser.set(assignment.user_id, current);
    }

    await Promise.all(
      [...assignmentsByUser.entries()].map(([assignedUserId, dutyNames]) =>
        notifyUser({
          organizationId: params.organizationId,
          userId: assignedUserId,
          type: "duty_roster_assigned",
          title: "Duty roster assigned",
          message: `You are assigned this week: ${dutyNames.join(", ")}.`,
          entityType: "duty_roster",
          entityId: roster.id,
          actionUrl: "/roster",
          priority: "medium",
          category: "roster",
          dedupeKey: `duty-roster:${roster.id}:${getCurrentDutyWeekStart()}:${assignedUserId}`,
          metadata: {
            rosterId: roster.id,
            weekStart: getCurrentDutyWeekStart(),
            duties: dutyNames,
          },
        }),
      ),
    );
  } catch (notificationError) {
    console.error("DUTY ROSTER SETUP NOTIFICATION ERROR:", notificationError);
  }

  return roster;
}

export async function createDutyRosterEntry(params: {
  rosterId: string;
  userId: string;
  shiftDate: string;
  shiftName: string;
  startTime?: string | null;
  endTime?: string | null;
  notes?: string;
}) {
  const { data, error } = await supabase
    .from("duty_roster_entries")
    .insert({
      roster_id: params.rosterId,
      user_id: params.userId,
      shift_date: params.shiftDate,
      shift_name: params.shiftName,
      start_time: params.startTime ?? null,
      end_time: params.endTime ?? null,
      notes: params.notes ?? "",
    })
    .select(
      "id, roster_id, user_id, shift_date, shift_name, start_time, end_time, notes, created_at",
    )
    .single();

  if (error) throw error;

  try {
    const { data: roster } = await supabase
      .from("duty_rosters")
      .select("id, organization_id, title, week_start")
      .eq("id", params.rosterId)
      .maybeSingle();

    if (roster) {
      await notifyUser({
        organizationId: roster.organization_id,
        userId: params.userId,
        type: "duty_roster_assigned",
        title: "Duty roster shift assigned",
        message: `You were assigned ${params.shiftName} on ${params.shiftDate}${params.startTime ? ` from ${params.startTime}` : ""}${params.endTime ? ` to ${params.endTime}` : ""}.`,
        entityType: "duty_roster",
        entityId: params.rosterId,
        referenceId: data.id,
        referenceType: "duty_roster_entry",
        actionUrl: "/roster",
        priority: "high",
        category: "roster",
        dedupeKey: `roster-entry:${data.id}`,
        metadata: {
          rosterId: params.rosterId,
          rosterTitle: roster.title,
          weekStart: roster.week_start,
          entryId: data.id,
          shiftDate: params.shiftDate,
          shiftName: params.shiftName,
          startTime: params.startTime ?? null,
          endTime: params.endTime ?? null,
        },
      });
    }
  } catch (notificationError) {
    console.error("DUTY ROSTER NOTIFICATION ERROR:", notificationError);
  }

  return data as DutyRosterEntryRow;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

function getCurrentWeekStart() {
  const date = new Date();
  const day = date.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diffToMonday);
  date.setHours(0, 0, 0, 0);
  return toDateKey(date);
}

export async function createWeeklyDutyRosterEntries(params: WeeklyDutyInput) {
  const payload = Array.from({ length: 7 }, (_, index) => ({
    roster_id: params.rosterId,
    user_id: params.userId,
    shift_date: addDays(params.weekStart, index),
    shift_name: params.shiftName,
    start_time: params.startTime ?? null,
    end_time: params.endTime ?? null,
    notes: params.notes ?? "",
  }));

  const { data, error } = await supabase
    .from("duty_roster_entries")
    .insert(payload)
    .select(
      "id, roster_id, user_id, shift_date, shift_name, start_time, end_time, notes, created_at",
    );

  if (error) throw error;
  return (data ?? []) as DutyRosterEntryRow[];
}

export async function ensureNextWeekDutyRosterRotation(params: {
  organizationId: string;
  createdBy: string;
}) {
  const currentWeekStart = getCurrentWeekStart();

  const existingCurrentWeek = await supabase
    .from("duty_rosters")
    .select("id")
    .eq("organization_id", params.organizationId)
    .eq("week_start", currentWeekStart)
    .maybeSingle();

  if (existingCurrentWeek.error) throw existingCurrentWeek.error;
  if (existingCurrentWeek.data) return null;

  const rosters = await getDutyRosters(params.organizationId);
  const latestRoster = rosters[0];
  if (!latestRoster || latestRoster.week_start >= currentWeekStart) return null;

  const [previousEntries, users] = await Promise.all([
    getDutyRosterEntries(latestRoster.id),
    getOrganizationUsersForRoster(params.organizationId),
  ]);

  const activeUsers = users.filter((item) => item.id);
  if (previousEntries.length === 0 || activeUsers.length < 2) return null;

  const userIds = activeUsers.map((item) => item.id);
  const rotatedEntries = previousEntries.map((entry) => {
    const currentIndex = userIds.indexOf(entry.user_id);
    const nextUserId =
      currentIndex === -1
        ? userIds[0]
        : userIds[(currentIndex + 1) % userIds.length];

    const previousDayOffset = Math.max(
      0,
      Math.round(
        (new Date(`${entry.shift_date}T00:00:00.000Z`).getTime() -
          new Date(`${latestRoster.week_start}T00:00:00.000Z`).getTime()) /
          86400000,
      ),
    );

    return {
      userId: nextUserId,
      shiftDate: addDays(currentWeekStart, previousDayOffset),
      shiftName: entry.shift_name,
      startTime: entry.start_time,
      endTime: entry.end_time,
      notes: entry.notes ?? "",
    };
  });

  const nextRoster = await createDutyRoster({
    organizationId: params.organizationId,
    title: `${latestRoster.title.replace(/\s*\(Auto rotated\)$/i, "")} (Auto rotated)`,
    department: latestRoster.department ?? undefined,
    weekStart: currentWeekStart,
    createdBy: params.createdBy,
  });

  const { error } = await supabase.from("duty_roster_entries").insert(
    rotatedEntries.map((entry) => ({
      roster_id: nextRoster.id,
      user_id: entry.userId,
      shift_date: entry.shiftDate,
      shift_name: entry.shiftName,
      start_time: entry.startTime,
      end_time: entry.endTime,
      notes: entry.notes,
    })),
  );

  if (error) throw error;

  return nextRoster;
}

export async function getAdminDashboardStats(organizationId: string) {
  const [employeesRes, leaveRes, dealsRes, stockRes, tasksRes, channelsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId),

      supabase
        .from("leave_requests")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .eq("status", "pending"),

      supabase
        .from("crm_deals")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .in("stage", ["lead", "proposal", "negotiation"]),

      supabase
        .from("stock_items")
        .select("id, quantity, reorder_level")
        .eq("organization_id", organizationId),

      supabase
        .from("tasks")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId)
        .in("status", ["todo", "backlog", "in_progress", "review", "blocked"]),

      supabase
        .from("chat_channels")
        .select("id", { head: true, count: "exact" })
        .eq("organization_id", organizationId),
    ]);

  const errors = [
    employeesRes.error,
    leaveRes.error,
    dealsRes.error,
    stockRes.error,
    tasksRes.error,
    channelsRes.error,
  ].filter(Boolean);

  if (errors.length > 0) throw errors[0];

  const lowStockItems = (stockRes.data ?? []).filter(
    (item) => item.quantity <= item.reorder_level,
  ).length;

  const stats: AdminDashboardStats = {
    totalEmployees: employeesRes.count ?? 0,
    pendingLeaveRequests: leaveRes.count ?? 0,
    activeCRMDeals: dealsRes.count ?? 0,
    lowStockItems,
    openTasks: tasksRes.count ?? 0,
    activeChannels: channelsRes.count ?? 0,
  };

  return stats;
}
