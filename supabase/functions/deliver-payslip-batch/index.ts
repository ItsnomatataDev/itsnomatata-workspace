import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  batchId?: string;
  itemIds?: string[];
};

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

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization") ?? "";
  if (!authorization.toLowerCase().startsWith("bearer ")) return null;
  return authorization.slice(7).trim() || null;
}

function canDeliverPayslips(role: string | null | undefined) {
  return ["admin", "manager", "hr", "superadmin", "it-superadmin"].includes(role ?? "");
}

function normalizeIdentity(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPayslipEmailPayload(params: {
  title: string;
  message: string;
  actionUrl: string;
  payrollMonth: number;
  payrollYear: number;
}) {
  const appUrl = Deno.env.get("APP_URL") ?? "https://codex.itsnomatata.com";
  const fullActionUrl = params.actionUrl.startsWith("http")
    ? params.actionUrl
    : `${appUrl}${params.actionUrl}`;
  const safeTitle = escapeHtml(params.title);
  const safeMessage = escapeHtml(params.message);
  const emailHtml = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111827">
      <h2 style="margin:0 0 12px;color:#111827">${safeTitle}</h2>
      <p style="margin:0 0 18px">${safeMessage}</p>
      <p style="margin:0 0 18px;color:#4b5563">Your payslip is available in your secure employee inbox.</p>
      <a href="${fullActionUrl}" style="display:inline-block;background:#f97316;color:#111827;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:700">Open payslip</a>
    </div>
  `.trim();

  return {
    title: params.title,
    body: params.message,
    action_url: params.actionUrl,
    app_url: appUrl,
    app_name: "Nomatata",
    priority: "medium",
    metadata: {
      document_type: "payslip",
      payroll_month: params.payrollMonth,
      payroll_year: params.payrollYear,
    },
    email_html: emailHtml,
    email_text: `${params.title}\n\n${params.message}\n\nOpen payslip: ${fullActionUrl}`,
  };
}

async function queuePayslipEmail(params: {
  adminClient: any;
  organizationId: string;
  userId: string;
  notificationId: string;
  documentId: string;
  recipientEmail: string | null;
  recipientName: string | null;
  title: string;
  message: string;
  actionUrl: string;
  payrollMonth: number;
  payrollYear: number;
}) {
  if (!params.recipientEmail) return;
  const payload = buildPayslipEmailPayload({
    title: params.title,
    message: params.message,
    actionUrl: params.actionUrl,
    payrollMonth: params.payrollMonth,
    payrollYear: params.payrollYear,
  });

  const { error } = await params.adminClient.from("email_events").insert({
    organization_id: params.organizationId,
    user_id: params.userId,
    notification_id: params.notificationId,
    event_type: "employee_document",
    recipient_email: params.recipientEmail,
    recipient_name: params.recipientName,
    subject: params.title,
    template_key: "employee_document",
    payload: {
      ...payload,
      metadata: {
        ...payload.metadata,
        document_id: params.documentId,
        notification_id: params.notificationId,
      },
    },
    status: "pending",
  });

  if (error) {
    console.warn("Failed to queue payslip email event.", error);
  }
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Payslip function is not configured." }, 500);
    }

    const token = getBearerToken(req);
    if (!token) return jsonResponse({ error: "Missing Authorization bearer token." }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) {
      return jsonResponse({ error: "Invalid or expired session." }, 401);
    }

    const body = (await req.json()) as RequestBody;
    if (!body.batchId) return jsonResponse({ error: "batchId is required." }, 400);

    const actorUserId = authData.user.id;
    const { data: actor, error: actorError } = await adminClient
      .from("profiles")
      .select("id, organization_id, primary_role, account_status, is_suspended")
      .eq("id", actorUserId)
      .maybeSingle();

    if (actorError) throw actorError;
    if (!actor || !canDeliverPayslips(actor.primary_role)) {
      return jsonResponse({ error: "Only admin, manager, or HR users can deliver payslips." }, 403);
    }

    const { data: batch, error: batchError } = await adminClient
      .from("payslip_batches")
      .select("*")
      .eq("id", body.batchId)
      .maybeSingle();

    if (batchError) throw batchError;
    if (!batch) return jsonResponse({ error: "Payslip batch was not found." }, 404);
    if (batch.organization_id !== actor.organization_id && !["superadmin", "it-superadmin"].includes(actor.primary_role ?? "")) {
      return jsonResponse({ error: "You can only deliver payslips in your organization." }, 403);
    }

    await adminClient
      .from("payslip_batches")
      .update({ status: "processing" })
      .eq("id", batch.id);

    let itemsQuery = adminClient
      .from("payslip_batch_items")
      .select("*")
      .eq("batch_id", batch.id)
      .eq("match_status", "matched");

    const selectedItemIds = [...new Set(body.itemIds ?? [])];
    if (selectedItemIds.length > 0) {
      itemsQuery = itemsQuery.in("id", selectedItemIds);
    }

    const { data: items, error: itemsError } = await itemsQuery;

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) {
      return jsonResponse({ error: "No selected matched payslips were found for delivery." }, 400);
    }

    let delivered = 0;
    let failed = 0;

    for (const item of items ?? []) {
      try {
        if (!item.user_id || !item.file_path) {
          throw new Error("Missing matched user or file path.");
        }

        const { data: matchedUser, error: matchedUserError } = await adminClient
          .from("profiles")
          .select("id, organization_id, full_name, email, account_status, is_suspended")
          .eq("id", item.user_id)
          .maybeSingle();

        if (matchedUserError) throw matchedUserError;
        if (!matchedUser || matchedUser.organization_id !== batch.organization_id) {
          throw new Error("Can't match this user. Ask the sender to check the employee from the list.");
        }
        if ((matchedUser.account_status && matchedUser.account_status !== "active") || matchedUser.is_suspended) {
          throw new Error("Matched employee account is not active.");
        }

        const storedEmail = normalizeIdentity(item.employee_email);
        const storedName = normalizeIdentity(item.employee_name);
        const registeredEmail = normalizeIdentity(matchedUser.email);
        const registeredName = normalizeIdentity(matchedUser.full_name);
        if (!storedEmail && !storedName) {
          throw new Error("Can't match this user. Ask the sender to check the employee from the list.");
        }
        if (storedEmail && storedEmail !== registeredEmail) {
          throw new Error("Matched email no longer matches the registered employee email.");
        }
        if (storedName && storedName !== registeredName) {
          throw new Error("Matched name no longer matches the registered employee name.");
        }

        const documentId = crypto.randomUUID();
        const title = `${batch.title} - Payslip`;
        const { error: docError } = await adminClient
          .from("employee_documents")
          .insert({
            id: documentId,
            organization_id: batch.organization_id,
            title,
            message: `Your ${batch.title} is available in your inbox.`,
            document_type: "payslip",
            file_bucket: "employee-documents",
            file_path: item.file_path,
            file_name: item.file_name,
            mime_type: "application/pdf",
            requires_acknowledgement: false,
            is_confidential: true,
            created_by: actorUserId,
            metadata: {
              payslip_batch_id: batch.id,
              payroll_month: batch.payroll_month,
              payroll_year: batch.payroll_year,
            },
          });

        if (docError) throw docError;

        const { data: recipient, error: recipientError } = await adminClient
          .from("employee_document_recipients")
          .insert({
            organization_id: batch.organization_id,
            document_id: documentId,
            user_id: item.user_id,
            status: "unread",
          })
          .select("id")
          .single();

        if (recipientError) throw recipientError;

        await adminClient.from("employee_document_audit_logs").insert([
          {
            organization_id: batch.organization_id,
            document_id: documentId,
            actor_user_id: actorUserId,
            action: "document_created",
            metadata: { payslip_batch_id: batch.id, batch_item_id: item.id },
          },
          {
            organization_id: batch.organization_id,
            document_id: documentId,
            recipient_id: recipient.id,
            actor_user_id: actorUserId,
            action: "document_sent",
            metadata: { payslip_batch_id: batch.id, batch_item_id: item.id },
          },
        ]);

        const actionUrl = `/inbox?documentId=${documentId}`;
        const notificationTitle = "New payslip available";
        const notificationMessage = `Your ${batch.title} is available in your inbox.`;
        const { data: notification, error: notificationError } = await adminClient.from("notifications").insert({
          organization_id: batch.organization_id,
          user_id: item.user_id,
          type: "employee_document",
          title: notificationTitle,
          message: notificationMessage,
          entity_type: "employee_document",
          entity_id: documentId,
          action_url: actionUrl,
          priority: "medium",
          category: "hr",
          actor_user_id: actorUserId,
          delivery_state: "processing",
          metadata: {
            document_type: "payslip",
            payslip_batch_id: batch.id,
          },
        }).select("id").single();

        if (notificationError) throw notificationError;

        await queuePayslipEmail({
          adminClient,
          organizationId: batch.organization_id,
          userId: item.user_id,
          notificationId: notification.id,
          documentId,
          recipientEmail: matchedUser.email,
          recipientName: matchedUser.full_name,
          title: notificationTitle,
          message: notificationMessage,
          actionUrl,
          payrollMonth: batch.payroll_month,
          payrollYear: batch.payroll_year,
        });

        await adminClient
          .from("payslip_batch_items")
          .update({ match_status: "delivered", document_id: documentId, error_message: null })
          .eq("id", item.id);

        delivered += 1;
      } catch (error) {
        failed += 1;
        await adminClient
          .from("payslip_batch_items")
          .update({
            match_status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown delivery error.",
          })
          .eq("id", item.id);
      }
    }

    await adminClient
      .from("payslip_batches")
      .update({
        status: failed > 0 ? (delivered > 0 ? "partial_failed" : "failed") : "delivered",
        completed_at: new Date().toISOString(),
      })
      .eq("id", batch.id);

    return jsonResponse({ ok: true, delivered, failed });
  } catch (error) {
    console.error("DELIVER PAYSLIP BATCH ERROR:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown payslip delivery error." },
      500,
    );
  }
});
