// src/types/ai-action.ts
// Shared AI action types used across features.

import type { AssistantResponseType } from "../lib/api/n8n";

/** Every action ID in the workspace catalog. */
export type AIActionId =
    | "ask_codex"
    | "summarize_my_tasks"
    | "create_task_draft"
    | "summarize_project"
    | "check_leave_conflicts"
    | "summarize_leave_status"
    | "generate_weekly_report"
    | "search_knowledge"
    | "summarize_document"
    | "analyze_screenshot"
    | "transcribe_audio"
    | "generate_image"
    | "generate_social_caption"
    | "draft_announcement"
    | "run_automation_flow";

export type AIActionCategory =
    | "chat"
    | "tasks"
    | "projects"
    | "leave"
    | "reports"
    | "knowledge"
    | "media"
    | "audio"
    | "images"
    | "automation"
    | "admin";

export type AIActionInputType =
    | "none"
    | "text"
    | "document"
    | "image"
    | "audio"
    | "mixed"
    | "form";

export type AIUserRole =
    | "admin"
    | "manager"
    | "it"
    | "social_media"
    | "media_team"
    | "seo_specialist"
    | "employee";

export interface AIAction {
    id: AIActionId;
    label: string;
    description: string;
    category: AIActionCategory;
    icon: string;
    allowedRoles: AIUserRole[];
    inputType: AIActionInputType;
    requiresApproval: boolean;
    featured?: boolean;
}

export type AIActionStatus = "pending" | "running" | "success" | "failed";

export interface AIActionRunResult {
    actionId: AIActionId;
    status: AIActionStatus;
    type: AssistantResponseType;
    message: string;
    conversationId?: string | null;
    approvalId?: string | null;
    data?: Record<string, unknown>;
    sources?: Array<{
        id?: string;
        title?: string;
        type?: string;
        url?: string;
        snippet?: string;
    }>;
    actions?: Array<{
        id: string;
        label: string;
        variant?: "primary" | "secondary" | "danger";
        payload?: Record<string, unknown>;
    }>;
}

export interface AIApprovalReview {
    approvalId: string;
    reviewerId: string;
    status: "approved" | "rejected";
    reviewNote?: string | null;
}
