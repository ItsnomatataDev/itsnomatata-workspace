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

const APP_URL = "https://codex.itsnomatata.com";
const APP_NAME = "Nomatata";

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

export async function postNotificationEmailToN8n(
  payload: N8nNotificationEmailPayload,
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const { webhookUrl, webhookSecret } = getN8nNotificationWebhookConfig();

  if (!webhookUrl) {
    return { ok: false, error: "N8N_NOTIFICATION_WEBHOOK_URL is not configured" };
  }

  if (!payload.to) {
    return { ok: false, error: "Missing recipient email" };
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
        status: response.status,
        error: text || `Webhook returned ${response.status}`,
      };
    }

    return { ok: true, status: response.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
