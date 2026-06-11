import { supabase } from "../../../lib/supabase/client";
import type {
  AiRouterRequest,
  AiRouterResponse,
} from "../types/aiToolTypes";

function getSupabaseFunctionsBaseUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) throw new Error("Missing VITE_SUPABASE_URL");
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1`;
}

function readableError(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(readableError).filter(Boolean).join("\n");
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

export async function sendAiRouterMessage(
  request: AiRouterRequest,
): Promise<AiRouterResponse> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("You must be signed in to use the AI assistant.");
  }

  const response = await fetch(`${getSupabaseFunctionsBaseUrl()}/ai-router`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as AiRouterResponse & {
    error?: unknown;
  };

  if (!response.ok) {
    throw new Error(readableError(payload.error || payload) || "AI router request failed.");
  }

  return payload;
}
