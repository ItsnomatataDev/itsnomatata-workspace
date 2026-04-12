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
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json(401, { error: "Missing authorization header" });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const livekitUrl = Deno.env.get("LIVEKIT_URL");
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
      return json(500, { error: "Missing required environment variables" });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser();

    if (userError || !user) {
      return json(401, {
        error: userError?.message || "Unauthorized",
      });
    }

    const body = (await req.json()) as TokenRequestBody;
    const meetingId = body.meetingId?.trim();

    if (!meetingId) {
      return json(400, { error: "meetingId is required" });
    }

    const { data: meeting, error: meetingError } = await adminClient
      .from("meetings")
      .select("id, title, organization_id, host_id")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return json(404, {
        error: meetingError?.message || "Meeting not found",
      });
    }

    const { data: participant, error: participantError } = await adminClient
      .from("meeting_participants")
      .select("id, user_id, role")
      .eq("meeting_id", meetingId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (participantError) {
      return json(500, { error: participantError.message });
    }

    if (!participant) {
      return json(403, {
        error: "You are not a participant in this meeting",
      });
    }

    const roomName = `meeting:${meeting.id}`;
    const identity = user.id;
    const name =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      "User";

    const at = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity,
      name,
      ttl: "2h",
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

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