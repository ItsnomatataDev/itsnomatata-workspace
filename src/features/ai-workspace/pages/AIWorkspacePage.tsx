import RealTimeChat from "../components/RealTimeChat";
import { askAssistant, generateImage } from "../../../lib/api/ai";
import type { ChatAttachment } from "../services/chatHistoryService";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useNavigate } from "react-router-dom";
import { sendAiRouterMessage } from "../../ai-layer/services/aiRouterClient";

type AssistantAttachmentType = "image" | "audio" | "document";

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toAssistantAttachments(attachments: ChatAttachment[] = []) {
  return attachments
    .filter((item) => item.type !== "video")
    .map((item) => ({
      type: item.type as AssistantAttachmentType,
      name: item.name,
      url: item.url,
      download_url: item.download_url,
      downloadUrl: item.downloadUrl || item.download_url || item.url,
      mimeType: item.mimeType,
      size: item.size,
      metadata: item.metadata,
    }));
}

function normalizeAttachmentType(value: unknown): ChatAttachment["type"] {
  if (value === "image") return "image";
  if (value === "audio") return "audio";
  if (value === "video") return "video";
  return "document";
}



function guessMimeType(type: ChatAttachment["type"], name: string) {
  const lower = name.toLowerCase();

  if (type === "image") return "image/png";
  if (type === "audio") return "audio/mpeg";
  if (type === "video") return "video/mp4";

  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".json")) return "application/json";
  if (lower.endsWith(".html")) return "text/html";
  if (lower.endsWith(".md")) return "text/markdown";
  if (lower.endsWith(".txt")) return "text/plain";

  return "application/octet-stream";
}

function toChatAttachments(rawAttachments: unknown): ChatAttachment[] {
  if (!Array.isArray(rawAttachments)) return [];

  return rawAttachments
    .filter((item): item is Record<string, unknown> => {
      return Boolean(item) && typeof item === "object";
    })
    .map((item) => {
      const name = String(
        item.name || item.file_name || item.filename || "codex-file",
      );

      const url = String(
        item.downloadUrl ||
          item.download_url ||
          item.url ||
          item.image_url ||
          "",
      );

      const type = normalizeAttachmentType(item.type || item.file_type);

      return {
        id: String(item.id || makeId("assistant-file")),
        messageId: String(
          item.messageId || item.message_id || makeId("assistant-message"),
        ),
        type,
        name,
        url,
        download_url: url,
        downloadUrl: url,
        mimeType:
          typeof item.mimeType === "string"
            ? item.mimeType
            : typeof item.mime_type === "string"
              ? item.mime_type
              : guessMimeType(type, name),
        size: typeof item.size === "number" ? item.size : 0,
        metadata:
          item.metadata && typeof item.metadata === "object"
            ? (item.metadata as ChatAttachment["metadata"])
            : {},
        uploadedAt: String(
          item.uploadedAt || item.uploaded_at || new Date().toISOString(),
        ),
      };
    });
}

function stripRawStorageUrls(content: string, attachments: ChatAttachment[]) {
  if (!attachments.length) return content;

  const cleaned = content
    .replace(/\bhttps?:\/\/\S*(?:supabase|storage\/v1\/object)\S*/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return cleaned || "Done. The file is attached below.";
}

function readableValue(value: unknown): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^[{\[]/.test(trimmed)) {
      try {
        const parsed = JSON.parse(trimmed) as unknown;
        const parsedText = readableValue(parsed);
        if (parsedText && parsedText !== trimmed) return parsedText;
      } catch {
  
      }
    }
    return trimmed;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map(readableValue).filter(Boolean).join("\n");
  }

  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  for (const key of [
    "reply",
    "message",
    "output",
    "text",
    "content",
    "summary",
    "answer",
    "result",
    "error",
  ]) {
    const text = readableValue(record[key]);
    if (text) return text;
  }

  if (record.data && typeof record.data === "object") {
    const dataText = readableValue(record.data);
    if (dataText) return dataText;
  }

  const readableEntries = Object.entries(record)
    .filter(([, nested]) =>
      typeof nested === "string" ||
      typeof nested === "number" ||
      typeof nested === "boolean"
    )
    .map(([key, nested]) => `${key}: ${nested}`);

  return readableEntries.join("\n");
}

