import { supabase } from "./client";

interface SignUpUserParams {
  email: string;
  password: string;
  fullName: string;
  role: string;
}

interface LoginUserParams {
  email: string;
  password: string;
}

const ORGANIZATION_SLUG = "its-nomatata";
const DEFAULT_ROLE = "social_media";

async function getOrganizationIdBySlug() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", ORGANIZATION_SLUG)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch organization: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Organization with slug "${ORGANIZATION_SLUG}" not found.`);
  }

  return data.id as string;
}

async function ensureProfileAndMembership({
  userId,
  email,
  fullName,
  role,
}: {
  userId: string;
  email: string;
  fullName: string;
  role?: string | null;
}) {
  const organizationId = await getOrganizationIdBySlug();
  const safeRole = role || DEFAULT_ROLE;

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: fullName,
      primary_role: safeRole,
      organization_id: organizationId,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw new Error(`Profile setup failed: ${profileError.message}`);
  }

  const { error: membershipError } = await supabase
    .from("organization_members")
    .upsert(
      {
        organization_id: organizationId,
        user_id: userId,
        role: safeRole,
        status: "active",
      },
      { onConflict: "organization_id,user_id,role" },
    );

  if (membershipError) {
    throw new Error(`Membership setup failed: ${membershipError.message}`);
  }
}

export const signUpUser = async ({
  email,
  password,
  fullName,
  role,
}: SignUpUserParams) => {
  const safeRole = role || DEFAULT_ROLE;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        primary_role: safeRole,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const user = data.user;
  if (!user) {
    throw new Error("User was not returned after signup.");
  }

  await ensureProfileAndMembership({
    userId: user.id,
    email,
    fullName,
    role: safeRole,
  });

  return {
    user,
    session: data.session,
  };
};

export const loginUser = async ({ email, password }: LoginUserParams) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw new Error(error.message);

  if (!data.user) {
    throw new Error("Login failed. No user returned.");
  }

  const fullName =
    data.user.user_metadata?.full_name ||
    data.user.user_metadata?.name ||
    data.user.email?.split("@")[0] ||
    "User";

  const { data: existingProfile, error: profileCheckError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profileCheckError) {
    throw new Error(`Failed to check profile: ${profileCheckError.message}`);
  }

  await ensureProfileAndMembership({
    userId: data.user.id,
    email: data.user.email || email,
    fullName,
    role: existingProfile?.primary_role || DEFAULT_ROLE,
  });

  return data.user;
};

export const signInWithGoogle = async () => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  });

  if (error) throw new Error(error.message);
};

export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
};
