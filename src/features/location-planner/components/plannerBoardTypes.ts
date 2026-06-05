import type { AssignmentStatus } from "../types";

export type PlannerTabId = "work_streams" | "locations" | "unassigned";

export type PlannerAssignmentCardModel = {
  id: string;
  employeeId: string;
  employeeName: string | null;
  employeeEmail?: string | null;
  roleName: string | null;
  locationName: string;
  locationId: string;
  slotId: string | null;
  temporaryRoleId: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  status: AssignmentStatus;
  isMine?: boolean;
};

export type PlannerWorkStream = {
  id: string;
  title: string;
  subtitle: string;
  locationId: string | null;
  slotId: string | null;
  temporaryRoleId: string | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  requiredCount: number | null;
  assignments: PlannerAssignmentCardModel[];
};

export type PlannerLocationColumn = {
  id: string;
  name: string;
  status: string;
  capacity: number | null;
  assignments: PlannerAssignmentCardModel[];
  slots?: PlannerWorkStream[];
};

export type PlannerEmployeeCardModel = {
  id: string;
  name: string;
  email: string | null;
  primaryRole: string | null;
  department: string | null;
  skills: string[];
  availabilityLabel?: string | null;
  availabilityKind?: "leave" | "off_day" | null;
};
