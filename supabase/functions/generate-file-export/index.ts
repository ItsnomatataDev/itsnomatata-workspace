import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-api-key, x-codex-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MIME_BY_FORMAT: Record<string, string> = {
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  markdown: "text/markdown; charset=utf-8",
  json: "application/json; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  html: "text/html; charset=utf-8",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function hasInternalSecret(req: Request) {
  const secret = Deno.env.get("INTERNAL_API_KEY") ??
    Deno.env.get("CODEX_TOOL_SECRET");
  if (!secret) return false;
  const inbound = req.headers.get("x-codex-internal-key") ??
    req.headers.get("x-internal-api-key");
  return inbound === secret;
}

function safeFileName(value: unknown, fallback: string) {
  const raw = typeof value === "string" && value.trim() ? value.trim() : fallback;
  return raw
    .replace(/[^\w.\- ]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
}

function normalizeContent(content: unknown, format: string) {
  if (format === "json" && typeof content !== "string") {
    return JSON.stringify(content ?? {}, null, 2);
  }
  if (typeof content === "string") return content;
  return JSON.stringify(content ?? "", null, 2);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Method not allowed" }, 405);
  }

  if (!hasInternalSecret(req)) {
    return jsonResponse({ success: false, error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: "Export service is not configured." }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const format = String(body.format || body.type || "md").toLowerCase();
    const normalizedFormat = format === "markdown" ? "md" : format;
    const mimeType = MIME_BY_FORMAT[format] ?? MIME_BY_FORMAT[normalizedFormat];

    if (!mimeType) {
      return jsonResponse({
        success: false,
        error: "Unsupported export format. Use txt, md, json, csv, or html.",
      }, 400);
    }

    const extension = normalizedFormat === "markdown" ? "md" : normalizedFormat;
    const fileName = safeFileName(
      body.file_name || body.fileName,
      `codex-export.${extension}`,
    ).replace(/\.[^.]+$/, "") + `.${extension}`;

    const content = normalizeContent(body.content ?? body.markdown ?? body.html ?? "", normalizedFormat);
    const bytes = new TextEncoder().encode(content);
    const organizationId = safeFileName(body.organization_id || body.organizationId || "workspace", "workspace");
    const userId = safeFileName(body.user_id || body.userId || "codex", "codex");
    const path = `${organizationId}/${userId}/${Date.now()}-${fileName}`;
    const bucket = Deno.env.get("CODEX_EXPORTS_BUCKET") || "codex-exports";

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    await supabase.storage.createBucket(bucket, { public: false }).catch(() => null);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, bytes, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data: signed, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    if (signedError) throw signedError;

    return jsonResponse({
      success: true,
      type: "file_export",
      message: "File generated successfully.",
      output: "File generated successfully.",
      attachments: [
        {
          type: normalizedFormat,
          name: fileName,
          url: signed.signedUrl,
          download_url: signed.signedUrl,
          metadata: {
            source: "generate-file-export",
            bucket,
            path,
            mime_type: mimeType,
          },
        },
      ],
    });
  } catch (error) {
    console.error("GENERATE FILE EXPORT ERROR:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate file.",
    }, 500);
  }
});