function shouldUseWorkspaceRouter(prompt: string) {
  const lower = prompt.toLowerCase();
  return (
    /\b(start|begin|track|trac|tracking|stop|pause|end|finish)\b.*\b(timer|time tracker|time tracking|tracking time|time)\b/.test(
      lower,
    ) ||
    /\btrac?k(?:ing)?\s+(my|his|her|their)?\s*time\b/.test(lower) ||
    /\b(show|who|which|list|people|users|team)\b.*\b(tracking|timer|time tracker|time tracking)\b/.test(
      lower,
    ) ||
    /\b(create|make|add)\b.*\b(card|task)\b/.test(lower) ||
    /\b(card|task)\b.*\b(named|called|titled)\b/.test(lower) ||
    /timesheet|time entr|hours|tracked time|active timer|currently tracking/.test(
      lower,
    ) ||
    /leave|vacation|time off|absence|pto/.test(lower) ||
    /summarize my tasks|list my boards|show my notifications|attendance|clock/.test(
      lower,
    ) ||
    /viewing|current card|this card|current board|which card|what card/.test(
      lower,
    )
  );
}

function shouldGenerateImage(prompt: string) {
  const lower = prompt.toLowerCase();
  return (
    /\b(generate|create|make|draw|design|render)\b.*\b(image|picture|photo|visual|poster|artwork|graphic|illustration)\b/.test(lower) ||
    /\bimage\s+(of|for)\b/.test(lower)
  );
}

function extractWorkspaceRouteContext(route: string) {
  const boardMatch = route.match(/\/boards\/([0-9a-f-]{36})/i);

  const params = new URLSearchParams(window.location.search);

  const cardId = params.get("cardId");

  const boardId = boardMatch?.[1] ?? null;

  return {
    boardId,
    cardId,
    selectedEntityId: cardId ?? boardId,
    selectedEntityType: cardId ? "card" : boardId ? "board" : null,
    currentModule: boardId ? "boards" : "ai-workspace",
  };
}

function buildWorkspaceContext(params: {
  userId: string;
  organizationId: string;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  department?: string | null;
}) {
  const currentRoute = `${window.location.pathname}${window.location.search}`;

  const routeContext = extractWorkspaceRouteContext(currentRoute);

  return {
    userId: params.userId,
    fullName: params.fullName || "Workspace User",
    email: params.email ?? null,
    role: params.role || "employee",
    department: params.department ?? null,
    organizationId: params.organizationId,

    currentRoute,
    currentModule: routeContext.currentModule,

    boardId: routeContext.boardId,
    cardId: routeContext.cardId,

    taskId: routeContext.cardId,
    clientId: routeContext.boardId,

    selectedEntityId: routeContext.selectedEntityId,
    selectedEntityType: routeContext.selectedEntityType,

    timezone: "Africa/Harare",
    channel: "web" as const,
  };
}


export default function AIWorkspacePage() {
  const auth = useAuth();
  const navigate = useNavigate();

  const userId = auth.user?.id || "";
  const organizationId =
    auth.currentOrganization?.organization_id ||
    auth.profile?.organization_id ||
    auth.memberships?.[0]?.organization_id ||
    "";

  return (
    <main className="h-screen min-h-screen overflow-hidden bg-black text-white">
      <RealTimeChat
        busy={false}
        userName={auth.profile?.full_name || "Workspace User"}
        role={auth.profile?.primary_role || "employee"}
        onAsk={async (
          prompt: string,
          attachments?: ChatAttachment[],
          metadata?: Record<string, unknown>,
        ) => {
          const hasAttachments = (attachments?.length ?? 0) > 0;
          const context = buildWorkspaceContext({
            userId,
            organizationId,
            fullName: auth.profile?.full_name,
            email: auth.profile?.email,
            role: auth.profile?.primary_role,
            department:
              typeof auth.profile?.department === "string"
                ? auth.profile.department
                : null,
          });

          if (shouldUseWorkspaceRouter(prompt) && !hasAttachments) {
            if (import.meta.env.DEV) {
              console.info("[AI Workspace] routing prompt through ai-router action backend");
            }
            const routerResponse = await sendAiRouterMessage({
              message: prompt,
              context,
            });

            const content = readableValue(routerResponse) || "Done.";
            return {
              content,
              attachments: [],
            };
          }

          if (shouldGenerateImage(prompt) && !hasAttachments) {
            const imageResponse = await generateImage({
              prompt,
              context,
              metadata: {
                source: "ai_workspace_chat",
                ...(metadata ?? {}),
              },
            });
            const responseAttachments = toChatAttachments(imageResponse?.attachments);
            const content =
              readableValue(imageResponse) ||
              (responseAttachments.length
                ? "Generated image attached below."
                : "I could not return a generated image.");

            return {
              content: stripRawStorageUrls(content, responseAttachments),
              attachments: responseAttachments,
            };
          }

          const response = await askAssistant({
            message: prompt,
            attachments: toAssistantAttachments(attachments || []),
            context,
            metadata: metadata || {},
          });

          const responseAttachments = toChatAttachments(response?.attachments);
          const content =
            readableValue(response) || "I could not produce a response.";

          return {
            content: stripRawStorageUrls(content, responseAttachments),
            attachments: responseAttachments,
          };
        }}
        onBack={() => navigate("/dashboard")}
      />
    </main>
  );
}
