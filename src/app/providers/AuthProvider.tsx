import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabase/client";
import { OFFICE_SLUGS } from "../../lib/offices";
import { resolveCompanyOfficeId } from "../../lib/supabase/queries/offices";

type AppRole =
  | "admin"
  | "superadmin"
  | "it-superadmin"
  | "manager"
  | "hr"
  | "it"
  | "social_media"
  | "media_team"
  | "seo_specialist";

export type AccountStatus =
  | "pending"
  | "pending_approval"
  | "active"
  | "suspended"
  | "rejected"
  | "deleted";

type AuthProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  organization_id?: string | null;
  office_id?: string | null;
  primary_role?: AppRole | null;
  account_status?: AccountStatus | null;
  is_active?: boolean | null;
  is_suspended?: boolean | null;
  last_seen_at?: string | null;
  organization?: Record<string, unknown> | null;
  office?: {
    id: string;
    name: string;
    slug: string;
    is_primary: boolean;
  } | null;
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
    "hr",
    "it",
    "social_media",
    "media_team",
    "seo_specialist",
  ].includes(String(value));
}

function isCompanyEmail(email?: string | null) {
  return Boolean(email?.trim().toLowerCase().endsWith("@itsnomatata.com"));
}


function resolveUserRole(
  user: User | null,
  profile?: AuthProfile | null,
): AppRole {
  const profileRole = profile?.primary_role;
  const appMetadataRole =
    user?.app_metadata?.primary_role ?? user?.app_metadata?.role;
  const userMetadataRole = user?.user_metadata?.role;

  if (isValidRole(profileRole)) return profileRole;
  if (isValidRole(appMetadataRole)) return appMetadataRole;
  if (isValidRole(userMetadataRole)) return userMetadataRole;

  return "social_media";
}

function resolveAccountStatus(user: User, profile?: AuthProfile | null) {
  if (isCompanyEmail(user.email) && (profile?.account_status === "pending" || profile?.account_status === "pending_approval")) {
    return "active";
  }

  if (profile?.account_status) return profile.account_status;
  if (profile?.is_suspended) return "suspended";
  if (profile?.is_active) return "active";

  return isCompanyEmail(user.email) ? "active" : "pending_approval";
}

async function getOrganization() {
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", ORGANIZATION_SLUG)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    throw new Error(
      `Organization with slug "${ORGANIZATION_SLUG}" was not found.`,
    );
  }

  return data;
}

async function getOfficeId(params: {
  organizationId: string;
  requestedSlug?: string | null;
  fallbackOfficeId?: string | null;
}) {
  if (params.fallbackOfficeId) return params.fallbackOfficeId;

  const slug = params.requestedSlug || OFFICE_SLUGS.itsNoMatata;
  return resolveCompanyOfficeId({
    organizationId: params.organizationId,
    slug,
  });
}

