import { requireAuthenticatedProfile } from "../_shared/edgeAuth.ts";
import { runLocalReadOnlyTool } from "../_shared/aiReadOnlyTools.ts";
import {
  canUseAiRouter,
  CODEX_DELEGATED_TOOLS,
  detectAiTool,
  formatToolReply,
  READ_ONLY_AI_TOOLS,
  type AiRouterToolId,
} from "../_shared/aiToolRegistry.ts";

type RouterRequestBody = {
  message?: string;
  conversationId?: string | null;
  context?: {
    currentRoute?: string | null;
    currentModule?: string | null;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function ensureAiWorkspaceEnabled(
  admin: ReturnType<typeof requireAuthenticatedProfile> extends Promise<infer T>
    ? T extends { admin: infer A }
      ? A
      : never
    : never,
  organizationId: string,
) {
  const { data, error } = await admin
    .from("organization_features")
    .select("enabled")
    .eq("organization_id", organizationId)
    .eq("feature_key", "ai_workspace")
    .maybeSingle();

  if (error) throw error;
  if (data?.enabled === false) {
    return false;
  }
  return true;
}

async function getOrCreateConversation(
  admin: any,
  params: {
    conversationId?: string | null;
    organizationId: string;
    userId: string;
    title: string;
  },
) {
  if (params.conversationId) {
    const { data, error } = await admin
      .from("ai_conversations")
      .select("id")
      .eq("id", params.conversationId)
      .eq("user_id", params.userId)
      .eq("organization_id", params.organizationId)
      .maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id as string;
  }

  const { data, error } = await admin
    .from("ai_conversations")
    .insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      title: params.title.slice(0, 120),
      tool_id: "ai-router",
      metadata: { channel: "floating_assistant" },
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function insertMessage(
  admin: any,
  params: {
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    toolId?: string | null;
    data?: Record<string, unknown>;
    error?: boolean;
  },
) {
  const { data, error } = await admin
    .from("ai_messages")
    .insert({
      conversation_id: params.conversationId,
      role: params.role,
      content: params.content,
      type: "text",
      tool_id: params.toolId ?? null,
      data: params.data ?? {},
      error: params.error ?? false,
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id as string;
}

async function logToolExecution(
  admin: any,
  params: {
    organizationId: string;
    userId: string;
    toolName: string;
    inputSummary: string;
    status: "success" | "failed" | "blocked" | "fallback";
    errorMessage?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const { error } = await admin.from("ai_tool_logs").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    tool_name: params.toolName,
    input_summary: params.inputSummary,
    status: params.status,
    error_message: params.errorMessage ?? null,
    metadata: params.metadata ?? {},
  });

  if (error) console.error("ai_tool_logs insert failed:", error.message);
}

async function invokeCodexTool(
  supabaseUrl: string,
  anonKey: string,
  userToken: string,
  toolId: AiRouterToolId,
  payload: Record<string, unknown>,
  context: Record<string, unknown>,
) {
  const response = await fetch(`${supabaseUrl}/functions/v1/codex-execute-tool`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${userToken}`,
      apikey: anonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      toolId,
      payload,
      context,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || `Codex tool failed: ${toolId}`);
  }
  return result as Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405);
  }

  try {
    const authResult = await requireAuthenticatedProfile(req);
    if (authResult instanceof Response) return authResult;

    const { userId, profile, admin } = authResult;
    const body = (await req.json()) as RouterRequestBody;
    const message = String(body.message ?? "").trim();

    if (!message) {
      return jsonResponse({ error: "message is required." }, 400);
    }

    if (!canUseAiRouter(profile.primary_role)) {
      return jsonResponse({ error: "AI access is not enabled for this role." }, 403);
    }

    const aiEnabled = await ensureAiWorkspaceEnabled(admin, profile.organization_id);
    if (!aiEnabled) {
      return jsonResponse({ error: "AI workspace is disabled for this organization." }, 403);
    }

    const conversationId = await getOrCreateConversation(admin, {
      conversationId: body.conversationId,
      organizationId: profile.organization_id,
      userId,
      title: message,
    });

    await insertMessage(admin, {
      conversationId,
      role: "user",
      content: message,
    });

    const toolMatch = detectAiTool(message);
    let toolId: AiRouterToolId | null = toolMatch?.toolId ?? null;
    let toolData: Record<string, unknown> = {};
    let toolStatus: "success" | "failed" | "fallback" = "success";
    let toolError: string | null = null;

    if (toolId && READ_ONLY_AI_TOOLS.has(toolId)) {
      try {
        const ctx = {
          userId,
          organizationId: profile.organization_id,
          role: profile.primary_role,
        };
        const payload = toolMatch?.payload ?? {};

        if (CODEX_DELEGATED_TOOLS.has(toolId)) {
          const { supabaseUrl, anonKey } = {
            supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
            anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          };
          const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
          toolData = await invokeCodexTool(
            supabaseUrl,
            anonKey,
            token,
            toolId,
            payload,
            {
              userId,
              organizationId: profile.organization_id,
              role: profile.primary_role,
              department: profile.department,
              fullName: profile.full_name,
            },
          );
        } else {
          toolData = await runLocalReadOnlyTool(admin, ctx, toolId, payload);
        }
      } catch (error) {
        toolStatus = "failed";
        toolError = error instanceof Error ? error.message : String(error);
        toolData = { error: toolError };
      }

      await logToolExecution(admin, {
        organizationId: profile.organization_id,
        userId,
        toolName: toolId,
        inputSummary: message.slice(0, 240),
        status: toolStatus,
        errorMessage: toolError,
        metadata: {
          route: body.context?.currentRoute ?? null,
          module: body.context?.currentModule ?? null,
        },
      });
    }

    const reply = toolError
      ? `I could not complete that lookup: ${toolError}`
      : formatToolReply(toolId, toolData);

    const messageId = await insertMessage(admin, {
      conversationId,
      role: "assistant",
      content: reply,
      toolId,
      data: toolData,
      error: Boolean(toolError),
    });

    return jsonResponse({
      reply,
      conversationId,
      messageId,
      toolId,
      data: toolData,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("ai-router error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
