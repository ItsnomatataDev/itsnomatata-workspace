export type PlatformAdminRole =
  | "platform_owner"
  | "platform_admin"
  | "platform_support";

export type OrganizationAccessStatus =
  | "active"
  | "trialing"
  | "suspended"
  | "cancelled";

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  is_active: boolean;
  is_system_organization: boolean;
  access_status: OrganizationAccessStatus;
  suspended_reason: string | null;
  suspended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyOffice = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  is_primary: boolean;
  created_at: string;
};

export type OrganizationBranding = {
  id: string;
  organization_id: string;
  brand_name: string | null;
  app_name?: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  login_background_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  background_color?: string | null;
  card_color?: string | null;
  sidebar_color?: string | null;
  topbar_color?: string | null;
  text_color?: string | null;
  muted_text_color?: string | null;
  border_color?: string | null;
  button_color?: string | null;
  button_text_color?: string | null;
  button_hover_color?: string | null;
  link_color?: string | null;
  link_hover_color?: string | null;
  input_focus_color?: string | null;
  company_slogan: string | null;
  company_welcome_text: string | null;
  dashboard_greeting_text: string | null;
  custom_terminology: Record<string, unknown>;
  invitation_template: string | null;
  onboarding_wording: Record<string, unknown>;
  custom_css?: Record<string, unknown>;
  is_active?: boolean;
  custom_domain: string | null;
  subdomain: string | null;
  domain_status?: "pending" | "verified" | "active" | "failed" | null;
  domain_verification_token?: string | null;
  dns_target?: string | null;
  domain_error?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type OrganizationDomain = {
  id: string;
  organization_id: string;
  domain: string;
  domain_type: "subdomain" | "custom_domain";
  status: "pending" | "dns_pending" | "verified" | "connected" | "failed" | "disabled";
  cname_host: string;
  cname_fqdn?: string | null;
  cname_target: string;
  txt_host: string;
  txt_fqdn?: string | null;
  txt_value: string;
  verified_at: string | null;
  connected_at: string | null;
  last_checked_at: string | null;
  last_error: string | null;
  ssl_status: "pending" | "issuing" | "active" | "failed";
  provider: string;
  provider_domain_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type OrganizationSubscription = {
  id: string;
  organization_id: string;
  status: string;
  plan_name: string;
  billing_interval: string;
  amount_usd: number;
  payment_method: string;
  notes: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
};

export type OrganizationFeature = {
  id: string;
  organization_id: string;
  feature_key: string;
  module_label?: string | null;
  module_category?: string | null;
  enabled: boolean;
  limits: Record<string, unknown>;
  configuration?: Record<string, unknown>;
  permissions?: Record<string, unknown>;
};

export type OrganizationRole = {
  id: string;
  organization_id: string;
  role_key: string;
  role_label: string;
  description: string | null;
  department: string | null;
  is_admin_role: boolean;
  is_manager_role: boolean;
  is_default_signup_role: boolean;
  requires_approval: boolean;
  is_active: boolean;
  permissions: Record<string, unknown>;
  onboarding_config?: Record<string, unknown>;
  department_access?: Record<string, unknown>;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type OrganizationInvitation = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  role_key: string;
  invited_by: string | null;
  status: "pending" | "accepted" | "revoked" | "expired";
  token_hash: string | null;
  expires_at: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformAuditLog = {
  id: string;
  actor_user_id: string | null;
  target_organization_id: string | null;
  target_user_id: string | null;
  action: string;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type OrganizationAnalytics = {
  usersCount: number;
  activeUsers: number;
  onlineUsers: number;
  departments: number;
  meetingsUsage: number;
  activeMeetings: number;
  aiUsage: number;
  automationUsage: number;
  failedAutomations: number;
  attendanceSessions: number;
  timesheetEntries: number;
  tasksTotal: number;
  tasksCompleted: number;
  taskCompletionRate: number;
  recentActivity: PlatformAuditLog[];
};

export type OperationsCenterMetrics = {
  totalOrganizations: number;
  activeOrganizations: number;
  suspendedOrganizations: number;
  totalActiveUsers: number;
  usersOnlineNow: number;
  activeMeetings: number;
  aiRequests: number;
  automationExecutions: number;
  failedAutomations: number;
  realtimeSystemHealth: "healthy" | "warning" | "critical";
  notificationHealth: "healthy" | "warning" | "critical";
  storageUsage: number;
  taskCompletionRate: number;
  attendanceSummaries: number;
  incidents: number;
  edgeFunctionFailures: number;
  meetingFailures: number;
  workflowFailures: number;
};
