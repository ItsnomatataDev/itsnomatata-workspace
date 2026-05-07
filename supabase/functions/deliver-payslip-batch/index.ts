import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  batchId?: string;
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

    const { data: items, error: itemsError } = await adminClient
      .from("payslip_batch_items")
      .select("*")
      .eq("batch_id", batch.id)
      .eq("match_status", "matched");

    if (itemsError) throw itemsError;

    let delivered = 0;
    let failed = 0;

    for (const item of items ?? []) {
      try {
        if (!item.user_id || !item.file_path) {
          throw new Error("Missing matched user or file path.");
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

        await adminClient.from("notifications").insert({
          organization_id: batch.organization_id,
          user_id: item.user_id,
          type: "employee_document",
          title: "New payslip available",
          message: `Your ${batch.title} is available in your inbox.`,
          entity_type: "employee_document",
          entity_id: documentId,
          action_url: `/inbox?documentId=${documentId}`,
          priority: "medium",
          category: "hr",
          actor_user_id: actorUserId,
          metadata: {
            document_type: "payslip",
            payslip_batch_id: batch.id,
          },
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
