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

    const userId =
      typeof body.userId === "string" && body.userId.trim()
        ? body.userId.trim()
        : null;
    const organizationId =
      typeof body.organizationId === "string" && body.organizationId.trim()
        ? body.organizationId.trim()
        : null;
    const title =
      typeof body.title === "string" && body.title.trim()
        ? body.title.trim()
        : null;

    if (!userId || !organizationId || !title) {
      return jsonResponse(
        { error: "userId, organizationId, and title are required" },
        400,
      );
    }

    const type =
      typeof body.type === "string" && body.type.trim()
        ? body.type.trim()
        : "general";

    const priority =
      typeof body.priority === "string" && body.priority.trim()
        ? body.priority.trim()
        : "medium";

    const payload = {
      user_id: userId,
      organization_id: organizationId,
      type,
      title,
      message:
        typeof body.message === "string" && body.message.trim()
          ? body.message.trim()
          : null,
      entity_type:
        typeof body.entityType === "string" && body.entityType.trim()
          ? body.entityType.trim()
          : null,
      entity_id:
        typeof body.entityId === "string" && body.entityId.trim()
          ? body.entityId.trim()
          : null,
      action_url:
        typeof body.actionUrl === "string" && body.actionUrl.trim()
          ? body.actionUrl.trim()
          : "/time",
      priority,
      metadata:
        body.metadata && typeof body.metadata === "object" ? body.metadata : {},
      reference_id:
        typeof body.referenceId === "string" && body.referenceId.trim()
          ? body.referenceId.trim()
          : null,
      reference_type:
        typeof body.referenceType === "string" && body.referenceType.trim()
          ? body.referenceType.trim()
          : null,
    };

    const { data, error } = await supabase
      .from("notifications")
      .insert(payload)
      .select()
      .single();

    if (error) throw error;

    return jsonResponse(
      {
        success: true,
        notification: data,
      },
      200,
    );
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500,
    );
  }
});