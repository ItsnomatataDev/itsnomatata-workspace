import { supabase } from "../../../lib/supabase/client";

export type LeaveCalendarRuleRow = {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  rule_type: "open" | "closed";
  applies_to_role: string | null;
  applies_to_department: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LeaveCalendarEventRow = {
  id: string;
  organization_id: string;
  user_id: string;
  leave_type_id: string | null;
  start_date: string;
  end_date: string;
  requested_days?: number;
  request_role?: string | null;
  request_department?: string | null;
  reason: string | null;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_role?: string | null;
  requester_department?: string | null;
};

export async function getLeaveCalendarRules(organizationId: string) {
  const { data, error } = await supabase
    .from("leave_calendar_rules")
    .select(
      "id, organization_id, title, description, start_date, end_date, rule_type, applies_to_role, applies_to_department, created_by, created_at, updated_at",
    )
    .eq("organization_id", organizationId)
    .order("start_date", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LeaveCalendarRuleRow[];
}

export async function createLeaveCalendarRule(params: {
  organizationId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  ruleType: "open" | "closed";
  appliesToRole?: string | null;
  appliesToDepartment?: string | null;
  createdBy: string;
}) {
  const { data, error } = await supabase
    .from("leave_calendar_rules")
    .insert({
      organization_id: params.organizationId,
      title: params.title,
      description: params.description ?? null,
      start_date: params.startDate,
      end_date: params.endDate,
      rule_type: params.ruleType,
      applies_to_role: params.appliesToRole ?? null,
      applies_to_department: params.appliesToDepartment ?? null,
      created_by: params.createdBy,
    })
    .select(
      "id, organization_id, title, description, start_date, end_date, rule_type, applies_to_role, applies_to_department, created_by, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return data as LeaveCalendarRuleRow;
}

export async function updateLeaveCalendarRule(params: {
  ruleId: string;
  title?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  ruleType?: "open" | "closed";
  appliesToRole?: string | null;
  appliesToDepartment?: string | null;
}) {
  const payload: Record<string, unknown> = {};

  if (params.title !== undefined) payload.title = params.title;
  if (params.description !== undefined) {
    payload.description = params.description;
  }
  if (params.startDate !== undefined) payload.start_date = params.startDate;
  if (params.endDate !== undefined) payload.end_date = params.endDate;
  if (params.ruleType !== undefined) payload.rule_type = params.ruleType;
  if (params.appliesToRole !== undefined) {
    payload.applies_to_role = params.appliesToRole;
  }
  if (params.appliesToDepartment !== undefined) {
    payload.applies_to_department = params.appliesToDepartment;
  }

  const { data, error } = await supabase
    .from("leave_calendar_rules")
    .update(payload)
    .eq("id", params.ruleId)
    .select(
      "id, organization_id, title, description, start_date, end_date, rule_type, applies_to_role, applies_to_department, created_by, created_at, updated_at",
    )
    .single();

  if (error) throw error;
  return data as LeaveCalendarRuleRow;
}

export async function deleteLeaveCalendarRule(ruleId: string) {
  const { error } = await supabase
    .from("leave_calendar_rules")
    .delete()
    .eq("id", ruleId);

  if (error) throw error;
}

export async function getApprovedLeaveCalendarEvents(organizationId: string) {
  const { data, error } = await supabase
    .from("leave_requests")
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_role, request_department, reason, status, approved_by, approved_at, rejection_reason, created_at",
    )
    .eq("organization_id", organizationId)
    .eq("status", "approved")
    .order("start_date", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as LeaveCalendarEventRow[];
  const userIds = [...new Set(rows.map((item) => item.user_id))];

  if (userIds.length === 0) return rows;

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, full_name, email, primary_role, department")
    .in("id", userIds);

  if (profilesError) throw profilesError;

  const profileMap = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile]),
  );

  return rows.map((row) => {
    const profile = profileMap.get(row.user_id);

    return {
      ...row,
      requester_name: profile?.full_name ?? null,
      requester_email: profile?.email ?? null,
      requester_role: row.request_role ?? profile?.primary_role ?? null,
      requester_department: row.request_department ?? profile?.department ?? null,
    };
  });
}

