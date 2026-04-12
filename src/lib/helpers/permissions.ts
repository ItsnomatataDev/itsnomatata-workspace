import type { Permission } from "../constants/permissions";
import { ROLE_PERMISSIONS } from "../constants/permissions";
import type { AppRole } from "../constants/roles";
import { isAppRole } from "../constants/roles";

export function normalizeRole(role: unknown): AppRole | null {
  return isAppRole(role) ? role : null;
}

export function getRolePermissions(role: unknown): Permission[] {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return [];
  return ROLE_PERMISSIONS[normalizedRole] ?? [];
}

export function hasPermission(
  role: unknown,
  permission: Permission,
): boolean {
  const permissions = getRolePermissions(role);
  return permissions.includes("*") || permissions.includes(permission);
}

export function hasAnyPermission(
  role: unknown,
  requiredPermissions: Permission[],
): boolean {
  if (!requiredPermissions.length) return true;
  return requiredPermissions.some((permission) =>
    hasPermission(role, permission),
  );
}

export function hasAllPermissions(
  role: unknown,
  requiredPermissions: Permission[],
): boolean {
  if (!requiredPermissions.length) return true;
  return requiredPermissions.every((permission) =>
    hasPermission(role, permission),
  );
}

export function canManageUsers(role: unknown): boolean {
  return hasPermission(role, "employees.manage") || hasPermission(role, "roles.manage");
}

export function canApprove(role: unknown): boolean {
  return hasPermission(role, "approvals.decide") || hasPermission(role, "leave.approve");
}

export function canUseAI(role: unknown): boolean {
  return hasPermission(role, "ai.use");
}

export function canManageStock(role: unknown): boolean {
  return hasPermission(role, "stock.manage");
}

export function canAccessTimesheets(role: unknown): boolean {
  return (
    hasPermission(role, "timesheets.view_own") ||
    hasPermission(role, "timesheets.view_team") ||
    hasPermission(role, "timesheets.view_all")
  );
}