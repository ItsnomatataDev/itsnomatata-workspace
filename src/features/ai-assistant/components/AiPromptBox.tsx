import { useRef, useState } from "react";
import { Image, Mic, Paperclip, Send, Sparkles } from "lucide-react";
import type { AssistantAttachmentInput } from "../../../lib/api/n8n";

export type PromptMode = "ask" | "analyze" | "create" | "action";

interface AiPromptBoxProps {
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  onSend: (payload: {
    text: string;
    attachments: AssistantAttachmentInput[];
    mode: PromptMode;
  }) => Promise<void> | void;
}

function detectAttachmentType(file: File): AssistantAttachmentInput["type"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";

  if (
    file.type.includes("pdf") ||
    file.type.includes("document") ||
    file.type.includes("text") ||
    file.type.includes("word") ||
    file.type.includes("sheet") ||
    file.type.includes("presentation")
  ) {
    return "document";
  }

  return "unknown";
}

function makeAttachmentId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function AiPromptBox({
  disabled = false,
  busy = false,
  placeholder = "Ask Copilot anything about your work, tasks, files, or projects...",
  onSend,
}: AiPromptBoxProps) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<PromptMode>("ask");
  const [attachments, setAttachments] = useState<AssistantAttachmentInput[]>(
    [],
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const isDisabled = disabled || busy;

  function handlePickFiles() {
    fileInputRef.current?.click();
  }

  function handleFilesSelected(files: FileList | null) {
    if (!files?.length) return;

    const mapped = Array.from(files).map<AssistantAttachmentInput>((file) => ({
      id: makeAttachmentId(),
      name: file.name,
      mimeType: file.type,
      size: file.size,
      type: detectAttachmentType(file),
    }));

    setAttachments((prev) => [...prev, ...mapped]);
  }

  function removeAttachment(id?: string) {
    if (!id) return;
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  }

  async function submit() {
    const trimmed = text.trim();

    if (!trimmed && attachments.length === 0) return;

    await onSend({
      text: trimmed,
      attachments,
      mode,
    });

    setText("");
    setAttachments([]);
    setMode("ask");
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 shadow-sm">
      <div className="mb-3 flex flex-wrap gap-2">
        {(["ask", "analyze", "create", "action"] as PromptMode[]).map(
          (item) => {
            const active = item === mode;

            return (
              <button
                key={item}
                type="button"
                onClick={() => setMode(item)}
                disabled={isDisabled}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? "bg-orange-500 text-white"
                    : "bg-white/5 text-gray-300 hover:bg-white/10"
                }`}
              >
                {item === "ask" && "Ask"}
                {item === "analyze" && "Analyze"}
                {item === "create" && "Create"}
                {item === "action" && "Action"}
              </button>
            );
          },
        )}
      </div>

      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2 text-sm text-gray-200"
            >
              <span className="max-w-45 truncate">{attachment.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(attachment.id)}
                className="text-gray-400 hover:text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={placeholder}
            disabled={isDisabled}
            rows={4}
            className="min-h-27.5 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-gray-400 focus:border-orange-500"
          />
        </div>

        <div className="flex items-center gap-2 md:flex-col">
          <button
            type="button"
            onClick={handlePickFiles}
            disabled={isDisabled}
            className="rounded-xl bg-white/5 p-3 text-gray-200 transition hover:bg-white/10 disabled:opacity-50"
            title="Attach file"
          >
            <Paperclip size={18} />
          </button>

          <button
            type="button"
            onClick={handlePickFiles}
            disabled={isDisabled}
            className="rounded-xl bg-white/5 p-3 text-gray-200 transition hover:bg-white/10 disabled:opacity-50"
            title="Upload image"
          >
            <Image size={18} />
          </button>

          <button
            type="button"
            onClick={handlePickFiles}
            disabled={isDisabled}
            className="rounded-xl bg-white/5 p-3 text-gray-200 transition hover:bg-white/10 disabled:opacity-50"
            title="Upload audio"
          >
            <Mic size={18} />
          </button>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={isDisabled || (!text.trim() && attachments.length === 0)}
            className="rounded-xl bg-orange-500 p-3 text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
            title="Send"
          >
            {mode === "create" ? <Sparkles size={18} /> : <Send size={18} />}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        hidden
        multiple
        onChange={(event) => handleFilesSelected(event.target.files)}
      />
    </div>
  );
}
