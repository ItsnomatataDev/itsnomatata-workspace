import { supabase } from "../../../lib/supabase/client";
import type {
  OperationsCenterMetrics,
  OrganizationAnalytics,
  OrganizationBranding,
  OrganizationFeature,
  OrganizationInvitation,
  OrganizationRole,
  OrganizationRow,
  OrganizationSubscription,
  PlatformAuditLog,
} from "../types/platformAdmin";

type JsonRecord = Record<string, unknown>;

const SYSTEM_ORGANIZATION_SLUG = "its-nomatata";

const DEFAULT_FEATURES = [
  { key: "ai_workspace", label: "AI Module", category: "Intelligence" },
  { key: "meetings", label: "Meetings Module", category: "Collaboration" },
  { key: "chat", label: "Chat Module", category: "Collaboration" },
  { key: "boards", label: "Boards Module", category: "Work Management" },
  { key: "tasks", label: "Tasks Module", category: "Work Management" },
  { key: "attendance", label: "Attendance Module", category: "HR" },
  { key: "timesheets", label: "Timesheets Module", category: "HR" },
  { key: "finance", label: "Finance Module", category: "Finance" },
  { key: "media_dashboard", label: "Media Module", category: "Media" },
  { key: "social_media", label: "Social Media Module", category: "Media" },
  { key: "automation", label: "Automation Module", category: "Operations" },
  { key: "notifications", label: "Notifications Module", category: "Operations" },
  { key: "fleet", label: "Fleet Module", category: "Assets" },
  { key: "stock", label: "Asset Tracking Module", category: "Assets" },
];

const DEFAULT_ROLES = [
  {
    role_key: "admin",
    role_label: "Administrator",
    department: "management",
    is_admin_role: true,
    is_manager_role: true,
    is_default_signup_role: false,
    requires_approval: true,
    is_active: true,
    permissions: { all: true },
  },
  {
    role_key: "manager",
    role_label: "Manager",
    department: "management",
    is_admin_role: false,
    is_manager_role: true,
    is_default_signup_role: false,
    requires_approval: true,
    is_active: true,
    permissions: {
      manage_team: true,
      manage_tasks: true,
      approve_requests: true,
    },
  },
  {
    role_key: "it",
    role_label: "IT Team",
    department: "it",
    is_admin_role: false,
    is_manager_role: false,
    is_default_signup_role: false,
    requires_approval: true,
    is_active: true,
    permissions: {
      it_workspace: true,
      assets: true,
      support: true,
    },
  },
  {
    role_key: "social_media",
    role_label: "Social Media",
    department: "marketing",
    is_admin_role: false,
    is_manager_role: false,
    is_default_signup_role: false,
    requires_approval: true,
    is_active: true,
    permissions: {
      social_media: true,
      campaigns: true,
    },
  },
  {
    role_key: "media_team",
    role_label: "Media Team",
    department: "media",
    is_admin_role: false,
    is_manager_role: false,
    is_default_signup_role: false,
    requires_approval: true,
    is_active: true,
    permissions: {
      media_dashboard: true,
      content_assets: true,
    },
  },
  {
    role_key: "seo_specialist",
    role_label: "SEO Specialist",
    department: "marketing",
    is_admin_role: false,
    is_manager_role: false,
    is_default_signup_role: false,
    requires_approval: true,
    is_active: true,
    permissions: {
      seo: true,
      reports: true,
    },
  },
  {
    role_key: "finance",
    role_label: "Finance",
    department: "finance",
    is_admin_role: false,
    is_manager_role: false,
    is_default_signup_role: false,
    requires_approval: true,
    is_active: true,
    permissions: {
      finance: true,
      invoices: true,
      expenses: true,
    },
  },
  {
    role_key: "employee",
    role_label: "Employee",
    department: "general",
    is_admin_role: false,
    is_manager_role: false,
    is_default_signup_role: true,
    requires_approval: true,
    is_active: true,
    permissions: {
      dashboard: true,
      chat: true,
      tasks: true,
    },
  },
];

export async function checkIsPlatformAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_admin");

  if (error) {
    console.error("CHECK PLATFORM ADMIN ERROR:", error);
    return false;
  }

  return Boolean(data);
}

export async function checkIsPlatformOwnerOrAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_platform_owner_or_admin");

  if (error) {
    console.error("CHECK PLATFORM OWNER ERROR:", error);
    return false;
  }

  return Boolean(data);
}

