export type N8nNotificationEmailPayload = {
  to: string;
  fullName: string;
  firstName: string;
  title: string;
  message: string;
  type: string;
  priority: string;
  actionUrl: string;
  metadata: Record<string, unknown>;
  emailHtml: string;
  subject: string;
  deliveryId?: string | null;
  notificationId?: string | null;
};

export type NotificationEmailResult = {
  ok: boolean;
  provider: "resend" | "n8n";
  status?: number;
  providerMessageId?: string | null;
  error?: string;
};

const APP_URL = "https://codex.itsnomatata.com";
const APP_NAME = "IT's Nomatata";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sourceBadgeFromMetadata(metadata: Record<string, unknown>) {
  if (typeof metadata.source_badge === "string") return metadata.source_badge;
  if (metadata.feedback_source === "client") return "Client review";
  if (metadata.feedback_source === "internal") return "Internal review";
  return null;
}

export function buildNotificationEmailHtml(params: {
  firstName: string;
  title: string;
  message: string;
  actionUrl: string;
  metadata?: Record<string, unknown>;
}) {
  const fullActionUrl = params.actionUrl.startsWith("http")
    ? params.actionUrl
    : `${APP_URL}${params.actionUrl.startsWith("/") ? params.actionUrl : `/${params.actionUrl}`}`;

  const sourceBadge = sourceBadgeFromMetadata(params.metadata ?? {});
  const reviewEvent =
    typeof params.metadata?.review_event === "string"
      ? String(params.metadata.review_event).replace(/_/g, " ")
      : null;

  const badgeHtml = sourceBadge
    ? `<p style="margin:0 0 16px;">
        <span style="display:inline-block;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;${
          sourceBadge === "Client review"
            ? "background:#0ea5e920;color:#0369a1;border:1px solid #0ea5e966;"
            : "background:#f9731620;color:#c2410c;border:1px solid #f9731666;"
        }">${escapeHtml(sourceBadge)}</span>
        ${
          reviewEvent
            ? `<span style="display:inline-block;margin-left:8px;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;background:#f4f4f5;color:#3f3f46;border:1px solid #e4e4e7;">${escapeHtml(reviewEvent)}</span>`
            : ""
        }
      </p>`
    : "";

  return `<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;margin:0;padding:24px;background:#f4f4f5;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:24px;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#ea580c;">${APP_NAME}</p>
    <h2 style="margin:0 0 16px;font-size:20px;">${escapeHtml(params.title)}</h2>
    ${badgeHtml}
    <p style="margin:0 0 12px;">Hi ${escapeHtml(params.firstName)},</p>
    <p style="margin:0 0 20px;">${escapeHtml(params.message)}</p>
    <a href="${fullActionUrl}" style="display:inline-block;background:#f97316;color:#000000;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;">Open in workspace</a>
  </div>
</body>
</html>`;
}

export function buildN8nNotificationEmailPayload(params: {
  to: string;
  fullName?: string | null;
  title: string;
  message: string;
  type?: string;
  priority?: string;
  actionUrl?: string | null;
  metadata?: Record<string, unknown>;
  deliveryId?: string | null;
  notificationId?: string | null;
}): N8nNotificationEmailPayload {
  const fullName = (params.fullName ?? "Team Member").trim() || "Team Member";
  const firstName = fullName.split(/\s+/)[0] || "there";
  const actionUrl = params.actionUrl?.trim() || "/";
  const metadata = params.metadata ?? {};
  const sourceBadge = sourceBadgeFromMetadata(metadata);
  const subject = sourceBadge
    ? `${params.title} - ${APP_NAME}`
    : `${params.title} - ${APP_NAME}`;

  return {
    to: params.to.trim(),
    fullName,
    firstName,
    title: params.title,
    message: params.message,
    type: params.type ?? "system_alert",
    priority: params.priority ?? "medium",
    actionUrl,
    metadata,
    subject,
    emailHtml: buildNotificationEmailHtml({
      firstName,
      title: params.title,
      message: params.message,
      actionUrl,
      metadata,
    }),
    deliveryId: params.deliveryId ?? null,
    notificationId: params.notificationId ?? null,
  };
}

