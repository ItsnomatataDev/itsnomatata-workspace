import { supabase } from "../../../lib/supabase/client";
import type {
  AdminPlannerCalendar,
  AssignmentInput,
  AssignmentSlot,
  CompanyLocation,
  CompanyRole,
  ConflictResult,
  CreateSlotInput,
  EmployeeAssignment,
  EmployeePlannerCalendar,
  EmployeeSkill,
  LocationStatusEvent,
  MoveAssignmentInput,
  TlbEmployeeOffDay,
} from "../types";

function parseConflictResult(value: unknown): ConflictResult {
  if (!value || typeof value !== "object") {
    return { ok: false, conflicts: [{ code: "unknown", message: "Unknown conflict." }] };
  }
  const payload = value as { ok?: boolean; conflicts?: ConflictItem[] };
  return {
    ok: Boolean(payload.ok),
    conflicts: Array.isArray(payload.conflicts) ? payload.conflicts : [],
  };
}

type ConflictItem = ConflictResult["conflicts"][number];

export async function getAdminPlannerCalendar(params: {
  organizationId: string;
  startDate: string;
  endDate: string;
  locationId?: string | null;
  roleId?: string | null;
  employeeId?: string | null;
}): Promise<AdminPlannerCalendar> {
  const { data, error } = await supabase.rpc("get_admin_planner_calendar", {
    p_organization_id: params.organizationId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_location_id: params.locationId ?? null,
    p_role_id: params.roleId ?? null,
    p_employee_id: params.employeeId ?? null,
  });

  if (error) throw new Error(error.message);
  return (data ?? {
    locations: [],
    roles: [],
    status_events: [],
    slots: [],
    assignments: [],
    employees: [],
    availability: [],
  }) as AdminPlannerCalendar;
}

export async function getEmployeeCalendarAssignments(params: {
  organizationId: string;
  startDate: string;
  endDate: string;
  locationId?: string | null;
}): Promise<EmployeePlannerCalendar> {
  const { data, error } = await supabase.rpc("get_employee_calendar_assignments", {
    p_organization_id: params.organizationId,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_location_id: params.locationId ?? null,
  });

  if (error) throw new Error(error.message);
  return (data ?? {
    viewer_id: null,
    locations: [],
    status_events: [],
    assignments: [],
    availability: [],
  }) as EmployeePlannerCalendar;
}

export async function detectAssignmentConflicts(params: {
  organizationId: string;
  employeeId: string;
  locationId: string;
  slotId?: string | null;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  excludeAssignmentId?: string | null;
  requiredSkills?: string[];
}): Promise<ConflictResult> {
  const { data, error } = await supabase.rpc("detect_assignment_conflicts", {
    p_organization_id: params.organizationId,
    p_employee_id: params.employeeId,
    p_location_id: params.locationId,
    p_slot_id: params.slotId ?? null,
    p_start_date: params.startDate,
    p_end_date: params.endDate,
    p_start_time: params.startTime ?? null,
    p_end_time: params.endTime ?? null,
    p_exclude_assignment_id: params.excludeAssignmentId ?? null,
    p_required_skills: params.requiredSkills ?? [],
  });

  if (error) throw new Error(error.message);
  return parseConflictResult(data);
}

export async function createAssignmentSlot(params: {
  organizationId: string;
  input: CreateSlotInput;
}): Promise<AssignmentSlot> {
  const { data, error } = await supabase.rpc("create_assignment_slot", {
    p_organization_id: params.organizationId,
    p_payload: params.input,
  });

  if (error) throw new Error(error.message);
  return data as AssignmentSlot;
}

