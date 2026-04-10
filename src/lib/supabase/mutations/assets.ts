import { supabase } from "../client";

function generateAssetTag() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INM-AST-${datePart}-${random}`;
}

export interface CreateAssetInput {
  organization_id: string;
  purchase_batch_id?: string | null;
  category_id?: string | null;
  current_location_id?: string | null;

  asset_name: string;
  asset_tag?: string | null;
  serial_number: string;

  brand?: string | null;
  model?: string | null;
  description?: string | null;

  purchase_price?: number | null;
  currency?: string | null;
  purchase_date?: string | null;
  warranty_expiry_date?: string | null;
  expected_life_months?: number | null;

  invoice_number?: string | null;
  reference_number?: string | null;

  insured?: boolean;
  insurance_provider?: string | null;
  insurance_policy_number?: string | null;
  insurance_expiry_date?: string | null;

  sub_location?: string | null;

  barcode_value?: string | null;
  qr_code_value?: string | null;

  asset_image_url?: string | null;
  site_image_url?: string | null;

  notes?: string | null;
  created_by?: string | null;
}

export interface UpdateAssetInput {
  asset_name?: string;
  purchase_batch_id?: string | null;
  category_id?: string | null;
  current_location_id?: string | null;

  asset_tag?: string | null;
  serial_number?: string;

  brand?: string | null;
  model?: string | null;
  description?: string | null;

  status?:
    | "in_stock"
    | "assigned"
    | "in_repair"
    | "retired"
    | "lost"
    | "disposed";

  condition?: "new" | "excellent" | "good" | "fair" | "damaged";

  purchase_price?: number | null;
  currency?: string | null;
  purchase_date?: string | null;
  warranty_expiry_date?: string | null;
  expected_life_months?: number | null;

  invoice_number?: string | null;
  reference_number?: string | null;

  insured?: boolean;
  insurance_provider?: string | null;
  insurance_policy_number?: string | null;
  insurance_expiry_date?: string | null;

  sub_location?: string | null;

  barcode_value?: string | null;
  qr_code_value?: string | null;

  asset_image_url?: string | null;
  site_image_url?: string | null;

  notes?: string | null;
}

export async function createAsset(input: CreateAssetInput) {
  const resolvedAssetTag = input.asset_tag?.trim() || generateAssetTag();

  const { data, error } = await supabase
    .from("assets")
    .insert({
      ...input,
      asset_tag: resolvedAssetTag,
      barcode_value: input.barcode_value?.trim() || resolvedAssetTag,
      qr_code_value: input.qr_code_value?.trim() || resolvedAssetTag,
      currency: input.currency?.trim() || "USD",
      status: "in_stock",
      condition: "new",
      insured: input.insured ?? false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to create asset.");
  }

  return data;
}

export async function updateAsset(assetId: string, input: UpdateAssetInput) {
  const payload = {
    ...input,
    currency: input.currency?.trim() || undefined,
  };

  const { data, error } = await supabase
    .from("assets")
    .update(payload)
    .eq("id", assetId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to update asset.");
  }

  return data;
}

export async function assignAsset(params: {
  organization_id: string;
  asset_id: string;
  assigned_to?: string | null;
  assigned_project_id?: string | null;
  assigned_location_id?: string | null;
  assigned_by?: string | null;
  due_back_at?: string | null;
  notes?: string | null;
}) {
  const { assigned_to, assigned_project_id, assigned_location_id } = params;

  if (!assigned_to && !assigned_project_id) {
    throw new Error("Assign the asset to a user or project.");
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("asset_assignments")
    .insert({
      ...params,
      status: "active",
    })
    .select()
    .single();

  if (assignmentError) {
    throw new Error(assignmentError.message || "Failed to assign asset.");
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .update({
      status: "assigned",
      assigned_to: assigned_to ?? null,
      assigned_project_id: assigned_project_id ?? null,
      current_location_id: assigned_location_id ?? null,
    })
    .eq("id", params.asset_id)
    .select()
    .single();

  if (assetError) {
    throw new Error(assetError.message || "Failed to update asset status.");
  }

  return {
    assignment,
    asset,
  };
}

export async function returnAsset(params: {
  assignment_id: string;
  asset_id: string;
  returned_by?: string | null;
  location_id?: string | null;
}) {
  const returnedAt = new Date().toISOString();

  const { data: assignment, error: assignmentError } = await supabase
    .from("asset_assignments")
    .update({
      status: "returned",
      returned_at: returnedAt,
      returned_by: params.returned_by ?? null,
    })
    .eq("id", params.assignment_id)
    .select()
    .single();

  if (assignmentError) {
    throw new Error(assignmentError.message || "Failed to return asset.");
  }

  const { data: asset, error: assetError } = await supabase
    .from("assets")
    .update({
      status: "in_stock",
      assigned_to: null,
      assigned_project_id: null,
      current_location_id: params.location_id ?? null,
    })
    .eq("id", params.asset_id)
    .select()
    .single();

  if (assetError) {
    throw new Error(assetError.message || "Failed to update returned asset.");
  }

  return {
    assignment,
    asset,
  };
}

export async function markAssetInRepair(assetId: string) {
  const { data, error } = await supabase
    .from("assets")
    .update({
      status: "in_repair",
      assigned_to: null,
      assigned_project_id: null,
    })
    .eq("id", assetId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to mark asset in repair.");
  }

  return data;
}

export async function retireAsset(assetId: string) {
  const { data, error } = await supabase
    .from("assets")
    .update({
      status: "retired",
      assigned_to: null,
      assigned_project_id: null,
    })
    .eq("id", assetId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message || "Failed to retire asset.");
  }

  return data;
}

export async function deleteAsset(assetId: string) {
  const { error } = await supabase.from("assets").delete().eq("id", assetId);

  if (error) {
    throw new Error(error.message || "Failed to delete asset.");
  }

  return true;
}