import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { AiRouterToolId } from "./aiToolRegistry.ts";

type ToolContext = {
  userId: string;
  organizationId: string;
  role: string | null;
};

export async function searchNotifications(
  admin: SupabaseClient,
  ctx: ToolContext,
  payload: Record<string, unknown>,
) {
  const limit = typeof payload.limit === "number" ? payload.limit : 15;
  const unreadOnly = payload.unreadOnly === true;

  let query = admin
    .from("notifications")
    .select("id, type, title, message, is_read, created_at, action_url")
    .eq("organization_id", ctx.organizationId)
    .eq("user_id", ctx.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) query = query.eq("is_read", false);

  const { data, error } = await query;
  if (error) throw error;

  return {
    notifications: data ?? [],
    count: data?.length ?? 0,
  };
}

export async function searchAssets(
  admin: SupabaseClient,
  ctx: ToolContext,
  payload: Record<string, unknown>,
) {
  const queryText = typeof payload.query === "string" ? payload.query.trim() : "";
  const limit = typeof payload.limit === "number" ? payload.limit : 15;

  let query = admin
    .from("assets")
    .select("id, asset_name, asset_tag, serial_number, status, brand, model")
    .eq("organization_id", ctx.organizationId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (queryText) {
    query = query.or(
      `asset_name.ilike.%${queryText}%,asset_tag.ilike.%${queryText}%,serial_number.ilike.%${queryText}%,brand.ilike.%${queryText}%,model.ilike.%${queryText}%`,
    );
  }

  const { data, error } = await query;
  if (error) throw error;

  return {
    assets: data ?? [],
    count: data?.length ?? 0,
    query: queryText,
  };
}

export async function runLocalReadOnlyTool(
  admin: SupabaseClient,
  ctx: ToolContext,
  toolId: AiRouterToolId,
  payload: Record<string, unknown>,
) {
  switch (toolId) {
    case "search_notifications":
      return searchNotifications(admin, ctx, payload);
    case "search_assets":
      return searchAssets(admin, ctx, payload);
    default:
      throw new Error(`Tool ${toolId} is not implemented locally.`);
  }
}
