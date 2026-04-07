// src/features/ai-assistant/components/AiChatPanel.tsx

import { useMemo, useState } from "react";
import type {
  AssistantAttachmentInput,
  AssistantContextInput,
} from "../../../lib/api/n8n";
import AiPromptBox from "./AiPromptBox";
import AiResponseCard from "./AiResponseCard";
import {
  createPendingAssistantMessage,
  createUserChatMessage,
  type AssistantChatMessage,
  runAssistantAction,
  sendAudioForTranscription,
  sendDocumentForAnalysis,
  sendImageForAnalysis,
  sendMessage,
} from "../services/aiAssistantService";

interface AiChatPanelProps {
  context: AssistantContextInput;
  title?: string;
  subtitle?: string;
}

export default function AiChatPanel({
  context,
  title = "Codex Assistant",
  subtitle = "Ask questions, analyze files, and run workspace actions.",
}: AiChatPanelProps) {
  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hi, I’m Codex. I can help with tasks, projects, leave, reports, screenshots, audio, and uploaded documents.",
      type: "text",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);

  const suggestedPrompts = useMemo(
    () => [
      "Summarize my current tasks",
      "Who is on leave this week?",
      "Summarize this uploaded PDF",
      "Analyze this screenshot",
      "Generate a weekly report draft",
    ],
    [],
  );

  async function processAttachments(
    attachments: AssistantAttachmentInput[],
    text: string,
  ) {
    if (!attachments.length) {
      const result = await sendMessage({
        message: text || "Help me with my current workspace context.",
        context,
        conversationId,
      });

      setConversationId(result.conversationId);
      setMessages((prev) => [...prev, result.assistantMessage]);
      return;
    }

    const first = attachments[0];

    if (first.type === "image") {
      const result = await sendImageForAnalysis({
        context,
        attachment: first,
        prompt: text || undefined,
        conversationId,
      });

      setConversationId(result.conversationId);
      setMessages((prev) => [...prev, result.assistantMessage]);
      return;
    }

    if (first.type === "audio") {
      const result = await sendAudioForTranscription({
        context,
        attachment: first,
        prompt: text || undefined,
        conversationId,
      });

      setConversationId(result.conversationId);
      setMessages((prev) => [...prev, result.assistantMessage]);
      return;
    }

    const result = await sendDocumentForAnalysis({
      context,
      attachment: first,
      question: text || undefined,
      conversationId,
    });

    setConversationId(result.conversationId);
    setMessages((prev) => [...prev, result.assistantMessage]);
  }

  async function handleSend(payload: {
    text: string;
    attachments: AssistantAttachmentInput[];
    mode: "ask" | "analyze" | "create" | "action";
  }) {
    const userText =
      payload.text ||
      (payload.attachments.length > 0
        ? `Uploaded ${payload.attachments[0].name}`
        : "New request");

    setMessages((prev) => [
      ...prev,
      createUserChatMessage(userText),
      createPendingAssistantMessage(),
    ]);

    setBusy(true);

    try {
      setMessages((prev) => prev.filter((msg) => !msg.pending));

      if (payload.mode === "action" && payload.text.trim()) {
        const result = await runAssistantAction({
          context,
          conversationId,
          action: {
            actionId: "ask_codex",
            label: payload.text,
            payload: {
              prompt: payload.text,
            },
            requiresApproval: false,
          },
        });

        setConversationId(result.conversationId);
        setMessages((prev) => [...prev, result.assistantMessage]);
        return;
      }

      await processAttachments(payload.attachments, payload.text);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Something went wrong.";

      setMessages((prev) => [
        ...prev.filter((msg) => !msg.pending),
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: message,
          type: "error",
          createdAt: new Date().toISOString(),
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  async function handleResponseAction(action: {
    id: string;
    label: string;
    payload?: Record<string, unknown>;
  }) {
    setBusy(true);

    try {
      const result = await runAssistantAction({
        context,
        conversationId,
        action: {
          actionId: action.id,
          label: action.label,
          payload: action.payload,
          requiresApproval: false,
        },
      });

      setConversationId(result.conversationId);
      setMessages((prev) => [...prev, result.assistantMessage]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to run action.";

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: message,
          type: "error",
          createdAt: new Date().toISOString(),
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-170 flex-col rounded-3xl border border-white/10 bg-[#0f0f10]">
      <div className="border-b border-white/10 px-6 py-5">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="mt-1 text-sm text-gray-400">{subtitle}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={busy}
              onClick={() =>
                handleSend({ text: prompt, attachments: [], mode: "ask" })
              }
              className="rounded-full bg-white/5 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-white/10 disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {messages.map((message) =>
          message.role === "assistant" ? (
            <AiResponseCard
              key={message.id}
              message={message}
              onActionClick={handleResponseAction}
            />
          ) : (
            <div key={message.id} className="flex justify-end">
              <div className="max-w-2xl rounded-2xl bg-orange-500 px-4 py-3 text-sm text-white shadow-sm">
                {message.content}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="border-t border-white/10 p-4">
        <AiPromptBox onSend={handleSend} busy={busy} />
      </div>
    </div>
  );
}
