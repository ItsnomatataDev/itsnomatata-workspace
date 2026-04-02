export type AIWorkspaceRole =
  | "admin"
  | "manager"
  | "it"
  | "social_media"
  | "marketing"
  | "seo"
  | "content"
  | "client_success"
  | "sales"
  | "member"
  | string;

export type AIWorkspaceModule =
  | "social-posts"
  | "campaigns"
  | "clients"
  | "content-assets"
  | "reports"
  | "tasks"
  | "it-workspace"
  | "seo-items"
  | "knowledge-documents"
  | "general";

export type AIActionType =
  | "generate_caption"
  | "draft_social_reply"
  | "generate_campaign_plan"
  | "generate_client_brief"
  | "summarize_client"
  | "generate_report"
  | "tag_asset"
  | "prioritize_tasks"
  | "analyze_workflow_failure"
  | "summarize_knowledge"
  | "custom";

export type AIActionVisibility = "all" | "restricted";

export interface AIActionDefinition {
  id: string;
  title: string;
  description: string;
  actionType: AIActionType;
  module: AIWorkspaceModule;
  visibility: AIActionVisibility;
  allowedRoles: string[];
  requiresApproval?: boolean;
  entityType?: string;
  icon?: string;
}

export interface AIActionRequestInput {
  prompt?: string;
  instructions?: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
}

export interface AIActionRequest {
  organizationId: string;
  userId: string;
  role: string;
  module: AIWorkspaceModule;
  actionType: AIActionType;
  entityId?: string;
  entityType?: string;
  input: AIActionRequestInput;
}

export type AIRequestStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "approval_required"
  | "approved"
  | "rejected";

export interface AIActionResponse {
  requestId: string;
  status: AIRequestStatus;
  output?: string;
  outputJson?: Record<string, unknown> | null;
  approvalId?: string | null;
  message?: string | null;
  runId?: string | null;
  workflowName?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AIActivityItem {
  id: string;
  actionType: AIActionType;
  module: AIWorkspaceModule;
  status: AIRequestStatus;
  outputSummary?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AIWorkspaceSummary {
  favorites: AIActionDefinition[];
  recentActivity: AIActivityItem[];
  pendingApprovalsCount: number;
}

export interface AIActionFormValues {
  entityId?: string;
  entityType?: string;
  prompt?: string;
  instructions?: string;
}
