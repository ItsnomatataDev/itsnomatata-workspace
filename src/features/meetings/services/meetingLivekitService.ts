import { supabase } from "../../../lib/supabase/client";

export type MeetingLivekitTokenResponse = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  name: string;
};

function isMeetingLivekitTokenResponse(
  value: unknown,
): value is MeetingLivekitTokenResponse {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<MeetingLivekitTokenResponse>;

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

export async function getMeetingLivekitToken(
  meetingId: string,
): Promise<MeetingLivekitTokenResponse> {
  const cleanMeetingId = meetingId.trim();

  if (!cleanMeetingId) {
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
    body: { meetingId: cleanMeetingId },
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

if (error) {
  console.error("LIVEKIT EDGE FUNCTION ERROR:", error);

  throw new Error(
    error.message ||
      "LiveKit token function failed. Check Supabase Edge Function logs.",
  );
}

  if (!isMeetingLivekitTokenResponse(data)) {
    throw new Error("LiveKit token response was incomplete.");
  }

  if (!data.url.startsWith("wss://") && !data.url.startsWith("ws://")) {
    throw new Error(`Invalid LiveKit URL returned: ${data.url}`);
  }

  return data;
}