export async function updateApprovedLeaveEventDates(params: {
  leaveRequestId: string;
  organizationId: string;
  startDate: string;
  endDate: string;
}) {
  const { data, error } = await supabase
    .from("leave_requests")
    .update({
      start_date: params.startDate,
      end_date: params.endDate,
    })
    .eq("id", params.leaveRequestId)
    .eq("organization_id", params.organizationId)
    .eq("status", "approved")
    .select(
      "id, organization_id, user_id, leave_type_id, start_date, end_date, reason, status, approved_by, approved_at, rejection_reason, created_at",
    )
    .single();

  if (error) throw error;
  return data as LeaveCalendarEventRow;
}

export async function checkLeaveAvailability(params: {
  organizationId: string;
  startDate: string;
  endDate: string;
  requestDepartment?: string | null;
  requestRole?: string | null;
}) {
  const [rulesRes, overlapRes] = await Promise.all([
    supabase
      .from("leave_calendar_rules")
      .select(
        "id, organization_id, title, description, start_date, end_date, rule_type, applies_to_role, applies_to_department, created_by, created_at, updated_at",
      )
      .eq("organization_id", params.organizationId)
      .eq("rule_type", "closed")
      .lte("start_date", params.endDate)
      .gte("end_date", params.startDate),
    supabase
      .from("leave_requests")
      .select(
        "id, organization_id, user_id, leave_type_id, start_date, end_date, requested_days, request_role, request_department, reason, status, approved_by, approved_at, rejection_reason, created_at",
      )
      .eq("organization_id", params.organizationId)
      .in("status", ["pending", "approved"])
      .lte("start_date", params.endDate)
      .gte("end_date", params.startDate),
  ]);

  if (rulesRes.error) throw rulesRes.error;
  if (overlapRes.error) throw overlapRes.error;

  const normalizedDepartment = params.requestDepartment?.trim().toLowerCase() ||
    null;
  const normalizedRole = params.requestRole?.trim().toLowerCase() || null;

  const rawRules = (rulesRes.data ?? []) as LeaveCalendarRuleRow[];
  const blockedRules = rawRules.filter((rule) => {
    const ruleDepartment = rule.applies_to_department?.trim().toLowerCase() ||
      null;
    const ruleRole = rule.applies_to_role?.trim().toLowerCase() || null;

    const matchesDepartment = !ruleDepartment || !normalizedDepartment ||
      ruleDepartment === normalizedDepartment;
    const matchesRole = !ruleRole || !normalizedRole ||
      ruleRole === normalizedRole;

    return matchesDepartment && matchesRole;
  });

  const overlaps = (overlapRes.data ?? []) as LeaveCalendarEventRow[];
  const userIds = [...new Set(overlaps.map((item) => item.user_id))];

  let profilesMap = new Map<
    string,
    {
      full_name?: string | null;
      email?: string | null;
      primary_role?: string | null;
      department?: string | null;
    }
  >();

  if (userIds.length > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, email, primary_role, department")
      .in("id", userIds);

    if (profilesError) throw profilesError;

    profilesMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        {
          full_name: profile.full_name,
          email: profile.email,
          primary_role: profile.primary_role,
          department: profile.department,
        },
      ]),
    );
  }

  const overlappingApprovedLeaves = overlaps
    .map((item) => ({
      ...item,
      requester_name: profilesMap.get(item.user_id)?.full_name ?? null,
      requester_email: profilesMap.get(item.user_id)?.email ?? null,
      requester_role:
        item.request_role ?? profilesMap.get(item.user_id)?.primary_role ?? null,
      requester_department:
        item.request_department ??
        profilesMap.get(item.user_id)?.department ??
        null,
    }))
    .filter((item) => {
      // Check for role-based overlap across all departments
      if (normalizedRole) {
        const itemRole = item.requester_role?.trim().toLowerCase() || null;
        if (itemRole === normalizedRole) {
          return true; // Role match - block across all departments
        }
      }

      // Check for department-based overlap (existing logic)
      if (!normalizedDepartment) {
        return true;
      }

      return (item.requester_department?.trim().toLowerCase() || null) ===
        normalizedDepartment;
    });

  return {
    blockedRules,
    overlappingApprovedLeaves,
  };
}
