import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Copy,
  Loader2,
  MessageSquare,
  RotateCcw,
  Sparkles,
  User,
  Zap,
} from "lucide-react";



interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  pending?: boolean;
  error?: boolean;
}

interface AIChatViewProps {
  busy: boolean;
  userName?: string | null;
  role?: string | null;
  onAsk: (prompt: string) => Promise<{ content: string } | void>;
}

// ── Helpers ────────────────────────────────────────────────

function makeId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STARTERS = [
  {
    icon: "📋",
    label: "Summarize my tasks",
    prompt: "Summarize my current open, overdue, and in-progress tasks.",
  },
  {
    icon: "📊",
    label: "Team workload",
    prompt:
      "Give me a workload analysis of the team — who has capacity and who's stretched?",
  },
  {
    icon: "📝",
    label: "Draft an announcement",
    prompt:
      "Draft an internal announcement for the team about our upcoming sprint.",
  },
  {
    icon: "🔍",
    label: "Search knowledge base",
    prompt:
      "Search the knowledge base for our onboarding process and summarize it.",
  },
  {
    icon: "📈",
    label: "Weekly report",
    prompt:
      "Generate a weekly summary for tasks, projects, and team activity this week.",
  },
  {
    icon: "🤖",
    label: "System health",
    prompt:
      "Give me a system health summary — uptime, error rates, and any active alerts.",
  },
];

// ── Typing Indicator ───────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 group">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-500/30 to-orange-600/20 ring-1 ring-orange-500/20">
        <Bot size={14} className="text-orange-400" />
      </div>
      <div className="rounded-2xl rounded-bl-sm border border-white/8 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400/70 [animation-delay:0ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400/70 [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-orange-400/70 [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

// ── Message Bubble ─────────────────────────────────────────

