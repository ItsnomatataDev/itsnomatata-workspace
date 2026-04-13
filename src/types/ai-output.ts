// src/types/ai-output.ts
// Shared AI output / response types used across features.

import type {
    AssistantQuickAction,
    AssistantResponseType,
    AssistantSourceReference,
} from "../lib/api/n8n";

/** A single AI output that can be displayed in the workspace or assistant UI. */
export interface AIOutput {
    id: string;
    title: string;
    type: AssistantResponseType;
    content: string;
    createdAt: string;
    toolId?: string | null;
    conversationId?: string | null;
    requiresApproval?: boolean;
    approvalId?: string | null;
    data?: Record<string, unknown>;
    sources?: AssistantSourceReference[];
    actions?: AssistantQuickAction[];
    error?: boolean;
}

/** A conversation thread for the AI assistant. */
export interface AIConversation {
    id: string;
    organizationId: string;
    userId: string;
    title: string | null;
    toolId?: string | null;
    metadata?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}

/** A message within an AI conversation. */
export interface AIMessage {
    id: string;
    conversationId: string;
    role: "user" | "assistant" | "system";
    content: string;
    type: AssistantResponseType | string;
    toolId?: string | null;
    data?: Record<string, unknown>;
    sources?: AssistantSourceReference[];
    actions?: AssistantQuickAction[];
    requiresApproval?: boolean;
    approvalId?: string | null;
    error?: boolean;
    createdAt: string;
}

/** An approval item linked to an AI action. */
export interface AIApproval {
    id: string;
    organizationId: string;
    conversationId?: string | null;
    messageId?: string | null;
    userId: string;
    reviewerId?: string | null;
    toolId?: string | null;
    title: string;
    description?: string | null;
    status: "pending" | "approved" | "rejected";
    reviewNote?: string | null;
    payload?: Record<string, unknown>;
    reviewedAt?: string | null;
    createdAt: string;
}

/** Dashboard summary returned by the AI. */
export interface AIDashboardSummary {
    summary: string;
    suggestions: string[];
}