async function getOrganizationById(organizationId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, slug, is_system_organization, access_status, is_active")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) throw error;
  return data as Pick<
    OrganizationRow,
    "id" | "slug" | "is_system_organization" | "access_status" | "is_active"
  > | null;
}

function isSystemOrganization(org: Pick<OrganizationRow, "slug" | "is_system_organization"> | null) {
  return Boolean(org?.is_system_organization || org?.slug === SYSTEM_ORGANIZATION_SLUG);
}

async function assertSystemOrganizationMayChange(organizationId: string, action: string) {
  const org = await getOrganizationById(organizationId);

  if (isSystemOrganization(org)) {
    throw new Error(`ITsNomatata is the system organization and cannot be ${action}.`);
  }
}

export async function getOrganizations(): Promise<OrganizationRow[]> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      `
      id,
      name,
      slug,
      timezone,
      is_active,
      is_system_organization,
      access_status,
      suspended_reason,
      suspended_at,
      created_at,
      updated_at
    `,
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as OrganizationRow[];
}

export async function createOrganization(params: {
  name: string;
  slug: string;
  timezone?: string;
}): Promise<OrganizationRow> {
  const { data: organization, error } = await supabase
    .from("organizations")
    .insert({
      name: params.name,
      slug: params.slug,
      timezone: params.timezone ?? "Africa/Harare",
      is_active: true,
      access_status: "active",
      is_system_organization: false,
      settings: {},
    })
    .select(
      `
      id,
      name,
      slug,
      timezone,
      is_active,
      is_system_organization,
      access_status,
      suspended_reason,
      suspended_at,
      created_at,
      updated_at
    `,
    )
    .single();

  if (error) throw error;

  const organizationId = organization.id;

  await Promise.all([
    createDefaultSubscription(organizationId),
    createDefaultBranding(organizationId, params.name),
    createDefaultFeatures(organizationId),
    createDefaultRoles(organizationId),
  ]);

  await createPlatformAuditLog({
    action: "organization_created",
    targetOrganizationId: organizationId,
    metadata: {
      name: params.name,
      slug: params.slug,
      defaults_created: true,
    },
  });

  return organization as OrganizationRow;
}

async function createDefaultSubscription(organizationId: string) {
  const { error } = await supabase.from("organization_subscriptions").upsert(
    {
      organization_id: organizationId,
      status: "active",
      plan_name: "enterprise",
      billing_interval: "manual",
      amount_usd: 0,
      payment_method: "manual",
      notes: "Manual payment tracking.",
      current_period_start: new Date().toISOString(),
    },
    {
      onConflict: "organization_id",
    },
  );

  if (error) throw error;
}

async function createDefaultBranding(organizationId: string, brandName: string) {
  const { error } = await supabase.from("organization_branding").upsert(
    {
      organization_id: organizationId,
      brand_name: brandName,
      primary_color: "#000000",
      secondary_color: "#ffffff",
      accent_color: "#f97316",
      company_slogan: "Enterprise operations without friction.",
      company_welcome_text: `Welcome to ${brandName}.`,
      dashboard_greeting_text: "Here is what needs attention today.",
      custom_terminology: {},
      onboarding_wording: {},
    },
    {
      onConflict: "organization_id",
    },
  );

  if (error) throw error;
}

async function createDefaultFeatures(organizationId: string) {
  const payload = DEFAULT_FEATURES.map((feature) => ({
    organization_id: organizationId,
    feature_key: feature.key,
    module_label: feature.label,
    module_category: feature.category,
    enabled: true,
    limits: {},
    configuration: {},
    permissions: {},
  }));

  const { error } = await supabase
    .from("organization_features")
    .upsert(payload, {
      onConflict: "organization_id,feature_key",
    });

  if (error) throw error;
}

async function createDefaultRoles(organizationId: string) {
  const payload = DEFAULT_ROLES.map((role) => ({
    organization_id: organizationId,
    ...role,
  }));

  const { error } = await supabase.from("organization_roles").upsert(payload, {
    onConflict: "organization_id,role_key",
  });

  if (error) throw error;
}