function MessageBubble({
  message,
  userName,
}: {
  message: ChatMessage;
  userName?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isUser) {
    return (
      <div className="flex items-end justify-end gap-3 group">
        <div className="max-w-[75%]">
          <div className="rounded-2xl rounded-br-sm bg-orange-500 px-4 py-3 text-sm leading-relaxed text-white shadow-lg shadow-orange-500/10">
            {message.content}
          </div>
          <p className="mt-1 text-right text-[10px] text-white/25">
            {formatTime(message.createdAt)}
          </p>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10">
          <User size={14} className="text-white/60" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 group">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-orange-500/30 to-orange-600/20 ring-1 ring-orange-500/20">
        <Bot size={14} className="text-orange-400" />
      </div>
      <div className="max-w-[80%] space-y-1">
        <div
          className={`relative rounded-2xl rounded-bl-sm border px-4 py-3 text-sm leading-relaxed ${
            message.error
              ? "border-red-500/20 bg-red-500/10 text-red-300"
              : "border-white/8 bg-white/5 text-gray-200"
          }`}
        >
          <FormattedContent content={message.content} />

          <button
            type="button"
            onClick={handleCopy}
            className="absolute right-2 top-2 rounded-lg p-1 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
            title="Copy"
          >
            {copied ? (
              <span className="text-[10px] text-green-400">✓</span>
            ) : (
              <Copy size={11} className="text-white/40" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-white/25">
          {formatTime(message.createdAt)}
        </p>
      </div>
    </div>
  );
}

// ── Formatted Content ──────────────────────────────────────

function FormattedContent({ content }: { content: string }) {
  const parts = content.split("\n\n").filter(Boolean);

  return (
    <div className="space-y-2">
      {parts.map((block, i) => {
        // Bullet list
        if (block.trim().match(/^[-•*]\s/m)) {
          const lines = block.split("\n").filter(Boolean);
          return (
            <ul key={i} className="space-y-1 pl-1">
              {lines.map((line, j) => (
                <li key={j} className="flex items-start gap-2 text-sm">
                  <span className="mt-1.25 h-1 w-1 shrink-0 rounded-full bg-orange-400/60" />
                  <span>{line.replace(/^[-•*]\s/, "")}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Numbered list
        if (block.trim().match(/^\d+\.\s/m)) {
          const lines = block.split("\n").filter(Boolean);
          return (
            <ol key={i} className="space-y-1 pl-1">
              {lines.map((line, j) => (
                <li key={j} className="flex items-start gap-2 text-sm">
                  <span className="mt-0.5 shrink-0 text-xs font-medium text-orange-400/70">
                    {j + 1}.
                  </span>
                  <span>{line.replace(/^\d+\.\s/, "")}</span>
                </li>
              ))}
            </ol>
          );
        }

        // Heading (bold line)
        if (block.startsWith("**") && block.endsWith("**")) {
          return (
            <p key={i} className="font-semibold text-white">
              {block.slice(2, -2)}
            </p>
          );
        }

        // Regular paragraph
        return (
          <p key={i} className="text-sm leading-relaxed">
            {block}
          </p>
        );
      })}
    </div>
  );
}

// ── Starter Cards ──────────────────────────────────────────

function StarterCards({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      {/* Glowing orb */}
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-pulse rounded-full bg-orange-500/20 blur-2xl" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-orange-500/20 to-orange-600/10 ring-1 ring-orange-500/20">
          <Sparkles size={28} className="text-orange-400" />
        </div>
      </div>

      <h3 className="text-xl font-semibold tracking-tight text-white">
        What can I help you with?
      </h3>
      <p className="mt-2 max-w-sm text-sm text-white/40">
        Ask anything about your workspace — tasks, reports, team, documents, or
        anything else.
      </p>

      <div className="mt-8 grid w-full max-w-2xl grid-cols-2 gap-2 sm:grid-cols-3">
        {STARTERS.map((s) => (
          <button
            key={s.prompt}
            type="button"
            onClick={() => onSelect(s.prompt)}
            className="group flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-left transition-all hover:border-orange-500/30 hover:bg-orange-500/5 hover:shadow-md hover:shadow-orange-500/5"
          >
            <span className="text-lg leading-none">{s.icon}</span>
            <span className="text-xs font-medium text-white/60 group-hover:text-white/90">
              {s.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Chat Input ─────────────────────────────────────────────

function ChatInput({
  busy,
  onSend,
  onClear,
  hasMessages,
}: {
  busy: boolean;
  onSend: (msg: string) => void;
  onClear: () => void;
  hasMessages: boolean;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setValue("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] p-3 shadow-xl shadow-black/50">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask Codex anything about your workspace…"
        disabled={busy}
        className="block w-full resize-none bg-transparent text-sm text-white placeholder-white/25 outline-none"
      />
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasMessages && (
            <button
              type="button"
              onClick={onClear}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-white/30 transition hover:bg-white/5 hover:text-white/60"
            >
              <RotateCcw size={11} />
              New chat
            </button>
          )}
          <span className="text-[10px] text-white/20">
            Shift+Enter for new line
          </span>
        </div>

        <button
          type="button"
          onClick={handleSend}
          disabled={!value.trim() || busy}
          className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500 text-white shadow-lg shadow-orange-500/20 transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {busy ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ArrowUp size={14} />
          )}
        </button>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export default function AIChatView({
  busy,
  userName,
  role,
  onAsk,
}: AIChatViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // Auto-scroll
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  useEffect(() => {
    if (messages.length > 0) scrollToBottom();
  }, [messages, isThinking, scrollToBottom]);

  // Show scroll-to-bottom button
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = () => {
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      setShowScrollBtn(distFromBottom > 200);
    };
    el.addEventListener("scroll", handler);
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const handleSend = async (prompt: string) => {
    const userMsg: ChatMessage = {
      id: makeId(),
      role: "user",
      content: prompt,
      createdAt: nowIso(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsThinking(true);

    try {
      const result = await onAsk(prompt);
      const content =
        (result as { content?: string } | null)?.content ??
        "I couldn't get a response right now. Please try again.";

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content,
        createdAt: nowIso(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const errorMsg: ChatMessage = {
        id: makeId(),
        role: "assistant",
        content:
          "Something went wrong reaching the AI service. Check your connection and try again.",
        createdAt: nowIso(),
        error: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
    }
  };

  const handleClear = () => {
    setMessages([]);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-380px)] min-h-125 flex-col rounded-3xl border border-white/8 bg-[#060606] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/6 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-orange-500/15 ring-1 ring-orange-500/20">
            <MessageSquare size={15} className="text-orange-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Codex</p>
            <p className="text-[10px] text-white/30">AI Workspace Assistant</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-2.5 py-1">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-400" />
            </span>
            <span className="text-[10px] font-medium text-white/40">Live</span>
          </div>

          {userName && (
            <div className="flex items-center gap-1.5 rounded-full border border-white/8 bg-white/4 px-2.5 py-1">
              <Zap size={10} className="text-orange-400" />
              <span className="text-[10px] font-medium text-white/40">
                {role ?? "employee"}
              </span>
            </div>
          )}

          {hasMessages && (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg p-1.5 text-white/20 transition hover:bg-white/5 hover:text-white/60"
              title="Clear conversation"
            >
              <RotateCcw size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-y-auto scroll-smooth"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.07) transparent",
        }}
      >
        <div className="px-5 py-5">
          {!hasMessages ? (
            <StarterCards onSelect={handleSend} />
          ) : (
            <div className="space-y-5">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} userName={userName} />
              ))}
              {isThinking && <TypingIndicator />}
              <div ref={bottomRef} className="h-px" />
            </div>
          )}
        </div>

        {/* Scroll to bottom button */}
        {showScrollBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-4 right-4 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-[#0a0a0a] text-white/40 shadow-xl transition hover:text-white/80"
          >
            <ChevronDown size={14} />
          </button>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-white/6 p-4">
        <ChatInput
          busy={busy || isThinking}
          onSend={handleSend}
          onClear={handleClear}
          hasMessages={hasMessages}
        />
      </div>
    </div>
  );
}
