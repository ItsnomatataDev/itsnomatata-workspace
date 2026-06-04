#!/usr/bin/env node
/**
 * Seed a demo tech client + June schedule with AI-style post images, then test caption AI.
 *
 * Prerequisites (.env in project root):
 *   SUPABASE_SERVICE_ROLE_KEY
 *   VITE_SUPABASE_URL (or SUPABASE_URL)
 *   DEFAULT_ORGANIZATION_ID
 *   VITE_N8N_AI_WEBHOOK_URL (for caption + vision analysis)
 *   INTERNAL_APP_BASE_URL (optional, for printed editor link)
 *
 * Usage:
 *   node scripts/seed-tech-client-caption-test.mjs
 *   node scripts/seed-tech-client-caption-test.mjs --skip-ai
 *   node scripts/seed-tech-client-caption-test.mjs --posts 3
 */

import crypto from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BUCKET = "content-review-assets";
const ASSET_RETENTION_DAYS = 60;

const TECH_COMPANY = {
  companyName: "Nebula Stack Labs",
  contactName: "Alex Chen",
  emailPrefix: "nebula.caption.test",
  scheduleTitle: "Nebula Stack Labs — June 2026 SM Schedule",
  subtitle: "B2B SaaS · AI infrastructure · Developer tools",
};

const POST_IMAGE_SPECS = [
  {
    slot: 0,
    label: "Product dashboard",
    prompt:
      "modern B2B SaaS analytics dashboard on ultrawide monitor, dark UI, data charts, tech startup office, photorealistic, no text logos",
  },
  {
    slot: 1,
    label: "Team collaboration",
    prompt:
      "diverse software engineering team whiteboarding in glass-walled tech office, laptops, warm lighting, candid corporate photo",
  },
  {
    slot: 2,
    label: "AI / cloud",
    prompt:
      "abstract visualization of neural network and cloud computing nodes, cyan and purple glow, futuristic technology marketing image",
  },
  {
    slot: 3,
    label: "Mobile app",
    prompt:
      "hand holding smartphone showing minimal productivity app interface mockup, shallow depth of field, clean product marketing photo",
  },
];

function loadEnv() {
  const env = {};
  for (const file of [".env.local", ".env"]) {
    const path = join(ROOT, file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      value = value.replace(/^["']|["']$/g, "");
      env[key] = value;
    }
  }
  return env;
}

function requireEnv(env, key) {
  const value = env[key]?.trim();
  if (!value) {
    throw new Error(`Missing ${key} in .env`);
  }
  return value;
}

function parseArgs(argv) {
  const flags = { skipAi: false, posts: POST_IMAGE_SPECS.length };
  for (let i = 2; i < argv.length; i += 1) {
    if (argv[i] === "--skip-ai") flags.skipAi = true;
    if (argv[i] === "--posts" && argv[i + 1]) {
      flags.posts = Math.max(1, Math.min(POST_IMAGE_SPECS.length, Number(argv[++i]) || 4));
    }
  }
  return flags;
}

function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString("hex");
}

function pinHash(portalToken, rawPin) {
  return crypto
    .createHash("sha256")
    .update(`${portalToken}:${rawPin}`)
    .digest("hex");
}

function generatePin() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}

function reviewToken() {
  return randomToken(18);
}

function buildReviewUrl(token, baseUrl) {
  const base = (baseUrl || "http://localhost:5173").replace(/\/$/, "");
  return `${base}/internal-preview/${token}`;
}

/** Free placeholder images (Pollinations often returns 402 without API key). */
function stockImageUrl(seed, topic) {
  const q = encodeURIComponent(topic.replace(/\s+/g, ","));
  return `https://loremflickr.com/1024/1024/${q}?lock=${seed}`;
}

async function downloadImage(url, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "image/*", "User-Agent": "ITsNomatata-CaptionSeed/1.0" },
        signal: AbortSignal.timeout(120_000),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 8_000) {
        throw new Error(`Image too small (${bytes.byteLength} bytes)`);
      }
      const contentType = response.headers.get("content-type") || "image/jpeg";
      return { bytes, contentType };
    } catch (error) {
      lastError = error;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastError;
}

function extractN8nMessage(data) {
  if (!data || typeof data !== "object") return "";
  if (typeof data.output === "string") return data.output;
  if (typeof data.message === "string") return data.message;
  return "";
}

