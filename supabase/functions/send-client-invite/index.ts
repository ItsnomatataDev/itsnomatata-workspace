import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  canUseContentStudio,
  requireAuthenticatedProfile,
} from "../_shared/edgeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

type InvitePayload = {
  email: string;
  fullName: string;
  clientId: string;
  organizationId: string;
};

serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const auth = await requireAuthenticatedProfile(req);
    if (auth instanceof Response) {
      return new Response(await auth.text(), {
        status: auth.status,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const body = (await req.json()) as Partial<InvitePayload>;

    const email = body.email?.trim();
    const fullName = body.fullName?.trim();
    const clientId = body.clientId?.trim();
    const organizationId = body.organizationId?.trim();

    if (!email || !fullName || !clientId || !organizationId) {
      return jsonResponse({
        error: "email, fullName, clientId, and organizationId are required",
      }, 400);
    }

    if (organizationId !== auth.profile.organization_id || !canUseContentStudio(auth.profile)) {
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const { data: client, error: clientError } = await auth.admin
      .from("content_clients")
      .select("id, organization_id, office_id")
      .eq("id", clientId)
      .eq("organization_id", organizationId)
      .maybeSingle();

    if (clientError) {
      return jsonResponse({ error: "Failed to verify client." }, 400);
    }

    if (!client) {
      return jsonResponse({ error: "Client not found." }, 404);
    }

    const webhookUrl = Deno.env.get("N8N_CLIENT_INVITE_WEBHOOK_URL");
    const webhookSecret = Deno.env.get("N8N_CLIENT_INVITE_WEBHOOK_SECRET");

    if (!webhookUrl) {
      return jsonResponse({ error: "Client invite service is not configured." }, 500);
    }

    const payload = {
      eventType: "client_contact_created",
      email,
      fullName,
      clientId,
      organizationId,
      sentAt: new Date().toISOString(),
    };

    const n8nResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret
          ? { "x-webhook-secret": webhookSecret }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    const responseText = await n8nResponse.text();

    if (!n8nResponse.ok) {
      console.warn("CLIENT INVITE WEBHOOK FAILED", n8nResponse.status, responseText);
      return jsonResponse({ error: "Client invite dispatch failed." }, 502);
    }

    return jsonResponse({
      ok: true,
      message: "Client invite event forwarded.",
    });
  } catch (error) {
    console.error("SEND CLIENT INVITE ERROR", error);
    return jsonResponse({ error: "Client invite failed." }, 500);
  }
});