async function ensureProfile(user: User): Promise<AuthProfile | null> {
  const organization = await getOrganization();

  const { data: existing, error: selectError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (selectError) throw selectError;

  const existingProfile = (existing as AuthProfile | null) ?? null;
  const resolvedRole = resolveUserRole(user, existingProfile);
  const resolvedStatus = resolveAccountStatus(user, existingProfile);
  const organizationId =
    existing?.organization_id ??
    user.user_metadata?.organization_id ??
    organization.id;
  const officeId = await getOfficeId({
    organizationId,
    requestedSlug: String(user.user_metadata?.office_slug ?? ""),
    fallbackOfficeId: existingProfile?.office_id ?? null,
  });

  const payload = {
    id: user.id,
    email: user.email ?? existing?.email ?? null,
    full_name: user.user_metadata?.full_name ?? existing?.full_name ?? null,
    organization_id: organizationId,
    office_id: officeId,
    primary_role: resolvedRole,
    account_status: resolvedStatus,
    is_active: resolvedStatus === "active",
    is_suspended: resolvedStatus === "suspended",
    last_seen_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert(payload, {
      onConflict: "id",
    });

  if (upsertError) throw upsertError;

  const { data: refreshed, error: refreshedError } = await supabase
    .from("profiles")
    .select(
      `
      *,
      organization:organizations(*),
      office:company_offices(id, name, slug, is_primary)
    `,
    )
    .eq("id", user.id)
    .maybeSingle();

  if (refreshedError) throw refreshedError;

  return (refreshed as AuthProfile | null) ?? null;
}

async function ensureOrganizationMembership(
  user: User,
  profile: AuthProfile | null,
) {
  if (!profile?.organization_id) return;
  if (profile.account_status !== "active" || profile.is_suspended) return;

  const role = resolveUserRole(user, profile);

  const { error } = await supabase.from("organization_members").upsert(
    {
      organization_id: profile.organization_id,
      user_id: user.id,
      role,
      status: "active",
      joined_at: new Date().toISOString(),
    },
    {
      onConflict: "organization_id,user_id",
    },
  );

  if (error) throw error;
}

function getDisabledAccountMessage(profile: AuthProfile | null) {
  const status = profile?.account_status ??
    (profile?.is_suspended ? "suspended" : null);

  if (status === "suspended") {
    return "Your account has been suspended. Contact support.";
  }
  if (status === "deleted") {
    return "Your account has been deactivated.";
  }
  if (status === "rejected") {
    return "Your account request was rejected by an administrator.";
  }
  return "";
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
    console.warn("TOUCH USER PRESENCE ERROR:", error.message);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const previousStatusRef = useRef<AccountStatus | null>(null);

  const loadingProfileRef = useRef(false);

  const loadUserProfile = async (sessionUser: User | null) => {
    if (loadingProfileRef.current) return;

    try {
      loadingProfileRef.current = true;

      if (!sessionUser) {
        setUser(null);
        setProfile(null);
        return;
      }

      setUser(sessionUser);

      const nextProfile = await ensureProfile(sessionUser);
      const disabledMessage = getDisabledAccountMessage(nextProfile);
      if (disabledMessage) {
        window.localStorage.setItem("account_disabled_message", disabledMessage);
        setProfile(nextProfile);
        await supabase.auth.signOut();
        return;
      }

      await ensureOrganizationMembership(sessionUser, nextProfile);
      await touchUserPresence(sessionUser);

      const nextStatus = nextProfile?.account_status ?? null;
      const previousStatus = previousStatusRef.current;
      previousStatusRef.current = nextStatus;
      if (
        previousStatus === "pending_approval" &&
        nextStatus === "active" &&
        window.location.pathname !== "/dashboard"
      ) {
        window.localStorage.setItem("account_approved_message", "Welcome. Your account has been approved.");
        window.location.assign("/dashboard");
        return;
      }

      setProfile(nextProfile);
    } catch (err) {
      console.error("LOAD USER PROFILE ERROR:", err);
      setProfile(null);
    } finally {
      loadingProfileRef.current = false;
    }
  };

  const refreshProfile = async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      console.error("REFRESH PROFILE ERROR:", error);
      return;
    }

    await loadUserProfile(session?.user ?? null);
  };

  useEffect(() => {
    let mounted = true;
    let presenceInterval: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      try {
        setLoading(true);

        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) throw error;

        if (!mounted) return;

        const sessionUser = session?.user ?? null;

        await loadUserProfile(sessionUser);

        if (sessionUser) {
          presenceInterval = setInterval(() => {
            void touchUserPresence(sessionUser);
          }, 60000);
        }
      } catch (err) {
        console.error("AUTH INIT ERROR:", err);

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

    void init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const sessionUser = session?.user ?? null;

      if (event === "SIGNED_OUT") {
        setUser(null);
        setProfile(null);

        if (presenceInterval) {
          clearInterval(presenceInterval);
          presenceInterval = null;
        }

        return;
      }

      if (
        event === "SIGNED_IN" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        void loadUserProfile(sessionUser);
      }
    });

    return () => {
      mounted = false;

      if (presenceInterval) {
        clearInterval(presenceInterval);
      }

      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`profile-live:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        () => {
          void refreshProfile();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (profile?.account_status !== "pending_approval") return;

    const interval = window.setInterval(() => {
      void refreshProfile();
    }, 45000);

    return () => window.clearInterval(interval);
  }, [profile?.account_status]);

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
