import {
  getAssetsByOrganization,
  getAssetById,
  getActiveAssetAssignment,
  searchAssetsByText,
  getAssetStats,
} from "../../../lib/supabase/queries/assets";
import {
  createAsset,
  updateAsset,
  assignAsset,
  returnAsset,
  markAssetInRepair,
  retireAsset,
  deleteAsset,
  type CreateAssetInput,
  type UpdateAssetInput,
} from "../../../lib/supabase/mutations/assets";

export async function fetchAssets(organizationId: string) {
  return getAssetsByOrganization(organizationId);
}

export async function fetchAsset(assetId: string) {
  return getAssetById(assetId);
}

export async function fetchActiveAssetAssignment(assetId: string) {
  return getActiveAssetAssignment(assetId);
}

export async function searchAssets(
  organizationId: string,
  searchTerm: string
) {
  const term = searchTerm.trim();

  if (!term) {
    return getAssetsByOrganization(organizationId);
  }

  return searchAssetsByText(organizationId, term);
}

export async function fetchAssetDashboardStats(organizationId: string) {
  return getAssetStats(organizationId);
}

export async function createSerializedAsset(input: CreateAssetInput) {
  return createAsset(input);
}

export async function editAsset(assetId: string, input: UpdateAssetInput) {
  return updateAsset(assetId, input);
}

export async function checkoutAsset(input: {
  organization_id: string;
  asset_id: string;
  assigned_to?: string | null;
  assigned_project_id?: string | null;
  assigned_location_id?: string | null;
  assigned_by?: string | null;
  due_back_at?: string | null;
  notes?: string | null;
}) {
  return assignAsset(input);
}

export async function checkinAsset(input: {
  assignment_id: string;
  asset_id: string;
  returned_by?: string | null;
  location_id?: string | null;
}) {
  return returnAsset(input);
}

export async function sendAssetToRepair(assetId: string) {
  return markAssetInRepair(assetId);
}

export async function archiveAsset(assetId: string) {
  return retireAsset(assetId);
}

export async function removeAsset(assetId: string) {
  return deleteAsset(assetId);
}