export function getN8nNotificationWebhookConfig() {
  const webhookUrl = Deno.env.get("N8N_NOTIFICATION_WEBHOOK_URL") ?? "";
  const webhookSecret = Deno.env.get("N8N_NOTIFICATION_WEBHOOK_SECRET") ?? "";

  return { webhookUrl: webhookUrl.trim(), webhookSecret: webhookSecret.trim() };
}

export function getNotificationEmailProviderName(): "resend" | "n8n" {
  const configured = Deno.env.get("EMAIL_PROVIDER")?.trim().toLowerCase();
  if (configured === "n8n") return "n8n";
  return "resend";
}

function getResendConfig() {
  return {
    apiKey: Deno.env.get("RESEND_API_KEY")?.trim() ?? "",
    from: Deno.env.get("RESEND_FROM_EMAIL")?.trim() ?? "",
    replyTo: Deno.env.get("RESEND_REPLY_TO_EMAIL")?.trim() ?? "",
  };
}

function buildPlainTextBody(payload: N8nNotificationEmailPayload) {
  return [
    payload.title,
    "",
    `Hi ${payload.firstName},`,
    payload.message,
    "",
    payload.actionUrl.startsWith("http")
      ? payload.actionUrl
      : `${APP_URL}${payload.actionUrl.startsWith("/") ? payload.actionUrl : `/${payload.actionUrl}`}`,
  ].join("\n");
}

export async function postNotificationEmailToResend(
  payload: N8nNotificationEmailPayload,
): Promise<NotificationEmailResult> {
  const { apiKey, from, replyTo } = getResendConfig();

  if (!apiKey) {
    return { ok: false, provider: "resend", error: "RESEND_API_KEY is not configured" };
  }

  if (!from) {
    return { ok: false, provider: "resend", error: "RESEND_FROM_EMAIL is not configured" };
  }

  if (!payload.to) {
    return { ok: false, provider: "resend", error: "Missing recipient email" };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "itsnomatata-codex-supabase-edge/1.0",
        ...(payload.deliveryId
          ? { "Idempotency-Key": `notification-delivery-${payload.deliveryId}` }
          : {}),
      },
      body: JSON.stringify({
        from,
        to: [payload.to],
        subject: payload.subject,
        html: payload.emailHtml,
        text: buildPlainTextBody(payload),
        ...(replyTo ? { reply_to: replyTo } : {}),
        tags: [
          { name: "source", value: "codex" },
          { name: "type", value: payload.type.slice(0, 256) },
          { name: "priority", value: payload.priority.slice(0, 256) },
        ],
      }),
    });

    const responseBody = await response.json().catch(() => null) as
      | { id?: string; message?: string; error?: string }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        provider: "resend",
        status: response.status,
        error:
          responseBody?.message ||
          responseBody?.error ||
          `Resend returned ${response.status}`,
      };
    }

    return {
      ok: true,
      provider: "resend",
      status: response.status,
      providerMessageId: responseBody?.id ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "resend",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function postNotificationEmailToN8n(
  payload: N8nNotificationEmailPayload,
): Promise<NotificationEmailResult> {
  const { webhookUrl, webhookSecret } = getN8nNotificationWebhookConfig();

  if (!webhookUrl) {
    return { ok: false, provider: "n8n", error: "N8N_NOTIFICATION_WEBHOOK_URL is not configured" };
  }

  if (!payload.to) {
    return { ok: false, provider: "n8n", error: "Missing recipient email" };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(webhookSecret
          ? { "x-notification-secret": webhookSecret }
          : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return {
        ok: false,
        provider: "n8n",
        status: response.status,
        error: text || `Webhook returned ${response.status}`,
      };
    }

    return { ok: true, provider: "n8n", status: response.status };
  } catch (error) {
    return {
      ok: false,
      provider: "n8n",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function sendNotificationEmail(
  payload: N8nNotificationEmailPayload,
): Promise<NotificationEmailResult> {
  const provider = getNotificationEmailProviderName();
  return provider === "resend"
    ? postNotificationEmailToResend(payload)
    : postNotificationEmailToN8n(payload);
}
