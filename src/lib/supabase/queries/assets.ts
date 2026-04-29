import { supabase } from "../client";

export async function getAssetsByOrganization(organizationId: string) {
  const { data, error } = await supabase
    .from("assets")
    .select(
      `
      id,
      organization_id,
      purchase_batch_id,
      category_id,
      current_location_id,
      asset_name,
      asset_tag,
      serial_number,
      brand,
      model,
      description,
      status,
      condition,
      purchase_price,
      currency,
      purchase_date,
      warranty_expiry_date,
      expected_life_months,
      invoice_number,
      reference_number,
      insured,
      insurance_provider,
      insurance_policy_number,
      insurance_expiry_date,
      sub_location,
      barcode_value,
      qr_code_value,
      asset_image_url,
      site_image_url,
      notes,
      created_by,
      created_at,
      updated_at,

      category:asset_categories(
        id,
        name
      ),

      location:stock_locations(
        id,
        name,
        code,
        image_url
      ),

      purchase_batch:purchase_batches(
        id,
        reference_number,
        invoice_number,
        purchase_date
      ),

      assigned_profile:profiles!assets_assigned_to_fkey(
        id,
        full_name,
        email
      ),

      created_profile:profiles!assets_created_by_fkey(
        id,
        full_name,
        email
      )
    `
    )
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to load assets.");
  }

  return data ?? [];
}

export async function getAssetById(assetId: string) {
  const { data, error } = await supabase
    .from("assets")
    .select(
      `
      id,
      organization_id,
      purchase_batch_id,
      category_id,
      current_location_id,
      asset_name,
      asset_tag,
      serial_number,
      brand,
      model,
      description,
      status,
      condition,
      purchase_price,
      currency,
      purchase_date,
      warranty_expiry_date,
      expected_life_months,
      invoice_number,
      reference_number,
      insured,
      insurance_provider,
      insurance_policy_number,
      insurance_expiry_date,
      sub_location,
      barcode_value,
      qr_code_value,
      asset_image_url,
      site_image_url,
      notes,
      created_by,
      created_at,
      updated_at,
      assigned_to,
      assigned_project_id,

      category:asset_categories(
        id,
        name
      ),

      location:stock_locations(
        id,
        name,
        code,
        image_url
      ),

      purchase_batch:purchase_batches(
        id,
        reference_number,
        invoice_number,
        purchase_date,
        vendor_id
      ),

      assigned_profile:profiles!assets_assigned_to_fkey(
        id,
        full_name,
        email
      ),

      created_profile:profiles!assets_created_by_fkey(
        id,
        full_name,
        email
      ),

      assignment_history:asset_assignments(
        id,
        organization_id,
        asset_id,
        assigned_to,
        assigned_project_id,
        assigned_location_id,
        assigned_by,
        assigned_at,
        due_back_at,
        returned_at,
        returned_by,
        status,
        notes,
        created_at,
        assigned_to_profile:profiles!asset_assignments_assigned_to_fkey(
          id,
          full_name,
          email
        ),
        assigned_by_profile:profiles!asset_assignments_assigned_by_fkey(
          id,
          full_name,
          email
        ),
        returned_by_profile:profiles!asset_assignments_returned_by_fkey(
          id,
          full_name,
          email
        )
      ),

      maintenance_history:asset_maintenance(
        id,
        organization_id,
        asset_id,
        title,
        description,
        service_vendor_id,
        cost,
        service_date,
        next_service_date,
        created_by,
        created_at,
        created_profile:profiles!asset_maintenance_created_by_fkey(
          id,
          full_name,
          email
        )
      ),

      audit_history:asset_audits(
        id,
        organization_id,
        asset_id,
        checked_by,
        checked_at,
        found_location_id,
        found_condition,
        remarks,
        checked_by_profile:profiles!asset_audits_checked_by_fkey(
          id,
          full_name,
          email
        )
      )
    `
    )
    .eq("id", assetId)
    .single();

  if (error) {
    throw new Error(error.message || "Failed to load asset.");
  }

  return data;
}

export async function getActiveAssetAssignment(assetId: string) {
  const { data, error } = await supabase
    .from("asset_assignments")
    .select(
      `
      id,
      asset_id,
      assigned_to,
      assigned_project_id,
      assigned_location_id,
      assigned_by,
      assigned_at,
      due_back_at,
      returned_at,
      returned_by,
      status,
      notes,
      assigned_to_profile:profiles!asset_assignments_assigned_to_fkey(
        id,
        full_name,
        email
      ),
      assigned_by_profile:profiles!asset_assignments_assigned_by_fkey(
        id,
        full_name,
        email
      )
    `
    )
    .eq("asset_id", assetId)
    .eq("status", "active")
    .is("returned_at", null)
    .order("assigned_at", { ascending: false })
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load active assignment.");
  }

  return data;
}

export async function searchAssetsByText(
  organizationId: string,
  searchTerm: string
) {
  const term = searchTerm.trim();

  const { data, error } = await supabase
    .from("assets")
    .select(
      `
      id,
      organization_id,
      purchase_batch_id,
      category_id,
      current_location_id,
      asset_name,
      asset_tag,
      serial_number,
      brand,
      model,
      description,
      status,
      condition,
      purchase_price,
      currency,
      purchase_date,
      warranty_expiry_date,
      expected_life_months,
      invoice_number,
      reference_number,
      insured,
      insurance_provider,
      insurance_policy_number,
      insurance_expiry_date,
      sub_location,
      barcode_value,
      qr_code_value,
      asset_image_url,
      site_image_url,
      notes,
      created_by,
      created_at,
      updated_at,

      category:asset_categories(
        id,
        name
      ),

      location:stock_locations(
        id,
        name,
        code,
        image_url
      ),

      assigned_profile:profiles!assets_assigned_to_fkey(
        id,
        full_name,
        email
      ),

      created_profile:profiles!assets_created_by_fkey(
        id,
        full_name,
        email
      )
    `
    )
    .eq("organization_id", organizationId)
    .or(
      [
        `asset_name.ilike.%${term}%`,
        `asset_tag.ilike.%${term}%`,
        `serial_number.ilike.%${term}%`,
        `brand.ilike.%${term}%`,
        `model.ilike.%${term}%`,
        `invoice_number.ilike.%${term}%`,
        `reference_number.ilike.%${term}%`,
        `sub_location.ilike.%${term}%`,
      ].join(",")
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "Failed to search assets.");
  }

  return data ?? [];
}

export async function getAssetStats(organizationId: string) {
  const { data, error } = await supabase
    .from("assets")
    .select("id, status, insured")
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message || "Failed to load asset stats.");
  }

  const assets = data ?? [];

  return {
    total: assets.length,
    in_stock: assets.filter((item) => item.status === "in_stock").length,
    assigned: assets.filter((item) => item.status === "assigned").length,
    in_repair: assets.filter((item) => item.status === "in_repair").length,
    retired: assets.filter((item) => item.status === "retired").length,
    lost: assets.filter((item) => item.status === "lost").length,
    disposed: assets.filter((item) => item.status === "disposed").length,
    insured: assets.filter((item) => item.insured === true).length,
    uninsured: assets.filter((item) => item.insured !== true).length,
  };
}


