import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  Clapperboard,
  FileText,
  Image as ImageIcon,
  Loader2,
  Mic,
  Plus,
  SendHorizontal,
  Square,
  X,
} from "lucide-react";
import EmojiPickerButton from "./EmojiPickerButton";
import GifPickerPanel, { type GifSelection } from "./GifPickerPanel";

export default function MessageInput({
  value,
  onChange,
  onSend,
  editing,
  onTyping,
  onImageSelect,
  onAudioReady,
  onFileSelect,
  onGifSelect,
  disabled,
  sending,
}: {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  editing?: boolean;
  onTyping?: () => void;
  onImageSelect?: (file: File) => void | Promise<void>;
  onAudioReady?: (file: File) => void | Promise<void>;
  onFileSelect?: (file: File) => void | Promise<void>;
  onGifSelect?: (selection: GifSelection) => void | Promise<void>;
  disabled: boolean;
  sending: boolean;
}) {
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [recording, setRecording] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);

  const hasText = value.trim().length > 0;
  const locked = disabled || sending;

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "40px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`;
  }, [value]);

  useEffect(() => {
    if (!editing) return;
    textareaRef.current?.focus();
  }, [editing]);

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (hasText && !locked) onSend();
    }
  };

  async function handleStartRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const file = new File([blob], `voice-note-${Date.now()}.webm`, {
          type: "audio/webm",
        });

        await onAudioReady?.(file);

        stream.getTracks().forEach((track) => track.stop());
        audioChunksRef.current = [];
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch (error) {
      console.error("VOICE RECORD ERROR:", error);
    }
  }

  function handleStopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }

  function handleMainAction() {
    if (hasText) {
      onSend();
      return;
    }

    if (recording) {
      handleStopRecording();
      return;
    }

    void handleStartRecording();
  }

  const menuButtonClass =
    "flex h-11 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-3 text-sm font-medium text-white/80 transition hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="sticky bottom-0 z-20 border-t border-white/10 bg-black/95 px-3 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur-xl sm:px-5 sm:py-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.json,.zip,.rar"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onFileSelect?.(file);
          event.target.value = "";
          setToolsOpen(false);
        }}
      />

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void onImageSelect?.(file);
          event.target.value = "";
          setToolsOpen(false);
        }}
      />

      {recording ? (
        <div className="mb-2 flex items-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
          <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
          Recording voice note...
        </div>
      ) : null}

      {editing ? (
        <div className="mb-2 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-medium text-white/55">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          Editing message
        </div>
      ) : null}

      {toolsOpen ? (
        <div className="mb-3 grid gap-2 rounded-3xl border border-white/10 bg-zinc-950/95 p-2 shadow-2xl shadow-black/40 sm:grid-cols-4">
          <button
            type="button"
            disabled={locked}
            onClick={() => fileInputRef.current?.click()}
            className={menuButtonClass}
            aria-label="Attach file"
            title="Attach file"
          >
            <FileText size={18} />
            <span>File</span>
          </button>

          <button
            type="button"
            disabled={locked}
            onClick={() => imageInputRef.current?.click()}
            className={menuButtonClass}
            aria-label="Attach image"
            title="Attach image"
          >
            <ImageIcon size={18} />
            <span>Image</span>
          </button>

          <div className="relative">
            <button
              type="button"
              disabled={locked}
              onClick={() => setGifOpen((current) => !current)}
              className={`${menuButtonClass} w-full`}
              aria-label="Send GIF or meme"
              title="Send GIF or meme"
              aria-haspopup="dialog"
              aria-expanded={gifOpen}
            >
              <Clapperboard size={18} />
              <span>GIF</span>
            </button>

            <GifPickerPanel
              open={gifOpen}
              disabled={locked}
              onClose={() => setGifOpen(false)}
              onSelect={(selection) => {
                void onGifSelect?.(selection);
                setGifOpen(false);
                setToolsOpen(false);
              }}
            />
          </div>

          <div className="flex h-11 items-center rounded-2xl border border-white/10 bg-white/[0.06] px-3">
            <EmojiPickerButton
              disabled={locked}
              onSelect={(emoji) => {
                onChange(`${value}${emoji}`);
                onTyping?.();
                setToolsOpen(false);
              }}
            />
            <span className="ml-3 text-sm font-medium text-white/80">
              Emoji
            </span>
          </div>
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 items-end gap-2 rounded-[28px] border border-white/10 bg-white/[0.06] px-2 py-1.5 shadow-inner shadow-black/30 transition focus-within:border-orange-500/60 focus-within:bg-white/[0.08]">
          <button
            type="button"
            disabled={locked}
            onClick={() => {
              setToolsOpen((current) => !current);
              setGifOpen(false);
            }}
            className="mb-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white/75 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label={toolsOpen ? "Close attachments" : "Open attachments"}
            title={toolsOpen ? "Close attachments" : "Open attachments"}
          >
            {toolsOpen ? <X size={19} /> : <Plus size={20} />}
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            rows={1}
            onChange={(event) => {
              onChange(event.target.value);
              onTyping?.();
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              recording
                ? "Recording..."
                : editing
                  ? "Edit message"
                  : "Message"
            }
            disabled={locked || recording}
            className="max-h-36 min-h-10 min-w-0 flex-1 resize-none overflow-y-auto bg-transparent px-1 py-2 text-[15px] leading-6 text-white outline-none placeholder:text-white/35 sm:text-sm"
          />
        </div>

        <button
          type="button"
          onClick={handleMainAction}
          disabled={locked || (!hasText && !onAudioReady)}
          className={[
            "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full shadow-lg transition disabled:cursor-not-allowed disabled:opacity-50",
            hasText || sending
              ? "bg-orange-500 text-black shadow-orange-500/25 hover:bg-orange-400"
              : recording
                ? "bg-red-500 text-white shadow-red-500/20 hover:bg-red-400"
                : "border border-white/10 bg-white/[0.08] text-white hover:bg-white/15",
          ].join(" ")}
          aria-label={
            hasText
              ? editing ? "Save edit" : "Send message"
              : recording
                ? "Stop recording"
                : "Record voice note"
          }
          title={
            hasText
              ? editing ? "Save edit" : "Send message"
              : recording
                ? "Stop recording"
                : "Record voice note"
          }
        >
          {sending ? (
            <Loader2 size={19} className="animate-spin" />
          ) : hasText ? (
            <SendHorizontal size={19} />
          ) : recording ? (
            <Square size={15} />
          ) : (
            <Mic size={19} />
          )}
        </button>
      </div>
    </div>
  );
}
