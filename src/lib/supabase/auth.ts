import { supabase } from "./client";
import { OFFICE_SLUGS, type OfficeSlug } from "../offices";
import { getCurrentHostname, resolveOrganizationByHost } from "../organization/organizationResolution";

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

let authRequestInFlight = false;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
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
    const hostOrganization = await resolveOrganizationByHost();
    const organization = params.organizationSlug
      ? await getOrganizationBySlug(params.organizationSlug)
      : hostOrganization
        ? {
            id: hostOrganization.id,
            name: hostOrganization.name,
            slug: hostOrganization.slug,
          }
        : null;
    const officeSlug = params.officeSlug ?? OFFICE_SLUGS.itsNoMatata;
    const metadata: Record<string, unknown> = {
      full_name: params.fullName.trim(),
      account_status: "pending_approval",
    };

    if (params.inviteToken) {
      metadata.invite_token = params.inviteToken;
    }

    if (officeSlug) {
      metadata.office_slug = officeSlug;
    }

    if (organization?.slug) {
      metadata.organization_slug_hint = organization.slug;
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

    const isTrustedCompanyAccount =
      email.endsWith("@itsnomatata.com") && organization?.slug === "its-nomatata";

    return {
      ...data,
      defaultPath: data.user
        ? getDefaultAuthenticatedPath("user")
        : "/dashboard",
      workspace: {
        organizationFound: Boolean(organization),
        organization,
      },
      approvalRequired: !params.inviteToken && !isTrustedCompanyAccount,
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

    const organization = await resolveOrganizationByHost(getCurrentHostname());

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
    const organization = await resolveOrganizationByHost(getCurrentHostname());

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
  return resolveOrganizationByHost(getCurrentHostname());
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: "https://codex.itsnomatata.com/resetpassword",
  });

  if (error) throw error;
}
