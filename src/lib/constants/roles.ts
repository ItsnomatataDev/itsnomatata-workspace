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
  "tourism_operations_manager",
  "reservations_agent",
  "guest_relations",
  "tour_guide",
  "driver",
  "activity_coordinator",
  "fleet_coordinator",
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
  tourism_operations_manager: "Tourism Operations Manager",
  reservations_agent: "Reservations Agent",
  guest_relations: "Guest Relations",
  tour_guide: "Tour Guide",
  driver: "Driver",
  activity_coordinator: "Activity Coordinator",
  fleet_coordinator: "Fleet Coordinator",
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
  { value: "tourism_operations_manager", label: "Tourism Operations Manager" },
  { value: "reservations_agent", label: "Reservations Agent" },
  { value: "guest_relations", label: "Guest Relations" },
  { value: "tour_guide", label: "Tour Guide" },
  { value: "driver", label: "Driver" },
  { value: "activity_coordinator", label: "Activity Coordinator" },
  { value: "fleet_coordinator", label: "Fleet Coordinator" },
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
