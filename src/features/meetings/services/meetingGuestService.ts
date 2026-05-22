import { supabase } from "../../../lib/supabase/client";
import type { MeetingType } from "../types/meeting";
import { normalizeLivekitClientUrl } from "./livekitTokenService";

const CLIENT_LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL as
  | string
  | undefined;

export type GuestLivekitTokenResponse = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  name: string;
  guestId: string;
  meetingId: string;
  meetingTitle: string;
  meetingType: MeetingType;
};

type SupabaseFunctionError = Error & {
  context?: Response;
};

function isGuestLivekitTokenResponse(
  value: unknown,
): value is GuestLivekitTokenResponse {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<GuestLivekitTokenResponse>;

  return (
    typeof payload.token === "string" &&
    payload.token.length > 0 &&
    typeof payload.url === "string" &&
    payload.url.length > 0 &&
    typeof payload.roomName === "string" &&
    payload.roomName.length > 0 &&
    typeof payload.identity === "string" &&
    payload.identity.startsWith("guest:") &&
    typeof payload.name === "string" &&
    payload.name.length > 0 &&
    typeof payload.guestId === "string" &&
    payload.guestId.length > 0 &&
    typeof payload.meetingId === "string" &&
    payload.meetingId.length > 0 &&
    typeof payload.meetingTitle === "string" &&
    payload.meetingTitle.length > 0 &&
    (payload.meetingType === "audio" || payload.meetingType === "video")
  );
}

export async function getGuestLivekitToken(params: {
  meetingCode?: string;
  meetingId?: string;
  name: string;
  email?: string | null;
}): Promise<GuestLivekitTokenResponse> {
  const name = params.name.trim();
  const email = params.email?.trim() || null;
  const meetingCode = params.meetingCode?.trim();
  const meetingId = params.meetingId?.trim();

  if (!name) throw new Error("Please enter your name.");
  if (!meetingCode && !meetingId) {
    throw new Error("Meeting link is missing.");
  }

  const { data, error } = await supabase.functions.invoke(
    "livekit-guest-token",
    {
      body: {
        meetingCode,
        meetingId,
        name,
        email,
      },
    },
  );

  if (error) {
    throw new Error(await getFunctionErrorMessage(error));
  }

  if (!isGuestLivekitTokenResponse(data)) {
    throw new Error("Guest meeting token response was incomplete.");
  }

  return {
    ...data,
    url: normalizeLivekitClientUrl(CLIENT_LIVEKIT_URL || data.url),
  };
}

async function getFunctionErrorMessage(error: SupabaseFunctionError) {
  const fallback = error.message || "Could not join this meeting.";

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

export async function leaveGuestMeeting(params: {
  meetingId: string;
  guestId: string;
}) {
  if (!params.meetingId || !params.guestId) return;

  const { error } = await supabase.functions.invoke("livekit-guest-token", {
    body: {
      action: "leave",
      meetingId: params.meetingId,
      guestId: params.guestId,
    },
  });

  if (error) {
    throw new Error(error.message || "Could not mark guest as left.");
  }
}
