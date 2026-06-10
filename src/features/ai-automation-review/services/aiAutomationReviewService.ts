import { supabase } from "../../../lib/supabase/client";

export type AIConnectionStatus = {
  status: "healthy" | "degraded" | "offline";
  checkedAt: string | null;
  n8nWebhookConfigured: boolean;
  n8nApiKeyConfigured: boolean;
  message: string;
};

export type AITableCheck = {
  table: string;
  ok: boolean;
  error: string | null;
};

export type AICountCheck = {
  table: string;
  ok: boolean;
  count: number;
  error: string | null;
};

export type AutomationRecommendation = {
  id: string;
  module: string;
  title: string;
  description: string;
  priority: "Easy" | "Medium" | "Advanced";
  risk: "Safe" | "Needs approval" | "Admin-only";
  affectedTables: string[];
  firstBuild: boolean;
};

export type AIReviewStatus = {
  connection: AIConnectionStatus;
  tableChecks: AITableCheck[];
  counts: AICountCheck[];
  recommendations: string[];
};

const REQUIRED_TABLES = [
  "automation_flows",
  "automation_runs",
  "ai_automation_rules",
  "ai_automation_runs",
  "ai_task_suggestions",
  "ai_document_summaries",
  "ai_chat_suggestions",
  "ai_report_summaries",
  "ai_activity_logs",
  "ai_approvals",
  "tasks",
  "chat_messages",
  "notifications",
  "meetings",
  "employee_documents",
  "leave_requests",
  "social_posts",
  "fleet_service_schedules",
  "reports",
  "attendance_daily_status",
];

export const AUTOMATION_RECOMMENDATIONS: AutomationRecommendation[] = [
  {
    id: "chat_to_task_suggestion",
    module: "Chat",
    title: "Chat message to task suggestion",
    description:
      "Detect task-like chat messages and save a task suggestion for manager or admin approval.",
    priority: "Easy",
    risk: "Needs approval",
    affectedTables: [
      "chat_messages",
      "ai_chat_suggestions",
      "ai_task_suggestions",
      "ai_activity_logs",
      "notifications",
    ],
    firstBuild: true,
  },
  {
    id: "overdue_blocker_alerts",
    module: "Tasks",
    title: "Overdue and blocked task reminders",
    description:
      "Find overdue or blocked tasks, notify owners, and suggest escalations for managers.",
    priority: "Easy",
    risk: "Safe",
    affectedTables: ["tasks", "task_assignees", "notifications", "ai_activity_logs"],
    firstBuild: true,
  },
  {
    id: "manager_team_digest",
    module: "Reports",
    title: "Manager team progress digest",
    description:
      "Summarize assigned work, blockers, overdue items, and workload signals for managers.",
    priority: "Medium",
    risk: "Safe",
    affectedTables: ["tasks", "time_entries", "reports", "ai_report_summaries"],
    firstBuild: false,
  },
  {
    id: "document_summary",
    module: "Documents",
    title: "Document summaries and action extraction",
    description:
      "Summarize uploaded documents, extract owners, deadlines, decisions, and task suggestions.",
    priority: "Medium",
    risk: "Needs approval",
    affectedTables: [
      "employee_documents",
      "ai_document_summaries",
      "ai_task_suggestions",
      "ai_activity_logs",
    ],
    firstBuild: false,
  },
  {
    id: "meeting_notes_to_tasks",
    module: "Meetings",
    title: "Meeting notes to task suggestions",
    description:
      "Turn meeting notes or chat into suggested cards with owners and due dates.",
    priority: "Medium",
    risk: "Needs approval",
    affectedTables: ["meetings", "meeting_participants", "tasks", "ai_task_suggestions"],
    firstBuild: false,
  },
  {
    id: "email_to_task",
    module: "Email",
    title: "Email to task suggestion",
    description:
      "Analyze incoming work emails and create task suggestions with approval before card creation.",
    priority: "Advanced",
    risk: "Needs approval",
    affectedTables: ["notifications", "tasks", "ai_task_suggestions", "ai_activity_logs"],
    firstBuild: false,
  },
  {
    id: "finance_reminders",
    module: "Finance",
    title: "Invoice and payment reminders",
    description:
      "Summarize invoice/payment follow-ups while requiring approval for any finance record changes.",
    priority: "Advanced",
    risk: "Admin-only",
    affectedTables: ["client_invoices", "notifications", "ai_activity_logs"],
    firstBuild: false,
  },
  {
    id: "leave_monthly_summary",
    module: "Leave",
    title: "Leave request summaries",
    description:
      "Summarize pending and approved leave by employee, date range, and overlap risk without approving or rejecting anything.",
    priority: "Easy",
    risk: "Safe",
    affectedTables: ["leave_requests", "leave_types", "profiles"],
    firstBuild: true,
  },
  {
    id: "meeting_action_items",
    module: "Meetings",
    title: "Meeting action item extraction",
    description:
      "Read meeting metadata or supplied notes, then draft task suggestions that require confirmation before creation.",
    priority: "Medium",
    risk: "Needs approval",
    affectedTables: ["meetings", "meeting_attendees", "tasks", "ai_task_suggestions"],
    firstBuild: false,
  },
  {
    id: "fleet_service_digest",
    module: "Fleet",
    title: "Fleet service needs digest",
    description:
      "Find vehicles with service due soon and prepare a manager digest without editing vehicle records.",
    priority: "Easy",
    risk: "Safe",
    affectedTables: ["fleet_vehicles", "fleet_service_schedules", "fleet_maintenance_records"],
    firstBuild: false,
  },
  {
    id: "content_schedule_digest",
    module: "Content Studio",
    title: "Content and social schedule digest",
    description:
      "Summarize draft, review, approval, and scheduled social posts while keeping publishing behind preview and confirmation.",
    priority: "Medium",
    risk: "Needs approval",
    affectedTables: ["social_posts", "content_review_drafts", "content_review_assets"],
    firstBuild: false,
  },
];

