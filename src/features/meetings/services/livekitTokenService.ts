import { supabase } from "../../../lib/supabase/client";

const CLIENT_LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL as
  | string
  | undefined;

export type LivekitTokenResponse = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  name: string;
};

type SupabaseFunctionError = Error & {
  context?: Response;
};

function isLivekitTokenResponse(value: unknown): value is LivekitTokenResponse {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<LivekitTokenResponse>;

  return (
    typeof payload.token === "string" &&
    payload.token.length > 0 &&
    typeof payload.url === "string" &&
    payload.url.length > 0 &&
    typeof payload.roomName === "string" &&
    payload.roomName.length > 0 &&
    typeof payload.identity === "string" &&
    payload.identity.length > 0 &&
    typeof payload.name === "string" &&
    payload.name.length > 0
  );
}

export function normalizeLivekitClientUrl(value: string | undefined) {
  if (!value?.trim()) return "";

  const rawValue = value.trim();
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawValue)
    ? rawValue
    : `wss://${rawValue}`;
  const url = new URL(withProtocol);

  if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else if (url.protocol === "http:") {
    url.protocol = "ws:";
  }

  if (!["ws:", "wss:"].includes(url.protocol)) {
    throw new Error("LiveKit URL must start with ws://, wss://, http://, or https://.");
  }

  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}

export async function getLivekitToken(params: {
  meetingId: string;
}): Promise<LivekitTokenResponse> {
  const meetingId = params.meetingId.trim();

  if (!meetingId) {
    throw new Error("Meeting ID is required.");
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Failed to get auth session.");
  }

  if (!session?.access_token) {
    throw new Error("No authenticated session found.");
  }

  const { data, error } = await supabase.functions.invoke("livekit-token", {
    body: { meetingId },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error) {
    console.error("LIVEKIT EDGE FUNCTION ERROR:", error);
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!isLivekitTokenResponse(data)) {
    throw new Error("LiveKit token response was incomplete.");
  }

  const url = normalizeLivekitClientUrl(CLIENT_LIVEKIT_URL || data.url);

  if (!url) {
    throw new Error("LiveKit URL was not configured.");
  }

  return {
    ...data,
    url,
  };
}

async function getFunctionErrorMessage(error: SupabaseFunctionError) {
  const fallback =
    error.message ||
    "LiveKit token function failed. Check Supabase Edge Function logs.";

  try {
    const payload = (await error.context?.clone().json()) as {
      error?: unknown;
      missing?: Record<string, boolean>;
    };

    if (typeof payload?.error === "string" && payload.error.length > 0) {
      const missing = Object.entries(payload.missing ?? {})
        .filter(([, isMissing]) => isMissing)
        .map(([key]) => key);

      if (missing.length > 0) {
        return `${payload.error}: ${missing.join(", ")}`;
      }

      return payload.error;
    }
  } catch {
    // Keep the SDK error message when the function did not return JSON.
  }

  return fallback;
}
