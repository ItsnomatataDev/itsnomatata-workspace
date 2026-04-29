import { useRef, useState, type KeyboardEvent } from "react";
import { Image as ImageIcon, Mic, Square, SendHorizontal, Paperclip } from "lucide-react";

export default function MessageInput({
  value,
  onChange,
  onSend,
  onTyping,
  onImageSelect,
  onAudioReady,
  onFileSelect,
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
  disabled: boolean;
  sending: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const genericFileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);

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
    <div className="border-t border-white/10 px-5 py-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled || sending}
          onClick={() => genericFileInputRef.current?.click()}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:border-orange-500/30 hover:bg-white/10 disabled:opacity-50"
          title="Attach file"
        >
          <Paperclip size={18} />
        </button>

        <input
          ref={genericFileInputRef}
          type="file"
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              if (file.type.startsWith('image/')) {
                void onImageSelect?.(file);
              } else {
                void onFileSelect?.(file);
              }
            }
            event.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={disabled || sending}
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white transition hover:border-orange-500/30 hover:bg-white/10 disabled:opacity-50"
          title="Send image"
        >
          <ImageIcon size={18} />
        </button>

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
            "inline-flex h-11 w-11 items-center justify-center rounded-xl border transition disabled:opacity-50",
            recording
              ? "border-red-500 bg-red-500 text-white"
              : "border-white/10 bg-white/5 text-white hover:border-orange-500/30 hover:bg-white/10",
          ].join(" ")}
          title={recording ? "Stop recording" : "Record voice note"}
        >
          {recording ? <Square size={16} /> : <Mic size={18} />}
        </button>

        <input
          type="text"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            onTyping?.();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          disabled={disabled || sending}
          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-orange-500"
        />

        <button
          type="button"
          onClick={onSend}
          disabled={disabled || !value.trim() || sending}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <SendHorizontal size={16} />
          Send
        </button>
      </div>

      {recording ? (
        <p className="mt-3 text-xs font-medium text-red-400">
          Recording voice note...
        </p>
      ) : null}
    </div>
  );
}
