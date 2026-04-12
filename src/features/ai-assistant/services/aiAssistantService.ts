import {
    type AIUserRole,
    analyzeDocument,
    analyzeImage,
    askAssistant,
    buildAssistantContext,
    type DashboardSummaryResult,
    generateDashboardSummary as generateDashboardSummaryRequest,
    generateImage,
    runAIAction,
    transcribeAudio,
} from "../../../lib/api/ai";
import type {
    AssistantActionInput,
    AssistantAttachmentInput,
    AssistantContextInput as N8nAssistantContextInput,
    AssistantResponse,
} from "../../../lib/api/n8n";

export type AssistantContextInput = N8nAssistantContextInput;
export type { AIUserRole, DashboardSummaryResult };

export type AiChatResponse = {
    reply: string;
    conversationId: string | null;
    assistantMessage: AssistantChatMessage;
};

export interface AssistantChatMessage {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    type?: AssistantResponse["type"];
    createdAt: string;
    data?: Record<string, unknown>;
    actions?: NonNullable<AssistantResponse["actions"]>;
    sources?: NonNullable<AssistantResponse["sources"]>;
    pending?: boolean;
    error?: boolean;
}

export interface SendAssistantMessageParams {
    message: string;
    context: AssistantContextInput;
    conversationId?: string | null;
    attachments?: AssistantAttachmentInput[];
    metadata?: Record<string, unknown>;
}

export interface RunAssistantActionParams {
    context: AssistantContextInput;
    action: AssistantActionInput;
    conversationId?: string | null;
    attachments?: AssistantAttachmentInput[];
    metadata?: Record<string, unknown>;
}

function createId(prefix = "msg"): string {
    const randomPart = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    return `${prefix}_${randomPart}`;
}

function nowIso(): string {
    return new Date().toISOString();
}

function getErrorMessage(error: unknown): string {
    return error instanceof Error
        ? error.message
        : "Unable to reach the AI service.";
}

function isServiceUnavailableError(error: unknown): boolean {
    return /VITE_N8N_AI_WEBHOOK_URL|Failed to fetch|Load failed|NetworkError|AI request failed/i
        .test(
            getErrorMessage(error),
        );
}

function createFallbackAssistantMessage(content: string): AssistantChatMessage {
    return {
        id: createId("assistant"),
        role: "assistant",
        content,
        type: "text",
        createdAt: nowIso(),
        data: {
            preview: true,
        },
    };
}

function mapAssistantResponseToChatMessage(
    response: AssistantResponse,
): AssistantChatMessage {
    return {
        id: response.requestId || createId("assistant"),
        role: "assistant",
        content: response.message,
        type: response.type,
        createdAt: nowIso(),
        data: (response.data as Record<string, unknown>) ?? {},
        actions: response.actions ?? [],
        sources: response.sources ?? [],
        error: response.success === false || response.type === "error",
    };
}

export function createUserChatMessage(
    content: string,
    extras?: Partial<AssistantChatMessage>,
): AssistantChatMessage {
    return {
        id: createId("user"),
        role: "user",
        content,
        type: "text",
        createdAt: nowIso(),
        ...extras,
    };
}

export function createPendingAssistantMessage(
    content = "AI assistant is thinking...",
): AssistantChatMessage {
    return {
        id: createId("pending"),
        role: "assistant",
        content,
        type: "text",
        createdAt: nowIso(),
        pending: true,
    };
}

export async function generateDashboardSummary(params: {
    role: AIUserRole | string;
    context?: Partial<AssistantContextInput>;
}): Promise<DashboardSummaryResult> {
    const normalizedContext = buildAssistantContext({
        userId: params.context?.userId ?? "workspace-ai",
        organizationId: params.context?.organizationId ?? "workspace-default",
        fullName: params.context?.fullName ?? "Workspace User",
        email: params.context?.email ?? null,
        role: params.context?.role ?? params.role,
        department: params.context?.department ?? null,
        currentRoute: params.context?.currentRoute ?? "/dashboard",
        currentModule: params.context?.currentModule ?? "dashboard",
        selectedEntityId: params.context?.selectedEntityId ?? null,
        selectedEntityType: params.context?.selectedEntityType ?? null,
        timezone: params.context?.timezone ?? "Africa/Harare",
        channel: params.context?.channel ?? "dashboard",
        sessionId: params.context?.sessionId ?? null,
    });

    try {
        return await generateDashboardSummaryRequest({
            organizationId: normalizedContext.organizationId ??
                "workspace-default",
            userId: normalizedContext.userId,
            role: normalizedContext.role ?? params.role,
            userName: normalizedContext.fullName ?? null,
            currentModule: normalizedContext.currentModule ?? "dashboard",
        });
    } catch (error) {
        if (!isServiceUnavailableError(error)) {
            throw error;
        }

        const roleLabel = String(
            normalizedContext.role ?? params.role ?? "employee",
        )
            .replaceAll("_", " ")
            .trim();

        return {
            summary:
                `AI preview mode is active for the ${roleLabel} workspace. The UI is ready and will return live role-based insights once the AI webhook is connected.`,
            suggestions: [
                "Review overdue tasks, blockers, and approvals first.",
                "Check team activity and recent operational updates.",
                "Configure `VITE_N8N_AI_WEBHOOK_URL` to enable real-time AI summaries.",
            ],
        };
    }
}

