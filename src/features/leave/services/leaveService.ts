import { supabase } from "../../../lib/supabase/client";
import { checkLeaveAvailability } from "./leaveCalendarService";
import { sendBulkNotifications } from "../../notifications/services/notificationService";

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
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
};

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
      "id, organization_id, user_id, leave_type_id, start_date, end_date, reason, status, approved_by, approved_at, rejection_reason, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as MyLeaveRequestRow[];
}

export async function createLeaveRequest(params: {
  organizationId: string;
  userId: string;
  leaveTypeId?: string | null;
  startDate: string;
  endDate: string;
  reason?: string;
}) {
  const availability = await checkLeaveAvailability({
    organizationId: params.organizationId,
    startDate: params.startDate,
    endDate: params.endDate,
  });

  if (availability.blockedRules.length > 0) {
    const firstBlockedRule = availability.blockedRules[0];

    throw new Error(
      firstBlockedRule.title
        ? `Leave requests are closed for this period: ${firstBlockedRule.title}.`
        : "Leave requests are closed for the selected period.",
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
      reason: params.reason ?? "",
      status: "pending",
    })
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, reason, status, approved_by, approved_at, rejection_reason, created_at",
    )
    .single();

  if (error) throw error;

  const leaveRequest = data as MyLeaveRequestRow;

  const [
    { data: admins, error: adminsError },
    { data: requester, error: requesterError },
    { data: leaveType, error: leaveTypeError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, organization_id, primary_role")
      .eq("organization_id", params.organizationId)
      .eq("primary_role", "admin"),
    supabase
      .from("profiles")
      .select("full_name, email, organization_id, primary_role")
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

  if (adminsError) {
    console.error(
      "FETCH ADMINS FOR LEAVE REQUEST NOTIFICATION ERROR:",
      adminsError,
    );
    throw new Error(adminsError.message);
  }

  if (requesterError) {
    console.error(
      "FETCH REQUESTER FOR LEAVE REQUEST NOTIFICATION ERROR:",
      requesterError,
    );
    throw new Error(requesterError.message);
  }

  if (leaveTypeError) {
    console.error(
      "FETCH LEAVE TYPE FOR LEAVE REQUEST NOTIFICATION ERROR:",
      leaveTypeError,
    );
    throw new Error(leaveTypeError.message);
  }

  if (!admins || admins.length === 0) {
    throw new Error(
      "No admin profiles were found for this organization, so notification rows could not be created.",
    );
  }

  const requesterName = requester?.full_name?.trim() || "Unknown user";
  const requesterEmail = requester?.email?.trim() || "No email";
  const leaveTypeName = leaveType?.name || "General Leave";

  await sendBulkNotifications({
    organizationId: params.organizationId,
    userIds: admins.map((admin) => admin.id),
    type: "leave_request_submitted",
    title: "New Leave Request Submitted",
    message: `${requesterName} (${requesterEmail}) requested ${leaveTypeName} from ${params.startDate} to ${params.endDate}.`,
    entityType: "leave_request",
    entityId: leaveRequest.id,
    referenceId: leaveRequest.id,
    referenceType: "leave_request",
    actionUrl: "/admin/leave",
    priority: "high",
    metadata: {
      leaveRequestId: leaveRequest.id,
      requesterName,
      requesterEmail,
      leaveTypeName,
      startDate: params.startDate,
      endDate: params.endDate,
    },
  });
  return leaveRequest;
}
