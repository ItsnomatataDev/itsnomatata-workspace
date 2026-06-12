import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { Send, Sparkles, Trash2, X } from "lucide-react";
import type { AiRouterMessage } from "../types/aiToolTypes";

type FloatingAnchorPosition = {
  x: number;
  y: number;
};

type FloatingAiChatProps = {
  open: boolean;
  anchorPosition: FloatingAnchorPosition;
  busy: boolean;
  messages: AiRouterMessage[];
  error?: string;
  onClose: () => void;
  onSend: (message: string) => Promise<void>;
  onReset: () => void;
};

const QUICK_PROMPTS = [
  "Summarize my tasks",
  "List my boards",
  "Show my timesheet this week",
  "Show my notifications",
  "Search assets",
];

const BUBBLE_SIZE = 56;
const PANEL_GAP = 16;
const VIEWPORT_MARGIN = 20;
const MAX_PANEL_WIDTH = 420;
const MAX_PANEL_HEIGHT = 640;

function getPanelPosition(anchorPosition: FloatingAnchorPosition) {
  const panelWidth = Math.min(window.innerWidth * 0.92, MAX_PANEL_WIDTH);
  const panelHeight = Math.min(window.innerHeight * 0.7, MAX_PANEL_HEIGHT);
  const maxLeft = Math.max(
    VIEWPORT_MARGIN,
    window.innerWidth - panelWidth - VIEWPORT_MARGIN,
  );
  const maxTop = Math.max(
    VIEWPORT_MARGIN,
    window.innerHeight - panelHeight - VIEWPORT_MARGIN,
  );

  const anchoredLeft = anchorPosition.x + BUBBLE_SIZE - panelWidth;
  const anchoredTop = anchorPosition.y - panelHeight - PANEL_GAP;
  const fallbackTop = anchorPosition.y + BUBBLE_SIZE + PANEL_GAP;

  return {
    width: "min(92vw, 420px)",
    height: "min(70vh, 640px)",
    left: Math.min(Math.max(anchoredLeft, VIEWPORT_MARGIN), maxLeft),
    top: Math.min(
      Math.max(
        anchoredTop >= VIEWPORT_MARGIN ? anchoredTop : fallbackTop,
        VIEWPORT_MARGIN,
      ),
      maxTop,
    ),
  };
}

function stringifyMessageContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (typeof content === "number" || typeof content === "boolean") {
    return String(content);
  }
  if (Array.isArray(content)) {
    return content.map(stringifyMessageContent).filter(Boolean).join("\n");
  }
  if (content && typeof content === "object") {
    return JSON.stringify(content, null, 2);
  }
  return "";
}

export default function FloatingAiChat({
  open,
  anchorPosition,
  busy,
  messages,
  error,
  onClose,
  onSend,
  onReset,
}: FloatingAiChatProps) {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, open, busy]);

  useEffect(() => {
    const textArea = textAreaRef.current;
    if (!textArea) return;

    textArea.style.height = "0px";
    textArea.style.height = `${Math.min(textArea.scrollHeight, 132)}px`;
  }, [input]);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = input.trim();
    if (!value || busy) return;
    setInput("");
    await onSend(value);
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void handleSubmit(event);
  };

  return (
    <div
      className="fixed z-9998 flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#090909] shadow-2xl shadow-black/60"
      style={getPanelPosition(anchorPosition)}
    >
      <div className="flex items-center justify-between border-b border-white/10 bg-white/3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-300">
            <Sparkles size={16} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Workspace AI</p>
            <p className="truncate text-xs text-white/45">
              Connected to your workspace
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white/55 transition hover:bg-white/8 hover:text-white"
          title="Close"
        >
          <X size={17} />
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-300">
              <Sparkles size={17} />
            </div>
            <p className="text-sm font-medium text-white">How can I help?</p>
            <p className="mt-1 text-sm leading-6 text-white/55">
              Ask about tasks, boards, time entries, notifications, assets, or
              anything you want drafted from your workspace context.
            </p>
          </div>
        ) : null}

        {messages.map((message) => (
          <div
            key={message.id}
            className={[
              "flex gap-2",
              message.role === "user"
                ? "justify-end"
                : "justify-start",
            ].join(" ")}
          >
            {message.role !== "user" ? (
              <div className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-300">
                <Sparkles size={13} />
              </div>
            ) : null}
            <div
              className={[
                "max-w-[86%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm leading-6",
                message.role === "user"
                  ? "rounded-br-md border border-white/10 bg-white/[0.08] text-white"
                  : message.error
                    ? "rounded-bl-md border border-red-500/20 bg-red-500/10 text-red-100"
                    : "rounded-bl-md border border-white/10 bg-white/[0.045] text-white/85",
              ].join(" ")}
            >
              {stringifyMessageContent(message.content)}
            </div>
          </div>
        ))}

        {busy ? (
          <div className="flex items-center gap-2">
            <div className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-300">
              <Sparkles size={13} />
            </div>
            <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.045] px-3.5 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/65 [animation-delay:-0.24s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/55 [animation-delay:-0.12s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45" />
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-100">
            {error}
          </p>
        ) : null}

        <div ref={bottomRef} />
      </div>

      <div className="border-t border-white/10 bg-white/[0.025] px-4 py-3">
        <div className="mb-3 flex items-center gap-2 overflow-x-auto pb-1">
          {QUICK_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy}
              onClick={() => void onSend(prompt)}
              className="shrink-0 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs text-white/65 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-2xl border border-white/10 bg-black/70 p-2 transition focus-within:border-orange-500/60"
        >
          <textarea
            ref={textAreaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleComposerKeyDown}
            placeholder="Ask your workspace..."
            disabled={busy}
            rows={1}
            className="max-h-32 min-h-10 w-full resize-none bg-transparent px-2 py-2 text-sm leading-6 text-white outline-none placeholder:text-white/35 disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-2 border-t border-white/10 px-1 pt-2">
            <button
              type="button"
              onClick={onReset}
              disabled={messages.length === 0 || busy}
              className="inline-flex h-9 items-center gap-2 rounded-xl px-2.5 text-xs text-white/45 transition hover:bg-white/[0.06] hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
              title="Clear chat"
            >
              <Trash2 size={14} />
              Clear
            </button>
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500 text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-45"
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
