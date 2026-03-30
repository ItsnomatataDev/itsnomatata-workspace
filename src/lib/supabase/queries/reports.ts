import { supabase } from "../client";

export type ReportStatus = "draft" | "generated" | "approved" | "sent";

export interface Report {
  id: string;
  organization_id: string;
  client_id: string;
  campaign_id: string | null;
  title: string;
  period_start: string | null;
  period_end: string | null;
  status: ReportStatus;
  summary: string | null;
  file_url: string | null;
  generated_by: string | null;
  approved_by: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export const getReports = async (organizationId?: string) => {
  let query = supabase
    .from("reports")
    .select("*")
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as Report[];
};
