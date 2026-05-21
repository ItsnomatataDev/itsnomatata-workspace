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

    return host
      ? `Could not reach the meeting media server at ${host}. Check that the LiveKit URL configured in Supabase secrets is correct, starts with wss:// or https://, and is reachable from the browser.`
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