function getSupabaseFunctionsBaseUrl() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!supabaseUrl) throw new Error("Missing VITE_SUPABASE_URL");
  return `${supabaseUrl.replace(/\/$/, "")}/functions/v1`;
}

async function fallbackTableChecks(): Promise<AITableCheck[]> {
  const checks = await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      const { error } = await supabase
        .from(table)
        .select("id", { count: "exact", head: true })
        .limit(1);

      return {
        table,
        ok: !error,
        error: error?.message ?? null,
      };
    }),
  );

  return checks;
}

export async function getAIReviewStatus(): Promise<AIReviewStatus> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  if (!token) {
    throw new Error("You must be signed in to review AI automation.");
  }

  try {
    const response = await fetch(
      `${getSupabaseFunctionsBaseUrl()}/ai-automation-gateway`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload?.error ?? `Gateway returned ${response.status}`);
    }

    const missingTables = Array.isArray(payload.tableChecks)
      ? payload.tableChecks.filter((item: AITableCheck) => !item.ok).length
      : 0;

    return {
      connection: {
        status: missingTables > 0 ? "degraded" : "healthy",
        checkedAt: typeof payload.checkedAt === "string" ? payload.checkedAt : null,
        n8nWebhookConfigured: Boolean(payload.gateway?.n8nWebhookConfigured),
        n8nApiKeyConfigured: Boolean(payload.gateway?.n8nApiKeyConfigured),
        message: "Server-side AI automation gateway responded successfully.",
      },
      tableChecks: Array.isArray(payload.tableChecks) ? payload.tableChecks : [],
      counts: Array.isArray(payload.counts) ? payload.counts : [],
      recommendations: Array.isArray(payload.recommendations)
        ? payload.recommendations
        : [],
    };
  } catch (error) {
    const tableChecks = await fallbackTableChecks();

    return {
      connection: {
        status: "degraded",
        checkedAt: new Date().toISOString(),
        n8nWebhookConfigured: false,
        n8nApiKeyConfigured: false,
        message:
          error instanceof Error
            ? `Gateway unavailable: ${error.message}`
            : "Gateway unavailable. Showing client-side table readiness only.",
      },
      tableChecks,
      counts: [],
      recommendations: [
        "Deploy the ai-automation-gateway Supabase Edge Function before enabling live n8n automation.",
        "Keep direct n8n webhook URLs out of the frontend.",
      ],
    };
  }
}

export async function createAutomationBuildRequest(params: {
  organizationId: string;
  userId: string;
  recommendation: AutomationRecommendation;
}) {
  const { error } = await supabase.from("ai_automation_rules").insert({
    organization_id: params.organizationId,
    name: params.recommendation.title,
    module: params.recommendation.module.toLowerCase(),
    source: params.recommendation.id,
    allowed_actions: ["suggest_task", "summarize", "notify", "schedule_reminder"],
    risk_level:
      params.recommendation.risk === "Safe"
        ? "safe"
        : params.recommendation.risk === "Admin-only"
          ? "admin_only"
          : "needs_approval",
    status: "draft",
    requires_approval: params.recommendation.risk !== "Safe",
    auto_execute: false,
    created_by: params.userId,
    metadata: {
      requested_from: "ai_automation_review",
      recommendation_id: params.recommendation.id,
      affected_tables: params.recommendation.affectedTables,
      priority: params.recommendation.priority,
      note: "Build request only. This does not enable automation.",
    },
  });

  if (error) throw error;
}
