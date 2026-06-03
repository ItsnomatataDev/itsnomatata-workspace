import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { hasAnyPermission } from "../../lib/helpers/permissions";
import type { Permission } from "../../lib/constants/permissions";
import type { AppRole } from "../../lib/constants/roles";

type RoleRouteProps = {
  children: ReactNode;
  roles?: AppRole[];
  permissions?: Permission[];
  fallbackTo?: string;
};

export default function RoleRoute({
  children,
  roles,
  permissions,
  fallbackTo = "/dashboard",
}: RoleRouteProps) {
  const auth = useAuth();

  if (!auth || auth.loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Checking access...
      </div>
    );
  }

  const roleCandidates = [
    auth.currentOrganization?.role,
    auth.profile?.organization_role_key,
    auth.profile?.primary_role,
  ].filter((value): value is string => Boolean(value));

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  const roleAllowed =
    !roles ||
    roleCandidates.some((role) => roles.includes(role as AppRole));

  const permissionAllowed =
    !permissions ||
    roleCandidates.some((role) => hasAnyPermission(role, permissions));

  if (!roleAllowed || !permissionAllowed) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <>{children}</>;
}
