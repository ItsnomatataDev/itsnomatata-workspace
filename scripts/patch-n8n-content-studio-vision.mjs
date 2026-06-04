#!/usr/bin/env node
/**
 * Adds a direct OpenAI vision branch for Content Studio (bypasses main agent).
 * Run: node scripts/patch-n8n-content-studio-vision.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workflowPath = join(
  __dirname,
  "../n8n/itsnomatata-codex-internal-ai.production.workflow.json",
);

const workflow = JSON.parse(readFileSync(workflowPath, "utf8"));

const visionHttpId = "content-studio-vision-openai";
const formatVisionId = "format-content-studio-vision";

if (workflow.nodes.some((n) => n.id === visionHttpId)) {
  console.log("Workflow already patched for Content Studio vision.");
  process.exit(0);
}

workflow.nodes.push(
  {
    id: visionHttpId,
    name: "Content Studio Vision (OpenAI Direct)",
    type: "n8n-nodes-base.httpRequest",
    typeVersion: 4.2,
    position: [-520, -360],
    parameters: {
      method: "POST",
      url: "https://api.openai.com/v1/responses",
      authentication: "predefinedCredentialType",
      nodeCredentialType: "openAiApi",
      sendHeaders: true,
      headerParameters: {
        parameters: [{ name: "Content-Type", value: "application/json" }],
      },
      sendBody: true,
      specifyBody: "json",
      jsonBody:
        "={{ (() => { const s = $('05 Permission + Tool Router').first().json; const list = [...(s.attachmentSources || []), ...(s.attachments || [])]; const img = list.find(a => a && (a.type === 'image' || /\\.(jpe?g|png|webp|gif)(\\?|#|$)/i.test(String(a.url || a.download_url || '')))); const url = String(img?.download_url || img?.url || ''); const prompt = String(s.chatInput || s.message || 'Analyze this image for social content.'); return JSON.stringify({ model: 'gpt-4o-mini', input: [{ role: 'user', content: [{ type: 'input_text', text: prompt }, { type: 'input_image', image_url: url }] }] }); })() }}",
      options: { timeout: 120000 },
    },
    credentials: {
      openAiApi: {
        id: "AMCuIhOcN1ffKYz9",
        name: "OpenAi account",
      },
    },
  },
  {
    id: formatVisionId,
    name: "Format Content Studio Vision JSON",
    type: "n8n-nodes-base.code",
    typeVersion: 2,
    position: [-280, -360],
    parameters: {
      jsCode: `const source = $('05 Permission + Tool Router').first().json;
let raw = '';
const payload = $json;
if (Array.isArray(payload?.output)) {
  for (const part of payload.output) {
    if (part?.type === 'message' && Array.isArray(part.content)) {
      const textPart = part.content.find(c => c.type === 'output_text');
      if (textPart?.text) raw = String(textPart.text);
    }
  }
}
if (!raw) raw = String(payload?.output_text || payload?.text || '').trim();
const trimmed = raw.trim();
const start = trimmed.indexOf('{');
const end = trimmed.lastIndexOf('}');
const jsonSlice = start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
let parsed = {};
try { parsed = JSON.parse(jsonSlice); } catch { parsed = { sceneDescription: trimmed, suggestedCaption: trimmed }; }
const out = {
  mood: String(parsed.mood || 'Professional'),
  sceneDescription: String(parsed.sceneDescription || parsed.scene || trimmed.slice(0, 800)),
  suggestedCaption: String(parsed.suggestedCaption || parsed.generatedCaption || parsed.caption || ''),
  hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
  shortAlternative: String(parsed.shortAlternative || ''),
  platformCaptions: parsed.platformCaptions && typeof parsed.platformCaptions === 'object' ? parsed.platformCaptions : {
    instagram: parsed.instagramCaption ? String(parsed.instagramCaption) : undefined,
    facebook: parsed.facebookCaption ? String(parsed.facebookCaption) : undefined,
  },
  confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.85,
};
const message = JSON.stringify(out);
return [{ json: {
  success: true,
  type: 'image_analysis',
  message,
  output: message,
  conversationId: source.conversationId || null,
  attachments: [],
  sources: [],
}}];`,
    },
  },
);

const routeSwitch = workflow.nodes.find((n) => n.name === "Route Image Generation?");
if (!routeSwitch) throw new Error("Route Image Generation? node not found");

routeSwitch.parameters.rules.values.push({
  renameOutput: true,
  outputKey: "image_analysis",
  conditions: {
    conditions: [
      {
        leftValue: "={{ $json.route }}",
        rightValue: "image_analysis",
        operator: { type: "string", operation: "equals" },
      },
    ],
    combinator: "and",
    options: {
      caseSensitive: true,
      typeValidation: "strict",
      version: 2,
    },
  },
});

// Router: Content Studio vision always uses direct branch
const router = workflow.nodes.find((n) => n.name === "05 Permission + Tool Router");
if (router?.parameters?.jsCode) {
  router.parameters.jsCode = router.parameters.jsCode.replace(
    "const contentStudioVision = metadataSource === 'content_studio_image_analysis' || $json.metadata?.forceImageVision === true;",
    "const contentStudioVision = metadataSource === 'content_studio_image_analysis' || $json.metadata?.forceImageVision === true;\nif (contentStudioVision && hasImageAttachment) {\n  return [{ json: { ...$json, chatInput, message: chatInput, route: 'image_analysis', allowed: true, routing: { contentStudioVision: true, hasImageAttachment } }, binary: $binary }];\n}",
  );
}

// Switch outputs: 0=edit, 1=generate, 2=ocr, 3=image_analysis, 4=fallback (main agent)
const routeMain = workflow.connections["Route Image Generation?"].main;
routeMain.splice(3, 0, [
  {
    node: "Content Studio Vision (OpenAI Direct)",
    type: "main",
    index: 0,
  },
]);

workflow.connections["Content Studio Vision (OpenAI Direct)"] = {
  main: [
    [
      {
        node: "Format Content Studio Vision JSON",
        type: "main",
        index: 0,
      },
    ],
  ],
};

workflow.connections["Format Content Studio Vision JSON"] = {
  main: [
    [
      {
        node: "07 Safe Response Contract",
        type: "main",
        index: 0,
      },
    ],
  ],
};

writeFileSync(workflowPath, `${JSON.stringify(workflow, null, 2)}\n`);
console.log("Patched", workflowPath);
console.log("Re-import this JSON in n8n and publish the workflow.");
