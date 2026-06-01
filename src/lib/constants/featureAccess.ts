import type { Permission } from "./permissions";
import type { AppRole } from "./roles";

export type RouteAccessRule = {
  roles?: AppRole[];
  permissions?: Permission[];
};

export const ROUTE_ACCESS: Record<string, RouteAccessRule> = {
  "/admin": {
    roles: ["admin"],
  },
  "/admin/employees": {
    roles: ["admin", "manager"],
  },
  "/admin/leave": {
    roles: ["admin", "manager", "hr"],
  },
  "/admin/roster": {
    roles: ["admin", "manager"],
  },
  "/admin/crm": {
    roles: ["admin", "manager"],
  },
  "/admin/stock": {
    roles: ["admin", "manager", "it"],
  },
  "/admin/notifications": {
    roles: ["admin", "manager"],
  },
  "/admin/documents": {
    roles: ["admin", "manager", "hr"],
  },
  "/admin/payslips": {
    roles: ["admin", "manager", "hr"],
  },

  "/inbox": {
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

  "/ai-assistant": {
    permissions: ["ai.use"],
  },
  "/ai-workspace": {
    permissions: ["ai.use"],
  },

  "/approvals": {
    roles: ["admin", "manager"],
  },

  "/automation-flows": {
    roles: ["admin", "it"],
  },
  "/automation-runs": {
    roles: ["admin", "it"],
  },

  "/billing": {
    roles: ["admin"],
  },
  "/budgets": {
    roles: ["admin", "manager"],
  },
  "/expenses": {
    roles: ["admin", "manager", "it", "seo_specialist", "social_media", "media_team"],
  },
  "/invoices": {
    roles: ["admin"],
  },

  "/campaigns": {
    permissions: ["campaigns.view"],
  },

  "/chat": {
    permissions: ["chat.use"],
  },

  "/clients": {
    permissions: ["clients.view"],
  },

  "/content-library": {
    permissions: ["assets.view"],
  },

  "/it": {
    roles: ["it", "admin", "manager"],
  },
  "/it/projects": {
    roles: ["it", "admin", "manager"],
  },
  "/it/issues": {
    roles: ["it", "admin", "manager"],
  },
  "/it/system-monitor": {
    roles: ["it", "admin", "manager"],
  },

  "/knowledge-base": {
    permissions: ["knowledge.view"],
  },

  "/leave": {
    permissions: ["leave.request"],
  },

  "/meetings": {
    permissions: ["meetings.use"],
  },
  "/schedule-meeting": {
    permissions: ["meetings.schedule"],
  },

  "/notifications": {
    permissions: ["notifications.use"],
  },

  "/team": {
    permissions: ["team.view"],
  },

  "/profile": {
    permissions: ["profile.view_own"],
  },

  "/projects": {
    permissions: ["projects.view"],
  },

  "/reports": {
    permissions: ["reports.view"],
  },

  "/seo": {
    roles: ["seo_specialist", "admin", "manager", "social_media", "media_team"],
  },

  "/social-posts": {
    roles: ["social_media", "media_team", "admin", "manager", "seo_specialist"],
  },

  "/media-dashboard": {
    roles: ["media_team", "admin", "manager", "seo_specialist", "social_media"],
  },

  "/creative-requests": {
    roles: ["media_team", "admin", "manager"],
  },

  "/production-pipeline": {
    roles: ["media_team", "admin", "manager"],
  },

  "/campaign-visuals": {
    roles: ["media_team", "admin", "manager"],
  },

  "/editing-queue": {
    roles: ["media_team", "admin", "manager"],
  },

  "/delivery-tracker": {
    roles: ["media_team", "admin", "manager"],
  },

  "/stock": {
    roles: ["admin", "it", "manager"],
  },

  "/tasks": {
    permissions: ["tasks.view"],
  },

  "/timesheets/team": {
    permissions: ["timesheets.view_own", "time.track"],
  },

  "/timesheets": {
    permissions: ["timesheets.view_own"],
  },

  "/time-approvals": {
    roles: ["admin", "org_admin", "manager"],
  },
};
