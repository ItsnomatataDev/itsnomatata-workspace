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
  user_id: string;
  leave_type_id: string | null;
  start_date: string;
  end_date: string;
  requested_days: number;
  request_department?: string | null;
  request_role?: string | null;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  balance_deducted_at?: string | null;
  created_at: string;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_department?: string | null;
  requester_role?: string | null;
};

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
  title: string;
  department: string | null;
  week_start: string;
  created_by: string | null;
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

export type ProfileRosterUserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  department: string | null;
};

export type EmployeeRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  primary_role: string | null;
  organization_id: string | null;
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

export async function getLeaveRequests(organizationId: string) {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_department, request_role, reason, status, approved_by, approved_at, rejection_reason, balance_deducted_at, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const requests = (data ?? []) as LeaveRequestRow[];

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
        request.request_department ?? requester?.department ?? null,
      requester_role: request.request_role ?? requester?.primary_role ?? null,
    };
  });
}

export async function getRecentLeaveRequests(
  organizationId: string,
): Promise<LeaveRequestRow[]> {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_department, request_role, reason, status, approved_by, approved_at, rejection_reason, balance_deducted_at, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) throw error;

  const requests = (data ?? []) as LeaveRequestRow[];

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
        request.request_department ?? requester?.department ?? null,
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

  const { data: updatedRequest, error: updateError } = await supabase
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
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_department, request_role, reason, status, approved_by, approved_at, rejection_reason, balance_deducted_at, created_at",
    )
    .single();

  if (updateError) {
    console.error("UPDATE LEAVE REQUEST STATUS ERROR:", updateError);
    throw new Error(updateError.message);
  }

  try {
    const request = updatedRequest as LeaveRequestRow;

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

  return updatedRequest;
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
      "id, email, full_name, primary_role, organization_id, department, last_seen_at, is_active, is_suspended, account_status, approved_at, approved_by, rejected_at, rejected_by, rejection_reason, suspended_at, suspended_by, suspension_reason, deleted_at, deleted_by, deletion_reason",
    )
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });

  if (error) throw error;

  return (data ?? []) as EmployeeRow[];
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
  return getEmployeeOverview(organizationId, "pending");
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
}) {
  const normalizedRole = params.role.trim().toLowerCase();

  if (!isAppRole(normalizedRole)) {
    throw new Error("Invalid role selected.");
  }

  await assertCanModifyUser({
    organizationId: params.organizationId,
    targetUserId: params.userId,
    actorUserId: params.updatedBy,
    nextRole: normalizedRole,
  });

  const { data: targetUser, error: targetUserError } = await supabase
    .from("profiles")
    .select("id, email, organization_id")
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId)
    .single();

  if (targetUserError) throw targetUserError;

  if (
    normalizedRole === "admin" && !isSuperAdminAllowedEmail(targetUser.email)
  ) {
    throw new Error(
      "This email is not allowed to receive the Super Admin role.",
    );
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      primary_role: normalizedRole,
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (profileError) throw profileError;

  const { error: memberDeleteError } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId);

  if (memberDeleteError) throw memberDeleteError;

  const { error: memberInsertError } = await supabase
    .from("organization_members")
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      role: normalizedRole,
      status: "active",
    });

  if (memberInsertError) throw memberInsertError;

  await logAdminAudit({
    organizationId: params.organizationId,
    actorUserId: params.updatedBy ?? null,
    targetUserId: params.userId,
    action: "role_changed",
    metadata: {
      role: normalizedRole,
    },
  });

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
  await assertCanModifyUser({
    organizationId: params.organizationId,
    targetUserId: params.userId,
    actorUserId: params.suspendedBy,
  });

  const { error } = await supabase
    .from("profiles")
    .update({
      is_suspended: true,
      is_active: false,
      account_status: "suspended",
      suspended_at: new Date().toISOString(),
      suspended_by: params.suspendedBy,
      suspension_reason: params.reason || null,
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (error) throw error;

  const { error: memberError } = await supabase
    .from("organization_members")
    .update({ status: "suspended" })
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId);

  if (memberError) throw memberError;

  await logAdminAudit({
    organizationId: params.organizationId,
    actorUserId: params.suspendedBy,
    targetUserId: params.userId,
    action: "user_suspended",
    reason: params.reason ?? null,
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
  const { error } = await supabase
    .from("profiles")
    .update({
      is_suspended: false,
      is_active: true,
      account_status: "active",
      suspended_at: null,
      suspended_by: null,
      suspension_reason: null,
      approved_at: new Date().toISOString(),
      approved_by: params.unsuspendedBy ?? null,
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (error) throw error;

  const { error: memberError } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id: params.organizationId,
        user_id: params.userId,
        status: "active",
        joined_at: new Date().toISOString(),
      },
      { onConflict: "organization_id,user_id" },
    );

  if (memberError) throw memberError;

  await logAdminAudit({
    organizationId: params.organizationId,
    actorUserId: params.unsuspendedBy ?? null,
    targetUserId: params.userId,
    action: "user_unsuspended",
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
  await assertCanModifyUser({
    organizationId: params.organizationId,
    targetUserId: params.userId,
    actorUserId: params.deletedBy,
  });

  const now = new Date().toISOString();

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      account_status: "deleted",
      is_active: false,
      is_suspended: false,
      deleted_at: now,
      deleted_by: params.deletedBy ?? null,
      deletion_reason: params.reason ?? null,
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (profileError) throw profileError;

  const { error: memberError } = await supabase
    .from("organization_members")
    .update({
      status: "removed",
      removed_at: now,
      removed_by: params.deletedBy ?? null,
    })
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId);

  if (memberError) throw memberError;

  await logAdminAudit({
    organizationId: params.organizationId,
    actorUserId: params.deletedBy ?? null,
    targetUserId: params.userId,
    action: "user_soft_deleted",
    reason: params.reason ?? null,
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

export const deleteUserCompletely = softDeleteUser;

export async function inviteEmployeeToOrganization(params: {
  organizationId: string;
  email: string;
  fullName: string;
  role: string;
  invitedBy?: string;
}): Promise<EmployeeInviteResult> {
  const normalizedEmail = params.email.trim().toLowerCase();
  const normalizedRole = params.role.trim().toLowerCase();

  if (!isAppRole(normalizedRole)) {
    throw new Error("Invalid role selected.");
  }

  if (
    normalizedRole === "admin" && !isSuperAdminAllowedEmail(normalizedEmail)
  ) {
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
    const invitationPayload = {
      organization_id: params.organizationId,
      email: normalizedEmail,
      full_name: params.fullName,
      role: normalizedRole,
      status: "pending",
      invited_by: params.invitedBy ?? null,
      expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        .toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: existingInvitation, error: existingInviteError } =
      await supabase
        .from("employee_invitations")
        .select("id")
        .eq("organization_id", params.organizationId)
        .ilike("email", normalizedEmail)
        .eq("status", "pending")
        .maybeSingle();

    if (existingInviteError) throw existingInviteError;

    const invitationRequest = existingInvitation?.id
      ? supabase
        .from("employee_invitations")
        .update(invitationPayload)
        .eq("id", existingInvitation.id)
        .select("id")
        .single()
      : supabase
        .from("employee_invitations")
        .insert(invitationPayload)
        .select("id")
        .single();

    const { data: invitation, error: inviteError } = await invitationRequest;

    if (inviteError) throw inviteError;

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
        "Invite recorded. The user must complete signup before an admin can approve access.",
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
      primary_role: normalizedRole,
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

export async function getDutyRosters(organizationId: string) {
  const { data, error } = await supabase
    .from("duty_rosters")
    .select(
      "id, organization_id, title, department, week_start, created_by, created_at",
    )
    .eq("organization_id", organizationId)
    .order("week_start", { ascending: false });

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

export async function getOrganizationUsersForRoster(organizationId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, department")
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ProfileRosterUserRow[];
}

export async function createDutyRoster(params: {
  organizationId: string;
  title: string;
  department?: string;
  weekStart: string;
  createdBy?: string | null;
}) {
  const { data, error } = await supabase
    .from("duty_rosters")
    .insert({
      organization_id: params.organizationId,
      title: params.title,
      department: params.department ?? null,
      week_start: params.weekStart,
      created_by: params.createdBy ?? null,
    })
    .select(
      "id, organization_id, title, department, week_start, created_by, created_at",
    )
    .single();

  if (error) throw error;
  return data as DutyRosterRow;
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
