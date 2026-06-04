import { askAssistant, buildAssistantContext } from "./ai";
import { supabase } from "../supabase/client";
import { captureVideoFrameDataUrl } from "../../features/content-review/utils/videoFrameCapture";

const CONTENT_AI_WEBHOOK = import.meta.env.VITE_N8N_CONTENT_AI_WEBHOOK_URL as
  | string
  | undefined;
const FALLBACK_AI_WEBHOOK = import.meta.env.VITE_N8N_AI_WEBHOOK_URL as
  | string
  | undefined;

function getContentStudioAiWebhookUrl() {
  const webhook = CONTENT_AI_WEBHOOK?.trim() || FALLBACK_AI_WEBHOOK?.trim();
  if (!webhook) {
    throw new Error(
      "Missing VITE_N8N_CONTENT_AI_WEBHOOK_URL or VITE_N8N_AI_WEBHOOK_URL.",
    );
  }
  return webhook;
}

function getContentStudioAiRequestUrl(route: string) {
  if (import.meta.env.DEV) {
    return route;
  }
  return getContentStudioAiWebhookUrl();
}

function isUndeployedEdgeFunctionError(message: string) {
  return /failed to send a request to the edge function|functions\.fetch|function not found|404.*function/i.test(
    message,
  );
}

function isImageGenerationMisroute(message: string) {
  return /could not return a generated image|no visible image attachment was produced/i.test(
    message,
  );
}

function contentStudioEdgeAiEnabled() {
  return import.meta.env.VITE_CONTENT_STUDIO_EDGE_AI === "true";
}

async function postContentStudioRoute(
  route: string,
  body: Record<string, unknown>,
  options?: { timeoutMs?: number },
): Promise<unknown> {
  try {
    const response = await fetch(getContentStudioAiRequestUrl(route), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options?.timeoutMs ?? 120_000),
    });
    if (!response.ok) {
      const text = await response.text();
      if (response.status >= 500) {
        throw new Error(
          text
            ? `n8n returned ${response.status}: ${text}`
            : "The AI service returned an internal server error. Check your n8n workflow execution logs and webhook URL.",
        );
      }
      throw new Error(text || `Request failed (${response.status})`);
    }
    return response.json();
  } catch (error) {
    if (route.includes("generate-caption") || route.includes("analyze-media")) {
      throw error;
    }
    throw error;
  }
}

function extractN8nMessage(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const record = data as Record<string, unknown>;
  if (typeof record.output === "string") return record.output;
  if (typeof record.message === "string") return record.message;
  return "";
}

export type ContentStudioCaptionApiInput = {
  clientName: string;
  postTitle: string;
  existingCaption?: string;
  mediaDescription?: string;
  platform?: string;
  tone?: string;
  instruction?: string;
};

export type ContentStudioCaptionApiOutput = {
  generatedCaption: string;
  hashtags: string[];
  shortAlternative: string;
};

export type ContentStudioAnalyzeMediaInput = {
  clientName: string;
  postTitle: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  existingCaption?: string;
  platform?: string;
  tone?: string;
  instruction?: string;
  storagePath?: string | null;
  fileName?: string;
};

export type ContentStudioAnalyzeMediaOutput = {
  mood: string;
  sceneDescription: string;
  suggestedCaption: string;
  hashtags: string[];
  shortAlternative: string;
  platformCaptions: {
    instagram?: string;
    facebook?: string;
  };
  confidenceScore?: number;
};

function buildCaptionChatInput(input: ContentStudioCaptionApiInput) {
  return [
    "Content Studio caption task — text only, not image generation.",
    `Client: ${input.clientName}`,
    `Post: ${input.postTitle}`,
    input.mediaDescription ? `Media: ${input.mediaDescription}` : null,
    input.existingCaption ? `Current caption: ${input.existingCaption}` : null,
    input.instruction?.trim() || "Write fresh caption copy",
    input.platform ? `Platform: ${input.platform}` : null,
    input.tone ? `Tone: ${input.tone}` : null,
    "",
    'Return strict JSON only: { "generatedCaption": string, "hashtags": string[], "shortAlternative": string }',
  ]
    .filter(Boolean)
    .join("\n");
}

