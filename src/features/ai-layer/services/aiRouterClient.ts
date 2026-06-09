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
    error?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error || "AI router request failed.");
  }

  return payload;
}
