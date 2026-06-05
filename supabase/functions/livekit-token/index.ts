import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type TokenRequestBody = {
  meetingId?: string;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return json(200, { ok: true });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return json(401, { error: "Missing or invalid authorization header" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const rawLivekitUrl = Deno.env.get("LIVEKIT_URL");
    const livekitUrl = normalizeLivekitUrl(rawLivekitUrl);
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (
      !supabaseUrl ||
      !supabaseAnonKey ||
      !supabaseServiceRoleKey ||
      !livekitUrl ||
      !livekitApiKey ||
      !livekitApiSecret
    ) {
      return json(500, { error: "LiveKit token service is not configured" });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return json(401, {
        error: userError?.message || "Unauthorized user",
      });
    }

    let body: TokenRequestBody;

    try {
      body = (await req.json()) as TokenRequestBody;
    } catch {
      return json(400, { error: "Invalid JSON body" });
    }

    const meetingId = body.meetingId?.trim();

    if (!meetingId) {
      return json(400, { error: "meetingId is required" });
    }

    const { data: meeting, error: meetingError } = await adminClient
      .from("meetings")
      .select("id, title, organization_id, host_id, status, livekit_room_name")
      .eq("id", meetingId)
      .maybeSingle();

    if (meetingError) {
      return json(500, {
        error: `Failed to fetch meeting: ${meetingError.message}`,
      });
    }

    if (!meeting) {
      return json(404, { error: "Meeting not found" });
    }

    if (meeting.status === "ended" || meeting.status === "cancelled") {
      return json(400, { error: "This meeting has already ended" });
    }

    const { data: participant, error: participantError } = await adminClient
      .from("meeting_participants")
      .select("id, user_id, role")
      .eq("meeting_id", meetingId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (participantError) {
      return json(500, {
        error: `Failed to fetch participant: ${participantError.message}`,
      });
    }

    if (!participant && meeting.host_id !== user.id) {
      return json(403, {
        error: "You are not a participant in this meeting",
      });
    }

    const roomName = resolveLivekitRoomName(meeting.id, meeting.livekit_room_name);
    const identity = user.id;
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      "User";

    const tokenBuilder = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity,
      name,
      ttl: "2h",
    });

    tokenBuilder.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await tokenBuilder.toJwt();

    return json(200, {
      token,
      url: livekitUrl,
      roomName,
      identity,
      name,
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unexpected error",
    });
  }
});

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function resolveLivekitRoomName(
  meetingId: string,
  livekitRoomName: string | null | undefined,
) {
  const trimmed = livekitRoomName?.trim();
  if (trimmed) return trimmed;
  return `meeting:${meetingId}`;
}

function normalizeLivekitUrl(value: string | undefined) {
  if (!value?.trim()) return null;

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
    throw new Error("LIVEKIT_URL must use wss://, ws://, https://, or http://.");
  }

  url.pathname = "";
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
}
