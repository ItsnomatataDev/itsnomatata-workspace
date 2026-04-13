export const APP_ROLES = [
  "admin",
  "manager",
  "it",
  "seo_specialist",
  "social_media",
  "media_team",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Super Admin",
  manager: "Administrator",
  it: "IT",
  seo_specialist: "SEO Specialist",
  social_media: "Social Media",
  media_team: "Media Team",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}

export const ADMIN_ROLE_ASSIGNMENT_OPTIONS: Array<{
  value: Exclude<AppRole, "admin">;
  label: string;
}> = [
  { value: "manager", label: "Administrator" },
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