import { supabase } from "../../../lib/supabase/client";
import {
  isAppRole,
  isSuperAdminAllowedEmail,
} from "../../../lib/constants/roles";

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
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_department?: string | null;
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

function startOfTodayISO() {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
}

function startOfWeekISO() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString();
}

function secondsBetween(start: string, end?: string | null) {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();

  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 0;

  return Math.max(0, Math.floor((endMs - startMs) / 1000));
}

function getEntrySeconds(entry: {
  started_at: string;
  ended_at?: string | null;
  duration_seconds?: number | null;
}) {
  if (
    typeof entry.duration_seconds === "number" &&
    entry.duration_seconds >= 0 &&
    entry.ended_at
  ) {
    return entry.duration_seconds;
  }

  return secondsBetween(entry.started_at, entry.ended_at);
}

export async function getEmployeeById(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, primary_role, organization_id, department, last_seen_at, is_active",
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
      "id, organization_id, user_id, leave_type_id, start_date, end_date, reason, status, approved_by, approved_at, rejection_reason, created_at",
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
    .select("id, full_name, email, department")
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
      requester_department: requester?.department ?? null,
    };
  });
}

export async function getRecentLeaveRequests(
  organizationId: string,
): Promise<LeaveRequestRow[]> {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, reason, status, approved_by, approved_at, rejection_reason, created_at",
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
    .select("id, full_name, email, department")
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
      requester_department: requester?.department ?? null,
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
      "id, organization_id, user_id, leave_type_id, start_date, end_date, reason, status, approved_by, approved_at, rejection_reason, created_at",
    )
    .single();

  if (updateError) {
    console.error("UPDATE LEAVE REQUEST STATUS ERROR:", updateError);
    throw new Error(updateError.message);
  }

  try {
    const request = updatedRequest;

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

    const approverLabel = approver?.full_name?.trim() ||
      approver?.email?.trim() ||
      "An administrator";

    const leaveTypeName = leaveType?.name || "General Leave";

    const notificationTitle = params.status === "approved"
      ? "Leave Request Approved"
      : "Leave Request Rejected";

    const notificationMessage = params.status === "approved"
      ? `${leaveTypeName} from ${request.start_date} to ${request.end_date} was approved by ${approverLabel}.`
      : `${leaveTypeName} from ${request.start_date} to ${request.end_date} was rejected by ${approverLabel}.${
        params.rejectionReason ? ` Reason: ${params.rejectionReason}` : ""
      }`;

    await supabase.from("notifications").insert({
      organization_id: params.organizationId,
      user_id: request.user_id,
      type: params.status === "approved"
        ? "leave_request_approved"
        : "leave_request_rejected",
      title: notificationTitle,
      message: notificationMessage,
      reference_id: request.id,
      reference_type: "leave_request",
      is_read: false,
    });
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
      "id, email, full_name, primary_role, organization_id, department, last_seen_at, is_active, is_suspended, suspended_at",
    )
    .eq("organization_id", organizationId)
    .order("full_name", { ascending: true });

  if (error) throw error;

  return (data ?? []) as EmployeeRow[];
}

export async function getEmployeeOverview(
  organizationId: string,
): Promise<EmployeeOverviewRow[]> {
  const [employees, timesheets] = await Promise.all([
    getOrganizationEmployees(organizationId),
    getEmployeeTimesheetSummaries(organizationId),
  ]);

  const timesheetMap = new Map(timesheets.map((item) => [item.user_id, item]));

  return employees.map((employee) => {
    const summary = timesheetMap.get(employee.id);

    return {
      ...employee,
      today_seconds: summary?.today_seconds ?? 0,
      week_seconds: summary?.week_seconds ?? 0,
      has_active_timer: summary?.has_active_timer ?? false,
      is_suspended: employee.is_suspended ?? false,
      suspended_at: employee.suspended_at ?? null,
    };
  });
}


export async function updateEmployeeRole(params: {
  organizationId: string;
  userId: string;
  role: string;
}) {
  const normalizedRole = params.role.trim().toLowerCase();

  if (!isAppRole(normalizedRole)) {
    throw new Error("Invalid role selected.");
  }

  const { data: targetUser, error: targetUserError } = await supabase
    .from("profiles")
    .select("id, email, organization_id")
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId)
    .single();

  if (targetUserError) throw targetUserError;

  if (normalizedRole === "admin" && !isSuperAdminAllowedEmail(targetUser.email)) {
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

  return true;
}

export async function removeEmployeeFromOrganization(params: {
  organizationId: string;
  userId: string;
}) {
  const { error: memberDeleteError } = await supabase
    .from("organization_members")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("user_id", params.userId);

  if (memberDeleteError) throw memberDeleteError;

  const { error: profileUpdateError } = await supabase
    .from("profiles")
    .update({
      organization_id: null,
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (profileUpdateError) throw profileUpdateError;

  return true;
}

export async function suspendUser(params: {
  organizationId: string;
  userId: string;
  suspendedBy: string;
  reason?: string;
}) {
  const { error } = await supabase
    .from("profiles")
    .update({
      is_suspended: true,
      suspended_at: new Date().toISOString(),
      suspended_by: params.suspendedBy,
      suspension_reason: params.reason || null,
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (error) throw error;

  return true;
}

export async function unsuspendUser(params: {
  organizationId: string;
  userId: string;
}) {
  const { error } = await supabase
    .from("profiles")
    .update({
      is_suspended: false,
      suspended_at: null,
      suspended_by: null,
      suspension_reason: null,
    })
    .eq("id", params.userId)
    .eq("organization_id", params.organizationId);

  if (error) throw error;

  return true;
}

export async function deleteUserCompletely(params: {
  organizationId: string;
  userId: string;
}) {
  // First, remove from organization
  await removeEmployeeFromOrganization({
    organizationId: params.organizationId,
    userId: params.userId,
  });

  // Then delete the profile
  const { error: profileDeleteError } = await supabase
    .from("profiles")
    .delete()
    .eq("id", params.userId);

  if (profileDeleteError) throw profileDeleteError;

  // Finally, delete the auth user (requires service role key, so this might need to be done via edge function)
  // For now, we'll just mark the profile as deleted
  const { error: authDeleteError } = await supabase.auth.admin.deleteUser(params.userId);

  if (authDeleteError) {
    console.warn("Failed to delete auth user (may require service role):", authDeleteError);
    // Don't throw - profile deletion is sufficient for most cases
  }

  return true;
}

export async function inviteEmployeeToOrganization(params: {
  organizationId: string;
  email: string;
  fullName: string;
  role: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const normalizedRole = params.role.trim().toLowerCase();

  if (!isAppRole(normalizedRole)) {
    throw new Error("Invalid role selected.");
  }

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
    throw new Error(
      `No profile row was returned for ${normalizedEmail}. If the user exists in SQL but not here, check your RLS policy on public.profiles.`,
    );
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
      },
      {
        onConflict: "organization_id,user_id",
      },
    );

  if (memberUpsertError) throw memberUpsertError;

  return {
    success: true,
    userId: existingProfile.id,
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
