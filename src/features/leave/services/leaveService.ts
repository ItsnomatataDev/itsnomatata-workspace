import { supabase } from "../../../lib/supabase/client";
import { checkLeaveAvailability } from "./leaveCalendarService";
import {
  notifyAndEmailUser,
  notifyAndEmailUsers,
} from "../../notifications/services/notificationService";
import { calculateLeaveDays } from "../utils/leaveDays";

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
  const requestedDays = calculateLeaveDays(params.startDate, params.endDate);

  if (requestedDays <= 0) {
    throw new Error("Leave end date cannot be earlier than the start date.");
  }

  const leaveBalance = await getLeaveBalance(params.organizationId, params.userId);

  if (requestedDays > leaveBalance.remainingDays) {
    throw new Error(
      `This request needs ${requestedDays} day${requestedDays === 1 ? "" : "s"}, but only ${leaveBalance.remainingDays} leave day${leaveBalance.remainingDays === 1 ? "" : "s"} remain.`,
    );
  }

  const availability = await checkLeaveAvailability({
    organizationId: params.organizationId,
    startDate: params.startDate,
    endDate: params.endDate,
    requestDepartment: params.requestDepartment,
    requestRole: params.requestRole,
  });

  if (availability.blockedRules.length > 0) {
    const firstBlockedRule = availability.blockedRules[0];
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

  if (error) throw error;

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
    await notifyAndEmailUsers({
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

    await notifyAndEmailUser({
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

    await notifyAndEmailUser({
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