function parseJsonFromText(raw, fallback) {
  const trimmed = String(raw || "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const slice = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  try {
    return JSON.parse(slice);
  } catch {
    return fallback;
  }
}

function buildAssistantContext() {
  return {
    userId: "content-studio-system",
    organizationId: "content-studio",
    currentModule: "content-studio",
    currentRoute: "/admin/content-studio",
    role: "social_media",
    timezone: "Africa/Harare",
  };
}

async function postToN8n(webhookUrl, body) {
  const target = new URL(webhookUrl);
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`n8n ${response.status}: ${text.slice(0, 400)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    return { output: text };
  }
}

async function requestCaptionEdge(supabase, input) {
  const { data, error } = await supabase.functions.invoke(
    "content-studio-generate-caption",
    { body: input },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return {
    generatedCaption: data.generatedCaption ?? "",
    hashtags: Array.isArray(data.hashtags) ? data.hashtags : [],
    shortAlternative: data.shortAlternative ?? "",
  };
}

async function requestCaption(webhookUrl, input) {
  const chatInput = [
    "Content Studio caption task — text only, not image generation.",
    `Client: ${input.clientName}`,
    `Post: ${input.postTitle}`,
    input.mediaDescription ? `Media: ${input.mediaDescription}` : null,
    input.instruction || "Write fresh caption copy for LinkedIn and Instagram",
    input.platform ? `Platform: ${input.platform}` : "Platform: linkedin",
    input.tone ? `Tone: ${input.tone}` : "Tone: professional, innovative",
    "",
    'Return strict JSON only: { "generatedCaption": string, "hashtags": string[], "shortAlternative": string }',
  ]
    .filter(Boolean)
    .join("\n");

  const data = await postToN8n(webhookUrl, {
    action: "sendMessage",
    chatInput,
    context: buildAssistantContext(),
    metadata: {
      source: "content_studio_caption",
      forceTextOnly: true,
      platform: input.platform ?? "linkedin",
      tone: input.tone ?? "professional",
      route: "generate-caption",
    },
  });

  const message = extractN8nMessage(data);
  return parseJsonFromText(message, {
    generatedCaption: message,
    hashtags: [],
    shortAlternative: "",
  });
}

async function requestAnalyzeEdge(supabase, input) {
  const { data, error } = await supabase.functions.invoke(
    "content-studio-analyze-image",
    {
      body: {
        clientName: input.clientName,
        postTitle: input.postTitle,
        imageUrl: input.mediaUrl,
        fileName: input.fileName,
      },
    },
  );
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return {
    sceneDescription: data.sceneDescription ?? "",
    suggestedCaption: data.generatedCaption ?? "",
    hashtags: data.hashtags ?? [],
  };
}

async function requestAnalyze(webhookUrl, input) {
  const chatInput = [
    `Client: ${input.clientName}`,
    `Post: ${input.postTitle}`,
    "Media type: image",
    input.instruction || "Analyze this media for social content",
    "Platform: linkedin",
    "Tone: professional, innovative",
    "",
    "Return strict JSON only with keys:",
    "mood, sceneDescription, suggestedCaption, hashtags (array), shortAlternative,",
    "platformCaptions ({ instagram?, facebook? }), confidenceScore (0-1 number)",
  ].join("\n");

  const data = await postToN8n(webhookUrl, {
    action: "sendMessage",
    chatInput,
    context: buildAssistantContext(),
    attachments: [
      {
        name: input.fileName ?? "post-media.jpg",
        type: "image",
        url: input.mediaUrl,
        mimeType: "image/jpeg",
      },
    ],
    metadata: {
      source: "content_studio_image_analysis",
      forceImageVision: true,
      route: "analyze-media-caption",
      mediaType: "image",
    },
  });

  const message = extractN8nMessage(data);
  return parseJsonFromText(message, {
    mood: "",
    sceneDescription: message,
    suggestedCaption: "",
    hashtags: [],
    shortAlternative: "",
    platformCaptions: {},
  });
}

async function main() {
  const flags = parseArgs(process.argv);
  const env = loadEnv();

  const supabaseUrl = requireEnv(env, "VITE_SUPABASE_URL");
  const serviceKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const organizationId = requireEnv(env, "DEFAULT_ORGANIZATION_ID");
  const n8nWebhook = env.VITE_N8N_AI_WEBHOOK_URL?.trim();
  const appBase = env.INTERNAL_APP_BASE_URL?.trim() || "http://localhost:5173";

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: offices, error: officeError } = await supabase
    .from("company_offices")
    .select("id, name")
    .eq("organization_id", organizationId)
    .limit(1);

  if (officeError || !offices?.length) {
    throw new Error(officeError?.message || "No office found for DEFAULT_ORGANIZATION_ID");
  }
  const officeId = offices[0].id;

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("organization_id", organizationId)
    .limit(1);

  const createdBy = profiles?.[0]?.id ?? null;
  const stamp = Date.now();
  const portalToken = randomToken();
  const rawPin = generatePin();
  const email = `${TECH_COMPANY.emailPrefix}+${stamp}@itsnomatata.test`;

  console.log("\n=== 1) Create demo client ===");
  const { data: client, error: clientError } = await supabase
    .from("content_clients")
    .insert({
      organization_id: organizationId,
      office_id: officeId,
      company_name: TECH_COMPANY.companyName,
      contact_name: TECH_COMPANY.contactName,
      email,
      phone: "+263 77 000 0000",
      portal_token: portalToken,
      login_pin_hash: pinHash(portalToken, rawPin),
      pin_last_generated_at: new Date().toISOString(),
      is_active: true,
      created_by: createdBy,
    })
    .select("id, company_name, portal_token")
    .single();

  if (clientError) throw clientError;
  console.log(`Client: ${client.company_name} (${client.id})`);
  console.log(`Portal email: ${email}`);
  console.log(`Portal PIN: ${rawPin}`);
  console.log(`Portal path: /client-portal/${client.portal_token}/login`);

  const token = reviewToken();
  const monthStart = `${new Date().toISOString().slice(0, 7)}-01T08:00:00.000Z`;

  console.log("\n=== 2) Create schedule draft ===");
  const { data: draft, error: draftError } = await supabase
    .from("content_review_drafts")
    .insert({
      organization_id: organizationId,
      office_id: officeId,
      created_by: createdBy,
      client_id: client.id,
      title: TECH_COMPANY.scheduleTitle,
      subtitle: TECH_COMPANY.subtitle,
      layout_type: "media_showcase",
      review_token: token,
      review_url: buildReviewUrl(token, appBase),
      status: "draft",
      review_status: "draft",
      scheduled_at: monthStart,
      expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    })
    .select("id, title, review_url")
    .single();

  if (draftError) throw draftError;
  console.log(`Draft: ${draft.title}`);
  console.log(`Editor: ${appBase.replace(/\/$/, "")}/admin/content-studio/editor/${draft.id}`);

  const posts = POST_IMAGE_SPECS.slice(0, flags.posts);
  const assetRows = [];

  console.log("\n=== 3) Download AI-style images & upload to storage ===");
  for (const spec of posts) {
    const seed = stamp + spec.slot;
    const imageUrl = stockImageUrl(seed, spec.label);
    process.stdout.write(`  Post ${spec.slot + 1} (${spec.label})… `);

    let bytes;
    let contentType;
    let source = "loremflickr";
    try {
      ({ bytes, contentType } = await downloadImage(imageUrl));
    } catch (primaryError) {
      source = "picsum";
      const fallback = `https://picsum.photos/seed/nebula${seed}/1024/1024`;
      ({ bytes, contentType } = await downloadImage(fallback));
    }
    console.log(`done (${source})`);

    const ext = contentType.includes("png") ? "png" : "jpg";
    const fileName = `nebula-post-${spec.slot + 1}.${ext}`;
    const storagePath = `${organizationId}/${draft.id}/${Date.now()}-${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, bytes, {
        contentType: contentType || "image/jpeg",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const expiresAt = new Date(
      Date.now() + ASSET_RETENTION_DAYS * 86400000,
    ).toISOString();

    const { data: asset, error: assetError } = await supabase
      .from("content_review_assets")
      .insert({
        draft_id: draft.id,
        organization_id: organizationId,
        office_id: officeId,
        uploaded_by: createdBy,
        file_name: fileName,
        file_url: publicUrl.publicUrl,
        storage_path: storagePath,
        mime_type: contentType || "image/jpeg",
        asset_type: "image",
        is_selected: true,
        heading: spec.label,
        caption: null,
        sort_order: spec.slot,
        display_slot: spec.slot,
        expires_at: expiresAt,
        compression_status: "not_applicable",
      })
      .select("id, file_url, display_slot, heading")
      .single();

    if (assetError) throw assetError;
    assetRows.push({ ...asset, spec });
  }

  if (flags.skipAi) {
    console.log("\n--skip-ai: seeded client + images only. Open the editor and run AI there.");
    printSummary({ client, draft, email, rawPin, assetRows, aiResults: [] });
    return;
  }

  if (!n8nWebhook) {
    console.warn("\nVITE_N8N_AI_WEBHOOK_URL not set — skipping caption tests.");
    printSummary({ client, draft, email, rawPin, assetRows, aiResults: [] });
    return;
  }

  console.log("\n=== 4) AI caption tests (n8n) ===");
  const aiResults = [];

  for (const asset of assetRows) {
    const postTitle = `${draft.title} — Post ${asset.display_slot + 1}`;
    console.log(`\n--- Post ${asset.display_slot + 1}: ${asset.heading} ---`);

    let analysis = null;
    let caption = null;

    try {
      process.stdout.write("  Vision (n8n)… ");
      analysis = await requestAnalyze(n8nWebhook, {
        clientName: TECH_COMPANY.companyName,
        postTitle,
        mediaUrl: asset.file_url,
        fileName: asset.file_name,
        instruction: `Describe this image for ${TECH_COMPANY.companyName}, a B2B tech brand.`,
      });
      console.log("ok");
    } catch (n8nErr) {
      try {
        process.stdout.write(`n8n failed; edge… `);
        analysis = await requestAnalyzeEdge(supabase, {
          clientName: TECH_COMPANY.companyName,
          postTitle,
          mediaUrl: asset.file_url,
          fileName: asset.file_name,
        });
        console.log("ok");
      } catch (edgeErr) {
        console.log(`failed (${edgeErr.message})`);
      }
    }

    const captionInput = {
      clientName: TECH_COMPANY.companyName,
      postTitle,
      mediaDescription:
        analysis?.sceneDescription?.trim() ||
        `${asset.heading}: ${asset.spec.prompt.slice(0, 160)}`,
      platform: "linkedin",
      tone: "professional, innovative",
      instruction:
        "Write a short LinkedIn caption that matches the image. Mention Nebula Stack Labs subtly.",
    };

    try {
      process.stdout.write("  Caption (n8n)… ");
      caption = await requestCaption(n8nWebhook, captionInput);
      console.log("ok");
    } catch (n8nError) {
      try {
        process.stdout.write(`n8n failed (${n8nError.message}); edge… `);
        caption = await requestCaptionEdge(supabase, captionInput);
        console.log("ok");
      } catch (edgeError) {
        console.log(`failed (${edgeError.message})`);
      }
    }

    if (caption?.generatedCaption) {
      await supabase
        .from("content_review_assets")
        .update({ caption: caption.generatedCaption.slice(0, 2000) })
        .eq("id", asset.id);
    }

    aiResults.push({
      slot: asset.display_slot + 1,
      label: asset.heading,
      sceneDescription: analysis?.sceneDescription ?? null,
      suggestedCaption: analysis?.suggestedCaption ?? null,
      generatedCaption: caption?.generatedCaption ?? null,
      hashtags: caption?.hashtags ?? analysis?.hashtags ?? [],
    });

    if (analysis?.suggestedCaption) {
      console.log(`  Scene: ${String(analysis.sceneDescription).slice(0, 140)}…`);
    }
    if (caption?.generatedCaption) {
      console.log(`  Caption: ${String(caption.generatedCaption).slice(0, 200)}…`);
    }
  }

  printSummary({ client, draft, email, rawPin, assetRows, aiResults });
}

function printSummary({ client, draft, email, rawPin, assetRows, aiResults }) {
  console.log("\n========== SUMMARY ==========");
  console.log(JSON.stringify(
    {
      clientId: client.id,
      draftId: draft.id,
      company: TECH_COMPANY.companyName,
      portalLogin: { email, pin: rawPin },
      editorUrl: `/admin/content-studio/editor/${draft.id}`,
      internalPreview: draft.review_url,
      posts: assetRows.map((a) => ({
        slot: a.display_slot + 1,
        label: a.heading,
        assetId: a.id,
        fileUrl: a.file_url,
      })),
      ai: aiResults,
    },
    null,
    2,
  ));
  console.log("============================\n");
}

main().catch((error) => {
  console.error("\nSeed failed:", error.message || error);
  process.exit(1);
});
