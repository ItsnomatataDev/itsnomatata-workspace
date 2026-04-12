import { useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import type { AssistantAttachmentInput } from "../../../lib/api/n8n";
import AiPromptBox, { type PromptMode } from "./AiPromptBox";
import AiResponseCard from "./AiResponseCard";
import {
  createPendingAssistantMessage,
  createUserChatMessage,
  sendAiChatMessage,
  type AssistantChatMessage,
  type AssistantContextInput,
} from "../services/aiAssistantService";

const QUICK_PROMPTS = [
  "Summarize my current priorities for today.",
  "Draft a short weekly progress update from my recent work.",
  "What should I focus on first in this workspace?",
];

function buildWelcomeMessage(
  context?: AssistantContextInput,
): AssistantChatMessage {
  const firstName = context?.fullName?.split(" ")[0] ?? "there";
  const roleLabel = String(context?.role ?? "employee").replaceAll("_", " ");

  return {
    id: "assistant_welcome",
    role: "assistant",
    content: `Hi ${firstName}, your ${roleLabel} AI assistant is ready. Ask about tasks, projects, documents, approvals, reports, or upload a file for analysis.`,
    type: "text",
    createdAt: new Date().toISOString(),
  };
}

export default function AiChatPanel({
  context,
}: {
  context?: AssistantContextInput;
}) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>(() => [
    buildWelcomeMessage(context),
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(null);

  async function handleSend(payload: {
    text: string;
    attachments: AssistantAttachmentInput[];
    mode: PromptMode;
  }) {
    const trimmed = payload.text.trim();

    if (!context) {
      setError("Missing AI assistant context.");
      return;
    }

    const fallbackText =
      payload.mode === "analyze"
        ? "Please analyze the attached file(s) and summarize the key findings."
        : payload.mode === "create"
          ? "Create a polished draft from the attached context."
          : payload.mode === "action"
            ? "Help me complete this workspace action."
            : "Help me with this workspace request.";

    const outgoingText = trimmed || fallbackText;
    const userMessage = createUserChatMessage(outgoingText, {
      data: {
        mode: payload.mode,
        attachmentCount: payload.attachments.length,
      },
    });
    const pendingMessage = createPendingAssistantMessage();

    try {
      setLoading(true);
      setError("");
      setMessages((prev) => [...prev, userMessage, pendingMessage]);

      const result = await sendAiChatMessage({
        message:
          payload.mode === "ask"
            ? outgoingText
            : `[${payload.mode.toUpperCase()}] ${outgoingText}`,
        context,
        conversationId,
        attachments: payload.attachments,
        metadata: {
          source: "ai_assistant_page",
          mode: payload.mode,
        },
      });

      setConversationId(result.conversationId);
      setMessages((prev) => [
        ...prev.filter((message) => message.id !== pendingMessage.id),
        result.assistantMessage,
      ]);
    } catch (error) {
      console.error("AI CHAT ERROR:", error);
      setError(
        error instanceof Error ? error.message : "Failed to send message.",
      );
      setMessages((prev) =>
        prev.filter((message) => message.id !== pendingMessage.id),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white xl:col-span-2">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-orange-500/15 p-2 text-orange-400">
            <Bot size={18} />
          </div>
          <div>
            <h2 className="text-lg font-semibold">AI Chat</h2>
            <p className="text-sm text-white/55">
              Ask, analyze, create, and action work items with one workspace
              assistant.
            </p>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
            {error}
          </div>
        ) : null}

        <div className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
          {messages.map((message) =>
            message.role === "assistant" ? (
              <AiResponseCard
                key={message.id}
                message={message}
                onActionClick={async (action) => {
                  await handleSend({
                    text: action.label,
                    attachments: [],
                    mode: "action",
                  });
                }}
              />
            ) : (
              <div
                key={message.id}
                className="ml-auto max-w-2xl rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
                  You
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/90">
                  {message.content}
                </p>
              </div>
            ),
          )}
        </div>

        <div className="mt-4">
          <AiPromptBox busy={loading} onSend={handleSend} />
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
          <div className="flex items-center gap-2 text-orange-400">
            <Sparkles size={16} />
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em]">
              Quick prompts
            </h3>
          </div>

          <div className="mt-4 space-y-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() =>
                  void handleSend({
                    text: prompt,
                    attachments: [],
                    mode: "ask",
                  })
                }
                disabled={loading}
                className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-3 text-left text-sm text-white/80 transition hover:bg-black/40 disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
          <h3 className="text-base font-semibold">Assistant status</h3>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2">
              <span>Role</span>
              <span className="text-white">{context?.role ?? "employee"}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2">
              <span>Conversation</span>
              <span className="text-white">
                {conversationId ? "Active" : "New session"}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-black/30 px-3 py-2">
              <span>Mode</span>
              <span className="text-white">Workspace-aware</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
