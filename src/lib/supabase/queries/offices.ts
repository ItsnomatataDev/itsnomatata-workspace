import { supabase } from "../client";
import type { CompanyOffice } from "../../offices";

export async function getCompanyOffices(
  organizationId: string,
): Promise<CompanyOffice[]> {
  if (!organizationId) throw new Error("organizationId is required");

  const { data, error } = await supabase
    .from("company_offices")
    .select("id, organization_id, name, slug, is_primary, created_at")
    .eq("organization_id", organizationId)
    .order("is_primary", { ascending: false })
    .order("name", { ascending: true });

  if (error) throw error;
  return (data ?? []) as CompanyOffice[];
}

export async function getCompanyOfficeBySlug(params: {
  organizationId: string;
  slug: string;
}): Promise<CompanyOffice | null> {
  const { data, error } = await supabase
    .from("company_offices")
    .select("id, organization_id, name, slug, is_primary, created_at")
    .eq("organization_id", params.organizationId)
    .eq("slug", params.slug)
    .maybeSingle();

  if (error) throw error;
  return (data as CompanyOffice | null) ?? null;
}

export async function resolveCompanyOfficeId(params: {
  organizationId: string;
  slug: string;
}): Promise<string | null> {
  const { data, error } = await supabase.rpc("resolve_company_office_id", {
    target_organization_id: params.organizationId,
    target_slug: params.slug,
  });

  if (error) throw error;
  return typeof data === "string" ? data : null;
}
