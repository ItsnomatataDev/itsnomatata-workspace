import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export type AuthProfile = {
  id: string;
  organization_id: string;
  primary_role: string | null;
  full_name: string | null;
  department: string | null;
  account_status: string | null;
  is_suspended: boolean | null;
};

export function getBearerToken(req: Request): string | null {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

export function getInternalApiKey(): string | null {
  const key = Deno.env.get("INTERNAL_API_KEY")?.trim();
  return key || null;
}

export function hasInternalSecret(req: Request): boolean {
  const secret = getInternalApiKey();
  if (!secret) return false;
  const inbound = req.headers.get("x-internal-api-key") ??
    req.headers.get("x-codex-internal-key") ??
    req.headers.get("x-notification-secret") ??
    req.headers.get("x-cron-secret");
  return inbound === secret;
}

export function isServiceRoleRequest(req: Request, serviceRoleKey: string): boolean {
  const token = getBearerToken(req);
  const apikey = req.headers.get("apikey") ?? "";
  return Boolean(
    serviceRoleKey &&
      (token === serviceRoleKey || apikey === serviceRoleKey),
  );
}

export function isPrivilegedServiceRequest(
  req: Request,
  serviceRoleKey: string,
): boolean {
  return isServiceRoleRequest(req, serviceRoleKey) && hasInternalSecret(req);
}

export function getSupabaseEnv() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return { supabaseUrl, anonKey, serviceRoleKey };
}

export async function requireAuthenticatedProfile(
  req: Request,
): Promise<
  | {
    userId: string;
    profile: AuthProfile;
    admin: SupabaseClient;
  }
  | Response
> {
  const { supabaseUrl, anonKey, serviceRoleKey } = getSupabaseEnv();
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: "Server configuration error." }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const token = getBearerToken(req);
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (isServiceRoleRequest(req, serviceRoleKey)) {
    return new Response(
      JSON.stringify({ error: "User session required." }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const { data: authData, error: authError } = await userClient.auth.getUser(token);
  if (authError || !authData.user) {
    return new Response(JSON.stringify({ error: "Invalid or expired session." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select(
      "id, organization_id, primary_role, full_name, department, account_status, is_suspended",
    )
    .eq("id", authData.user.id)
    .maybeSingle();

  if (profileError || !profile?.organization_id) {
    return new Response(JSON.stringify({ error: "Profile not found." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (
    profile.account_status !== "active" ||
    profile.is_suspended
  ) {
    return new Response(JSON.stringify({ error: "Account is not active." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return {
    userId: authData.user.id,
    profile: profile as AuthProfile,
    admin,
  };
}

const CONTENT_STUDIO_ROLES = new Set([
  "admin",
  "org_admin",
  "super_admin",
  "superadmin",
  "manager",
  "social_media",
  "media_team",
  "seo_specialist",
]);

export function canUseContentStudio(profile: AuthProfile): boolean {
  return CONTENT_STUDIO_ROLES.has(String(profile.primary_role ?? ""));
}

export function isAllowedImageUrl(imageUrl: string, supabaseUrl: string): boolean {
  const trimmed = imageUrl.trim();
  if (trimmed.startsWith("data:image/")) return true;
  const base = supabaseUrl.replace(/\/$/, "");
  if (trimmed.startsWith(base)) return true;
  if (/\/storage\/v1\/object\//i.test(trimmed)) return true;
  return false;
}