function buildAnalyzeChatInput(input: ContentStudioAnalyzeMediaInput) {
  return [
    `Client: ${input.clientName}`,
    `Post: ${input.postTitle}`,
    `Media type: ${input.mediaType}`,
    input.existingCaption ? `Existing caption: ${input.existingCaption}` : null,
    input.instruction?.trim() || "Analyze this media for social content",
    input.platform ? `Platform: ${input.platform}` : null,
    input.tone ? `Tone: ${input.tone}` : null,
    "",
    "Return strict JSON only with keys:",
    "mood, sceneDescription, suggestedCaption, hashtags (array), shortAlternative,",
    'platformCaptions ({ instagram?, facebook? }), confidenceScore (0-1 number)',
  ]
    .filter(Boolean)
    .join("\n");
}

function parseJsonFromText<T>(raw: string, fallback: T): T {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  const slice =
    start >= 0 && end > start ? trimmed.slice(start, end + 1) : trimmed;
  try {
    return JSON.parse(slice) as T;
  } catch {
    return fallback;
  }
}

/** Caption via dedicated proxy route → n8n (falls back to askAssistant). */
const contentStudioAiContext = buildAssistantContext({
  userId: "content-studio-system",
  organizationId: "content-studio",
  currentModule: "content-studio",
  currentRoute: "/admin/content-studio",
  role: "social_media",
  timezone: "Africa/Harare",
});

export async function requestContentStudioCaption(
  input: ContentStudioCaptionApiInput,
): Promise<ContentStudioCaptionApiOutput> {
  const n8nPayload = {
    action: "sendMessage",
    chatInput: buildCaptionChatInput(input),
    context: contentStudioAiContext,
    metadata: {
      source: "content_studio_caption",
      forceTextOnly: true,
      platform: input.platform,
      tone: input.tone,
      route: "generate-caption",
    },
  };

  try {
    const data = await postContentStudioRoute(
      "/api/content-studio/generate-caption",
      n8nPayload,
    );
    const message = extractN8nMessage(data);
    const parsed = parseJsonFromText<ContentStudioCaptionApiOutput>(message, {
      generatedCaption: message,
      hashtags: [],
      shortAlternative: "",
    });
    return {
      generatedCaption: String(
        parsed.generatedCaption ?? (parsed as { suggestedCaption?: string }).suggestedCaption ?? "",
      ),
      hashtags: Array.isArray(parsed.hashtags)
        ? parsed.hashtags.map(String)
        : [],
      shortAlternative: String(parsed.shortAlternative ?? ""),
    };
  } catch (n8nError) {
    if (contentStudioEdgeAiEnabled()) {
      try {
        const { data, error } = await supabase.functions.invoke(
          "content-studio-generate-caption",
          { body: input },
        );
      if (!error && data && !data.error) {
        return {
          generatedCaption: String(data.generatedCaption ?? ""),
          hashtags: Array.isArray(data.hashtags)
            ? data.hashtags.map(String)
            : [],
          shortAlternative: String(data.shortAlternative ?? ""),
        };
      }
        if (error && !isUndeployedEdgeFunctionError(error.message)) {
          throw error;
        }
      } catch (edgeError) {
        if (
          edgeError instanceof Error &&
          !isUndeployedEdgeFunctionError(edgeError.message)
        ) {
          throw new Error(
            `Caption assist failed (n8n: ${n8nError instanceof Error ? n8nError.message : "unknown"}; edge: ${edgeError.message})`,
          );
        }
      }
    }

    const response = await askAssistant({
      message: buildCaptionChatInput(input),
      context: buildAssistantContext({
        userId: "content-studio-system",
        organizationId: "content-studio",
        currentModule: "content-studio",
        currentRoute: "/admin/content-studio",
        role: "social_media",
        timezone: "Africa/Harare",
      }),
      metadata: {
        source: "content_studio_caption",
        forceTextOnly: true,
        platform: input.platform,
        tone: input.tone,
      },
    });
    const parsed = parseJsonFromText<ContentStudioCaptionApiOutput>(
      response.message || "",
      { generatedCaption: response.message || "", hashtags: [], shortAlternative: "" },
    );
    return {
      generatedCaption: String(parsed.generatedCaption ?? response.message ?? ""),
      hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String) : [],
      shortAlternative: String(parsed.shortAlternative ?? ""),
    };
  }
}

