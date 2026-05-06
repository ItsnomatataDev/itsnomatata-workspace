import { useRef, useState, type KeyboardEvent } from "react";
import {
  Clapperboard,
  Image as ImageIcon,
  Mic,
  Square,
  SendHorizontal,
  Paperclip,
} from "lucide-react";
import EmojiPickerButton from "./EmojiPickerButton";
import GifPickerPanel, { type GifSelection } from "./GifPickerPanel";

export default function MessageInput({
  value,
  onChange,
  onSend,
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
  onTyping?: () => void;
  onImageSelect?: (file: File) => void | Promise<void>;
  onAudioReady?: (file: File) => void | Promise<void>;
  onFileSelect?: (file: File) => void | Promise<void>;
  onGifSelect?: (selection: GifSelection) => void | Promise<void>;
  disabled: boolean;
  sending: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const genericFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  async function handleStartRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
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

  return (
    <div className="border-t border-white/10 bg-black/95 px-3 py-3 sm:px-5 sm:py-4">
      <input
        ref={genericFileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.json,.zip,.rar"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            if (file.type.startsWith("image/")) {
              void onImageSelect?.(file);
            } else {
              void onFileSelect?.(file);
            }
          }
          event.target.value = "";
        }}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void onImageSelect?.(file);
          }
          event.target.value = "";
        }}
      />

      <div className="flex items-end gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 rounded-[26px] border border-white/10 bg-white/5 px-2 py-1.5 shadow-inner shadow-black/30 focus-within:border-orange-500/60 sm:gap-2 sm:px-3">
          <button
            type="button"
            disabled={disabled || sending}
            onClick={() => genericFileInputRef.current?.click()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            title="Attach file"
            aria-label="Attach file"
          >
            <Paperclip size={18} />
          </button>

          <EmojiPickerButton
            disabled={disabled || sending}
            onSelect={(emoji) => {
              onChange(`${value}${emoji}`);
              onTyping?.();
            }}
          />

          <input
            type="text"
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              onTyping?.();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Message"
            disabled={disabled || sending}
            className="h-10 min-w-0 flex-1 bg-transparent px-1 text-base text-white outline-none placeholder:text-white/35 sm:text-sm"
          />

          <div className="relative">
            <button
              type="button"
              disabled={disabled || sending}
              onClick={() => setGifOpen((current) => !current)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              title="Send GIF or meme"
              aria-label="Send GIF or meme"
              aria-haspopup="dialog"
              aria-expanded={gifOpen}
            >
              <Clapperboard size={18} />
            </button>
            <GifPickerPanel
              open={gifOpen}
              disabled={disabled || sending}
              onClose={() => setGifOpen(false)}
              onSelect={(selection) => void onGifSelect?.(selection)}
            />
          </div>

          <button
            type="button"
            disabled={disabled || sending}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
            title="Send image"
            aria-label="Send image"
          >
            <ImageIcon size={18} />
          </button>

          <button
            type="button"
            disabled={disabled || sending}
            onClick={() => {
              if (recording) {
                handleStopRecording();
              } else {
                void handleStartRecording();
              }
            }}
            className={[
              "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50",
              recording
                ? "bg-red-500 text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white",
            ].join(" ")}
            title={recording ? "Stop recording" : "Record voice note"}
            aria-label={recording ? "Stop recording" : "Record voice note"}
          >
            {recording ? <Square size={15} /> : <Mic size={18} />}
          </button>
        </div>

        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim() || sending}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-orange-500 text-black shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Send message"
          title="Send message"
        >
          <SendHorizontal size={19} />
        </button>
      </div>

      {recording ? (
        <p className="mt-2 px-3 text-xs font-medium text-red-400">
          Recording voice note...
        </p>
      ) : null}
    </div>
  );
}
