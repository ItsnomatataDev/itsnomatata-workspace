import type { AppRole } from "./roles";

export type Permission =
  | "*"
  | "admin.dashboard.view"
  | "employees.view"
  | "employees.manage"
  | "roles.manage"
  | "roster.view"
  | "roster.manage"
  | "leave.request"
  | "leave.approve"
  | "leave.rules.view"
  | "leave.rules.manage"
  | "approvals.view"
  | "approvals.decide"
  | "clients.view"
  | "clients.manage"
  | "campaigns.view"
  | "campaigns.manage"
  | "projects.view"
  | "projects.manage"
  | "projects.manage_it"
  | "tasks.view"
  | "tasks.manage"
  | "tasks.assign"
  | "tasks.assign_team"
  | "time.track"
  | "timesheets.view_own"
  | "timesheets.view_team"
  | "timesheets.view_all"
  | "timesheets.approve"
  | "chat.use"
  | "chat.moderate"
  | "meetings.use"
  | "meetings.schedule"
  | "meetings.diagnostics"
  | "stock.view_assigned"
  | "stock.view"
  | "stock.manage"
  | "stock.export"
  | "reports.view"
  | "reports.generate"
  | "reports.export"
  | "seo.view"
  | "seo.manage"
  | "social.view"
  | "social.manage"
  | "media.view"
  | "media.manage"
  | "assets.view"
  | "assets.upload"
  | "assets.manage"
  | "knowledge.view"
  | "knowledge.manage"
  | "automation.view"
  | "automation.manage"
  | "ai.use"
  | "ai.manage"
  | "ai.approve"
  | "notifications.use"
  | "notifications.broadcast"
  | "team.view"
  | "team.manage"
  | "profile.view_own"
  | "profile.edit_own"
  | "profile.view_others";

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: ["*"],

  manager: [
    "admin.dashboard.view",
    "employees.view",
    "roster.view",
    "roster.manage",
    "leave.request",
    "leave.approve",
    "leave.rules.view",
    "approvals.view",
    "approvals.decide",
    "clients.view",
    "clients.manage",
    "campaigns.view",
    "campaigns.manage",
    "projects.view",
    "projects.manage",
    "tasks.view",
    "tasks.manage",
    "tasks.assign",
    "time.track",
    "timesheets.view_own",
    "timesheets.view_team",
    "timesheets.approve",
    "chat.use",
    "meetings.use",
    "meetings.schedule",
    "stock.view",
    "reports.view",
    "reports.generate",
    "reports.export",
    "assets.view",
    "knowledge.view",
    "knowledge.manage",
    "ai.use",
    "ai.approve",
    "notifications.use",
    "notifications.broadcast",
    "team.view",
    "profile.view_own",
    "profile.edit_own",
    "profile.view_others",
  ],

  it: [
    "leave.request",
    "projects.view",
    "projects.manage_it",
    "tasks.view",
    "tasks.assign_team",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "chat.moderate",
    "meetings.use",
    "meetings.schedule",
    "meetings.diagnostics",
    "stock.view",
    "stock.manage",
    "stock.export",
    "reports.view",
    "reports.generate",
    "assets.view",
    "knowledge.view",
    "knowledge.manage",
    "automation.view",
    "automation.manage",
    "ai.use",
    "notifications.use",
    "team.view",
    "profile.view_own",
    "profile.edit_own",
    "profile.view_others",
  ],

  seo_specialist: [
    "leave.request",
    "clients.view",
    "campaigns.view",
    "projects.view",
    "tasks.view",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "meetings.use",
    "meetings.schedule",
    "reports.view",
    "reports.generate",
    "reports.export",
    "seo.view",
    "seo.manage",
    "social.view",
    "media.view",
    "assets.view",
    "assets.upload",
    "knowledge.view",
    "knowledge.manage",
    "ai.use",
    "notifications.use",
    "team.view",
    "profile.view_own",
    "profile.edit_own",
    "profile.view_others",
  ],

  social_media: [
    "leave.request",
    "clients.view",
    "campaigns.view",
    "projects.view",
    "tasks.view",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "meetings.use",
    "meetings.schedule",
    "reports.view",
    "reports.generate",
    "reports.export",
    "seo.view",
    "social.view",
    "social.manage",
    "media.view",
    "assets.view",
    "assets.upload",
    "knowledge.view",
    "knowledge.manage",
    "ai.use",
    "notifications.use",
    "team.view",
    "profile.view_own",
    "profile.edit_own",
    "profile.view_others",
  ],

  media_team: [
    "leave.request",
    "clients.view",
    "campaigns.view",
    "projects.view",
    "tasks.view",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "meetings.use",
    "meetings.schedule",
    "reports.view",
    "reports.generate",
    "media.view",
    "media.manage",
    "assets.view",
    "assets.upload",
    "assets.manage",
    "knowledge.view",
    "knowledge.manage",
    "ai.use",
    "notifications.use",
    "team.view",
    "profile.view_own",
    "profile.edit_own",
    "profile.view_others",
  ],
};