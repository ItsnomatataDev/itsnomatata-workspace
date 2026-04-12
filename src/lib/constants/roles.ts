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
  admin: "Admin",
  manager: "Manager",
  it: "IT",
  seo_specialist: "SEO Specialist",
  social_media: "Social Media",
  media_team: "Media Team",
};

export function isAppRole(value: unknown): value is AppRole {
  return typeof value === "string" && APP_ROLES.includes(value as AppRole);
}