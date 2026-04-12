import type { AppRole } from "./roles";

export type NavItem = {
  label: string;
  to: string;
  roles: AppRole[];
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", to: "/dashboard", roles: ["admin", "manager", "it", "seo_specialist", "social_media", "media_team"] },
  { label: "Admin", to: "/admin", roles: ["admin"] },
  { label: "Employees", to: "/admin/employees", roles: ["admin", "manager"] },
  { label: "Approvals", to: "/approvals", roles: ["admin", "manager"] },
  { label: "IT Workspace", to: "/it", roles: ["admin", "manager", "it"] },
  { label: "Projects", to: "/projects", roles: ["admin", "manager", "it", "seo_specialist", "social_media", "media_team"] },
  { label: "Tasks", to: "/tasks", roles: ["admin", "manager", "it", "seo_specialist", "social_media", "media_team"] },
  { label: "Meetings", to: "/meetings", roles: ["admin", "manager", "it", "seo_specialist", "social_media", "media_team"] },
  { label: "Chat", to: "/chat", roles: ["admin", "manager", "it", "seo_specialist", "social_media", "media_team"] },
  { label: "SEO", to: "/seo", roles: ["admin", "manager", "seo_specialist", "social_media", "media_team"] },
  { label: "Social Posts", to: "/social-posts", roles: ["admin", "manager", "seo_specialist", "social_media", "media_team"] },
  { label: "Content Library", to: "/content-library", roles: ["admin", "manager", "seo_specialist", "social_media", "media_team"] },
  { label: "Stock", to: "/stock", roles: ["admin", "manager", "it"] },
  { label: "Time", to: "/time", roles: ["admin", "manager", "it", "seo_specialist", "social_media", "media_team"] },
  { label: "Timesheets", to: "/timesheets", roles: ["admin", "manager", "it", "seo_specialist", "social_media", "media_team"] },
  { label: "Reports", to: "/reports", roles: ["admin", "manager", "it", "seo_specialist", "social_media", "media_team"] },
  { label: "AI Workspace", to: "/ai-workspace", roles: ["admin", "manager", "it", "seo_specialist", "social_media", "media_team"] },
];