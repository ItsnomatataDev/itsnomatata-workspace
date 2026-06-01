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
      ? `Could not reach the meeting media server at ${host}. The browser must open a WebSocket to ${expectedUrl || `wss://${host}`} (HTTPS on port 443 with a valid TLS certificate). Verify your self-hosted LiveKit VPS is running, DNS points to it, the firewall allows 443/tcp (and LiveKit RTC UDP ports), and your reverse proxy forwards WebSocket traffic to LiveKit. Supabase LIVEKIT_URL should be ${expectedUrl || `wss://${host}`}; LIVEKIT_API_KEY and LIVEKIT_API_SECRET must match the keys in your server livekit.yaml.`
      : "Could not reach the meeting media server. Check that LIVEKIT_URL in Supabase secrets is correct (wss://your-host), the self-hosted server is reachable on HTTPS/WebSocket, and API key/secret match your LiveKit server config.";
  }

  if (lowerMessage.includes("unauthorized") || lowerMessage.includes("invalid token")) {
    return "The meeting media token was rejected. Check LIVEKIT_API_KEY and LIVEKIT_API_SECRET in Supabase match the keys in your self-hosted LiveKit server config (livekit.yaml), then redeploy the livekit-token and livekit-guest-token edge functions.";
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
