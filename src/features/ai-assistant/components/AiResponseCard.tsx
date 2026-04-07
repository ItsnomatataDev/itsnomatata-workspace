import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Mic,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { AssistantChatMessage } from "../services/aiAssistantService";

interface AiResponseCardProps {
  message: AssistantChatMessage;
  onActionClick?: (action: {
    id: string;
    label: string;
    payload?: Record<string, unknown>;
  }) => Promise<void> | void;
}

function getTypeMeta(type?: AssistantChatMessage["type"]) {
  switch (type) {
    case "document_summary":
      return {
        icon: <FileText size={18} />,
        title: "Document Summary",
      };
    case "image_analysis":
      return {
        icon: <ImageIcon size={18} />,
        title: "Image Analysis",
      };
    case "audio_transcript":
      return {
        icon: <Mic size={18} />,
        title: "Audio Transcript",
      };
    case "approval_request":
      return {
        icon: <ShieldAlert size={18} />,
        title: "Approval Required",
      };
    case "generated_image":
      return {
        icon: <Sparkles size={18} />,
        title: "Generated Image",
      };
    case "error":
      return {
        icon: <AlertTriangle size={18} />,
        title: "Assistant Error",
      };
    default:
      return {
        icon: <CheckCircle2 size={18} />,
        title: "Codex",
      };
  }
}

export default function AiResponseCard({
  message,
  onActionClick,
}: AiResponseCardProps) {
  const meta = getTypeMeta(message.type);
  const imageUrl =
    typeof message.data?.imageUrl === "string" ? message.data.imageUrl : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
        <span className="text-orange-400">{meta.icon}</span>
        <span>{meta.title}</span>
      </div>

      <div className="whitespace-pre-wrap text-sm leading-6 text-gray-200">
        {message.content}
      </div>

      {imageUrl && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <img
            src={imageUrl}
            alt="AI generated"
            className="h-auto w-full object-cover"
          />
        </div>
      )}

      {message.sources && message.sources.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Sources
          </p>

          <div className="space-y-2">
            {message.sources.map((source, index) => (
              <div
                key={`${source.id || source.title || "source"}-${index}`}
                className="rounded-xl bg-black/20 px-3 py-2"
              >
                <p className="text-sm font-medium text-white">
                  {source.title || "Untitled source"}
                </p>
                {source.snippet && (
                  <p className="mt-1 text-xs text-gray-400">{source.snippet}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {message.actions && message.actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {message.actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => onActionClick?.(action)}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                action.variant === "danger"
                  ? "bg-red-500/15 text-red-300 hover:bg-red-500/25"
                  : action.variant === "primary"
                    ? "bg-orange-500 text-white hover:bg-orange-600"
                    : "bg-white/10 text-gray-200 hover:bg-white/15"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
