import { supabase } from "../client";
import type { Report, ReportStatus } from "../queries/reports";

export interface CreateReportInput {
  organization_id: string;
  client_id: string;
  campaign_id?: string | null;
  title: string;
  period_start?: string | null;
  period_end?: string | null;
  status?: ReportStatus;
  summary?: string | null;
  file_url?: string | null;
  generated_by?: string | null;
}

export const createReport = async (payload: CreateReportInput) => {
  const { data, error } = await supabase
    .from("reports")
    .insert({
      organization_id: payload.organization_id,
      client_id: payload.client_id,
      campaign_id: payload.campaign_id ?? null,
      title: payload.title,
      period_start: payload.period_start ?? null,
      period_end: payload.period_end ?? null,
      status: payload.status ?? "draft",
      summary: payload.summary ?? null,
      file_url: payload.file_url ?? null,
      generated_by: payload.generated_by ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data as Report;
};
