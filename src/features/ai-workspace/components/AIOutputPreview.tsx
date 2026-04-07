import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Mic,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { AIWorkspaceOutput } from "../types/aiWorkspace";

interface AIOutputPreviewProps {
  output: AIWorkspaceOutput | null;
}

function getOutputMeta(type: AIWorkspaceOutput["type"]) {
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
        title: "AI Error",
      };
    default:
      return {
        icon: <CheckCircle2 size={18} />,
        title: "AI Output",
      };
  }
}

export default function AIOutputPreview({ output }: AIOutputPreviewProps) {
  if (!output) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-sm text-gray-400">
        Select or run a tool to preview its output here.
      </div>
    );
  }

  const meta = getOutputMeta(output.type);
  const imageUrl =
    typeof output.data?.imageUrl === "string" ? output.data.imageUrl : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4 flex items-center gap-2 text-white">
        <span className="text-orange-400">{meta.icon}</span>
        <div>
          <h3 className="text-base font-semibold">{meta.title}</h3>
          <p className="text-xs text-gray-400">{output.createdAt}</p>
        </div>
      </div>

      <div className="whitespace-pre-wrap text-sm leading-6 text-gray-200">
        {output.content}
      </div>

      {imageUrl && (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <img
            src={imageUrl}
            alt="AI output"
            className="h-auto w-full object-cover"
          />
        </div>
      )}

      {output.sources && output.sources.length > 0 && (
        <div className="mt-5 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Sources
          </p>

          {output.sources.map((source, index) => (
            <div
              key={`${source.id || source.title || "source"}-${index}`}
              className="rounded-xl bg-black/20 px-3 py-3"
            >
              <p className="text-sm font-medium text-white">
                {source.title || "Untitled source"}
              </p>
              {source.snippet && (
                <p className="mt-1 text-xs leading-5 text-gray-400">
                  {source.snippet}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