export async function deleteAssignmentSlot(params: {
  organizationId: string;
  slotId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("assignment_slots")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("id", params.slotId);

  if (error) throw new Error(error.message);
}

export async function assignEmployeeToSlot(params: {
  organizationId: string;
  input: AssignmentInput;
}): Promise<EmployeeAssignment> {
  const { data, error } = await supabase.rpc("assign_employee_to_slot", {
    p_organization_id: params.organizationId,
    p_payload: params.input,
  });

  if (error) throw new Error(error.message);
  return data as EmployeeAssignment;
}

export async function moveAssignment(params: {
  organizationId: string;
  assignmentId: string;
  input: MoveAssignmentInput;
}): Promise<EmployeeAssignment> {
  const { data, error } = await supabase.rpc("move_assignment", {
    p_organization_id: params.organizationId,
    p_assignment_id: params.assignmentId,
    p_payload: params.input,
  });

  if (error) throw new Error(error.message);
  return data as EmployeeAssignment;
}

export async function updateAssignment(params: {
  organizationId: string;
  assignmentId: string;
  input: MoveAssignmentInput;
}): Promise<EmployeeAssignment> {
  const { data, error } = await supabase.rpc("update_assignment", {
    p_organization_id: params.organizationId,
    p_assignment_id: params.assignmentId,
    p_payload: params.input,
  });

  if (error) throw new Error(error.message);
  return data as EmployeeAssignment;
}

export async function deleteAssignment(params: {
  organizationId: string;
  assignmentId: string;
}): Promise<void> {
  const { error } = await supabase.rpc("delete_assignment", {
    p_organization_id: params.organizationId,
    p_assignment_id: params.assignmentId,
  });

  if (error) throw new Error(error.message);
}

export async function upsertCompanyLocation(
  row: Partial<CompanyLocation> & {
    organization_id: string;
    name: string;
    type: CompanyLocation["type"];
    status: CompanyLocation["status"];
  },
): Promise<CompanyLocation> {
  const payload = {
    organization_id: row.organization_id,
    name: row.name.trim(),
    type: row.type,
    status: row.status,
    capacity: row.capacity ?? null,
    notes: row.notes ?? null,
    is_active: row.is_active ?? true,
  };

  if (row.id) {
    const { data, error } = await supabase
      .from("company_locations")
      .update(payload)
      .eq("id", row.id)
      .eq("organization_id", row.organization_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as CompanyLocation;
  }

  const { data, error } = await supabase
    .from("company_locations")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CompanyLocation;
}

export async function deleteCompanyLocation(params: {
  organizationId: string;
  locationId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("company_locations")
    .update({ is_active: false })
    .eq("organization_id", params.organizationId)
    .eq("id", params.locationId);

  if (error) throw new Error(error.message);
}

export async function createTlbEmployeeOffDay(params: {
  organizationId: string;
  officeId: string;
  userId: string;
  offDate: string;
  reason?: string | null;
  createdBy?: string | null;
}): Promise<TlbEmployeeOffDay> {
  const { data, error } = await supabase
    .from("tlb_employee_off_days")
    .insert({
      organization_id: params.organizationId,
      office_id: params.officeId,
      user_id: params.userId,
      off_date: params.offDate,
      reason: params.reason?.trim() || null,
      created_by: params.createdBy ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as TlbEmployeeOffDay;
}

export async function listTlbEmployeeOffDayHistory(params: {
  organizationId: string;
  limit?: number;
}): Promise<TlbEmployeeOffDay[]> {
  const { data, error } = await supabase
    .from("tlb_employee_off_days")
    .select("*")
    .eq("organization_id", params.organizationId)
    .order("off_date", { ascending: false })
    .limit(params.limit ?? 500);

  if (error) throw new Error(error.message);
  return (data ?? []) as TlbEmployeeOffDay[];
}

export async function deleteTlbEmployeeOffDay(params: {
  organizationId: string;
  offDayId: string;
}): Promise<void> {
  const { error } = await supabase
    .from("tlb_employee_off_days")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("id", params.offDayId);

  if (error) throw new Error(error.message);
}

export async function upsertCompanyRole(
  row: Partial<CompanyRole> & {
    organization_id: string;
    name: string;
  },
): Promise<CompanyRole> {
  const payload = {
    organization_id: row.organization_id,
    name: row.name.trim(),
    category: row.category ?? null,
    description: row.description ?? null,
    required_skills: row.required_skills ?? [],
    is_temporary: row.is_temporary ?? true,
    is_active: row.is_active ?? true,
  };

  if (row.id) {
    const { data, error } = await supabase
      .from("company_roles")
      .update(payload)
      .eq("id", row.id)
      .eq("organization_id", row.organization_id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data as CompanyRole;
  }

  const { data, error } = await supabase
    .from("company_roles")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return data as CompanyRole;
}

export async function createLocationStatusEvent(params: {
  organization_id: string;
  location_id: string;
  title: string;
  reason?: string | null;
  status: LocationStatusEvent["status"];
  start_date: string;
  end_date: string;
  notes?: string | null;
  created_by?: string | null;
}): Promise<LocationStatusEvent> {
  const { data, error } = await supabase
    .from("location_status_events")
    .insert({
      organization_id: params.organization_id,
      location_id: params.location_id,
      title: params.title,
      reason: params.reason ?? null,
      status: params.status,
      start_date: params.start_date,
      end_date: params.end_date,
      notes: params.notes ?? null,
      created_by: params.created_by ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as LocationStatusEvent;
}

export async function upsertEmployeeSkills(params: {
  organizationId: string;
  employeeId: string;
  skills: string[];
}): Promise<EmployeeSkill[]> {
  const normalized = [
    ...new Set(params.skills.map((s) => s.trim()).filter(Boolean)),
  ];

  const { error: deleteError } = await supabase
    .from("employee_skills")
    .delete()
    .eq("organization_id", params.organizationId)
    .eq("employee_id", params.employeeId);

  if (deleteError) throw new Error(deleteError.message);

  if (normalized.length === 0) return [];

  const { data, error } = await supabase
    .from("employee_skills")
    .insert(
      normalized.map((skill) => ({
        organization_id: params.organizationId,
        employee_id: params.employeeId,
        skill,
      })),
    )
    .select("*");

  if (error) throw new Error(error.message);
  return (data ?? []) as EmployeeSkill[];
}
