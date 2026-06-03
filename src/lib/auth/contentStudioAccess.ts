/** Roles that may use Content Studio (any matching profile field grants access). */
export const CONTENT_STUDIO_ROLES = new Set([
  "admin",
  "social_media",
  "media_team",
  "superadmin",
  "super_admin",
  "org_admin",
  "manager",
  "it",
  "it-superadmin",
]);

type AuthRoleSource = {
  currentOrganization?: { role?: string | null } | null;
  profile?: {
    organization_role_key?: string | null;
    primary_role?: string | null;
  } | null;
};

export function collectAuthRoleCandidates(auth: AuthRoleSource): string[] {
  const profile = auth.profile;
  return [
    auth.currentOrganization?.role,
    profile?.organization_role_key,
    profile?.primary_role,
  ].filter((value): value is string => Boolean(value));
}

export function canAccessContentStudio(auth: AuthRoleSource) {
  return collectAuthRoleCandidates(auth).some((role) =>
    CONTENT_STUDIO_ROLES.has(role),
  );
}

export function isContentStudioPath(pathname: string) {
  return (
    pathname.startsWith("/admin/content-studio") ||
    pathname.startsWith("/content-studio")
  );
}
