export type LocationStatus = "open" | "closed" | "limited";
export type LocationType =
  | "activity_site"
  | "office"
  | "department"
  | "team"
  | "other";

export type SlotPriority = "low" | "normal" | "high";
export type SlotStatus = "open" | "filled" | "closed";
export type AssignmentStatus = "draft" | "confirmed" | "cancelled";
export type CalendarViewMode = "day" | "week" | "month";

export type CompanyLocation = {
  id: string;
  organization_id: string;
  name: string;
  type: LocationType;
  status: LocationStatus;
  capacity: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CompanyRole = {
  id: string;
  organization_id: string;
  name: string;
  category: string | null;
  description: string | null;
  required_skills: string[];
  is_temporary: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type LocationStatusEvent = {
  id: string;
  organization_id: string;
  location_id: string;
  title: string;
  reason: string | null;
  status: LocationStatus;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AssignmentSlot = {
  id: string;
  organization_id: string;
  location_id: string;
  title: string;
  temporary_role_id: string | null;
  required_count: number;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  required_skills: string[];
  priority: SlotPriority;
  notes: string | null;
  status: SlotStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeAssignment = {
  id: string;
  organization_id: string;
  employee_id: string;
  slot_id: string | null;
  location_id: string;
  temporary_role_id: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  status: AssignmentStatus;
  notes: string | null;
  created_by: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmployeeSkill = {
  id: string;
  organization_id: string;
  employee_id: string;
  skill: string;
  created_at: string;
};

export type PlannerEmployee = {
  id: string;
  full_name: string | null;
  email: string | null;
  primary_role: string | null;
  department: string | null;
  skills: string[];
};

export type AdminAssignmentRow = {
  assignment: EmployeeAssignment;
  employee_name: string | null;
  employee_email: string | null;
  location_name: string;
  role_name: string | null;
};

export type EmployeeAssignmentRow = {
  assignment: EmployeeAssignment;
  employee_id: string;
  employee_name: string | null;
  location_name: string;
  location_status: LocationStatus;
  role_name: string | null;
  is_mine: boolean;
};

export type AdminPlannerCalendar = {
  locations: CompanyLocation[];
  roles: CompanyRole[];
  status_events: LocationStatusEvent[];
  slots: AssignmentSlot[];
  assignments: AdminAssignmentRow[];
  employees: PlannerEmployee[];
};

export type EmployeePlannerCalendar = {
  viewer_id: string | null;
  locations: CompanyLocation[];
  status_events: LocationStatusEvent[];
  assignments: EmployeeAssignmentRow[];
};

export type ConflictItem = {
  code: string;
  message: string;
  skills?: string[];
};

export type ConflictResult = {
  ok: boolean;
  conflicts: ConflictItem[];
};

export type CreateSlotInput = {
  location_id: string;
  title: string;
  temporary_role_id?: string | null;
  required_count: number;
  start_date: string;
  end_date: string;
  start_time?: string | null;
  end_time?: string | null;
  required_skills?: string[];
  priority?: SlotPriority;
  notes?: string | null;
  status?: SlotStatus;
};

export type AssignmentInput = {
  employee_id: string;
  slot_id?: string | null;
  location_id?: string;
  temporary_role_id?: string | null;
  start_date?: string;
  end_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  status?: AssignmentStatus;
  notes?: string | null;
  required_skills?: string[];
};

export type MoveAssignmentInput = {
  slot_id?: string | null;
  location_id?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string | null;
  end_time?: string | null;
  temporary_role_id?: string | null;
  status?: AssignmentStatus;
  notes?: string | null;
};
