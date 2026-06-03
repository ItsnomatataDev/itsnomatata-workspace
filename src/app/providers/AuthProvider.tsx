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
import {
  getCurrentHostname,
  resolveOrganizationByHost,
  type ResolvedHostOrganization,
} from "../../lib/organization/organizationResolution";

type AppRole =
  | "super_admin"
  | "org_admin"
  | "admin"
  | "user"
  | "superadmin"
  | "manager"
  | "hr"
  | "it"
  | "social_media"
  | "media_team"
  | "seo_specialist"
  | "finance";

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
  organization_role_key?: string | null;
  account_status?: AccountStatus | null;
  is_active?: boolean | null;
  is_suspended?: boolean | null;
  last_seen_at?: string | null;
  organization?: Record<string, unknown> | null;
  active_membership?: ActiveMembership | null;
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
  memberships: ActiveMembership[];
  currentOrganization: CurrentOrganization | null;
  resolvedHostOrganization: ResolvedHostOrganization | null;
  accessIssue: AccessIssue | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

type ActiveMembership = {
  membership_id: string;
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: string;
  status: string;
  joined_at: string | null;
  access_status: string | null;
  organization_is_active: boolean | null;
  is_system_organization: boolean | null;
};

type CurrentOrganization = {
  organization_id: string;
  organization_name: string;
  organization_slug: string;
  role: string;
  membership_status: string;
  access_status: string | null;
  organization_is_active: boolean | null;
  is_system_organization: boolean | null;
};

type AccessIssue =
  | "no_membership"
  | "wrong_organization"
  | "pending_approval"
  | "suspended_account"
  | "suspended_organization";

let hasEnsureProfileRpc = true;
let hasMembershipRpc = true;

function isMissingRpcError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  return (
    record.code === "PGRST202" ||
    String(record.message ?? "").includes("Could not find the function")
  );
}

function formatSupabaseError(error: unknown): string {
  if (!error || typeof error !== "object") return String(error);
  const record = error as Record<string, unknown>;
  return [
    record.message,
    record.code ? `code=${record.code}` : null,
    record.details ? `details=${record.details}` : null,
    record.hint ? `hint=${record.hint}` : null,
  ]
    .filter(Boolean)
    .join(" | ");
}

function isMissingColumnError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as Record<string, unknown>;
  const message = String(record.message ?? "");
  const details = String(record.details ?? "");
  return (
    record.code === "42703" ||
    message.includes("does not exist") ||
    details.includes("does not exist")
  );
}

const PROFILE_WITH_RELATIONS_SELECT = `
  *,
  organization:organizations!profiles_organization_id_fkey(
    id,
    name,
    slug,
    timezone,
    is_active,
    settings,
    is_system_organization,
    access_status,
    social_media_enabled,
    social_media_settings,
    leave_settings,
    created_at,
    updated_at
  ),
  office:company_offices!profiles_office_id_fkey(
    id,
    name,
    slug,
    is_primary
  )
`;

const PROFILE_WITH_RELATIONS_LEGACY_SELECT = `
  *,
  organization:organizations!profiles_organization_id_fkey(
    id,
    name,
    slug,
    timezone,
    is_active,
    settings,
    created_at,
    updated_at
  ),
  office:company_offices!profiles_office_id_fkey(
    id,
    name,
    slug,
    is_primary
  )
`;

async function fetchProfileWithRelations(userId: string) {
  const full = await supabase
    .from("profiles")
    .select(PROFILE_WITH_RELATIONS_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (!full.error) return full;

  if (!isMissingColumnError(full.error)) return full;

  console.warn(
    "PROFILE SELECT FALLBACK (remote DB missing organization columns):",
    formatSupabaseError(full.error),
  );

  const legacy = await supabase
    .from("profiles")
    .select(PROFILE_WITH_RELATIONS_LEGACY_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (legacy.data?.organization && !Array.isArray(legacy.data.organization)) {
    const org = legacy.data.organization as Record<string, unknown>;
    legacy.data.organization = {
      ...org,
      access_status: org.access_status ?? "active",
      is_system_organization: org.is_system_organization ?? false,
      social_media_enabled: org.social_media_enabled ?? false,
      social_media_settings: org.social_media_settings ?? {},
      leave_settings: org.leave_settings ?? null,
    };
  }

  return legacy;
}

function toProfileCompatibleRole(roleKey?: string | null): AppRole {
  const role = roleKey?.trim();
  if (
    role &&
    [
      "admin",
      "super_admin",
      "org_admin",
      "superadmin",
      "manager",
      "hr",
      "it",
      "social_media",
      "media_team",
      "seo_specialist",
    ].includes(role)
  ) {
    return role as AppRole;
  }
  return "user" as AppRole;
}

async function loadActiveMemberships() {
  if (!hasMembershipRpc) return loadActiveMembershipsFallback();

  const { data, error } = await supabase.rpc("get_my_active_memberships");
  if (error) {
    if (isMissingRpcError(error)) {
      hasMembershipRpc = false;
      return loadActiveMembershipsFallback();
    }
    throw error;
  }
  return (data ?? []) as ActiveMembership[];
}

async function loadActiveMembershipsFallback() {
  const { data, error } = await supabase
    .from("organization_members")
    .select(
      `
      id,
      organization_id,
      role,
      status,
      joined_at,
      organizations(
        name,
        slug,
        access_status,
        is_active,
        is_system_organization
      )
    `,
    )
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
    const organization = Array.isArray(row.organizations)
      ? row.organizations[0]
      : row.organizations;
    const org = (organization ?? {}) as Record<string, unknown>;

    return {
      membership_id: String(row.id),
      organization_id: String(row.organization_id),
      organization_name: String(org.name ?? "Organization"),
      organization_slug: String(org.slug ?? ""),
      role: String(row.role ?? "user"),
      status: String(row.status ?? "active"),
      joined_at: typeof row.joined_at === "string" ? row.joined_at : null,
      access_status:
        typeof org.access_status === "string" ? org.access_status : null,
      organization_is_active:
        typeof org.is_active === "boolean" ? org.is_active : null,
      is_system_organization:
        typeof org.is_system_organization === "boolean"
          ? org.is_system_organization
          : null,
    };
  });
}

