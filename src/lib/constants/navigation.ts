import type { AppRole } from "./roles";
import type { FeatureKey } from "../hooks/useOrganizationFeatures";

export type NavItem = {
  label: string;
  to: string;
  roles: AppRole[];
  featureKey?: FeatureKey;
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    to: "/dashboard",
    roles: [
      "admin",
      "manager",
      "hr",
      "it",
      "seo_specialist",
      "social_media",
      "media_team",
    ],
  },
  { label: "Everhour", to: "/everhour", roles: ["admin", "manager"] },
  { label: "Admin", to: "/admin", roles: ["admin"] },
  { label: "Employees", to: "/admin/employees", roles: ["admin", "manager"], featureKey: "admin_users" },
  { label: "Inbox", to: "/inbox", roles: ["admin", "manager", "hr", "it", "seo_specialist", "social_media", "media_team"], featureKey: "notifications" },
  { label: "Documents", to: "/admin/documents", roles: ["admin", "manager", "hr"], featureKey: "knowledge_base" },
  { label: "Payslips", to: "/admin/payslips", roles: ["admin", "manager", "hr"], featureKey: "finance" },
  { label: "Approvals", to: "/approvals", roles: ["admin", "manager"] },
  { label: "IT Workspace", to: "/it", roles: ["admin", "manager", "it"] },
  {
    label: "Boards",
    to: "/boards",
    roles: [
      "admin",
      "manager",
      "hr",
      "it",
      "seo_specialist",
      "social_media",
      "media_team",
    ],
    featureKey: "boards",
  },
  {
    label: "Tasks",
    to: "/tasks",
    roles: [
      "admin",
      "manager",
      "hr",
      "it",
      "seo_specialist",
      "social_media",
      "media_team",
    ],
    featureKey: "tasks",
  },
  {
    label: "Meetings",
    to: "/meetings",
    roles: [
      "admin",
      "manager",
      "hr",
      "it",
      "seo_specialist",
      "social_media",
      "media_team",
    ],
    featureKey: "meetings",
  },
  {
    label: "Chat",
    to: "/chat",
    roles: [
      "admin",
      "manager",
      "hr",
      "it",
      "seo_specialist",
      "social_media",
      "media_team",
    ],
    featureKey: "chat",
  },
  {
    label: "SEO",
    to: "/seo",
    roles: ["admin", "manager", "seo_specialist", "social_media", "media_team"],
  },
  {
    label: "Social Posts",
    to: "/social-posts",
    roles: ["admin", "manager", "seo_specialist", "social_media", "media_team"],
  },
  {
    label: "Content Library",
    to: "/content-library",
    roles: ["admin", "manager", "seo_specialist", "social_media", "media_team"],
  },
  { label: "Stock", to: "/stock", roles: ["admin", "manager", "it"], featureKey: "stock" },
  {
    label: "My Timesheet",
    to: "/timesheet",
    roles: [
      "admin",
      "manager",
      "hr",
      "it",
      "seo_specialist",
      "social_media",
      "media_team",
    ],
    featureKey: "timesheets",
  },
  {
    label: "Timesheets",
    to: "/timesheets",
    roles: [
      "admin",
      "manager",
      "hr",
      "it",
      "seo_specialist",
      "social_media",
      "media_team",
    ],
    featureKey: "timesheets",
  },
  {
    label: "Reports",
    to: "/reports",
    roles: [
      "admin",
      "manager",
      "hr",
      "it",
      "seo_specialist",
      "social_media",
      "media_team",
    ],
    featureKey: "reports",
  },
  {
    label: "AI Workspace",
    to: "/ai-workspace",
    roles: [
      "admin",
      "manager",
      "it",
      "seo_specialist",
      "social_media",
      "media_team",
    ],
    featureKey: "ai_workspace",
  },
];
