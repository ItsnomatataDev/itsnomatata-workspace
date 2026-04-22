import type {
  AssistantActionInput,
  AssistantAttachmentInput,
  AssistantResponseType,
} from "../../../lib/api/n8n";

export type AIWorkspaceViewMode = "overview" | "tool" | "history" | "approvals";

export type AIWorkspaceToolCategory =
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

export interface AIWorkspaceTool {
  id: string;
  label: string;
  description: string;
  category: AIWorkspaceToolCategory;
  icon: string;
  allowedRoles: string[];
  inputType:
    | "none"
    | "text"
    | "document"
    | "image"
    | "audio"
    | "mixed"
    | "form";
  requiresApproval: boolean;
  featured?: boolean;
}

export interface AIWorkspaceActionRequest {
  action: AssistantActionInput;
  prompt?: string;
  attachments?: AssistantAttachmentInput[];
  metadata?: Record<string, unknown>;
}

export interface AIWorkspaceOutput {
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
  sources?: Array<{
    id?: string;
    title?: string;
    type?: string;
    url?: string;
    snippet?: string;
  }>;
}

export interface AIWorkspaceApprovalItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
  requestedBy?: string | null;
  toolId?: string | null;
}

export interface AIWorkspaceHistoryItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  status: "success" | "failed" | "pending";
  toolId?: string | null;
}

export interface AIWorkspaceState {
  loading: boolean;
  running: boolean;
  selectedToolId: string | null;
  tools: AIWorkspaceTool[];
  featuredTools: AIWorkspaceTool[];
  recentOutputs: AIWorkspaceOutput[];
  history: AIWorkspaceHistoryItem[];
  pendingApprovals: AIWorkspaceApprovalItem[];
  error: string | null;
  viewMode: AIWorkspaceViewMode;
}
