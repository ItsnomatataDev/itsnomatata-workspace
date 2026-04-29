import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";

type AppRole =
  | "admin"
  | "manager"
  | "it"
  | "social_media"
  | "media_team"
  | "seo_specialist";

export type AccountStatus =
  | "pending"
  | "active"
  | "suspended"
  | "rejected"
  | "deleted";

type AuthProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  organization_id?: string | null;
  primary_role?: AppRole | null;
  account_status?: AccountStatus | null;
  is_active?: boolean | null;
  is_suspended?: boolean | null;
  last_seen_at?: string | null;
  organization?: Record<string, unknown> | null;
  [key: string]: unknown;
};

export type AuthContextType = {
  user: User | null;
  profile: AuthProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

const ORGANIZATION_SLUG = "its-nomatata";

function isValidRole(value: unknown): value is AppRole {
  return [
    "admin",
    "manager",
    "it",
    "social_media",
    "media_team",
    "seo_specialist",
  ].includes(String(value));
}

function resolveUserRole(
  user: User | null,
  profile?: AuthProfile | null,
): AppRole {
  const metadataRole = user?.user_metadata?.role;
  const profileRole = profile?.primary_role;

  if (isValidRole(metadataRole)) return metadataRole;
  if (isValidRole(profileRole)) return profileRole;

  return "social_media";
}

function isCompanyEmail(email?: string | null) {
  return Boolean(email?.trim().toLowerCase().endsWith("@itsnomatata.com"));
}

function resolveAccountStatus(user: User, profile?: AuthProfile | null) {
  if (isCompanyEmail(user.email) && profile?.account_status === "pending") {
    return "active";
  }
  if (profile?.account_status) return profile.account_status;
  if (profile?.is_suspended) return "suspended";
  if (profile?.is_active) return "active";
  return isCompanyEmail(user.email) ? "active" : "pending";
}

async function getOrganization() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", ORGANIZATION_SLUG)
    .single();

  if (error) {
    console.error("GET ORGANIZATION ERROR:", error);
    throw error;
  }

  if (!data) {
    throw new Error(
      `Organization with slug "${ORGANIZATION_SLUG}" was not found.`,
    );
  }

  return data;
}

async function touchUserPresence(user: User | null) {
  if (!user?.id) return;

  const { error } = await supabase
    .from("profiles")
    .update({
      last_seen_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("TOUCH USER PRESENCE ERROR:", error);
  }
}

async function ensureProfile(user: User | null): Promise<AuthProfile | null> {
  if (!user?.id) return null;

  const organization = await getOrganization();
  const organizationId =
    user.user_metadata?.organization_id ?? organization?.id ?? null;

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) {
    console.error("ENSURE PROFILE SELECT ERROR:", selectError);
    throw selectError;
  }

  const resolvedRole = resolveUserRole(
    user,
    (existing as AuthProfile | null) ?? null,
  );

  const payload = {
    id: user.id,
    email: user.email ?? existing?.email ?? null,
    full_name: user.user_metadata?.full_name ?? existing?.full_name ?? null,
    organization_id: existing?.organization_id ?? organizationId,
    primary_role: resolvedRole,
    account_status: resolveAccountStatus(
      user,
      (existing as AuthProfile | null) ?? null,
    ),
    is_active:
      resolveAccountStatus(user, (existing as AuthProfile | null) ?? null) ===
      "active",
    is_suspended:
      resolveAccountStatus(user, (existing as AuthProfile | null) ?? null) ===
      "suspended",
    last_seen_at:
      resolveAccountStatus(user, (existing as AuthProfile | null) ?? null) ===
      "active"
        ? new Date().toISOString()
        : existing?.last_seen_at ?? null,
  };

  if (!existing) {
    const { error: insertError } = await supabase
      .from("profiles")
      .insert(payload);

    if (insertError) {
      console.error("ENSURE PROFILE INSERT ERROR:", insertError);
      throw insertError;
    }
  } else {
    const { error: updateError } = await supabase
      .from("profiles")
      .update(payload)
      .eq("id", user.id);

    if (updateError) {
      console.error("ENSURE PROFILE UPDATE ERROR:", updateError);
      throw updateError;
    }
  }

  const { data: refreshed, error: refreshedError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (refreshedError) {
    console.error("ENSURE PROFILE REFRESH ERROR:", refreshedError);
    throw refreshedError;
  }

  return (refreshed as AuthProfile | null) ?? null;
}

async function ensureOrganizationMembership(
  user: User | null,
  profile: AuthProfile | null,
) {
  if (!user?.id || !profile?.organization_id) return null;
  if (profile.account_status !== "active" || profile.is_suspended) return null;

  const resolvedRole = resolveUserRole(user, profile);

  const { error } = await supabase.from("organization_members").upsert(
    {
      organization_id: profile.organization_id,
      user_id: user.id,
      role: resolvedRole,
      status: "active",
      joined_at: new Date().toISOString(),
    },
    {
      onConflict: "organization_id,user_id",
    },
  );

  if (error) {
    console.error("ENSURE ORG MEMBERSHIP ERROR:", error);
    throw error;
  }

  return true;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          `
          *,
          organization:organizations(*)
        `,
        )
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("PROFILE FETCH ERROR:", error);
        setProfile(null);
        return null;
      }

      const nextProfile = (data as AuthProfile | null) ?? null;
      setProfile(nextProfile);
      return nextProfile;
    } catch (err) {
      console.error("PROFILE FETCH CRASH:", err);
      setProfile(null);
      return null;
    }
  };

  const loadAuthenticatedUser = async (sessionUser: User | null) => {
    setUser(sessionUser);

    if (!sessionUser) {
      setProfile(null);
      return;
    }

    const ensuredProfile = await ensureProfile(sessionUser);
    await ensureOrganizationMembership(sessionUser, ensuredProfile);
    await touchUserPresence(sessionUser);
    await fetchProfile(sessionUser.id);
  };

  const refreshProfile = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        const ensuredProfile = await ensureProfile(session.user);
        await ensureOrganizationMembership(session.user, ensuredProfile);
        await touchUserPresence(session.user);
        await fetchProfile(session.user.id);
      } else {
        setUser(null);
        setProfile(null);
      }
    } catch (err) {
      console.error("REFRESH PROFILE ERROR:", err);
    }
  };

  useEffect(() => {
    let mounted = true;
    let presenceInterval: ReturnType<typeof setInterval> | null = null;

    const initialize = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.error("GET SESSION ERROR:", error);
        }

        if (!mounted) return;

        await loadAuthenticatedUser(session?.user ?? null);

        if (session?.user) {
          presenceInterval = setInterval(() => {
            void touchUserPresence(session.user);
          }, 60000);
        }
      } catch (err) {
        console.error("AUTH INITIALIZE ERROR:", err);
        if (mounted) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null;

      if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
      }

      void (async () => {
        if (!mounted) return;

        try {
          setLoading(true);

          if (event === "SIGNED_OUT") {
            setUser(null);
            setProfile(null);
            return;
          }

          await loadAuthenticatedUser(sessionUser);

          if (sessionUser) {
            presenceInterval = setInterval(() => {
              void touchUserPresence(sessionUser);
            }, 60000);
          }
        } catch (err) {
          console.error("AUTH STATE CHANGE ERROR:", err);
          if (mounted) {
            setUser(sessionUser);
            setProfile(null);
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      })();
    });

    return () => {
      mounted = false;
      if (presenceInterval) clearInterval(presenceInterval);
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      loading,
      refreshProfile,
    }),
    [user, profile, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
