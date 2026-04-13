import { useEffect, useRef, useState } from "react";
import { Bot, Sparkles } from "lucide-react";
import type { AssistantAttachmentInput } from "../../../lib/api/n8n";
import AiPromptBox, { type PromptMode } from "./AiPromptBox";
import AiResponseCard from "./AiResponseCard";
import {
  createPendingAssistantMessage,
  createUserChatMessage,
  saveConversationMessage,
  sendAiChatMessage,
  type AssistantChatMessage,
  type AssistantContextInput,
} from "../services/aiAssistantService";

const ROLE_QUICK_PROMPTS: Record<string, string[]> = {
  admin: [
    "Give me a full team overview — attendance, task loads, and who's on leave.",
    "Run an organization health check — overdue tasks, budgets, pending approvals.",
    "Generate an onboarding checklist for a new team member.",
    "Summarize leave status across all departments.",
    "Draft a company-wide announcement about upcoming changes.",
  ],
  manager: [
    "Analyze my team's workload — who's overloaded and who has capacity?",
    "Generate a sprint summary for this week.",
    "Draft a client status update for our active project.",
    "Prepare a briefing for my upcoming team meeting.",
    "Suggest task reassignments based on team capacity.",
  ],
  social_media: [
    "Generate a content calendar for this week across all platforms.",
    "Create 3 caption variants for an upcoming product post.",
    "Research trending hashtags for our industry niche.",
    "Repurpose our latest blog post into social media content.",
    "Draft a campaign brief for our next promotion.",
  ],
  media_team: [
    "Generate a creative brief for a new design project.",
    "Draft a video script for a 60-second product showcase.",
    "Summarize the design feedback and create action items.",
    "Suggest a file naming convention for our campaign assets.",
    "Create a shot list for an upcoming photoshoot.",
  ],
  seo_specialist: [
    "Research keywords for our main product/service page.",
    "Generate SEO meta tags for a new landing page.",
    "Audit this content for SEO improvements.",
    "Create an SEO-optimized blog post outline.",
    "Draft a competitor content analysis for our target keyword.",
  ],
  it: [
    "Give me a system health summary — uptime, errors, recent deploys.",
    "Draft an incident report for a recent outage.",
    "Summarize code changes and flag potential issues.",
    "Generate a deployment checklist for our next release.",
    "Help me troubleshoot this error from the logs.",
  ],
  employee: [
    "Summarize my current priorities for today.",
    "Draft a short weekly progress update from my recent work.",
    "What should I focus on first in this workspace?",
  ],
};

function getQuickPrompts(role?: string | null): string[] {
  return ROLE_QUICK_PROMPTS[role ?? "employee"] ?? ROLE_QUICK_PROMPTS.employee;
}

function buildWelcomeMessage(
  context?: AssistantContextInput,
): AssistantChatMessage {
  const firstName = context?.fullName?.split(" ")[0] ?? "there";
  const role = context?.role ?? "employee";
  const roleLabel = String(role).replaceAll("_", " ");

  const roleWelcome: Record<string, string> = {
    admin: `Hi ${firstName}, your **admin AI assistant** is ready. I can help with team oversight, organization health, payroll summaries, policy drafts, onboarding checklists, leave management, and company-wide operations.`,
    manager: `Hi ${firstName}, your **manager AI assistant** is ready. I can help with team workload analysis, sprint summaries, client updates, meeting prep, task reassignment, and project tracking.`,
    social_media: `Hi ${firstName}, your **social media AI assistant** is ready. I can help with content calendars, caption writing, hashtag research, content repurposing, campaign briefs, and engagement replies.`,
    media_team: `Hi ${firstName}, your **media team AI assistant** is ready. I can help with creative briefs, video scripts, design feedback summaries, asset organization, and production planning.`,
    seo_specialist: `Hi ${firstName}, your **SEO AI assistant** is ready. I can help with keyword research, meta tag generation, content audits, blog outlines, and competitor analysis.`,
    it: `Hi ${firstName}, your **IT AI assistant** is ready. I can help with system health monitoring, incident reports, code reviews, deployment checklists, and troubleshooting issues.`,
  };

  const content =
    roleWelcome[role] ??
    `Hi ${firstName}, your ${roleLabel} AI assistant is ready. Ask about tasks, projects, documents, approvals, reports, or upload a file for analysis.`;

  return {
    id: "assistant_welcome",
    role: "assistant",
    content,
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

      // Persist both messages to the conversation
      void saveConversationMessage(userMessage, result.conversationId);
      void saveConversationMessage(
        result.assistantMessage,
        result.conversationId,
      );
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

        <div className="max-h-128 space-y-3 overflow-y-auto pr-1">
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
          <div ref={messagesEndRef} />
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
              {context?.role
                ? `${String(context.role).replaceAll("_", " ")} prompts`
                : "Quick prompts"}
            </h3>
          </div>

          <div className="mt-4 space-y-2">
            {getQuickPrompts(context?.role).map((prompt) => (
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
