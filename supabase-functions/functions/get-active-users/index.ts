import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAuthorized(req: Request): boolean {
  const internalApiKey = Deno.env.get("INTERNAL_API_KEY");
  const requestApiKey =
    req.headers.get("x-internal-api-key") ?? req.headers.get("apikey");

  return !!internalApiKey && requestApiKey === internalApiKey;
}

Deno.serve(async (req) => {
  try {
    if (!isAuthorized(req)) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return jsonResponse(
        { error: "Missing Supabase environment configuration" },
        500,
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body = await req.json().catch(() => ({}));
    const organizationId =
      typeof body.organizationId === "string" && body.organizationId.trim()
        ? body.organizationId.trim()
        : null;

    let query = supabase
      .from("profiles")
      .select(
        "id, organization_id, email, full_name, department, primary_role, is_active, metadata, created_at",
      )
      .eq("is_active", true);

    if (organizationId) {
      query = query.eq("organization_id", organizationId);
    }

    const { data, error } = await query.order("created_at", {
      ascending: true,
    });

    if (error) throw error;

    const users = (data ?? []).map((user) => ({
      id: user.id,
      organization_id: user.organization_id,
      email: user.email,
      full_name: user.full_name,
      department: user.department,
      primary_role: user.primary_role,
      is_active: user.is_active,
      notifications_enabled: user.metadata?.notifications_enabled ?? true,
      email_reminders_enabled: user.metadata?.email_reminders_enabled ?? true,
      preferred_response_style: user.metadata?.preferred_response_style ?? null,
      favorite_tools: user.metadata?.favorite_tools ?? [],
      likes: user.metadata?.likes ?? [],
      dislikes: user.metadata?.dislikes ?? [],
    }));

    return jsonResponse(users, 200);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});