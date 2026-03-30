import { supabase } from "../../../lib/supabase/client";
import { triggerN8NFlow } from "../../../lib/api/n8n";
import { createAutomationRun, getAutomationRuns } from "./automationRunService";

export type AutomationFlowRow = {
  id: string;
  organization_id: string;
  project_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  webhook_url: string | null;
  status: string;
  created_at: string;
};

export type CreateAutomationFlowInput = {
  organizationId: string;
  projectId?: string | null;
  name: string;
  slug: string;
  description?: string;
  webhookUrl?: string | null;
  status?: string;
  createdBy?: string | null;
};

export type UpdateAutomationFlowInput = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  webhookUrl?: string | null;
  status?: string;
  projectId?: string | null;
};

export type TriggerAutomationFlowInput = {
  flow: AutomationFlowRow;
  organizationId: string;
  triggeredBy: string;
  payload?: Record<string, any>;
};

export type AutomationHealthSummary = {
  totalRuns: number;
  successCount: number;
  failedCount: number;
  successRate: number;
  lastRunAt: string | null;
  latestStatus: string | null;
  riskLevel: "low" | "medium" | "high";
};

export async function getAutomationFlows(organizationId: string) {
  const { data, error } = await supabase
    .from("automation_flows")
    .select(
      "id, organization_id, project_id, name, slug, description, webhook_url, status, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as AutomationFlowRow[];
}

export async function createAutomationFlow(input: CreateAutomationFlowInput) {
  const { data, error } = await supabase
    .from("automation_flows")
    .insert({
      organization_id: input.organizationId,
      project_id: input.projectId ?? null,
      name: input.name,
      slug: input.slug,
      description: input.description ?? "",
      webhook_url: input.webhookUrl ?? null,
      status: input.status ?? "active",
      created_by: input.createdBy ?? null,
    })
    .select(
      "id, organization_id, project_id, name, slug, description, webhook_url, status, created_at",
    )
    .single();

  if (error) throw error;

  return data as AutomationFlowRow;
}

export async function updateAutomationFlow(input: UpdateAutomationFlowInput) {
  const { data, error } = await supabase
    .from("automation_flows")
    .update({
      name: input.name,
      slug: input.slug,
      description: input.description ?? "",
      webhook_url: input.webhookUrl ?? null,
      status: input.status ?? "active",
      project_id: input.projectId ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select(
      "id, organization_id, project_id, name, slug, description, webhook_url, status, created_at",
    )
    .single();

  if (error) throw error;

  return data as AutomationFlowRow;
}

export async function triggerAutomationFlow({
  flow,
  organizationId,
  triggeredBy,
  payload = {},
}: TriggerAutomationFlowInput) {
  if (!flow.webhook_url) {
    throw new Error("This automation flow does not have a webhook URL.");
  }

  const result = await triggerN8NFlow({
    webhookUrl: flow.webhook_url,
    payload: {
      flowId: flow.id,
      flowName: flow.name,
      flowSlug: flow.slug,
      organizationId,
      projectId: flow.project_id,
      triggeredBy,
      ...payload,
    },
  });

  await createAutomationRun({
    organizationId,
    automationFlowId: flow.id,
    projectId: flow.project_id,
    workflowName: flow.name,
    status: result.ok ? "success" : "failed",
    message: result.ok
      ? result.data?.message || "Automation triggered successfully."
      : result.error || "Automation trigger failed.",
    triggeredBy,
  });

  if (!result.ok) {
    throw new Error(result.error || "Automation trigger failed.");
  }

  return result;
}

export async function getAutomationHealthSummary(
  organizationId: string,
  workflowName: string,
) {
  const runs = await getAutomationRuns(organizationId);
  const filtered = runs.filter((run) => run.workflow_name === workflowName);

  const totalRuns = filtered.length;
  const successCount = filtered.filter(
    (run) => run.status === "success",
  ).length;
  const failedCount = filtered.filter((run) => run.status !== "success").length;
  const successRate =
    totalRuns === 0 ? 0 : Math.round((successCount / totalRuns) * 100);
  const latest = filtered[0] ?? null;

  let riskLevel: "low" | "medium" | "high" = "low";
  if (failedCount >= 2 || successRate < 80) riskLevel = "medium";
  if (failedCount >= 5 || successRate < 50) riskLevel = "high";

  const summary: AutomationHealthSummary = {
    totalRuns,
    successCount,
    failedCount,
    successRate,
    lastRunAt: latest?.created_at ?? null,
    latestStatus: latest?.status ?? null,
    riskLevel,
  };

  return summary;
}

export function generateFlowSlug(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}
