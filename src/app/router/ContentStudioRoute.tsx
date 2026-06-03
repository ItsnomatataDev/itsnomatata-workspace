import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";

/** Roles that may use Content Studio (any matching profile field grants access). */
const CONTENT_STUDIO_ROLES = new Set([
  "admin",
  "social_media",
  "media_team",
  "superadmin",
  "super_admin",
  "org_admin",
]);

function collectRoleCandidates(
  auth: NonNullable<ReturnType<typeof useAuth>>,
): string[] {
  return [
    auth.currentOrganization?.role,
    auth.profile?.organization_role_key,
    auth.profile?.primary_role,
  ].filter((value): value is string => Boolean(value));
}

function canAccessContentStudio(auth: NonNullable<ReturnType<typeof useAuth>>) {
  return collectRoleCandidates(auth).some((role) =>
    CONTENT_STUDIO_ROLES.has(role),
  );
}

/**
 * Content Studio guard — checks every role field on the profile, not only
 * currentOrganization.role (which could be "user" while primary_role is social_media).
 */
export default function ContentStudioRoute({
  children,
}: {
  children: ReactNode;
}) {
  const auth = useAuth();

  if (!auth || auth.loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Checking access...
      </div>
    );
  }

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  if (!canAccessContentStudio(auth)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
