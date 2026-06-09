import { searchAssetsByText } from "../../../lib/supabase/queries/assets";
import type { AiRouterContext } from "../types/aiToolTypes";

export async function searchAssetsFallback(
  context: AiRouterContext,
  query?: string,
) {
  const assets = await searchAssetsByText(
    context.organizationId,
    query?.trim() || "",
  );

  return {
    assets: assets.map((asset) => ({
      id: asset.id,
      asset_name: asset.asset_name,
      asset_tag: asset.asset_tag,
      serial_number: asset.serial_number,
      status: asset.status,
      brand: asset.brand,
      model: asset.model,
    })),
    count: assets.length,
    query: query?.trim() || "",
  };
}
