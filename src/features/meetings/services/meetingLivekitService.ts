import { supabase } from "../../../lib/supabase/client";

export type MeetingLivekitTokenResponse = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  name: string;
};

export async function getMeetingLivekitToken(
  meetingId: string,
): Promise<MeetingLivekitTokenResponse> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  console.log("SESSION DEBUG:", session);

  if (sessionError) {
    console.error("LIVEKIT TOKEN SESSION ERROR:", sessionError);
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
    console.error("LIVEKIT TOKEN FUNCTION ERROR:", error);
    throw new Error(error.message || "Failed to get LiveKit token.");
  }

  if (!data?.token || !data?.url || !data?.roomName) {
    console.error("LIVEKIT TOKEN BAD RESPONSE:", data);
    throw new Error("LiveKit token response was incomplete.");
  }

  return data as MeetingLivekitTokenResponse;
}