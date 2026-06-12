import { requireAuthenticatedProfile } from "../_shared/edgeAuth.ts";
import { runLocalReadOnlyTool } from "../_shared/aiReadOnlyTools.ts";
import {
  type AiRouterToolId,
  canUseAiRouter,
  CODEX_DELEGATED_TOOLS,
  detectAiTool,
  formatToolReply,
  READ_ONLY_AI_TOOLS,
} from "../_shared/aiToolRegistry.ts";

type RouterRequestBody = {
  message?: string;
  conversationId?: string | null;
  context?: {
    currentRoute?: string | null;
    currentModule?: string | null;

    boardId?: string | null;
    cardId?: string | null;

    taskId?: string | null;
    clientId?: string | null;

    selectedEntityId?: string | null;
    selectedEntityType?: string | null;
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

function readableError(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(readableError).filter(Boolean).join("\n");
  }
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  for (const key of ["message", "error", "details", "hint", "description"]) {
    const text = readableError(record[key]);
    if (text) return text;
  }

  try {
    return JSON.stringify(record);
  } catch {
    return "";
  }
}

async function ensureAiWorkspaceEnabled(
  admin: ReturnType<typeof requireAuthenticatedProfile> extends Promise<infer T>
    ? T extends { admin: infer A } ? A
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
    organizationId: string;
    userId: string;
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
      organization_id: params.organizationId,
      user_id: params.userId,
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
  const response = await fetch(
    `${supabaseUrl}/functions/v1/codex-execute-tool`,
    {
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
    },
  );

  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      readableError(result.error || result) || `Codex tool failed: ${toolId}`,
    );
  }
  return result as Record<string, unknown>;
}

function enrichPayloadFromRoute(
  payload: Record<string, unknown>,
  route: string | null | undefined,
) {
  if (!route) return payload;
  const next = { ...payload };
  const cardId = route.match(/[?&]cardId=([0-9a-f-]{36})/i)?.[1];
  const boardId = route.match(/\/boards\/([0-9a-f-]{36})/i)?.[1];

  if (cardId && !next.taskId && !next.task_id) {
    next.taskId = cardId;
  }
  if (
    boardId && !next.boardId && !next.board_id && !next.clientId &&
    !next.client_id
  ) {
    next.boardId = boardId;
  }

  return next;
}

function enrichTimerPayloadFromMessage(
  payload: Record<string, unknown>,
  message: string,
) {
  const next = { ...payload };
  const possessive = message.match(
    /\b([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,2})['’]s\s+(?:timer|time)\b/i,
  );
  const targetAfterFor = message.match(
    /\b(?:timer|time tracker|time tracking|time)\s+for\s+([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z][A-Za-z.'-]+){0,3})(?=\s+(?:now|on|under|to|and|please|at|$)|[,.?!]|$)/i,
  ) ?? message.match(
    /\bfor\s+([A-Za-z][A-Za-z.'-]+(?:\s+[A-Za-z.'-]+){0,3})\s+(?:now|on|under|to|and|please|at|$)/i,
  );
  const email = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0];

  if (email && !next.userEmail && !next.user_email && !next.email) {
    next.userEmail = email;
  }
  if (possessive?.[1] && !next.userName && !next.user_name && !next.name) {
    next.userName = possessive[1].trim();
  }
  if (targetAfterFor?.[1] && !next.userName && !next.user_name && !next.name) {
    next.userName = targetAfterFor[1].trim();
  }

  return next;
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
      return jsonResponse(
        { error: "AI access is not enabled for this role." },
        403,
      );
    }

    const aiEnabled = await ensureAiWorkspaceEnabled(
      admin,
      profile.organization_id,
    );
    if (!aiEnabled) {
      return jsonResponse({
        error: "AI workspace is disabled for this organization.",
      }, 403);
    }

    const conversationId = await getOrCreateConversation(admin, {
      conversationId: body.conversationId,
      organizationId: profile.organization_id,
      userId,
      title: message,
    });

    await insertMessage(admin, {
      conversationId,
      organizationId: profile.organization_id,
      userId,
      role: "user",
      content: message,
    });

    const toolMatch = detectAiTool(message);
    let toolId: AiRouterToolId | null = toolMatch?.toolId ?? null;
    let toolData: Record<string, unknown> = {};
    let toolStatus: "success" | "failed" | "fallback" = "success";
    let toolError: string | null = null;

    if (
      toolId &&
      (READ_ONLY_AI_TOOLS.has(toolId) || CODEX_DELEGATED_TOOLS.has(toolId))
    ) {
      try {
        const ctx = {
          userId,
          organizationId: profile.organization_id,
          role: profile.primary_role,
        };
        const basePayload = enrichPayloadFromRoute(
          {
            ...(toolMatch?.payload ?? {}),
            originalMessage: message,
          },
          body.context?.currentRoute,
        );
        const payload =
          toolId === "start_time_tracker" || toolId === "stop_time_tracker"
            ? enrichTimerPayloadFromMessage(basePayload, message)
            : basePayload;

        if (CODEX_DELEGATED_TOOLS.has(toolId)) {
          const { supabaseUrl, anonKey } = {
            supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
            anonKey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          };
          const token =
            req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
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

              currentRoute: body.context?.currentRoute ?? null,
              currentModule: body.context?.currentModule ?? null,

              boardId: body.context?.boardId ?? null,
              cardId: body.context?.cardId ?? null,

              taskId: body.context?.taskId ?? null,
              clientId: body.context?.clientId ?? null,

              selectedEntityId: body.context?.selectedEntityId ?? null,
              selectedEntityType: body.context?.selectedEntityType ?? null,
            },
          );
console.log(
  "[LEAVE DEBUG]",
  JSON.stringify(
    {
      toolId,
      payload,
      message: body.message,
    },
    null,
    2,
  ),
);
          if (
            toolData &&
            typeof toolData === "object" &&
            "result" in toolData &&
            toolData.result &&
            typeof toolData.result === "object"
          ) {
            toolData = toolData.result as Record<string, unknown>;
          }
        } else {
          toolData = await runLocalReadOnlyTool(admin, ctx, toolId, payload);
        }
      } catch (error) {
        toolStatus = "failed";
        toolError = readableError(error) || "Workspace tool failed.";
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
      organizationId: profile.organization_id,
      userId,
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
    const message = readableError(error) || "AI router failed.";
    console.error("ai-router error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
