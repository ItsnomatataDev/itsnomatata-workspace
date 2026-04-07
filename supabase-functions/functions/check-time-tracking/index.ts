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

function getUtcDayRange(dateString?: string) {
  const base = dateString ? new Date(dateString) : new Date();

  const start = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );

  const end = new Date(
    Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
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
    const date =
      typeof body.date === "string" && body.date.trim()
        ? body.date.trim()
        : undefined;

    if (!userId) {
      return jsonResponse({ error: "userId is required" }, 400);
    }

    const { start, end } = getUtcDayRange(date);

    const { data, error } = await supabase
      .from("time_entries")
      .select("id, started_at, ended_at, is_running, duration_seconds")
      .eq("user_id", userId)
      .gte("started_at", start)
      .lte("started_at", end)
      .order("started_at", { ascending: false });

    if (error) throw error;

    const entries = data ?? [];

    const todaySeconds = entries.reduce(
      (sum, entry) => sum + (entry.duration_seconds ?? 0),
      0,
    );

    const hasActiveTimer = entries.some((entry) => entry.is_running === true);
    const hasTrackedTimeToday =
      hasActiveTimer || todaySeconds > 0 || entries.length > 0;

    return jsonResponse(
      {
        hasTrackedTimeToday,
        hasActiveTimer,
        todaySeconds,
        entriesCount: entries.length,
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