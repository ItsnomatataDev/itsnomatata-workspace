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

  const role = auth.profile?.primary_role ?? null;

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  const roleAllowed =
    !roles || (role ? roles.includes(role as AppRole) : false);

  const permissionAllowed = !permissions || hasAnyPermission(role, permissions);

  if (!roleAllowed || !permissionAllowed) {
    return <Navigate to={fallbackTo} replace />;
  }

  return <>{children}</>;
}
