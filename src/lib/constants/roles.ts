export const APP_ROLES = [
  "super_admin",
  "org_admin",
  "user",
  "admin",
  "superadmin",
  "it-superadmin",
  "manager",
  "hr",
  "it",
  "seo_specialist",
  "social_media",
  "media_team",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  org_admin: "Organization Admin",
  user: "User",
  admin: "Super Admin",
  superadmin: "Global Super Admin",
  "it-superadmin": "IT Super Admin",
  manager: "Administrator",
  hr: "HR",
  it: "IT",
  seo_specialist: "SEO Specialist",
  social_media: "Social Media",
  media_team: "Media Team",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export const ADMIN_ROLE_ASSIGNMENT_OPTIONS: Array<{
  value: Exclude<AppRole, "super_admin" | "admin" | "superadmin" | "it-superadmin">;
  label: string;
}> = [
  { value: "org_admin", label: "Organization Admin" },
  { value: "user", label: "User" },
  { value: "manager", label: "Administrator" },
  { value: "hr", label: "HR" },
  { value: "it", label: "IT" },
  { value: "social_media", label: "Social Media" },
  { value: "media_team", label: "Media Team" },
  { value: "seo_specialist", label: "SEO Specialist" },
];

export const SUPER_ADMIN_ALLOWLIST = [
  "ben@itsnomatata.com",
  "thando@itsnomatata.com",
  "tammie@itsnomatata.com",
] as const;

export function isSuperAdminAllowedEmail(email: string | null | undefined) {
  if (!email) return false;
  const normalizedEmail = email.trim().toLowerCase();
  return SUPER_ADMIN_ALLOWLIST.includes(
    normalizedEmail as (typeof SUPER_ADMIN_ALLOWLIST)[number],
  );
}
