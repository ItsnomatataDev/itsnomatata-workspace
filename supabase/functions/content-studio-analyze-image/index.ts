import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

type AnalyzeRequest = {
  clientName?: string;
  postTitle?: string;
  existingCaption?: string;
  imageUrl?: string;
  fileName?: string;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function parseStoragePath(url: string, supabaseUrl: string) {
  const base = supabaseUrl.replace(/\/$/, "");
  const patterns = [
    new RegExp(`${base}/storage/v1/object/(?:public|sign)/([^/]+)/(.+)$`),
    /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        bucket: decodeURIComponent(match[1]),
        path: decodeURIComponent(match[2].split("?")[0]),
      };
    }
  }
  return null;
}

async function loadImageAsDataUrl(imageUrl: string) {
  if (imageUrl.startsWith("data:image/")) {
    return imageUrl;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const admin = serviceKey && supabaseUrl
    ? createClient(supabaseUrl, serviceKey)
    : null;

  let fetchUrl = imageUrl;
  if (admin) {
    const storage = parseStoragePath(imageUrl, supabaseUrl);
    if (storage) {
      const { data, error } = await admin.storage
        .from(storage.bucket)
        .createSignedUrl(storage.path, 3600);
      if (!error && data?.signedUrl) fetchUrl = data.signedUrl;
    }
  }

  const response = await fetch(fetchUrl, {
    headers: { Accept: "image/*,*/*", "User-Agent": "ITsNomatata-ContentStudio/1.0" },
  });
  if (!response.ok) {
    throw new Error(
      `Could not download image (${response.status}). If this is Supabase storage, ensure the bucket exists and the service role can sign URLs.`,
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 12 * 1024 * 1024) {
    throw new Error("Image exceeds 12MB analysis limit.");
  }

  const mimeType =
    response.headers.get("content-type")?.split(";")[0]?.trim() ||
    "image/jpeg";
  return `data:${mimeType};base64,${bytesToBase64(bytes)}`;
}

async function analyzeWithOpenAI(input: AnalyzeRequest, imageDataUrl: string) {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured.");

  const prompt = [
    `Client: ${input.clientName ?? "Client"}`,
    `Post: ${input.postTitle ?? "Schedule post"}`,
    input.existingCaption ? `Existing caption: ${input.existingCaption}` : null,
    "",
    "Analyze this image for a social media schedule post.",
    "Return strict JSON only with keys:",
    "mood (string), sceneDescription (string), generatedCaption (string),",
    "hashtags (array of strings), shortAlternative (string),",
    "instagramCaption (string), facebookCaption (string).",
    "Do not invent brand names that are not visible. Be concise and professional.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageDataUrl },
        ],
      }],
    }),
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = typeof payload?.error?.message === "string"
      ? payload.error.message
      : `OpenAI vision failed (${response.status})`;
    throw new Error(message);
  }

  const parts = payload?.output;
  if (Array.isArray(parts)) {
    for (const part of parts) {
      if (part?.type === "message" && Array.isArray(part.content)) {
        const textPart = part.content.find((c: { type?: string }) =>
          c.type === "output_text"
        );
        if (textPart?.text) return String(textPart.text);
      }
    }
  }

  const fallback = payload?.output_text ?? payload?.choices?.[0]?.message?.content;
  if (typeof fallback === "string" && fallback.trim()) return fallback;
  throw new Error("OpenAI returned no analysis text.");
}

function parseAnalysis(raw: string) {
  const trimmed = raw.trim();
  const jsonStart = trimmed.indexOf("{");
  const jsonEnd = trimmed.lastIndexOf("}");
  const slice = jsonStart >= 0 && jsonEnd > jsonStart
    ? trimmed.slice(jsonStart, jsonEnd + 1)
    : trimmed;

  try {
    const parsed = JSON.parse(slice) as Record<string, unknown>;
    return {
      mood: String(parsed.mood ?? "Professional"),
      sceneDescription: String(
        parsed.sceneDescription ?? parsed.scene ?? "",
      ),
      generatedCaption: String(
        parsed.generatedCaption ?? parsed.caption ?? "",
      ),
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map((item) => String(item))
        : [],
      shortAlternative: String(parsed.shortAlternative ?? ""),
      instagramCaption: parsed.instagramCaption
        ? String(parsed.instagramCaption)
        : undefined,
      facebookCaption: parsed.facebookCaption
        ? String(parsed.facebookCaption)
        : undefined,
    };
  } catch {
    return {
      mood: "Professional",
      sceneDescription: trimmed.slice(0, 500),
      generatedCaption: trimmed,
      hashtags: [] as string[],
      shortAlternative: "",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await req.json()) as AnalyzeRequest;
    const imageUrl = body.imageUrl?.trim();
    if (!imageUrl) {
      return jsonResponse({ error: "imageUrl is required." }, 400);
    }

    const imageDataUrl = await loadImageAsDataUrl(imageUrl);
    const aiText = await analyzeWithOpenAI(body, imageDataUrl);
    return jsonResponse(parseAnalysis(aiText));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