async function loadCurrentOrganization(memberships?: ActiveMembership[]) {
  if (!hasMembershipRpc) {
    return activeMembershipToCurrentOrganization(memberships?.[0] ?? null);
  }

  const { data, error } = await supabase
    .rpc("get_my_current_organization")
    .maybeSingle();
  if (error) {
    if (isMissingRpcError(error)) {
      hasMembershipRpc = false;
      return activeMembershipToCurrentOrganization(memberships?.[0] ?? null);
    }
    throw error;
  }
  return (data ?? null) as CurrentOrganization | null;
}

function activeMembershipToCurrentOrganization(
  membership?: ActiveMembership | null,
): CurrentOrganization | null {
  if (!membership) return null;
  return {
    organization_id: membership.organization_id,
    organization_name: membership.organization_name,
    organization_slug: membership.organization_slug,
    role: membership.role,
    membership_status: membership.status,
    access_status: membership.access_status,
    organization_is_active: membership.organization_is_active,
    is_system_organization: membership.is_system_organization,
  };
}

function resolveAccessIssue(params: {
  profile: AuthProfile | null;
  currentOrganization: CurrentOrganization | null;
  hostOrganization: ResolvedHostOrganization | null;
}): AccessIssue | null {
  const { profile, currentOrganization, hostOrganization } = params;
  const accountStatus =
    profile?.account_status ?? (profile?.is_suspended ? "suspended" : null);

  if (accountStatus === "suspended" || profile?.is_suspended) {
    return "suspended_account";
  }

  if (accountStatus === "pending" || accountStatus === "pending_approval") {
    return "pending_approval";
  }

  if (!currentOrganization) return "no_membership";

  if (
    currentOrganization.organization_is_active === false ||
    ["suspended", "cancelled"].includes(
      currentOrganization.access_status ?? "",
    )
  ) {
    return "suspended_organization";
  }

  if (
    hostOrganization &&
    currentOrganization.organization_id !== hostOrganization.id
  ) {
    return "wrong_organization";
  }

  return null;
}

async function ensureProfile(user: User): Promise<AuthProfile | null> {
  if (hasEnsureProfileRpc) {
    const { error: ensureError } = await supabase.rpc(
      "ensure_current_user_profile",
      {
        host_name: getCurrentHostname(),
      },
    );

    if (ensureError) {
      if (isMissingRpcError(ensureError)) {
        hasEnsureProfileRpc = false;
      } else {
        throw ensureError;
      }
    }
  }

  const { data: refreshed, error: refreshedError } =
    await fetchProfileWithRelations(user.id);

  if (refreshedError) throw refreshedError;

  if (!refreshed && !hasEnsureProfileRpc) {
    const { error: insertError } = await supabase.from("profiles").insert({
      id: user.id,
      email: user.email ?? null,
      full_name:
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name
          : null,
      organization_id: null,
      primary_role: "user",
      organization_role_key: "user",
      account_status: "pending_approval",
      is_active: false,
      is_suspended: false,
      last_seen_at: new Date().toISOString(),
    });

    if (insertError) throw insertError;
    return ensureProfile(user);
  }

  const profile = (refreshed as AuthProfile | null) ?? null;
  if (!profile) return null;

  const office = profile.office as
    | AuthProfile["office"]
    | AuthProfile["office"][]
    | null
    | undefined;

  if (Array.isArray(office)) {
    profile.office = office[0] ?? null;
  }

  return profile;
}

async function ensureOrganizationMembership(
  _user: User,
  profile: AuthProfile | null,
) {
  if (!profile?.organization_id) return;
}