/** Vision via Supabase edge (downloads storage image, OpenAI vision). */
async function analyzeContentStudioMediaViaEdge(
  input: ContentStudioAnalyzeMediaInput,
): Promise<ContentStudioAnalyzeMediaOutput> {
  const { data, error } = await supabase.functions.invoke(
    "content-studio-analyze-image",
    {
      body: {
        clientName: input.clientName,
        postTitle: input.postTitle,
        existingCaption: input.existingCaption,
        imageUrl: input.mediaUrl,
        fileName: input.fileName,
      },
    },
  );

  if (error) {
    throw new Error(error.message || "content-studio-analyze-image failed");
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    throw new Error(String(data.error));
  }
  if (!data || typeof data !== "object") {
    throw new Error("content-studio-analyze-image returned no data");
  }

  const record = data as Record<string, unknown>;
  return normalizeAnalyzeOutput(
    JSON.stringify({
      mood: record.mood,
      sceneDescription: record.sceneDescription,
      suggestedCaption: record.generatedCaption ?? record.suggestedCaption,
      hashtags: record.hashtags,
      shortAlternative: record.shortAlternative,
      instagramCaption: record.instagramCaption,
      facebookCaption: record.facebookCaption,
    }),
  );
}

function formatImageAnalysisFailure(primary: Error, edgeHint?: string) {
  const msg = primary.message.trim();
  if (isImageGenerationMisroute(msg)) {
    return new Error(
      "Image analysis was routed to image generation in n8n. Re-import and publish n8n/itsnomatata-codex-internal-ai.production.workflow.json.",
    );
  }
  if (/Error in workflow/i.test(msg)) {
    return new Error(
      `Image analysis failed in n8n (${msg}). Re-import and publish n8n/itsnomatata-codex-internal-ai.production.workflow.json, then check Executions for "Content Studio Vision (OpenAI Direct)" and confirm the OpenAi account credential.${edgeHint ?? ""}`,
    );
  }
  return new Error(
    `Image analysis failed: ${msg}${edgeHint ?? ""}`,
  );
}

function isEdgeImageAnalysisUnavailable(message: string) {
  return /OPENAI_API_KEY is not configured|function not found|failed to send a request to the edge function|404/i.test(
    message,
  );
}

/**
 * Image analysis: Supabase edge (downloads storage + vision) when available,
 * then n8n Content Studio Vision branch (same OpenAI credential as Codex).
 */
