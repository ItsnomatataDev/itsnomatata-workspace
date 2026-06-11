import RealTimeChat from "../components/RealTimeChat";
import { askAssistant } from "../../../lib/api/ai";
import type { ChatAttachment } from "../services/chatHistoryService";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useNavigate } from "react-router-dom";

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
          const response = await askAssistant({
            message: prompt,
            attachments: toAssistantAttachments(attachments || []),
            context: {
              userId,
              fullName: auth.profile?.full_name || "Workspace User",
              email: auth.profile?.email || null,
              role: auth.profile?.primary_role || "employee",
              department:
                typeof auth.profile?.department === "string"
                  ? auth.profile.department
                  : null,
              organizationId,
              currentModule: "ai-workspace",
              timezone: "Africa/Harare",
              channel: "web",
            },
            metadata: metadata || {},
          });

          const responseAttachments = toChatAttachments(response?.attachments);
          const content = String(
              response?.message ||
                response?.output ||
                response?.reply ||
                response?.content ||
                "I could not produce a response.",
            );

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
