import { supabase } from "../../../lib/supabase/client";

export type AutomationRunRow = {
  id: string;
  organization_id: string;
  automation_flow_id: string;
  project_id: string | null;
  workflow_name: string;
  status: string;
  message: string | null;
  triggered_by: string | null;
  created_at: string;
};

export type CreateAutomationRunInput = {
  organizationId: string;
  automationFlowId: string;
  projectId?: string | null;
  workflowName: string;
  status: string;
  message?: string | null;
  triggeredBy?: string | null;
};

export async function getAutomationRuns(organizationId: string) {
  const { data, error } = await supabase
    .from("automation_runs")
    .select(
      "id, organization_id, automation_flow_id, project_id, workflow_name, status, message, triggered_by, created_at",
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []) as AutomationRunRow[];
}

export async function createAutomationRun(input: CreateAutomationRunInput) {
  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      organization_id: input.organizationId,
      automation_flow_id: input.automationFlowId,
      project_id: input.projectId ?? null,
      workflow_name: input.workflowName,
      status: input.status,
      message: input.message ?? null,
      triggered_by: input.triggeredBy ?? null,
    })
    .select(
      "id, organization_id, automation_flow_id, project_id, workflow_name, status, message, triggered_by, created_at",
    )
    .single();

  if (error) throw error;

  return data as AutomationRunRow;
}