export async function sendMessage(params: SendAssistantMessageParams): Promise<{
    conversationId: string | null;
    assistantMessage: AssistantChatMessage;
}> {
    const normalizedContext = buildAssistantContext(params.context);

    try {
        const response = await askAssistant({
            message: params.message,
            context: normalizedContext,
            attachments: params.attachments ?? [],
            conversationId: params.conversationId ?? null,
            metadata: params.metadata,
        });

        return {
            conversationId: response.conversationId ?? null,
            assistantMessage: mapAssistantResponseToChatMessage(response),
        };
    } catch (error) {
        if (!isServiceUnavailableError(error)) {
            throw error;
        }

        return {
            conversationId: params.conversationId ?? null,
            assistantMessage: createFallbackAssistantMessage(
                [
                    "Live AI is not available right now, so the assistant is running in preview mode.",
                    getErrorMessage(error),
                    `Request: ${params.message}`,
                    "Configure `VITE_N8N_AI_WEBHOOK_URL` to enable real-time assistant replies.",
                ].join("\n\n"),
            ),
        };
    }
}

export async function sendAiChatMessage(params: {
    message: string;
    context: AssistantContextInput;
    conversationId?: string | null;
    attachments?: AssistantAttachmentInput[];
    metadata?: Record<string, unknown>;
}): Promise<AiChatResponse> {
    const result = await sendMessage({
        message: params.message,
        context: params.context,
        conversationId: params.conversationId ?? null,
        attachments: params.attachments ?? [],
        metadata: params.metadata,
    });

    return {
        reply: result.assistantMessage.content,
        conversationId: result.conversationId,
        assistantMessage: result.assistantMessage,
    };
}

export async function runAssistantAction(
    params: RunAssistantActionParams,
): Promise<{
    conversationId: string | null;
    assistantMessage: AssistantChatMessage;
}> {
    const normalizedContext = buildAssistantContext(params.context);

    const response = await runAIAction({
        context: normalizedContext,
        action: params.action,
        conversationId: params.conversationId ?? null,
        attachments: params.attachments ?? [],
        metadata: params.metadata,
    });

    return {
        conversationId: response.conversationId ?? null,
        assistantMessage: mapAssistantResponseToChatMessage(response),
    };
}

export async function sendDocumentForAnalysis(params: {
    context: AssistantContextInput;
    attachment: AssistantAttachmentInput;
    question?: string;
    conversationId?: string | null;
}): Promise<{
    conversationId: string | null;
    assistantMessage: AssistantChatMessage;
}> {
    const normalizedContext = buildAssistantContext(params.context);

    const response = await analyzeDocument({
        context: normalizedContext,
        prompt: params.question ??
            "Summarize this document and highlight the key action items.",
        attachments: [params.attachment],
        conversationId: params.conversationId ?? null,
    });

    return {
        conversationId: response.conversationId ?? null,
        assistantMessage: mapAssistantResponseToChatMessage(response),
    };
}

export async function sendImageForAnalysis(params: {
    context: AssistantContextInput;
    attachment: AssistantAttachmentInput;
    prompt?: string;
    conversationId?: string | null;
}): Promise<{
    conversationId: string | null;
    assistantMessage: AssistantChatMessage;
}> {
    const normalizedContext = buildAssistantContext(params.context);

    const response = await analyzeImage({
        context: normalizedContext,
        attachment: params.attachment,
        prompt: params.prompt,
        conversationId: params.conversationId ?? null,
    });

    return {
        conversationId: response.conversationId ?? null,
        assistantMessage: mapAssistantResponseToChatMessage(response),
    };
}

export async function sendAudioForTranscription(params: {
    context: AssistantContextInput;
    attachment: AssistantAttachmentInput;
    prompt?: string;
    conversationId?: string | null;
}): Promise<{
    conversationId: string | null;
    assistantMessage: AssistantChatMessage;
}> {
    const normalizedContext = buildAssistantContext(params.context);

    const response = await transcribeAudio({
        context: normalizedContext,
        attachment: params.attachment,
        prompt: params.prompt,
        conversationId: params.conversationId ?? null,
    });

    return {
        conversationId: response.conversationId ?? null,
        assistantMessage: mapAssistantResponseToChatMessage(response),
    };
}

export async function requestImageGeneration(params: {
    context: AssistantContextInput;
    prompt: string;
    conversationId?: string | null;
}): Promise<{
    conversationId: string | null;
    assistantMessage: AssistantChatMessage;
}> {
    const normalizedContext = buildAssistantContext(params.context);

    const response = await generateImage({
        context: normalizedContext,
        prompt: params.prompt,
        conversationId: params.conversationId ?? null,
    });

    return {
        conversationId: response.conversationId ?? null,
        assistantMessage: mapAssistantResponseToChatMessage(response),
    };
}

export async function saveConversationMessage(
    _message: AssistantChatMessage,
    _conversationId?: string | null,
): Promise<void> {
    return;
}

export async function getConversationHistory(
    _conversationId: string,
): Promise<AssistantChatMessage[]> {
    return [];
}
