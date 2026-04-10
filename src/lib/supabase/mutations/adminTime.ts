import { supabase } from "../client";

export async function approveTimeEntry({
  entryId,
  approvedBy,
}: {
  entryId: string;
  approvedBy: string;
}) {
  if (!entryId) throw new Error("entryId is required");
  if (!approvedBy) throw new Error("approvedBy is required");

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      approval_status: "approved",
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
      locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function rejectTimeEntry({
  entryId,
  approvedBy,
}: {
  entryId: string;
  approvedBy?: string | null;
}) {
  if (!entryId) throw new Error("entryId is required");

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      approval_status: "rejected",
      approved_by: approvedBy ?? null,
      approved_at: new Date().toISOString(),
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function bulkApproveTimeEntries({
  entryIds,
  approvedBy,
}: {
  entryIds: string[];
  approvedBy: string;
}) {
  if (!entryIds?.length) throw new Error("entryIds are required");
  if (!approvedBy) throw new Error("approvedBy is required");

  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("time_entries")
    .update({
      approval_status: "approved",
      approved_by: approvedBy,
      approved_at: now,
      locked_at: now,
      updated_at: now,
    })
    .in("id", entryIds)
    .select();

  if (error) throw error;
  return data ?? [];
}