import { supabase } from "./client";

const ORGANIZATION_SLUG = "its-nomatata";

export type AppRole =
  | "admin"
  | "manager"
  | "it"
  | "social_media"
  | "media_team"
  | "seo_specialist";

type SignUpUserParams = {
  email: string;
  password: string;
  fullName: string;
  role: AppRole;
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

export async function signUpUser(params: SignUpUserParams) {
  if (authRequestInFlight) {
    throw new Error("An authentication request is already in progress.");
  }

  authRequestInFlight = true;

  try {
    const email = normalizeEmail(params.email);

    const organization = await getOrganizationBySlug(ORGANIZATION_SLUG);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: params.password,
      options: {
        data: {
          full_name: params.fullName,
          role: params.role,
          organization_slug: ORGANIZATION_SLUG,
          organization_id: organization?.id ?? null,
        },
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
      workspace: {
        organizationFound: Boolean(organization),
        organization,
      },
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
