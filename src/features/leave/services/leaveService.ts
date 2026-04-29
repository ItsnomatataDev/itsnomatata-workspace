import { supabase } from "../../../lib/supabase/client";
import { checkLeaveAvailability } from "./leaveCalendarService";
import {
  notifyAndEmailUser,
  notifyAndEmailUsers,
} from "../../notifications/services/notificationService";
import { calculateLeaveDays, calculateLeaveDaysWithExclusions } from "../utils/leaveDays";
import { recordBalanceChange } from "./leaveBalanceAuditService";
import type {
  NotificationPriority,
  NotificationType,
} from "../../../lib/supabase/mutations/notifications";

export type LeaveTypeRow = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  default_days: number;
  created_at: string;
};

export type MyLeaveRequestRow = {
  id: string;
  organization_id: string;
  user_id: string;
  leave_type_id: string | null;
  start_date: string;
  end_date: string;
  requested_days: number;
  request_department: string | null;
  request_role: string | null;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  balance_deducted_at?: string | null;
  created_at: string;
};

export type LeaveBalanceRow = {
  totalDays: number;
  remainingDays: number;
  usedDays: number;
};

type NotificationSummary = {
  ok?: boolean;
  failed?: number;
};

async function notifyLeaveUsersWithFallback(params: {
  organizationId: string;
  userIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string;
  priority: NotificationPriority;
  entityType: string;
  entityId: string;
  referenceId: string;
  referenceType: string;
  actorUserId?: string | null;
  category: string;
  dedupeKey: string;
  metadata: Record<string, unknown>;
}) {
  const result = await notifyAndEmailUsers(params) as NotificationSummary;

  if (result?.ok !== false && !(result?.failed && result.failed > 0)) {
    return result;
  }

  console.warn("LEAVE NOTIFICATION PRIMARY PIPELINE FAILED, USING EDGE FALLBACK:", result);

  const { data, error } = await supabase.functions.invoke("create-notification", {
    body: params,
  });

  if (error) throw error;
  return data;
}

async function notifyLeaveUserWithFallback(params: {
  organizationId: string;
  userId: string;
  userEmail: string;
  fullName?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl: string;
  priority: NotificationPriority;
  entityType: string;
  entityId: string;
  referenceId: string;
  referenceType: string;
  actorUserId?: string | null;
  category: string;
  dedupeKey: string;
  metadata: Record<string, unknown>;
}) {
  const result = await notifyAndEmailUser(params) as NotificationSummary | null;

  if (result?.ok !== false && !(result?.failed && result.failed > 0)) {
    return result;
  }

  console.warn("LEAVE NOTIFICATION PRIMARY PIPELINE FAILED, USING EDGE FALLBACK:", result);

  const { data, error } = await supabase.functions.invoke("create-notification", {
    body: {
      ...params,
      userIds: [params.userId],
    },
  });

  if (error) throw error;
  return data;
}

