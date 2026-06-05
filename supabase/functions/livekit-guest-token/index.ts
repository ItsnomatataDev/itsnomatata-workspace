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
  action?: "join" | "leave";
  meetingCode?: string;
  meetingId?: string;
  guestId?: string;
  name?: string;
  email?: string | null;
};

type MeetingRow = {
  id: string;
  title: string;
  meeting_type: "audio" | "video";
  status: "scheduled" | "live" | "ended" | "cancelled";
  started_at: string | null;
  allow_guest_access: boolean | null;
  guest_code: string | null;
  livekit_room_name: string | null;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const livekitUrl = normalizeLivekitUrl(Deno.env.get("LIVEKIT_URL"));
    const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY");
    const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET");

    if (
      !supabaseUrl ||
      !supabaseServiceRoleKey ||
      !livekitApiKey ||
      !livekitApiSecret
    ) {
      return json(500, { error: "Missing required environment variables" });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const body = (await req.json()) as TokenRequestBody;

    if (body.action === "leave") {
      return await handleLeave(adminClient, body);
    }

    return await handleJoin(adminClient, body, {
      livekitUrl,
      livekitApiKey,
      livekitApiSecret,
    });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unexpected error",
    });
  }
});

async function handleJoin(
  adminClient: ReturnType<typeof createClient>,
  body: TokenRequestBody,
  livekit: {
    livekitUrl: string;
    livekitApiKey: string;
    livekitApiSecret: string;
  },
) {
  const meetingCode = body.meetingCode?.trim();
  const name = body.name?.trim();
  const email = body.email?.trim() || null;

  if (!meetingCode) {
    return json(400, { error: "Meeting code is required" });
  }

  if (!name) {
    return json(400, { error: "Guest name is required" });
  }

  if (name.length > 120) {
    return json(400, { error: "Guest name is too long" });
  }

  if (email && email.length > 254) {
    return json(400, { error: "Guest email is too long" });
  }

  const meeting = await findMeeting(adminClient, { meetingCode });

  if (!meeting) {
    return json(404, { error: "Meeting link is invalid" });
  }

  if (meeting.status === "ended" || meeting.status === "cancelled") {
    return json(403, { error: "This meeting has already ended" });
  }

  if (!meeting.allow_guest_access || !meeting.guest_code) {
    return json(403, { error: "Guest access is not enabled for this meeting" });
  }

  if (meeting.status === "scheduled") {
    const { error: startError } = await adminClient
      .from("meetings")
      .update({
        status: "live",
        started_at: meeting.started_at ?? new Date().toISOString(),
      })
      .eq("id", meeting.id)
      .eq("status", "scheduled");

    if (startError) {
      return json(500, { error: startError.message });
    }
  }

  const { data: guest, error: guestError } = await adminClient
    .from("meeting_guests")
    .insert({
      meeting_id: meeting.id,
      name,
      email,
      joined_at: new Date().toISOString(),
      left_at: null,
    })
    .select("id, name")
    .single();

  if (guestError || !guest) {
    return json(500, {
      error: guestError?.message || "Could not create guest participant",
    });
  }

  const roomName = resolveLivekitRoomName(meeting.id, meeting.livekit_room_name);
  const identity = `guest:${guest.id}`;

  const at = new AccessToken(livekit.livekitApiKey, livekit.livekitApiSecret, {
    identity,
    name,
    ttl: "2h",
  });

  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });

  const token = await at.toJwt();

  return json(200, {
    token,
    url: livekit.livekitUrl,
    roomName,
    identity,
    name,
    guestId: guest.id,
    meetingId: meeting.id,
    meetingTitle: meeting.title,
    meetingType: meeting.meeting_type,
  });
}

async function handleLeave(
  adminClient: ReturnType<typeof createClient>,
  body: TokenRequestBody,
) {
  const meetingId = body.meetingId?.trim();
  const guestId = body.guestId?.trim();

  if (!meetingId || !guestId) {
    return json(400, { error: "meetingId and guestId are required" });
  }

  const { error } = await adminClient
    .from("meeting_guests")
    .update({ left_at: new Date().toISOString() })
    .eq("id", guestId)
    .eq("meeting_id", meetingId)
    .is("left_at", null);

  if (error) {
    return json(500, { error: error.message });
  }

  return json(200, { ok: true });
}

async function findMeeting(
  adminClient: ReturnType<typeof createClient>,
  params: {
    meetingCode: string;
  },
): Promise<MeetingRow | null> {
  const select =
    "id, title, meeting_type, status, started_at, allow_guest_access, guest_code, livekit_room_name";

  const { data, error } = await adminClient
    .from("meetings")
    .select(select)
    .eq("guest_code", params.meetingCode)
    .maybeSingle();

  if (error) throw error;
  return (data as MeetingRow | null) ?? null;
}

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

  try {
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
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Invalid LIVEKIT_URL: ${error.message}`
        : "Invalid LIVEKIT_URL.",
    );
  }
}
