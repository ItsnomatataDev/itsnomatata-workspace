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
type OrganizationBrandingInput = {
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
  dnsTarget?: string | null;
  domainError?: string | null;
};

const SYSTEM_ORGANIZATION_SLUG = "its-nomatata";
const PROFILE_COMPATIBLE_ROLES = new Set([
  "admin",
  "org_admin",
  "user",
  "manager",
  "it",
  "social_media",
  "media_team",
  "seo_specialist",
  "superadmin",
  "it-superadmin",
  "super_admin",
]);

function toProfileCompatibleRole(roleKey: string) {
  return PROFILE_COMPATIBLE_ROLES.has(roleKey) ? roleKey : "user";
}

export type OrganizationSignupRoleOption = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role_key: string;
  role_label: string;
  is_default_signup_role: boolean;
};

export async function getOrganizationSignupRoles(params: {
  organizationId?: string | null;
  organizationSlug?: string | null;
}): Promise<OrganizationSignupRoleOption[]> {
  const { data, error } = await supabase.rpc("get_organization_signup_roles", {
    target_organization_id: params.organizationId ?? null,
    target_organization_slug: params.organizationSlug ?? null,
  });

  if (error) throw error;
  return (data ?? []) as OrganizationSignupRoleOption[];
}

function getSupabaseErrorMessage(error: unknown, fallback = "Supabase request failed.") {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.details ?? record.hint ?? record.code;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

async function runSetupStep(label: string, action: () => Promise<void>) {
  try {
    await action();
  } catch (error) {
    throw new Error(`${label}: ${getSupabaseErrorMessage(error)}`);
  }
}

export const DEFAULT_FEATURES = [
  { key: "admin_dashboard", label: "Admin Dashboard", category: "Admin" },
  { key: "admin_users", label: "Admin Users", category: "Admin" },
  { key: "admin_leave", label: "Admin Leave", category: "Admin" },
  { key: "admin_roster", label: "Admin Roster", category: "Admin" },
  { key: "meetings", label: "Meetings", category: "Collaboration" },
  { key: "ai_workspace", label: "AI Workspace", category: "Intelligence" },
  { key: "ai_agent", label: "AI Agent", category: "Intelligence" },
  { key: "fleet", label: "Fleet", category: "Assets" },
  { key: "stock", label: "Stock", category: "Assets" },
  { key: "assets", label: "Assets", category: "Assets" },
  { key: "finance", label: "Finance", category: "Finance" },
  { key: "attendance", label: "Attendance", category: "HR" },
  { key: "timesheets", label: "Timesheets", category: "HR" },
  { key: "leave_requests", label: "Leave Requests", category: "HR" },
  { key: "duty_roster", label: "Duty Roster", category: "HR" },
  { key: "media_dashboard", label: "Media Dashboard", category: "Media" },
  { key: "social_media", label: "Social Media", category: "Media" },
  { key: "automation", label: "Automation", category: "Operations" },
  { key: "notifications", label: "Notifications", category: "Operations" },
  { key: "boards", label: "Boards", category: "Work Management" },
  { key: "tasks", label: "Tasks", category: "Work Management" },
  { key: "chat", label: "Chat", category: "Collaboration" },
  { key: "reports", label: "Reports", category: "Analytics" },
  { key: "clients", label: "Clients", category: "CRM" },
  { key: "invoices", label: "Invoices", category: "Finance" },
  { key: "expenses", label: "Expenses", category: "Finance" },
  { key: "budgets", label: "Budgets", category: "Finance" },
  { key: "knowledge_base", label: "Knowledge Base", category: "Knowledge" },
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

  if (error) {
    throw new Error(`organization row: ${getSupabaseErrorMessage(error)}`);
  }
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
  subdomain?: string | null;
  customDomain?: string | null;
  adminEmail?: string | null;
  adminFullName?: string | null;
  adminRole?: string;
  branding?: OrganizationBrandingInput;
  enabledFeatureKeys?: string[];
}): Promise<OrganizationRow> {
  await assertDomainAvailable({
    subdomain: params.subdomain,
    customDomain: params.customDomain,
  });

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

  await runSetupStep("default subscription", () =>
    createDefaultSubscription(organizationId),
  );
  await runSetupStep("default branding", () =>
    createDefaultBranding(organizationId, params.name, {
      ...params.branding,
      subdomain: params.subdomain,
      customDomain: params.customDomain,
    }),
  );
  await runSetupStep("default features", () =>
    createDefaultFeatures(organizationId),
  );
  await runSetupStep("default roles", () => createDefaultRoles(organizationId));

  if (params.enabledFeatureKeys) {
    const enabledSet = new Set(params.enabledFeatureKeys);
    let featureQuery = supabase
      .from("organization_features")
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq("organization_id", organizationId);

    if (enabledSet.size > 0) {
      featureQuery = featureQuery.not(
        "feature_key",
        "in",
        `(${[...enabledSet].map((key) => `"${key}"`).join(",")})`,
      );
    }

    const { error: featureError } = await featureQuery;

    if (featureError) {
      throw new Error(`feature selection: ${getSupabaseErrorMessage(featureError)}`);
    }
  }

  const adminEmail = params.adminEmail?.trim();

  if (adminEmail) {
    await runSetupStep("first admin invitation", async () => {
      await createOrganizationInvitation({
        organizationId,
        email: adminEmail,
        fullName: params.adminFullName ?? null,
        roleKey: params.adminRole ?? "admin",
      });
    });
  }

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

function normalizeNullableText(value?: string | null) {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

function shouldRetryBrandingWithoutDomainMetadata(error: unknown) {
  const message = getSupabaseErrorMessage(error, "").toLowerCase();
  return [
    "domain_status",
    "domain_verification_token",
    "dns_target",
    "domain_error",
    "schema cache",
  ].some((term) => message.includes(term));
}

function removeDomainMetadataColumns<T extends Record<string, unknown>>(payload: T) {
  const {
    domain_status: _domainStatus,
    domain_verification_token: _domainVerificationToken,
    dns_target: _dnsTarget,
    domain_error: _domainError,
    ...safePayload
  } = payload;

  return safePayload;
}

async function upsertOrganizationBrandingPayload(
  payload: Record<string, unknown>,
  options: { returnRow?: boolean } = {},
): Promise<OrganizationBranding | undefined> {
  const runUpsert = async (nextPayload: Record<string, unknown>) => {
    const request = supabase
      .from("organization_branding")
      .upsert(nextPayload, {
        onConflict: "organization_id",
      });

    if (options.returnRow) {
      return request.select("*").single();
    }

    return request;
  };

  const result = await runUpsert(payload);
  if (!result.error) {
    return options.returnRow
      ? (result.data as OrganizationBranding)
      : undefined;
  }

  if (!shouldRetryBrandingWithoutDomainMetadata(result.error)) {
    throw result.error;
  }

  console.warn("BRANDING UPSERT RETRY WITHOUT DOMAIN METADATA:", result.error);
  const retryResult = await runUpsert(removeDomainMetadataColumns(payload));
  if (retryResult.error) throw retryResult.error;

  if (options.returnRow) return retryResult.data as OrganizationBranding;
  return undefined;
}

async function assertDomainAvailable(params: {
  organizationId?: string;
  subdomain?: string | null;
  customDomain?: string | null;
}) {
  const subdomain = normalizeNullableText(params.subdomain);
  const customDomain = normalizeNullableText(params.customDomain);

  if (!subdomain && !customDomain) return;

  if (subdomain) {
    const { data, error } = await supabase
      .from("organization_branding")
      .select("organization_id")
      .ilike("subdomain", subdomain)
      .maybeSingle();

    if (error) throw error;
    if (data && data.organization_id !== params.organizationId) {
      throw new Error("This subdomain is already assigned to another organization.");
    }
  }

  if (customDomain) {
    const { data, error } = await supabase
      .from("organization_branding")
      .select("organization_id")
      .ilike("custom_domain", customDomain)
      .maybeSingle();

    if (error) throw error;
    if (data && data.organization_id !== params.organizationId) {
      throw new Error("This custom domain is already assigned to another organization.");
    }
  }
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

async function createDefaultBranding(
  organizationId: string,
  brandName: string,
  branding: OrganizationBrandingInput & {
    subdomain?: string | null;
    customDomain?: string | null;
  } = {},
) {
  const normalizedCustomDomain = normalizeNullableText(branding.customDomain);
  const normalizedSubdomain = normalizeNullableText(branding.subdomain);

  await upsertOrganizationBrandingPayload({
    organization_id: organizationId,
    brand_name: branding.brandName ?? brandName,
    logo_url: branding.logoUrl ?? null,
    favicon_url: branding.faviconUrl ?? null,
    login_background_url: branding.loginBackgroundUrl ?? null,
    primary_color: branding.primaryColor ?? "#000000",
    secondary_color: branding.secondaryColor ?? "#ffffff",
    accent_color: branding.accentColor ?? "#f97316",
    company_slogan:
      branding.companySlogan ?? "Enterprise operations without friction.",
    company_welcome_text:
      branding.companyWelcomeText ?? `Welcome to ${brandName}.`,
    dashboard_greeting_text:
      branding.dashboardGreetingText ?? "Here is what needs attention today.",
    custom_terminology: branding.customTerminology ?? {},
    invitation_template: branding.invitationTemplate ?? null,
    onboarding_wording: branding.onboardingWording ?? {},
    custom_domain: normalizedCustomDomain,
    subdomain: normalizedSubdomain,
    domain_status: normalizedCustomDomain || normalizedSubdomain ? "pending" : null,
    domain_verification_token:
      normalizedCustomDomain || normalizedSubdomain ? crypto.randomUUID() : null,
    dns_target: branding.dnsTarget ?? "cname.itsnomatata.com",
    domain_error: branding.domainError ?? null,
  });
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

async function ensureOrganizationFeatures(organizationId: string) {
  await createDefaultFeatures(organizationId);
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

export async function deleteOrganization(organizationId: string) {
  await assertSystemOrganizationMayChange(organizationId, "deleted");

  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", organizationId)
    .eq("is_system_organization", false);

  if (error) throw error;

  await createPlatformAuditLog({
    action: "organization_deleted",
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
  if (await checkIsPlatformAdmin()) {
    await ensureOrganizationFeatures(organizationId);
  }

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
  onboardingConfig?: JsonRecord;
  departmentAccess?: JsonRecord;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const roleKey = params.roleKey.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

  if (!roleKey) throw new Error("Role key is required.");

  if (params.isDefaultSignupRole) {
    const { error: defaultError } = await supabase
      .from("organization_roles")
      .update({
        is_default_signup_role: false,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("organization_id", params.organizationId);

    if (defaultError) throw defaultError;
  }

  const { data, error } = await supabase
    .from("organization_roles")
    .insert({
      organization_id: params.organizationId,
      role_key: roleKey,
      role_label: params.roleLabel,
      department: params.department ?? null,
      description: params.description ?? null,
      is_admin_role: params.isAdminRole ?? false,
      is_manager_role: params.isManagerRole ?? false,
      is_default_signup_role: params.isDefaultSignupRole ?? false,
      requires_approval: params.requiresApproval ?? true,
      is_active: true,
      permissions: params.permissions ?? {},
      onboarding_config: params.onboardingConfig ?? {},
      department_access: params.departmentAccess ?? {},
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    })
    .select("*")
    .single();

  if (error) throw error;

  await createPlatformAuditLog({
    action: "role_created",
    targetOrganizationId: params.organizationId,
    metadata: {
      roleKey,
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
  onboardingConfig?: JsonRecord;
  departmentAccess?: JsonRecord;
}) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    updated_by: user?.id ?? null,
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
  if (params.onboardingConfig !== undefined) {
    updates.onboarding_config = params.onboardingConfig;
  }
  if (params.departmentAccess !== undefined) {
    updates.department_access = params.departmentAccess;
  }

  if (params.isDefaultSignupRole) {
    const { data: currentRole, error: currentRoleError } = await supabase
      .from("organization_roles")
      .select("organization_id")
      .eq("id", params.roleId)
      .single();

    if (currentRoleError) throw currentRoleError;

    const { error: defaultError } = await supabase
      .from("organization_roles")
      .update({
        is_default_signup_role: false,
        updated_at: new Date().toISOString(),
        updated_by: user?.id ?? null,
      })
      .eq("organization_id", currentRole.organization_id);

    if (defaultError) throw defaultError;
  }

  const { data, error } = await supabase
    .from("organization_roles")
    .update(updates)
    .eq("id", params.roleId)
    .select("*")
    .single();

  if (error) throw error;

  const roleAction =
    params.isActive === false
      ? "role_disabled"
      : params.isActive === true
        ? "role_enabled"
        : params.permissions !== undefined
          ? "role_permission_changed"
          : "role_updated";

  await createPlatformAuditLog({
    action: roleAction,
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
  if (data) return data as OrganizationBranding;

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .maybeSingle();

  if (organizationError) throw organizationError;

  await createDefaultBranding(
    organizationId,
    organization?.name ?? "ITsNomatata",
  );

  const { data: created, error: createdError } = await supabase
    .from("organization_branding")
    .select("*")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (createdError) throw createdError;

  return (created as OrganizationBranding | null) ?? null;
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
  dnsTarget?: string | null;
  domainError?: string | null;
}) {
  await assertDomainAvailable({
    organizationId: params.organizationId,
    subdomain: params.subdomain,
    customDomain: params.customDomain,
  });

  const normalizedCustomDomain = normalizeNullableText(params.customDomain);
  const normalizedSubdomain = normalizeNullableText(params.subdomain);

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
    custom_domain: normalizedCustomDomain,
    subdomain: normalizedSubdomain,
    domain_status: normalizedCustomDomain || normalizedSubdomain ? "pending" : null,
    domain_verification_token:
      normalizedCustomDomain || normalizedSubdomain ? crypto.randomUUID() : null,
    dns_target: params.dnsTarget ?? "cname.itsnomatata.com",
    domain_error: params.domainError ?? null,
    updated_at: new Date().toISOString(),
  };

  const data = await upsertOrganizationBrandingPayload(payload, {
    returnRow: true,
  });
  if (!data) throw new Error("Branding saved but no row was returned by Supabase.");

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

  const normalizedEmail = params.email.trim().toLowerCase();
  const roleKey = params.roleKey ?? "admin";
  const profileRole = toProfileCompatibleRole(roleKey);
  const tokenHash = crypto.randomUUID();

  const { data, error } = await supabase
    .from("organization_invitations")
    .upsert(
      {
        organization_id: params.organizationId,
        email: normalizedEmail,
        full_name: params.fullName ?? null,
        role_key: roleKey,
        invited_by: user?.id ?? null,
        status: "pending",
        token_hash: tokenHash,
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14).toISOString(),
        accepted_by: null,
        accepted_at: null,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id,email",
      },
    )
    .select("*")
    .single();

  if (error) throw error;

  const { data: matchingProfiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, organization_id")
    .ilike("email", normalizedEmail);

  if (profileError) throw profileError;

  if ((matchingProfiles ?? []).length > 1) {
    throw new Error("Multiple profiles were found for this email. Clean up duplicate profile rows first.");
  }

  const matchingProfile = matchingProfiles?.[0];

  if (matchingProfile?.id) {
    const { error: memberError } = await supabase.from("organization_members").upsert(
      {
        organization_id: params.organizationId,
        user_id: matchingProfile.id,
        role: roleKey,
        status: "active",
        invited_by: user?.id ?? null,
        joined_at: new Date().toISOString(),
      },
      {
        onConflict: "organization_id,user_id",
      },
    );

    if (memberError) throw memberError;

    const { error: profileUpdateError } = await supabase
      .from("profiles")
      .update({
        organization_id: params.organizationId,
        full_name: matchingProfile.full_name ?? params.fullName ?? null,
        primary_role: profileRole,
        organization_role_key: roleKey,
        account_status: "active",
        is_active: true,
        is_suspended: false,
      })
      .eq("id", matchingProfile.id);

    if (profileUpdateError) throw profileUpdateError;

    const { error: acceptError } = await supabase
      .from("organization_invitations")
      .update({
        status: "accepted",
        accepted_by: matchingProfile.id,
        accepted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);

    if (acceptError) throw acceptError;

    await createPlatformAuditLog({
      action: "organization_admin_assigned",
      targetOrganizationId: params.organizationId,
      targetUserId: matchingProfile.id,
      metadata: {
        email: normalizedEmail,
        roleKey,
      },
    });
  }

  await createPlatformAuditLog({
    action: matchingProfile?.id ? "invitation_accepted_existing_profile" : "invitation_created",
    targetOrganizationId: params.organizationId,
    metadata: {
      email: normalizedEmail,
      roleKey,
      inviteLink:
        typeof window !== "undefined"
          ? `${window.location.origin}/invite/${data.token_hash}`
          : `/invite/${data.token_hash}`,
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
