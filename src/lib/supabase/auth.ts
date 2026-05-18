import { supabase } from "./client";
import { OFFICE_SLUGS, type OfficeSlug } from "../offices";

const ORGANIZATION_SLUG = "its-nomatata";

export type AppRole =
  | "admin"
  | "org_admin"
  | "user"
  | "manager"
  | "it"
  | "social_media"
  | "media_team"
  | "seo_specialist"
  | "finance";

export type PublicSignupRole = string;

type SignUpUserParams = {
  email: string;
  password: string;
  fullName: string;
  role?: PublicSignupRole;
  officeSlug?: OfficeSlug;
  inviteToken?: string | null;
  organizationId?: string | null;
  organizationSlug?: string | null;
};

type SignInUserParams = {
  email: string;
  password: string;
};

type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
};

const ADMIN_PORTAL_ROLES = new Set([
  "admin",
  "org_admin",
  "super_admin",
  "superadmin",
  "it-superadmin",
]);

const SUPER_ADMIN_ALLOWLIST = [
  "ben@itsnomatata.com",
  "thando@itsnomatata.com",
  "tammie@itsnomatata.com",
] as const;

let authRequestInFlight = false;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function isAppRole(value: unknown): value is AppRole {
  return (
    typeof value === "string" &&
    [
      "admin",
      "org_admin",
      "user",
      "manager",
      "it",
      "social_media",
      "media_team",
      "seo_specialist",
      "finance",
    ].includes(value)
  );
}

function isPublicSignupRole(value: unknown): value is PublicSignupRole {
  return (
    typeof value === "string" &&
    value.trim().length > 0
  );
}

function isSuperAdminAllowedEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  return SUPER_ADMIN_ALLOWLIST.includes(
    normalizedEmail as (typeof SUPER_ADMIN_ALLOWLIST)[number],
  );
}

function resolveSignupRole(
  email: string,
  requestedRole?: PublicSignupRole,
): AppRole {
  const normalizedEmail = normalizeEmail(email);

  if (isSuperAdminAllowedEmail(normalizedEmail)) {
    return "admin";
  }

  return requestedRole && isAppRole(requestedRole) ? requestedRole : "user";
}

async function getOrganizationBySlug(
  slug: string,
): Promise<OrganizationRow | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw error;
  return (data ?? null) as OrganizationRow | null;
}

export function getDefaultAuthenticatedPath(role?: string | null) {
  return role && ADMIN_PORTAL_ROLES.has(role) ? "/admin/dashboard" : "/dashboard";
}

async function getInviteRoleForEmail(email: string) {
  const { data, error } = await supabase
    .from("organization_invitations")
    .select("role_key, status")
    .ilike("email", normalizeEmail(email))
    .in("status", ["pending", "accepted"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("POST LOGIN INVITATION ROLE LOOKUP FAILED:", error);
    return null;
  }

  return typeof data?.role_key === "string" ? data.role_key : null;
}

async function getProfileRoleForUser(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("primary_role, organization_role_key")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.warn("POST LOGIN PROFILE ROLE LOOKUP FAILED:", error);
    return null;
  }

  return (
    (typeof data?.primary_role === "string" && data.primary_role) ||
    (typeof data?.organization_role_key === "string" && data.organization_role_key) ||
    null
  );
}

async function getDefaultPathForUser(userId: string, email?: string | null) {
  const inviteRole = email ? await getInviteRoleForEmail(email) : null;
  const profileRole = await getProfileRoleForUser(userId);
  return getDefaultAuthenticatedPath(inviteRole ?? profileRole);
}

export async function signUpUser(params: SignUpUserParams) {
  if (authRequestInFlight) {
    throw new Error("An authentication request is already in progress.");
  }

  authRequestInFlight = true;

  try {
    const email = normalizeEmail(params.email);
    const isCompanyEmail = email.endsWith("@itsnomatata.com");
    const organization = isCompanyEmail
      ? await getOrganizationBySlug(ORGANIZATION_SLUG)
      : params.organizationSlug
        ? await getOrganizationBySlug(params.organizationSlug)
      : null;
    const resolvedRole = resolveSignupRole(email, params.role);
    const officeSlug = params.officeSlug ?? OFFICE_SLUGS.itsNoMatata;

    const initialStatus = isCompanyEmail ? "active" : "pending_approval";
    const metadata: Record<string, unknown> = {
      full_name: params.fullName.trim(),
      role: resolvedRole,
      requested_role_key: params.role ?? resolvedRole,
      account_status: initialStatus,
    };

    if (params.inviteToken) {
      metadata.invite_token = params.inviteToken;
    }

    if (isCompanyEmail) {
      metadata.organization_slug = ORGANIZATION_SLUG;
      metadata.organization_id = organization?.id ?? null;
      metadata.office_slug = officeSlug;
    } else if (params.organizationId || organization?.id) {
      metadata.organization_id = params.organizationId ?? organization?.id ?? null;
      metadata.organization_slug = params.organizationSlug ?? organization?.slug ?? null;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password: params.password,
      options: {
        data: metadata,
      },
    });

    if (error) {
      if (error.message.toLowerCase().includes("email rate limit exceeded")) {
        throw new Error(
          "Too many auth emails were requested. Wait a few minutes, then try again. For development, you can disable email confirmation in Supabase.",
        );
      }

      throw error;
    }

    return {
      ...data,
      defaultPath: data.user
        ? getDefaultAuthenticatedPath(params.role ?? resolvedRole)
        : "/dashboard",
      workspace: {
        organizationFound: Boolean(organization),
        organization,
      },
      approvalRequired: !isCompanyEmail && !params.inviteToken,
    };
  } finally {
    authRequestInFlight = false;
  }
}

export async function signInUser(params: SignInUserParams) {
  if (authRequestInFlight) {
    throw new Error("An authentication request is already in progress.");
  }

  authRequestInFlight = true;

  try {
    const email = normalizeEmail(params.email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: params.password,
    });

    if (error) throw error;

    if (!data.user) {
      throw new Error("Login failed. No user was returned.");
    }

    const organization = await getOrganizationBySlug(ORGANIZATION_SLUG);

    return {
      ...data,
      defaultPath: await getDefaultPathForUser(data.user.id, data.user.email),
      workspace: {
        organizationFound: Boolean(organization),
        organization,
      },
    };
  } finally {
    authRequestInFlight = false;
  }
}

export async function signInWithGoogle() {
  if (authRequestInFlight) {
    throw new Error("An authentication request is already in progress.");
  }

  authRequestInFlight = true;

  try {
    const organization = await getOrganizationBySlug(ORGANIZATION_SLUG);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        queryParams: {
          prompt: "select_account",
        },
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });

    if (error) throw error;

    return {
      ...data,
      workspace: {
        organizationFound: Boolean(organization),
        organization,
      },
    };
  } finally {
    authRequestInFlight = false;
  }
}

export async function signOutUser() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function logoutUser() {
  return signOutUser();
}

export async function loginUser(params: SignInUserParams) {
  return signInUser(params);
}

export async function getCurrentSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user;
}

export async function getWorkspaceOrganization() {
  return getOrganizationBySlug(ORGANIZATION_SLUG);
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://codex.itsnomatata.com/resetpassword",
  });

  if (error) throw error;
}
