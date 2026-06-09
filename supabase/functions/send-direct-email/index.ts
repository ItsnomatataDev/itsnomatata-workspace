import {
  buildN8nNotificationEmailPayload,
  sendNotificationEmail,
} from "../_shared/n8nNotificationEmail.ts";
import { requireAuthenticatedProfile } from "../_shared/edgeAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

type SendDirectEmailBody = {
  to?: string;
  fullName?: string | null;
  title?: string;
  message?: string | null;
  type?: string;
  priority?: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  emailHtml?: string;
  subject?: string;
};

Deno.serve(async (req) => {
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

  const body = (await req.json().catch(() => ({}))) as SendDirectEmailBody;
  const to = body.to?.trim();
  const title = body.title?.trim();

  if (!to || !title) {
    return jsonResponse({ error: "to and title are required." }, 400);
  }

  const payload = buildN8nNotificationEmailPayload({
    to,
    fullName: body.fullName,
    title,
    message: body.message?.trim() || "",
    type: body.type,
    priority: body.priority,
    actionUrl: body.actionUrl,
    metadata: body.metadata,
  });

  if (body.emailHtml?.trim()) {
    payload.emailHtml = body.emailHtml.trim();
  }
  if (body.subject?.trim()) {
    payload.subject = body.subject.trim();
  }

  const result = await sendNotificationEmail(payload);

  if (!result.ok) {
    return jsonResponse({
      ok: false,
      error: result.error ?? "Email dispatch failed.",
    }, 502);
  }

  return jsonResponse({
    ok: true,
    provider: result.provider,
    providerMessageId: result.providerMessageId ?? null,
  });
});
