import type {
  AssistantContextInput,
  AssistantResponse,
} from "./n8n";
import { supabase } from "../supabase/client";

export type ManualTaskAutomationInput = {
  context: AssistantContextInput;
  instruction: string;
  source?: "manual" | "chat" | "email" | "task" | "document" | "meeting";
  allowedActions?: string[];
  extraContext?: Record<string, unknown>;
};

function getSupabaseFunctionsBaseUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) throw new Error("Missing VITE_SUPABASE_URL");
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export async function requestManualTaskAutomation(
  input: ManualTaskAutomationInput,
): Promise<AssistantResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("You must be signed in to use AI task automation.");
  }

  const response = await fetch(
    `${getSupabaseFunctionsBaseUrl()}/ai-automation-gateway`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: input.source ?? "manual",
        organization_id: input.context.organizationId,
        user_id: input.context.userId,
        role: input.context.role,
        department: input.context.department,
        instruction: input.instruction,
        context: {
          current_module: input.context.currentModule,
          current_route: input.context.currentRoute,
          selected_entity_id: input.context.selectedEntityId,
          selected_entity_type: input.context.selectedEntityType,
          ...(input.extraContext ?? {}),
        },
        allowed_actions: input.allowedActions ?? ["suggest_task", "notify"],
      }),
    },
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      isRecord(payload) && typeof payload.summary === "string"
        ? payload.summary
        : isRecord(payload) && typeof payload.error === "string"
          ? payload.error
          : `AI automation failed with status ${response.status}.`,
    );
  }

  const data = isRecord(payload)
    ? {
      suggestions: Array.isArray(payload.suggestions) ? payload.suggestions : [],
      recommended_actions: Array.isArray(payload.recommended_actions)
        ? payload.recommended_actions
        : [],
      persisted_actions: Array.isArray(payload.persisted_actions)
        ? payload.persisted_actions
        : [],
      run_id: typeof payload.run_id === "string" ? payload.run_id : null,
      raw: payload.raw ?? payload,
    }
    : {};

  return {
    success: true,
    type: "approval_request",
    message: isRecord(payload) && typeof payload.summary === "string"
      ? payload.summary
      : "AI task automation request was processed.",
    output: isRecord(payload) && typeof payload.summary === "string"
      ? payload.summary
      : "AI task automation request was processed.",
    reply: isRecord(payload) && typeof payload.summary === "string"
      ? payload.summary
      : "AI task automation request was processed.",
    content: isRecord(payload) && typeof payload.summary === "string"
      ? payload.summary
      : "AI task automation request was processed.",
    requestId: isRecord(payload) && typeof payload.run_id === "string"
      ? payload.run_id
      : crypto.randomUUID(),
    conversationId: null,
    requiresApproval: true,
    approvalId: null,
    data,
    actions: [],
    sources: [],
    raw: payload,
  };
}
