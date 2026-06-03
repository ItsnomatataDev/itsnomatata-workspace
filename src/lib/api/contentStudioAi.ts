import { askAssistant, buildAssistantContext } from "./ai";

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

async function postContentStudioRoute(
  route: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  try {
    const response = await fetch(getContentStudioAiRequestUrl(route), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
  } catch {
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

/** Image/video analysis via dedicated proxy route → n8n vision. */
export async function requestContentStudioAnalyzeMedia(
  input: ContentStudioAnalyzeMediaInput,
): Promise<ContentStudioAnalyzeMediaOutput> {
  const n8nPayload = {
    action: "sendMessage",
    chatInput: buildAnalyzeChatInput(input),
    context: contentStudioAiContext,
    attachments: [
      {
        name: input.fileName ?? "post-media",
        type: input.mediaType === "video" ? "video" : "image",
        url: input.mediaUrl,
        mimeType: input.mediaType === "video" ? "video/mp4" : "image/jpeg",
      },
    ],
    metadata: {
      source: "content_studio_image_analysis",
      forceImageVision: true,
      route: "analyze-media-caption",
      mediaType: input.mediaType,
    },
  };

  try {
    const data = await postContentStudioRoute(
      "/api/content-studio/analyze-media-caption",
      n8nPayload,
    );
    const message = extractN8nMessage(data);
    return normalizeAnalyzeOutput(message);
  } catch {
    const response = await askAssistant({
      message: buildAnalyzeChatInput(input),
      context: buildAssistantContext({
        userId: "content-studio-system",
        organizationId: "content-studio",
        currentModule: "content-studio",
        currentRoute: "/admin/content-studio",
        role: "social_media",
        timezone: "Africa/Harare",
      }),
      attachments:
        input.mediaType === "image"
          ? [
              {
                name: input.fileName ?? "post-media",
                type: "image",
                url: input.mediaUrl,
                mimeType: "image/jpeg",
              },
            ]
          : [],
      metadata: {
        source: "content_studio_image_analysis",
        forceImageVision: true,
      },
    });
    return normalizeAnalyzeOutput(response.message || "");
  }
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
