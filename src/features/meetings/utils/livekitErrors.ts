export function getLiveKitConnectionErrorMessage(
  error: unknown,
  serverUrl?: string,
): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  const lowerMessage = message.toLowerCase();

  if (
    lowerMessage.includes("websocket") ||
    lowerMessage.includes("signal connection") ||
    lowerMessage.includes("connection establishment")
  ) {
    const host = getUrlHost(serverUrl);
    const expectedUrl = getExpectedLivekitUrl(serverUrl);

    return host
      ? `Could not reach the meeting media server at ${host}. Check Supabase secret LIVEKIT_URL is ${expectedUrl || `wss://${host}`}, redeploy the LiveKit edge functions, and confirm the LiveKit API key/secret are from the same LiveKit Cloud project.`
      : "Could not reach the meeting media server. Check that the LiveKit URL configured in Supabase secrets is correct, starts with wss:// or https://, and is reachable from the browser.";
  }

  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("invalid token")) {
    return "The meeting media token was rejected. Check the LiveKit API key and secret configured in Supabase secrets.";
  }

  return message || "Failed to connect to the meeting media server.";
}

function getUrlHost(value?: string) {
  if (!value) return "";

  try {
    return new URL(value).host;
  } catch {
    return "";
  }
}

function getExpectedLivekitUrl(value?: string) {
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.protocol === "https:") url.protocol = "wss:";
    if (url.protocol === "http:") url.protocol = "ws:";
    url.pathname = "";
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}