function buildOverlapMessage(params: {
  overlapName: string;
  overlapRole?: string | null;
  overlapStatus?: string | null;
  requestRole?: string | null;
  requestDepartment?: string | null;
}) {
  const normalizedRequestRole = params.requestRole?.trim().toLowerCase() || null;
  const normalizedOverlapRole = params.overlapRole?.trim().toLowerCase() || null;
  const requestStatus = params.overlapStatus === "pending"
    ? "already has a pending leave request"
    : "is already on approved leave";

  if (normalizedRequestRole && normalizedRequestRole === normalizedOverlapRole) {
    return `Leave cannot be requested because ${params.overlapName} (${params.overlapRole || "the same role"}) ${requestStatus} for this period. Role-based leave restriction applies across all offices.`;
  }

  const officeLabel = params.requestDepartment || "the selected office";
  return `Leave cannot be requested for ${officeLabel} because ${params.overlapName} ${requestStatus} for that period.`;
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

export async function getMyLeaveRequests(
  organizationId: string,
  userId: string,
) {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_department, request_role, reason, status, approved_by, approved_at, rejection_reason, balance_deducted_at, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MyLeaveRequestRow[];
}

export async function getLeaveBalance(
  organizationId: string,
  userId: string,
): Promise<LeaveBalanceRow> {
  const { data, error } = await supabase
    .from("profiles")
    .select("leave_days_total, leave_days_remaining")
    .eq("organization_id", organizationId)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;

  const totalDays = Number(data?.leave_days_total ?? 22);
  const remainingDays = Number(data?.leave_days_remaining ?? totalDays);

  return {
    totalDays,
    remainingDays,
    usedDays: Math.max(totalDays - remainingDays, 0),
  };
}

export async function createLeaveRequest(params: {
  organizationId: string;
  userId: string;
  leaveTypeId?: string | null;
  startDate: string;
  endDate: string;
  reason?: string;
  requestDepartment?: string | null;
  requestRole?: string | null;
}) {
  console.log("[createLeaveRequest] Starting with params:", params);

  // Check for public holidays in the requested date range
  console.log("[createLeaveRequest] Checking for public holidays...");
  const { data: holidays } = await supabase
    .from("public_holidays")
    .select("date, name")
    .eq("organization_id", params.organizationId)
    .gte("date", params.startDate)
    .lte("date", params.endDate);

  console.log("[createLeaveRequest] Holidays found:", holidays);

  if (holidays && holidays.length > 0) {
    const holidayNames = holidays.map((h) => `${h.date} (${h.name})`).join(", ");
    console.error("[createLeaveRequest] Public holiday conflict:", holidayNames);
    throw new Error(
      `Cannot request leave on public holidays: ${holidayNames}. Please adjust your dates to exclude these days.`,
    );
  }

  console.log("[createLeaveRequest] Calculating leave days with exclusions...");
  const requestedDays = await calculateLeaveDaysWithExclusions({
    organizationId: params.organizationId,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  console.log("[createLeaveRequest] Requested days:", requestedDays);

  if (requestedDays <= 0) {
    console.error("[createLeaveRequest] Invalid date range");
    throw new Error("Leave end date cannot be earlier than the start date.");
  }

  console.log("[createLeaveRequest] Getting leave balance...");
  const leaveBalance = await getLeaveBalance(params.organizationId, params.userId);

  console.log("[createLeaveRequest] Leave balance:", leaveBalance);

  if (requestedDays > leaveBalance.remainingDays) {
    console.error("[createLeaveRequest] Insufficient leave balance");
    throw new Error(
      `This request needs ${requestedDays} day${requestedDays === 1 ? "" : "s"}, but only ${leaveBalance.remainingDays} leave day${leaveBalance.remainingDays === 1 ? "" : "s"} remain.`,
    );
  }

  console.log("[createLeaveRequest] Checking leave availability...");
  const availability = await checkLeaveAvailability({
    organizationId: params.organizationId,
    startDate: params.startDate,
    endDate: params.endDate,
    requestDepartment: params.requestDepartment,
    requestRole: params.requestRole,
  });

  console.log("[createLeaveRequest] Availability check result:", availability);

  if (availability.blockedRules.length > 0) {
    const firstBlockedRule = availability.blockedRules[0];
    console.error("[createLeaveRequest] Blocked rules:", firstBlockedRule);
    throw new Error(
      firstBlockedRule.title
        ? `Leave requests are closed for this period: ${firstBlockedRule.title}.`
        : "Leave requests are closed for the selected period.",
    );
  }

  if (availability.overlappingApprovedLeaves.length > 0) {
    const firstOverlap = availability.overlappingApprovedLeaves[0];
    const overlapName =
      firstOverlap?.requester_name ||
      firstOverlap?.requester_email ||
      "another employee";
    console.error("[createLeaveRequest] Overlapping leave:", firstOverlap);
    throw new Error(
      buildOverlapMessage({
        overlapName,
        overlapRole: firstOverlap?.requester_role,
        overlapStatus: firstOverlap?.status,
        requestRole: params.requestRole,
        requestDepartment: params.requestDepartment,
      }),
    );
  }

  console.log("[createLeaveRequest] Inserting leave request into database...");
  const { data, error } = await supabase
    .from("leave_requests")
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      leave_type_id: params.leaveTypeId ?? null,
      start_date: params.startDate,
      end_date: params.endDate,
      requested_days: requestedDays,
      request_department: params.requestDepartment?.trim() || null,
      request_role: params.requestRole?.trim() || null,
      reason: params.reason?.trim() || "",
      status: "pending",
    })
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_department, request_role, reason, status, approved_by, approved_at, rejection_reason, balance_deducted_at, created_at",
    )
    .single();

  if (error) {
    console.error("[createLeaveRequest] Database insert error:", error);
    console.error("[createLeaveRequest] Error details:", {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw error;
  }

  console.log("[createLeaveRequest] Leave request inserted successfully:", data);

  const leaveRequest = data as MyLeaveRequestRow;

  // — notifications + emails —
  try {
    const [
      { data: adminsAndManagers, error: recipientsError },
      { data: requester, error: requesterError },
      { data: leaveType, error: leaveTypeError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, primary_role")
        .eq("organization_id", params.organizationId)
        .in("primary_role", ["admin", "manager"]),
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", params.userId)
        .maybeSingle(),
      params.leaveTypeId
        ? supabase
            .from("leave_types")
            .select("name")
            .eq("id", params.leaveTypeId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (recipientsError) {
      console.error("FETCH LEAVE NOTIFICATION RECIPIENTS ERROR:", recipientsError);
      return leaveRequest;
    }

    if (requesterError) {
      console.error("FETCH REQUESTER FOR LEAVE NOTIFICATION ERROR:", requesterError);
      return leaveRequest;
    }

    if (leaveTypeError) {
      console.error("FETCH LEAVE TYPE FOR LEAVE NOTIFICATION ERROR:", leaveTypeError);
      return leaveRequest;
    }

    if (!adminsAndManagers || adminsAndManagers.length === 0) {
      console.warn("No admin or manager profiles found for leave notifications.");
      return leaveRequest;
    }

    const requesterName = requester?.full_name?.trim() || "Unknown user";
    const requesterEmail = requester?.email?.trim() || "No email";
    const leaveTypeName = leaveType?.name || "General Leave";
    const officeLabel = params.requestDepartment?.trim() || "Unspecified office";

    const notificationMessage = `${requesterName} (${requesterEmail}) requested ${leaveTypeName} for ${officeLabel} from ${params.startDate} to ${params.endDate}.`;

    const sharedMeta = {
      leaveRequestId: leaveRequest.id,
      requesterName,
      requesterEmail,
      leaveTypeName,
      requestedDays,
      office: officeLabel,
      startDate: params.startDate,
      endDate: params.endDate,
    };

    // in-system + email for all admins and managers
    await notifyLeaveUsersWithFallback({
      organizationId: params.organizationId,
      userIds: adminsAndManagers.map((p) => p.id),
      type: "leave_request_submitted",
      title: "New Leave Request Submitted",
      message: notificationMessage,
      actionUrl: "/admin/leave",
      priority: "high",
      entityType: "leave_request",
      entityId: leaveRequest.id,
      referenceId: leaveRequest.id,
      referenceType: "leave_request",
      actorUserId: params.userId,
      category: "leave",
      dedupeKey: `leave-submitted:${leaveRequest.id}`,
      metadata: sharedMeta,
    });
  } catch (notificationError) {
    console.error("LEAVE REQUEST NOTIFICATION ERROR:", notificationError);
  }

  return leaveRequest;
}

export async function approveLeaveRequest(params: {
  organizationId: string;
  leaveRequestId: string;
  approvedByUserId: string;
}) {
  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      status: "approved",
      approved_by: params.approvedByUserId,
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", params.leaveRequestId)
    .eq("organization_id", params.organizationId)
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_department, request_role, reason, status, approved_by, approved_at, rejection_reason, balance_deducted_at, created_at",
    )
    .single();

  if (error) throw error;

  const leaveRequest = data as MyLeaveRequestRow;

  try {
    const [
      { data: requester, error: requesterError },
      { data: leaveType, error: leaveTypeError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", leaveRequest.user_id)
        .maybeSingle(),
      leaveRequest.leave_type_id
        ? supabase
            .from("leave_types")
            .select("name")
            .eq("id", leaveRequest.leave_type_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (requesterError) {
      console.error("FETCH REQUESTER FOR LEAVE APPROVAL NOTIFICATION ERROR:", requesterError);
      return leaveRequest;
    }

    if (leaveTypeError) {
      console.error("FETCH LEAVE TYPE FOR LEAVE APPROVAL NOTIFICATION ERROR:", leaveTypeError);
      return leaveRequest;
    }

    const requesterName = requester?.full_name?.trim() || "Team Member";
    const leaveTypeName = leaveType?.name || "Leave";

    await notifyLeaveUserWithFallback({
      organizationId: params.organizationId,
      userId: leaveRequest.user_id,
      userEmail: requester?.email ?? "",
      fullName: requesterName,
      type: "leave_request_approved",
      title: "Leave Request Approved",
      message: `Your ${leaveTypeName} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} has been approved.`,
      actionUrl: "/leave",
      priority: "high",
      entityType: "leave_request",
      entityId: leaveRequest.id,
      referenceId: leaveRequest.id,
      referenceType: "leave_request",
      actorUserId: params.approvedByUserId,
      category: "leave",
      dedupeKey: `leave-approved:${leaveRequest.id}`,
      metadata: {
        leaveRequestId: leaveRequest.id,
        leaveTypeName,
        requestedDays: leaveRequest.requested_days,
        startDate: leaveRequest.start_date,
        endDate: leaveRequest.end_date,
        approvedByUserId: params.approvedByUserId,
      },
    });
  } catch (notificationError) {
    console.error("LEAVE APPROVAL NOTIFICATION ERROR:", notificationError);
  }

  return leaveRequest;
}

export async function rejectLeaveRequest(params: {
  organizationId: string;
  leaveRequestId: string;
  rejectedByUserId: string;
  rejectionReason?: string | null;
}) {
  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      status: "rejected",
      approved_by: params.rejectedByUserId,
      approved_at: new Date().toISOString(),
      rejection_reason: params.rejectionReason ?? null,
    })
    .eq("id", params.leaveRequestId)
    .eq("organization_id", params.organizationId)
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_department, request_role, reason, status, approved_by, approved_at, rejection_reason, balance_deducted_at, created_at",
    )
    .single();

  if (error) throw error;

  const leaveRequest = data as MyLeaveRequestRow;

  try {
    const [
      { data: requester, error: requesterError },
      { data: leaveType, error: leaveTypeError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("id", leaveRequest.user_id)
        .maybeSingle(),
      leaveRequest.leave_type_id
        ? supabase
            .from("leave_types")
            .select("name")
            .eq("id", leaveRequest.leave_type_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (requesterError) {
      console.error("FETCH REQUESTER FOR LEAVE REJECTION NOTIFICATION ERROR:", requesterError);
      return leaveRequest;
    }

    if (leaveTypeError) {
      console.error("FETCH LEAVE TYPE FOR LEAVE REJECTION NOTIFICATION ERROR:", leaveTypeError);
      return leaveRequest;
    }

    const requesterName = requester?.full_name?.trim() || "Team Member";
    const leaveTypeName = leaveType?.name || "Leave";
    const reasonSuffix = params.rejectionReason
      ? ` Reason: ${params.rejectionReason}`
      : "";

    await notifyLeaveUserWithFallback({
      organizationId: params.organizationId,
      userId: leaveRequest.user_id,
      userEmail: requester?.email ?? "",
      fullName: requesterName,
      type: "leave_request_rejected",
      title: "Leave Request Rejected",
      message: `Your ${leaveTypeName} request from ${leaveRequest.start_date} to ${leaveRequest.end_date} was not approved.${reasonSuffix}`,
      actionUrl: "/leave",
      priority: "high",
      entityType: "leave_request",
      entityId: leaveRequest.id,
      referenceId: leaveRequest.id,
      referenceType: "leave_request",
      actorUserId: params.rejectedByUserId,
      category: "leave",
      dedupeKey: `leave-rejected:${leaveRequest.id}`,
      metadata: {
        leaveRequestId: leaveRequest.id,
        leaveTypeName,
        requestedDays: leaveRequest.requested_days,
        startDate: leaveRequest.start_date,
        endDate: leaveRequest.end_date,
        rejectedByUserId: params.rejectedByUserId,
        rejectionReason: params.rejectionReason ?? null,
      },
    });
  } catch (notificationError) {
    console.error("LEAVE REJECTION NOTIFICATION ERROR:", notificationError);
  }

  return leaveRequest;
}

export async function modifyLeaveRequestDates(params: {
  organizationId: string;
  leaveRequestId: string;
  modifiedByUserId: string;
  newStartDate: string;
  newEndDate: string;
  reason?: string;
}) {
  // Check for public holidays in the requested date range
  const { data: holidays } = await supabase
    .from("public_holidays")
    .select("date, name")
    .eq("organization_id", params.organizationId)
    .gte("date", params.newStartDate)
    .lte("date", params.newEndDate);

  if (holidays && holidays.length > 0) {
    const holidayNames = holidays.map((h) => `${h.date} (${h.name})`).join(", ");
    throw new Error(
      `Cannot modify leave to include public holidays: ${holidayNames}. Please adjust your dates to exclude these days.`,
    );
  }

  // Calculate new days
  const newRequestedDays = await calculateLeaveDaysWithExclusions({
    organizationId: params.organizationId,
    startDate: params.newStartDate,
    endDate: params.newEndDate,
  });

  if (newRequestedDays <= 0) {
    throw new Error("Leave end date cannot be earlier than the start date.");
  }

  // Get current leave request
  const { data: currentRequest, error: fetchError } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("id", params.leaveRequestId)
    .eq("organization_id", params.organizationId)
    .single();

  if (fetchError || !currentRequest) {
    throw new Error("Leave request not found.");
  }

  // Check if already approved - need to handle balance adjustment
  const wasApproved = currentRequest.status === "approved";
  const oldRequestedDays = currentRequest.requested_days;

  // Update the leave request
  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      start_date: params.newStartDate,
      end_date: params.newEndDate,
      requested_days: newRequestedDays,
      metadata: {
        ...currentRequest.metadata,
        modified_by: params.modifiedByUserId,
        modified_at: new Date().toISOString(),
        modification_reason: params.reason,
        previous_start_date: currentRequest.start_date,
        previous_end_date: currentRequest.end_date,
        previous_requested_days: oldRequestedDays,
      },
    })
    .eq("id", params.leaveRequestId)
    .eq("organization_id", params.organizationId)
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_department, request_role, reason, status, approved_by, approved_at, rejection_reason, balance_deducted_at, created_at",
    )
    .single();

  if (error) throw error;

  const leaveRequest = data as MyLeaveRequestRow;

  // If approved, adjust balance
  if (wasApproved) {
    const balanceDelta = newRequestedDays - oldRequestedDays;

    if (balanceDelta > 0) {
      // Need more days - check if available
      const { data: profile } = await supabase
        .from("profiles")
        .select("leave_days_remaining")
        .eq("id", leaveRequest.user_id)
        .single();

      if (!profile || profile.leave_days_remaining < balanceDelta) {
        throw new Error(
          `Not enough leave days to extend this request. Need ${balanceDelta} more days.`,
        );
      }

      await supabase
        .from("profiles")
        .update({ leave_days_remaining: profile.leave_days_remaining - balanceDelta })
        .eq("id", leaveRequest.user_id);
    } else if (balanceDelta < 0) {
      // Return days
      const { data: profileForUpdate } = await supabase
        .from("profiles")
        .select("leave_days_total, leave_days_remaining")
        .eq("id", leaveRequest.user_id)
        .single();

      if (profileForUpdate) {
        const newRemaining = Math.min(
          profileForUpdate.leave_days_total,
          profileForUpdate.leave_days_remaining + Math.abs(balanceDelta),
        );
        await supabase
          .from("profiles")
          .update({ leave_days_remaining: newRemaining })
          .eq("id", leaveRequest.user_id);
      }
    }
  }

  // Send notification to user
  try {
    const { data: requester } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", leaveRequest.user_id)
      .maybeSingle();

    if (requester) {
      await notifyAndEmailUser({
        organizationId: params.organizationId,
        userId: leaveRequest.user_id,
        userEmail: requester.email ?? "",
        fullName: requester.full_name ?? "Team Member",
        type: "leave_request_approved",
        title: "Leave Dates Modified",
        message: `Your leave request has been modified from ${currentRequest.start_date} - ${currentRequest.end_date} (${oldRequestedDays} days) to ${params.newStartDate} - ${params.newEndDate} (${newRequestedDays} days).${params.reason ? ` Reason: ${params.reason}` : ""}`,
        actionUrl: "/leave",
        priority: "high",
        entityType: "leave_request",
        entityId: leaveRequest.id,
        referenceId: leaveRequest.id,
        referenceType: "leave_request",
        metadata: {
          leaveRequestId: leaveRequest.id,
          previousStartDate: currentRequest.start_date,
          previousEndDate: currentRequest.end_date,
          previousDays: oldRequestedDays,
          newStartDate: params.newStartDate,
          newEndDate: params.newEndDate,
          newDays: newRequestedDays,
          modifiedBy: params.modifiedByUserId,
        },
      });
    }
  } catch (notificationError) {
    console.error("LEAVE MODIFICATION NOTIFICATION ERROR:", notificationError);
  }

  return leaveRequest;
}

export async function modifyUserLeaveBalance(params: {
  organizationId: string;
  userId: string;
  modifiedByUserId: string;
  newTotal?: number;
  newRemaining?: number;
  reason: string;
}) {
  // Get current balance
  const { data: profile, error: fetchError } = await supabase
    .from("profiles")
    .select("leave_days_total, leave_days_remaining")
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId)
    .single();

  if (fetchError || !profile) {
    throw new Error("User profile not found.");
  }

  const previousTotal = profile.leave_days_total;
  const previousRemaining = profile.leave_days_remaining;
  const newTotal = params.newTotal ?? previousTotal;
  const newRemaining = params.newRemaining ?? previousRemaining;

  // Update profile
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      leave_days_total: newTotal,
      leave_days_remaining: newRemaining,
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (updateError) throw updateError;

  // Record audit trail
  await recordBalanceChange({
    organizationId: params.organizationId,
    userId: params.userId,
    modifiedBy: params.modifiedByUserId,
    previousTotal,
    newTotal,
    previousRemaining,
    newRemaining,
    reason: params.reason,
  });

  // Send notification to user
  try {
    const { data: requester } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", params.userId)
      .maybeSingle();

    if (requester) {
      await notifyAndEmailUser({
        organizationId: params.organizationId,
        userId: params.userId,
        userEmail: requester.email ?? "",
        fullName: requester.full_name ?? "Team Member",
        type: "system_alert",
        title: "Leave Balance Updated",
        message: `Your leave balance has been updated. Total: ${previousTotal} → ${newTotal} days. Remaining: ${previousRemaining} → ${newRemaining} days. Reason: ${params.reason}`,
        actionUrl: "/leave",
        priority: "high",
        entityType: "leave_balance",
        entityId: params.userId,
        referenceId: params.userId,
        referenceType: "leave_balance",
        metadata: {
          userId: params.userId,
          previousTotal,
          newTotal,
          previousRemaining,
          newRemaining,
          modifiedBy: params.modifiedByUserId,
          reason: params.reason,
        },
      });
    }
  } catch (notificationError) {
    console.error("LEAVE BALANCE MODIFICATION NOTIFICATION ERROR:", notificationError);
  }

  return {
    previousTotal,
    newTotal,
    previousRemaining,
    newRemaining,
  };
}

export async function getPublicHolidays(params: {
  organizationId: string;
  startDate?: string;
  endDate?: string;
}) {
  let query = supabase
    .from("public_holidays")
    .select("*")
    .eq("organization_id", params.organizationId);

  if (params.startDate) {
    query = query.gte("date", params.startDate);
  }
  if (params.endDate) {
    query = query.lte("date", params.endDate);
  }

  const { data, error } = await query.order("date", { ascending: true });

  if (error) throw error;
  return data;
}
