import { useState } from "react";
import { Bot, Loader2, SendHorizonal } from "lucide-react";
import {
  sendAiChatMessage,
  type AssistantContextInput,
} from "../services/aiAssistantService";

export default function AiChatPanel({
  context,
}: {
  context?: AssistantContextInput;
}) {
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    const trimmed = message.trim();

    if (!trimmed) return;
    if (!context) {
      setError("Missing AI assistant context.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result = await sendAiChatMessage({
        message: trimmed,
        context,
      });

      setReply(result.reply);
      setMessage("");
    } catch (err: any) {
      console.error("AI CHAT ERROR:", err);
      setError(err?.message || "Failed to send message.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
      <div className="mb-4 flex items-center gap-3">
        <div className="rounded-xl bg-orange-500/15 p-2 text-orange-400">
          <Bot size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">AI Chat</h2>
          <p className="text-sm text-white/55">
            Ask the assistant about your workspace.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="space-y-4">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Ask something about your dashboard, tasks, approvals, or team..."
          className="min-h-30 w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35"
        />

        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={loading || !message.trim()}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <SendHorizonal size={16} />
          )}
          {loading ? "Sending..." : "Send"}
        </button>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm font-semibold text-orange-400">
            Assistant Reply
          </p>
          <p className="mt-2 text-sm leading-6 text-white/80">
            {reply || "No response yet."}
          </p>
        </div>
      </div>
    </div>
  );
}
