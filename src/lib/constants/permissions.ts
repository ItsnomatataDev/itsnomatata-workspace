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
  | "fleet.view"
  | "fleet.manage"
  | "fleet.assign"
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
  | "tourism.operations.view"
  | "tourism.operations.manage"
  | "tourism.bookings.view"
  | "tourism.bookings.manage"
  | "tourism.guests.view"
  | "tourism.guests.manage"
  | "tourism.itineraries.view"
  | "tourism.itineraries.manage"
  | "tourism.transfers.view"
  | "tourism.transfers.manage"
  | "tourism.assigned.view"
  | "team.view"
  | "team.manage"
  | "profile.view_own"
  | "profile.edit_own"
  | "profile.view_others";

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  super_admin: ["*"],
  org_admin: ["*"],
  admin: ["*"],
  superadmin: ["*"],
  "it-superadmin": ["*"],

  user: [
    "leave.request",
    "clients.view",
    "tasks.view",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "meetings.use",
    "reports.view",
    "assets.view",
    "notifications.use",
    "profile.view_own",
    "profile.edit_own",
  ],

  hr: [
    "admin.dashboard.view",
    "employees.view",
    "roster.view",
    "leave.request",
    "leave.approve",
    "leave.rules.view",
    "approvals.view",
    "clients.view",
    "tasks.view",
    "time.track",
    "timesheets.view_own",
    "timesheets.view_team",
    "chat.use",
    "meetings.use",
    "meetings.schedule",
    "reports.view",
    "assets.view",
    "ai.use",
    "notifications.use",
    "notifications.broadcast",
    "team.view",
    "profile.view_own",
    "profile.edit_own",
    "profile.view_others",
  ],

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

  tourism_operations_manager: [
    "admin.dashboard.view",
    "employees.view",
    "roster.view",
    "roster.manage",
    "leave.request",
    "approvals.view",
    "clients.view",
    "clients.manage",
    "tasks.view",
    "tasks.manage",
    "tasks.assign",
    "time.track",
    "timesheets.view_own",
    "timesheets.view_team",
    "chat.use",
    "meetings.use",
    "fleet.view",
    "reports.view",
    "reports.generate",
    "notifications.use",
    "notifications.broadcast",
    "tourism.operations.view",
    "tourism.operations.manage",
    "tourism.bookings.view",
    "tourism.bookings.manage",
    "tourism.guests.view",
    "tourism.guests.manage",
    "tourism.itineraries.view",
    "tourism.itineraries.manage",
    "tourism.transfers.view",
    "tourism.transfers.manage",
    "team.view",
    "profile.view_own",
    "profile.edit_own",
    "profile.view_others",
  ],

  reservations_agent: [
    "leave.request",
    "clients.view",
    "tasks.view",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "meetings.use",
    "notifications.use",
    "tourism.operations.view",
    "tourism.bookings.view",
    "tourism.bookings.manage",
    "tourism.guests.view",
    "tourism.guests.manage",
    "tourism.itineraries.view",
    "tourism.itineraries.manage",
    "profile.view_own",
    "profile.edit_own",
  ],

  guest_relations: [
    "leave.request",
    "tasks.view",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "meetings.use",
    "notifications.use",
    "tourism.operations.view",
    "tourism.guests.view",
    "tourism.guests.manage",
    "tourism.itineraries.view",
    "tourism.assigned.view",
    "profile.view_own",
    "profile.edit_own",
  ],

  tour_guide: [
    "leave.request",
    "tasks.view",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "meetings.use",
    "notifications.use",
    "tourism.assigned.view",
    "tourism.itineraries.view",
    "profile.view_own",
    "profile.edit_own",
  ],

  driver: [
    "leave.request",
    "tasks.view",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "notifications.use",
    "tourism.assigned.view",
    "tourism.transfers.view",
    "profile.view_own",
    "profile.edit_own",
  ],

  activity_coordinator: [
    "leave.request",
    "roster.view",
    "roster.manage",
    "tasks.view",
    "tasks.assign",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "meetings.use",
    "notifications.use",
    "tourism.operations.view",
    "tourism.operations.manage",
    "tourism.bookings.view",
    "tourism.itineraries.view",
    "tourism.itineraries.manage",
    "profile.view_own",
    "profile.edit_own",
    "profile.view_others",
  ],

  fleet_coordinator: [
    "leave.request",
    "tasks.view",
    "tasks.assign",
    "time.track",
    "timesheets.view_own",
    "chat.use",
    "notifications.use",
    "fleet.view",
    "fleet.manage",
    "tourism.operations.view",
    "tourism.transfers.view",
    "tourism.transfers.manage",
    "profile.view_own",
    "profile.edit_own",
    "profile.view_others",
  ],
};
