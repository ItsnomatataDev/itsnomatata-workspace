import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type DocumentType =
  | "payslip"
  | "warning"
  | "letter"
  | "contract"
  | "policy"
  | "announcement"
  | "leave"
  | "asset"
  | "performance"
  | "notice";

type RequestBody = {
  documentId?: string;
  organizationId?: string;
  title?: string;
  message?: string | null;
  documentType?: DocumentType;
  filePath?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  sizeBytes?: number | null;
  requiresAcknowledgement?: boolean;
  isConfidential?: boolean;
  recipientUserIds?: string[];
  metadata?: Record<string, unknown>;
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

function canSendDocuments(role: string | null | undefined) {
  return ["admin", "manager", "hr", "superadmin", "it-superadmin"].includes(role ?? "");
}

function notificationCopy(documentType: string, title: string, requiresAck: boolean) {
  if (documentType === "payslip") {
    return {
      title: "New payslip available",
      message: `${title} is available in your inbox.`,
    };
  }
  if (requiresAck) {
    return {
      title: "New HR document requires acknowledgement",
      message: "Please review and acknowledge this document.",
    };
  }
  return {
    title: "New document available",
    message: `${title} is available in your inbox.`,
  };
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse({ error: "Document function is not configured." }, 500);
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
    const organizationId = body.organizationId;
    const documentId = body.documentId;
    const title = body.title?.trim();
    const documentType = body.documentType;
    const recipientUserIds = [...new Set(body.recipientUserIds ?? [])];

    if (!organizationId) return jsonResponse({ error: "organizationId is required." }, 400);
    if (!documentId) return jsonResponse({ error: "documentId is required." }, 400);
    if (!title) return jsonResponse({ error: "title is required." }, 400);
    if (!documentType) return jsonResponse({ error: "documentType is required." }, 400);
    if (recipientUserIds.length === 0) {
      return jsonResponse({ error: "At least one recipient is required." }, 400);
    }

    const actorUserId = authData.user.id;
    const { data: actor, error: actorError } = await adminClient
      .from("profiles")
      .select("id, organization_id, primary_role, account_status, is_suspended")
      .eq("id", actorUserId)
      .maybeSingle();

    if (actorError) throw actorError;
    if (!actor || !canSendDocuments(actor.primary_role)) {
      return jsonResponse({ error: "Only admin, manager, or HR users can send documents." }, 403);
    }
    if (actor.organization_id !== organizationId && !["superadmin", "it-superadmin"].includes(actor.primary_role ?? "")) {
      return jsonResponse({ error: "You can only send documents in your organization." }, 403);
    }
    if ((actor.account_status && actor.account_status !== "active") || actor.is_suspended) {
      return jsonResponse({ error: "Your account is not active." }, 403);
    }

    const { data: recipients, error: recipientError } = await adminClient
      .from("profiles")
      .select("id, full_name, email, account_status, is_suspended")
      .eq("organization_id", organizationId)
      .in("id", recipientUserIds);

    if (recipientError) throw recipientError;
    const activeRecipients = (recipients ?? []).filter(
      (recipient) =>
        (!recipient.account_status || recipient.account_status === "active") &&
        !recipient.is_suspended,
    );
    const validRecipientIds = activeRecipients.map((recipient) => recipient.id);
    if (validRecipientIds.length === 0) {
      return jsonResponse({ error: "Can't match this user. No valid active recipients were found." }, 400);
    }
    if (validRecipientIds.length !== recipientUserIds.length) {
      return jsonResponse(
        {
          error:
            "Can't match this user. One or more selected recipients are missing, inactive, or outside this organization. Ask the sender to check the user from the list.",
        },
        400,
      );
    }

    const { error: documentError } = await adminClient
      .from("employee_documents")
      .insert({
        id: documentId,
        organization_id: organizationId,
        title,
        message: body.message?.trim() || null,
        document_type: documentType,
        file_bucket: "employee-documents",
        file_path: body.filePath ?? null,
        file_name: body.fileName ?? null,
        mime_type: body.mimeType ?? null,
        size_bytes: body.sizeBytes ?? null,
        requires_acknowledgement: Boolean(body.requiresAcknowledgement),
        is_confidential: body.isConfidential ?? true,
        created_by: actorUserId,
        metadata: body.metadata ?? {},
      });

    if (documentError) throw documentError;

    const recipientRows = validRecipientIds.map((userId) => ({
      organization_id: organizationId,
      document_id: documentId,
      user_id: userId,
      status: "unread",
    }));

    const { data: createdRecipients, error: createRecipientError } = await adminClient
      .from("employee_document_recipients")
      .insert(recipientRows)
      .select("id, user_id");

    if (createRecipientError) throw createRecipientError;

    await adminClient.from("employee_document_audit_logs").insert([
      {
        organization_id: organizationId,
        document_id: documentId,
        actor_user_id: actorUserId,
        action: "document_created",
        metadata: { recipient_count: validRecipientIds.length },
      },
      ...((createdRecipients ?? []).map((recipient) => ({
        organization_id: organizationId,
        document_id: documentId,
        recipient_id: recipient.id,
        actor_user_id: actorUserId,
        action: "document_sent",
        metadata: { user_id: recipient.user_id },
      }))),
    ]);

    const copy = notificationCopy(documentType, title, Boolean(body.requiresAcknowledgement));
    await adminClient.from("notifications").insert(
      validRecipientIds.map((userId) => ({
        organization_id: organizationId,
        user_id: userId,
        type: "employee_document",
        title: copy.title,
        message: copy.message,
        entity_type: "employee_document",
        entity_id: documentId,
        action_url: `/inbox?documentId=${documentId}`,
        priority: body.requiresAcknowledgement || documentType === "warning" ? "high" : "medium",
        category: "hr",
        actor_user_id: actorUserId,
        metadata: {
          document_type: documentType,
          requires_acknowledgement: Boolean(body.requiresAcknowledgement),
        },
      })),
    );

    return jsonResponse({
      ok: true,
      documentId,
      delivered: validRecipientIds.length,
    });
  } catch (error) {
    console.error("SEND EMPLOYEE DOCUMENTS ERROR:", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown document delivery error." },
      500,
    );
  }
});