function getDisabledAccountMessage(profile: AuthProfile | null) {
  const status =
    profile?.account_status ??
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

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);

  const [profile, setProfile] = useState<AuthProfile | null>(
    null,
  );
  const [memberships, setMemberships] = useState<ActiveMembership[]>([]);
  const [currentOrganization, setCurrentOrganization] =
    useState<CurrentOrganization | null>(null);
  const [resolvedHostOrganization, setResolvedHostOrganization] =
    useState<ResolvedHostOrganization | null>(null);
  const [accessIssue, setAccessIssue] = useState<AccessIssue | null>(null);

  const [loading, setLoading] = useState(true);

  const previousStatusRef =
    useRef<AccountStatus | null>(null);

  const loadingProfileRef = useRef(false);

  const loadUserProfile = async (
    sessionUser: User | null,
  ) => {
    if (loadingProfileRef.current) return;

    try {
      loadingProfileRef.current = true;

      if (!sessionUser) {
        setUser(null);
        setProfile(null);
        setMemberships([]);
        setCurrentOrganization(null);
        setResolvedHostOrganization(null);
        setAccessIssue(null);
        return;
      }

      setUser(sessionUser);

      const nextProfile = await ensureProfile(
        sessionUser,
      );

      const disabledMessage =
        getDisabledAccountMessage(nextProfile);

      if (disabledMessage) {
        window.localStorage.setItem(
          "account_disabled_message",
          disabledMessage,
        );

        setProfile(nextProfile);

        await supabase.auth.signOut();

        return;
      }

      await ensureOrganizationMembership(sessionUser, nextProfile);

      const [nextMemberships, hostOrganization] = await Promise.all([
        loadActiveMemberships(),
        resolveOrganizationByHost(),
      ]);
      const nextCurrentOrganization =
        await loadCurrentOrganization(nextMemberships);
      const hostMembership = hostOrganization
        ? nextMemberships.find(
            (membership) => membership.organization_id === hostOrganization.id,
          )
        : null;
      const effectiveCurrentOrganization = hostMembership
        ? {
            organization_id: hostMembership.organization_id,
            organization_name: hostMembership.organization_name,
            organization_slug: hostMembership.organization_slug,
            role: hostMembership.role,
            membership_status: hostMembership.status,
            access_status: hostMembership.access_status,
            organization_is_active: hostMembership.organization_is_active,
            is_system_organization: hostMembership.is_system_organization,
          }
        : nextCurrentOrganization;

      const safeRole = toProfileCompatibleRole(effectiveCurrentOrganization?.role);
      const safeProfile = nextProfile
        ? {
            ...nextProfile,
            organization_id:
              effectiveCurrentOrganization?.organization_id ??
              nextProfile.organization_id ??
              null,
            primary_role: safeRole,
            organization_role_key:
              effectiveCurrentOrganization?.role ??
              nextProfile.organization_role_key ??
              safeRole,
            active_membership:
              nextMemberships.find(
                (membership) =>
                  membership.organization_id ===
                  effectiveCurrentOrganization?.organization_id,
              ) ?? null,
          }
        : null;

      setMemberships(nextMemberships);
      setCurrentOrganization(effectiveCurrentOrganization);
      setResolvedHostOrganization(hostOrganization);
      setAccessIssue(
        resolveAccessIssue({
          profile: safeProfile,
          currentOrganization: effectiveCurrentOrganization,
          hostOrganization,
        }),
      );

      await touchUserPresence(sessionUser);

      const nextStatus =
        safeProfile?.account_status ?? null;

      const previousStatus =
        previousStatusRef.current;

      previousStatusRef.current = nextStatus;

      if (previousStatus === "pending_approval" && nextStatus === "active") {
        window.localStorage.setItem(
          "account_approved_message",
          "Welcome. Your account has been approved.",
        );

        const path = window.location.pathname;
        const authEntryPaths = new Set([
          "/login",
          "/signup",
          "/forgot-password",
          "/resetpassword",
        ]);
        if (authEntryPaths.has(path)) {
          window.location.assign("/dashboard");
          return;
        }
      }

      setProfile(safeProfile);
    } catch (err) {
      console.error(
        "LOAD USER PROFILE ERROR:",
        formatSupabaseError(err),
        err,
      );

      setProfile(null);
      setMemberships([]);
      setCurrentOrganization(null);
      setResolvedHostOrganization(null);
      setAccessIssue(null);
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

    let presenceInterval:
      | ReturnType<typeof setInterval>
      | null = null;

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
          setMemberships([]);
          setCurrentOrganization(null);
          setResolvedHostOrganization(null);
          setAccessIssue(null);
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
    } = supabase.auth.onAuthStateChange(
      (event, session) => {
        const sessionUser = session?.user ?? null;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
          setMemberships([]);
          setCurrentOrganization(null);
          setResolvedHostOrganization(null);
          setAccessIssue(null);

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
      },
    );

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
    if (
      profile?.account_status !==
      "pending_approval"
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void refreshProfile();
    }, 45000);

    return () => window.clearInterval(interval);
  }, [profile?.account_status]);

  const value = useMemo<AuthContextType>(
    () => ({
      user,
      profile,
      memberships,
      currentOrganization,
      resolvedHostOrganization,
      accessIssue,
      loading,
      refreshProfile,
    }),
    [
      user,
      profile,
      memberships,
      currentOrganization,
      resolvedHostOrganization,
      accessIssue,
      loading,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider",
    );
  }

  return context;
}
