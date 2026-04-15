import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type InvitePayload = {
  email: string;
  fullName: string;
  clientId: string;
  organizationId: string;
};

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const body = (await req.json()) as Partial<InvitePayload>;

    const email = body.email?.trim();
    const fullName = body.fullName?.trim();
    const clientId = body.clientId?.trim();
    const organizationId = body.organizationId?.trim();

    if (!email || !fullName || !clientId || !organizationId) {
      return new Response(
        JSON.stringify({
          error:
            "email, fullName, clientId, and organizationId are required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const webhookUrl = Deno.env.get("N8N_CLIENT_INVITE_WEBHOOK_URL");
    const webhookSecret = Deno.env.get("N8N_CLIENT_INVITE_WEBHOOK_SECRET");

    if (!webhookUrl) {
      return new Response(
        JSON.stringify({
          error: "Missing N8N_CLIENT_INVITE_WEBHOOK_URL secret",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
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
      return new Response(
        JSON.stringify({
          error: "n8n webhook request failed",
          status: n8nResponse.status,
          details: responseText,
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        message: "Client invite event forwarded to n8n",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
});