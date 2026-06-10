import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-internal-api-key, x-codex-internal-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
  const clean = raw
    .replace(/[^\w.\- ]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 120);
  return clean.toLowerCase().endsWith(".pdf") ? clean : `${clean}.pdf`;
}

function htmlToText(value: string) {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<\/(p|div|h[1-6]|li|tr|table|section|article)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wrapText(text: string, maxChars = 88) {
  const lines: string[] = [];
  for (const paragraph of text.split(/\n/)) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      if ((line + " " + word).trim().length > maxChars) {
        lines.push(line);
        line = word;
      } else {
        line = (line + " " + word).trim();
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, "\"")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function buildPdfBytes(title: string, content: string) {
  const titleLines = wrapText(title, 64).slice(0, 3);
  const contentLines = wrapText(content, 92);
  const allLines = [...titleLines, "", ...contentLines];
  const pages: string[] = [];
  const linesPerPage = 42;

  for (let i = 0; i < allLines.length; i += linesPerPage) {
    const chunk = allLines.slice(i, i + linesPerPage);
    const commands = ["BT", "/F1 11 Tf", "50 792 Td", "14 TL"];
    chunk.forEach((line, index) => {
      if (index === 0 && titleLines.includes(line)) {
        commands.push("/F1 16 Tf");
      } else if (index === titleLines.length) {
        commands.push("/F1 11 Tf");
      }
      commands.push(`(${escapePdfText(line)}) Tj`);
      commands.push("T*");
    });
    commands.push("ET");
    pages.push(commands.join("\n"));
  }

  if (pages.length === 0) pages.push("BT\n/F1 11 Tf\n50 792 Td\n(Codex Export) Tj\nET");

  const objects: string[] = [];
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  const pageObjectNumbers = pages.map((_, index) => 4 + index * 2);
  objects.push(`<< /Type /Pages /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((stream, index) => {
    const pageObj = 4 + index * 2;
    const contentObj = pageObj + 1;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObj} 0 R >>`);
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
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
    return jsonResponse({ success: false, error: "PDF service is not configured." }, 500);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const title = String(body.title || "Codex Export").slice(0, 180);
    const rawContent = String(body.html || body.markdown || body.content || body.text || "");
    const content = body.html ? htmlToText(rawContent) : rawContent.trim();
    const fileName = safeFileName(body.file_name || body.fileName, "codex-export.pdf");
    const organizationId = safeFileName(body.organization_id || body.organizationId || "workspace", "workspace").replace(/\.pdf$/, "");
    const userId = safeFileName(body.user_id || body.userId || "codex", "codex").replace(/\.pdf$/, "");
    const bucket = Deno.env.get("CODEX_EXPORTS_BUCKET") || "codex-exports";
    const path = `${organizationId}/${userId}/${Date.now()}-${fileName}`;

    const pdfBytes = buildPdfBytes(title, content || title);
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    await supabase.storage.createBucket(bucket, { public: false }).catch(() => null);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, pdfBytes, {
        contentType: "application/pdf",
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
      message: "PDF generated successfully.",
      output: "PDF generated successfully.",
      attachments: [
        {
          type: "pdf",
          name: fileName,
          url: signed.signedUrl,
          download_url: signed.signedUrl,
          metadata: {
            source: "generate-pdf",
            bucket,
            path,
          },
        },
      ],
    });
  } catch (error) {
    console.error("GENERATE PDF ERROR:", error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate PDF.",
    }, 500);
  }
});