export async function updateOrganization(params: {
  organizationId: string;
  name?: string;
  slug?: string;
  timezone?: string;
  accessStatus?: string;
  isActive?: boolean;
}) {
  if (
    params.accessStatus === "suspended" ||
    params.accessStatus === "cancelled" ||
    params.isActive === false
  ) {
    await assertSystemOrganizationMayChange(params.organizationId, "blocked or deactivated");
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (params.name !== undefined) updates.name = params.name;
  if (params.slug !== undefined) updates.slug = params.slug;
  if (params.timezone !== undefined) updates.timezone = params.timezone;
  if (params.accessStatus !== undefined) updates.access_status = params.accessStatus;
  if (params.isActive !== undefined) updates.is_active = params.isActive;

  const { data, error } = await supabase
    .from("organizations")
    .update(updates)
    .eq("id", params.organizationId)
    .select("*")
    .single();

  if (error) throw error;

  await createPlatformAuditLog({
    action: "organization_updated",
    targetOrganizationId: params.organizationId,
    metadata: updates,
  });

  return data as OrganizationRow;
}

export async function suspendOrganization(params: {
  organizationId: string;
  reason?: string;
}) {
  await assertSystemOrganizationMayChange(params.organizationId, "suspended");

  const { error } = await supabase
    .from("organizations")
    .update({
      access_status: "suspended",
      is_active: false,
      suspended_reason: params.reason ?? "Suspended by platform admin",
      suspended_at: new Date().toISOString(),
    })
    .eq("id", params.organizationId)
    .eq("is_system_organization", false);

  if (error) throw error;

  await supabase
    .from("organization_subscriptions")
    .update({
      status: "suspended",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", params.organizationId);

  await createPlatformAuditLog({
    action: "organization_suspended",
    targetOrganizationId: params.organizationId,
    reason: params.reason,
  });
}

export async function reactivateOrganization(organizationId: string) {
  const { error } = await supabase
    .from("organizations")
    .update({
      access_status: "active",
      is_active: true,
      suspended_reason: null,
      suspended_at: null,
    })
    .eq("id", organizationId);

  if (error) throw error;

  await supabase
    .from("organization_subscriptions")
    .update({
      status: "active",
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);

  await createPlatformAuditLog({
    action: "organization_reactivated",
    targetOrganizationId: organizationId,
  });
}

export async function getOrganizationSubscription(
  organizationId: string,
): Promise<OrganizationSubscription | null> {
  const { data, error } = await supabase
    .from("organization_subscriptions")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  return (data as OrganizationSubscription | null) ?? null;
}

export async function updateOrganizationSubscription(params: {
  organizationId: string;
  status?: string;
  planName?: string;
  billingInterval?: string;
  amountUsd?: number;
  paymentMethod?: string;
  notes?: string | null;
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
}) {
  if (
    params.status === "suspended" ||
    params.status === "cancelled" ||
    params.status === "past_due"
  ) {
    await assertSystemOrganizationMayChange(params.organizationId, "cancelled or suspended");
  }

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (params.status !== undefined) updates.status = params.status;
  if (params.planName !== undefined) updates.plan_name = params.planName;
  if (params.billingInterval !== undefined) updates.billing_interval = params.billingInterval;
  if (params.amountUsd !== undefined) updates.amount_usd = params.amountUsd;
  if (params.paymentMethod !== undefined) updates.payment_method = params.paymentMethod;
  if (params.notes !== undefined) updates.notes = params.notes;
  if (params.currentPeriodStart !== undefined) {
    updates.current_period_start = params.currentPeriodStart;
  }
  if (params.currentPeriodEnd !== undefined) {
    updates.current_period_end = params.currentPeriodEnd;
  }

  const { data, error } = await supabase
    .from("organization_subscriptions")
    .upsert(
      {
        organization_id: params.organizationId,
        ...updates,
      },
      {
        onConflict: "organization_id",
      },
    )
    .select("*")
    .single();

  if (error) throw error;

  await createPlatformAuditLog({
    action: "subscription_updated",
    targetOrganizationId: params.organizationId,
    metadata: updates,
  });

  return data as OrganizationSubscription;
}

export async function getOrganizationFeatures(
  organizationId: string,
): Promise<OrganizationFeature[]> {
  const { data, error } = await supabase
    .from("organization_features")
    .select("*")
    .eq("organization_id", organizationId)
    .order("feature_key", { ascending: true });

  if (error) throw error;

  return (data ?? []) as OrganizationFeature[];
}

export async function updateOrganizationFeature(params: {
  featureId: string;
  enabled: boolean;
}) {
  const { data: currentFeature, error: featureReadError } = await supabase
    .from("organization_features")
    .select("id, organization_id, feature_key")
    .eq("id", params.featureId)
    .single();

  if (featureReadError) throw featureReadError;

  if (!params.enabled) {
    await assertSystemOrganizationMayChange(
      currentFeature.organization_id,
      "restricted by disabling modules",
    );
  }

  const { data: feature, error } = await supabase
    .from("organization_features")
    .update({
      enabled: params.enabled,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.featureId)
    .select("*")
    .single();

  if (error) throw error;

  await createPlatformAuditLog({
    action: "feature_updated",
    targetOrganizationId: feature.organization_id,
    metadata: {
      featureId: params.featureId,
      featureKey: feature.feature_key,
      enabled: params.enabled,
    },
  });

  return feature as OrganizationFeature;
}

export async function getOrganizationRoles(
  organizationId: string,
): Promise<OrganizationRole[]> {
  const { data, error } = await supabase
    .from("organization_roles")
    .select("*")
    .eq("organization_id", organizationId)
    .order("role_label", { ascending: true });

  if (error) throw error;

  return (data ?? []) as OrganizationRole[];
}

export async function createOrganizationRole(params: {
  organizationId: string;
  roleKey: string;
  roleLabel: string;
  department?: string | null;
  description?: string | null;
  isAdminRole?: boolean;
  isManagerRole?: boolean;
  isDefaultSignupRole?: boolean;
  requiresApproval?: boolean;
  permissions?: JsonRecord;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("organization_roles")
    .insert({
      organization_id: params.organizationId,
      role_key: params.roleKey,
      role_label: params.roleLabel,
      department: params.department ?? null,
      description: params.description ?? null,
      is_admin_role: params.isAdminRole ?? false,
      is_manager_role: params.isManagerRole ?? false,
      is_default_signup_role: params.isDefaultSignupRole ?? false,
      requires_approval: params.requiresApproval ?? true,
      is_active: true,
      permissions: params.permissions ?? {},
      created_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  await createPlatformAuditLog({
    action: "role_created",
    targetOrganizationId: params.organizationId,
    metadata: {
      roleKey: params.roleKey,
      roleLabel: params.roleLabel,
    },
  });

  return data as OrganizationRole;
}

export async function updateOrganizationRole(params: {
  roleId: string;
  roleLabel?: string;
  description?: string | null;
  department?: string | null;
  isAdminRole?: boolean;
  isManagerRole?: boolean;
  isDefaultSignupRole?: boolean;
  requiresApproval?: boolean;
  isActive?: boolean;
  permissions?: JsonRecord;
}) {
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (params.roleLabel !== undefined) updates.role_label = params.roleLabel;
  if (params.description !== undefined) updates.description = params.description;
  if (params.department !== undefined) updates.department = params.department;
  if (params.isAdminRole !== undefined) updates.is_admin_role = params.isAdminRole;
  if (params.isManagerRole !== undefined) updates.is_manager_role = params.isManagerRole;
  if (params.isDefaultSignupRole !== undefined) {
    updates.is_default_signup_role = params.isDefaultSignupRole;
  }
  if (params.requiresApproval !== undefined) {
    updates.requires_approval = params.requiresApproval;
  }
  if (params.isActive !== undefined) updates.is_active = params.isActive;
  if (params.permissions !== undefined) updates.permissions = params.permissions;

  const { data, error } = await supabase
    .from("organization_roles")
    .update(updates)
    .eq("id", params.roleId)
    .select("*")
    .single();

  if (error) throw error;

  await createPlatformAuditLog({
    action: "role_updated",
    targetOrganizationId: data.organization_id,
    metadata: {
      roleId: params.roleId,
      updates,
    },
  });

  return data as OrganizationRole;
}

export async function getOrganizationBranding(
  organizationId: string,
): Promise<OrganizationBranding | null> {
  const { data, error } = await supabase
    .from("organization_branding")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (error) throw error;

  return (data as OrganizationBranding | null) ?? null;
}

export async function updateOrganizationBranding(params: {
  organizationId: string;
  brandName?: string | null;
  logoUrl?: string | null;
  faviconUrl?: string | null;
  loginBackgroundUrl?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  companySlogan?: string | null;
  companyWelcomeText?: string | null;
  dashboardGreetingText?: string | null;
  customTerminology?: JsonRecord;
  invitationTemplate?: string | null;
  onboardingWording?: JsonRecord;
  customDomain?: string | null;
  subdomain?: string | null;
}) {
  const payload = {
    organization_id: params.organizationId,
    brand_name: params.brandName ?? null,
    logo_url: params.logoUrl ?? null,
    favicon_url: params.faviconUrl ?? null,
    login_background_url: params.loginBackgroundUrl ?? null,
    primary_color: params.primaryColor ?? "#000000",
    secondary_color: params.secondaryColor ?? "#ffffff",
    accent_color: params.accentColor ?? "#f97316",
    company_slogan: params.companySlogan ?? null,
    company_welcome_text: params.companyWelcomeText ?? null,
    dashboard_greeting_text: params.dashboardGreetingText ?? null,
    custom_terminology: params.customTerminology ?? {},
    invitation_template: params.invitationTemplate ?? null,
    onboarding_wording: params.onboardingWording ?? {},
    custom_domain: params.customDomain ?? null,
    subdomain: params.subdomain ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("organization_branding")
    .upsert(payload, {
      onConflict: "organization_id",
    })
    .select("*")
    .single();

  if (error) throw error;

  await createPlatformAuditLog({
    action: "branding_updated",
    targetOrganizationId: params.organizationId,
    metadata: payload,
  });

  return data as OrganizationBranding;
}

export async function getOrganizationInvitations(
  organizationId: string,
): Promise<OrganizationInvitation[]> {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as OrganizationInvitation[];
}

export async function createOrganizationInvitation(params: {
  organizationId: string;
  email: string;
  fullName?: string | null;
  roleKey?: string;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("organization_invitations")
    .upsert(
      {
        organization_id: params.organizationId,
        email: params.email.trim().toLowerCase(),
        full_name: params.fullName ?? null,
        role_key: params.roleKey ?? "admin",
        invited_by: user?.id ?? null,
        status: "pending",
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
      },
      {
        onConflict: "organization_id,email",
      },
    )
    .select("*")
    .single();

  if (error) throw error;

  await createPlatformAuditLog({
    action: "invitation_created",
    targetOrganizationId: params.organizationId,
    metadata: {
      email: params.email,
      roleKey: params.roleKey ?? "admin",
    },
  });

  return data as OrganizationInvitation;
}

async function safeCount(table: string, filters: Record<string, unknown> = {}) {
  try {
    let query = supabase.from(table).select("id", {
      count: "exact",
      head: true,
    });

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value as never);
    });

    const { count, error } = await query;

    if (error) {
      console.warn(`COUNT ${table} ERROR:`, error.message);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.warn(`COUNT ${table} FAILED:`, err);
    return 0;
  }
}

async function safeRecentCount(table: string, filters: Record<string, unknown> = {}, since?: string) {
  try {
    let query = supabase.from(table).select("id", {
      count: "exact",
      head: true,
    });

    Object.entries(filters).forEach(([key, value]) => {
      query = query.eq(key, value as never);
    });

    if (since) query = query.gte("created_at", since);

    const { count, error } = await query;

    if (error) {
      console.warn(`RECENT COUNT ${table} ERROR:`, error.message);
      return 0;
    }

    return count ?? 0;
  } catch (err) {
    console.warn(`RECENT COUNT ${table} FAILED:`, err);
    return 0;
  }
}

export async function getOrganizationAnalytics(
  organizationId: string,
): Promise<OrganizationAnalytics> {
  const oneHourAgo = new Date(Date.now() - 1000 * 60 * 60).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();

  const [
    usersCount,
    activeUsers,
    onlineUsers,
    departmentsResult,
    meetingsUsage,
    activeMeetings,
    aiUsage,
    automationUsage,
    failedAutomations,
    attendanceSessions,
    timesheetEntries,
    tasksTotal,
    tasksCompleted,
    recentActivity,
  ] = await Promise.all([
    safeCount("profiles", { organization_id: organizationId }),
    safeCount("profiles", { organization_id: organizationId, is_active: true }),
    safeRecentCount("profiles", { organization_id: organizationId }, oneHourAgo),
    supabase
      .from("organization_roles")
      .select("department")
      .eq("organization_id", organizationId),
    safeRecentCount("meetings", { organization_id: organizationId }, sevenDaysAgo),
    safeCount("meetings", { organization_id: organizationId, status: "live" }),
    safeRecentCount("ai_activity_logs", { organization_id: organizationId }, sevenDaysAgo),
    safeRecentCount("automation_runs", { organization_id: organizationId }, sevenDaysAgo),
    safeCount("automation_runs", { organization_id: organizationId, status: "failed" }),
    safeRecentCount("attendance_sessions", { organization_id: organizationId }, sevenDaysAgo),
    safeRecentCount("time_entries", { organization_id: organizationId }, sevenDaysAgo),
    safeCount("tasks", { organization_id: organizationId }),
    safeCount("tasks", { organization_id: organizationId, status: "done" }),
    getPlatformAuditLogs({ organizationId, limit: 12 }),
  ]);

  const departments = new Set(
    ((departmentsResult.data ?? []) as Array<{ department: string | null }>)
      .map((item) => item.department)
      .filter(Boolean),
  ).size;

  const taskCompletionRate =
    tasksTotal > 0 ? Math.round((tasksCompleted / tasksTotal) * 100) : 0;

  return {
    usersCount,
    activeUsers,
    onlineUsers,
    departments,
    meetingsUsage,
    activeMeetings,
    aiUsage,
    automationUsage,
    failedAutomations,
    attendanceSessions,
    timesheetEntries,
    tasksTotal,
    tasksCompleted,
    taskCompletionRate,
    recentActivity,
  };
}

function healthFromFailures(failures: number): "healthy" | "warning" | "critical" {
  if (failures >= 10) return "critical";
  if (failures > 0) return "warning";
  return "healthy";
}

export async function getOperationsCenterMetrics(): Promise<OperationsCenterMetrics> {
  const organizations = await getOrganizations();
  const oneHourAgo = new Date(Date.now() - 1000 * 60 * 60).toISOString();
  const sevenDaysAgo = new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString();

  const [
    totalActiveUsers,
    usersOnlineNow,
    activeMeetings,
    aiRequests,
    automationExecutions,
    failedAutomations,
    notificationFailures,
    attendanceSummaries,
    incidents,
    edgeFunctionFailures,
    meetingFailures,
    workflowFailures,
    tasksTotal,
    tasksDone,
  ] = await Promise.all([
    safeCount("profiles", { is_active: true }),
    safeRecentCount("profiles", {}, oneHourAgo),
    safeCount("meetings", { status: "live" }),
    safeRecentCount("ai_activity_logs", {}, sevenDaysAgo),
    safeRecentCount("automation_runs", {}, sevenDaysAgo),
    safeCount("automation_runs", { status: "failed" }),
    safeCount("notification_deliveries", { status: "failed" }),
    safeRecentCount("attendance_daily_status", {}, sevenDaysAgo),
    safeCount("incidents", { status: "open" }),
    safeCount("system_events", { severity: "error" }),
    safeCount("meetings", { status: "failed" }),
    safeCount("workflow_execution_logs", { status: "failed" }),
    safeCount("tasks"),
    safeCount("tasks", { status: "done" }),
  ]);

  const taskCompletionRate =
    tasksTotal > 0 ? Math.round((tasksDone / tasksTotal) * 100) : 0;

  return {
    totalOrganizations: organizations.length,
    activeOrganizations: organizations.filter(
      (org) => org.access_status === "active" && org.is_active,
    ).length,
    suspendedOrganizations: organizations.filter(
      (org) => org.access_status === "suspended" || !org.is_active,
    ).length,
    totalActiveUsers,
    usersOnlineNow,
    activeMeetings,
    aiRequests,
    automationExecutions,
    failedAutomations,
    realtimeSystemHealth: healthFromFailures(edgeFunctionFailures + meetingFailures),
    notificationHealth: healthFromFailures(notificationFailures),
    storageUsage: 0,
    taskCompletionRate,
    attendanceSummaries,
    incidents,
    edgeFunctionFailures,
    meetingFailures,
    workflowFailures,
  };
}

export async function getPlatformAuditLogs(params?: {
  organizationId?: string;
  limit?: number;
}): Promise<PlatformAuditLog[]> {
  let query = supabase
    .from("platform_audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(params?.limit ?? 50);

  if (params?.organizationId) {
    query = query.eq("target_organization_id", params.organizationId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? []) as PlatformAuditLog[];
}

export async function createPlatformAuditLog(params: {
  action: string;
  targetOrganizationId?: string;
  targetUserId?: string;
  reason?: string;
  metadata?: JsonRecord;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("platform_audit_logs").insert({
    actor_user_id: user?.id ?? null,
    target_organization_id: params.targetOrganizationId ?? null,
    target_user_id: params.targetUserId ?? null,
    action: params.action,
    reason: params.reason ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.warn("PLATFORM AUDIT LOG ERROR:", error.message);
  }
}