export async function requestContentStudioAnalyzeMedia(
  input: ContentStudioAnalyzeMediaInput,
): Promise<ContentStudioAnalyzeMediaOutput> {
  let mediaUrl = input.mediaUrl;
  let mediaType = input.mediaType;
  let fileName = input.fileName;

  if (input.mediaType === "video") {
    mediaUrl = await captureVideoFrameDataUrl(input.mediaUrl);
    mediaType = "image";
    fileName = `${(input.fileName ?? "video").replace(/\.[^.]+$/, "")}-frame.jpg`;
  }

  const visionInput: ContentStudioAnalyzeMediaInput = {
    ...input,
    mediaUrl,
    mediaType,
    fileName,
  };

  let edgeError: Error | null = null;
  try {
    return await analyzeContentStudioMediaViaEdge(visionInput);
  } catch (error) {
    edgeError = error instanceof Error ? error : new Error(String(error));
    if (!isEdgeImageAnalysisUnavailable(edgeError.message)) {
      throw edgeError;
    }
  }

  const n8nPayload = {
    action: "sendMessage",
    chatInput: buildAnalyzeChatInput(visionInput),
    context: contentStudioAiContext,
    attachments: [
      {
        name: visionInput.fileName ?? "post-media",
        type: "image",
        url: mediaUrl.startsWith("data:") ? mediaUrl : visionInput.mediaUrl,
        mimeType: mediaUrl.startsWith("data:") ? "image/jpeg" : "image/jpeg",
      },
    ],
    metadata: {
      source: "content_studio_image_analysis",
      forceImageVision: true,
      route: "analyze-media-caption",
      mediaType: visionInput.mediaType,
      analyzedFromVideo: input.mediaType === "video",
    },
  };

  let n8nError: Error | null = null;

  try {
    const data = await postContentStudioRoute(
      "/api/content-studio/analyze-media-caption",
      n8nPayload,
      { timeoutMs: 120_000 },
    );
    const message = extractN8nMessage(data);
    const normalized = normalizeAnalyzeOutput(message);
    if (
      normalized.sceneDescription.trim() &&
      !/^openai vision failed|^no image url/i.test(normalized.sceneDescription)
    ) {
      return normalized;
    }
    if (
      normalized.suggestedCaption.trim() &&
      !/^openai vision failed|^no image url/i.test(normalized.suggestedCaption)
    ) {
      return normalized;
    }
    if (message.trim()) return normalized;
    throw new Error("n8n returned an empty image analysis response.");
  } catch (error) {
    n8nError = error instanceof Error ? error : new Error(String(error));
  }

  try {
    const response = await askAssistant({
      message: buildAnalyzeChatInput(visionInput),
      context: buildAssistantContext({
        userId: "content-studio-system",
        organizationId: "content-studio",
        currentModule: "content-studio",
        currentRoute: "/admin/content-studio",
        role: "social_media",
        timezone: "Africa/Harare",
      }),
      attachments: [
        {
          name: visionInput.fileName ?? "post-media",
          type: "image",
          url: mediaUrl.startsWith("data:") ? mediaUrl : visionInput.mediaUrl,
          mimeType: "image/jpeg",
        },
      ],
      metadata: {
        source: "content_studio_image_analysis",
        forceImageVision: true,
        analyzedFromVideo: input.mediaType === "video",
      },
    });
    const normalized = normalizeAnalyzeOutput(response.message || "");
    if (
      normalized.sceneDescription.trim() ||
      normalized.suggestedCaption.trim()
    ) {
      return normalized;
    }
  } catch {
    // fall through to combined error
  }

  const edgeHint = edgeError
    ? ` Supabase edge: ${edgeError.message} (run: supabase secrets set OPENAI_API_KEY=sk-... and deploy content-studio-analyze-image).`
    : "";
  throw formatImageAnalysisFailure(n8nError ?? new Error("Unknown error"), edgeHint);
}

function normalizeAnalyzeOutput(raw: string): ContentStudioAnalyzeMediaOutput {
  const parsed = parseJsonFromText<Record<string, unknown>>(raw, {});
  const platformRaw = parsed.platformCaptions;
  const platformRecord =
    platformRaw && typeof platformRaw === "object" && !Array.isArray(platformRaw)
      ? (platformRaw as Record<string, unknown>)
      : null;
  const platformCaptions =
    platformRecord
      ? {
          instagram: platformRecord.instagram
            ? String(platformRecord.instagram)
            : undefined,
          facebook: platformRecord.facebook
            ? String(platformRecord.facebook)
            : undefined,
        }
      : {
          instagram: parsed.instagramCaption
            ? String(parsed.instagramCaption)
            : undefined,
          facebook: parsed.facebookCaption
            ? String(parsed.facebookCaption)
            : undefined,
        };

  return {
    mood: String(parsed.mood ?? "Professional"),
    sceneDescription: String(
      parsed.sceneDescription ?? parsed.scene ?? "",
    ),
    suggestedCaption: String(
      parsed.suggestedCaption ?? parsed.generatedCaption ?? parsed.caption ?? raw.trim(),
    ),
    hashtags: Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((item) => String(item))
      : [],
    shortAlternative: String(parsed.shortAlternative ?? ""),
    platformCaptions,
    confidenceScore:
      typeof parsed.confidenceScore === "number"
        ? parsed.confidenceScore
        : undefined,
  };
}
