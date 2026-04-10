import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchAssets,
  searchAssets,
  createSerializedAsset,
  editAsset,
  checkoutAsset,
  checkinAsset,
  fetchAssetDashboardStats,
  sendAssetToRepair,
  archiveAsset,
  removeAsset,
} from "../../features/stock/services/stockService";
import type {
  CreateAssetInput,
  UpdateAssetInput,
} from "../supabase/mutations/assets";

interface AssetStats {
  total: number;
  in_stock: number;
  assigned: number;
  in_repair: number;
  retired: number;
  lost: number;
  disposed: number;
  insured: number;
  uninsured: number;
}

const DEFAULT_STATS: AssetStats = {
  total: 0,
  in_stock: 0,
  assigned: 0,
  in_repair: 0,
  retired: 0,
  lost: 0,
  disposed: 0,
  insured: 0,
  uninsured: 0,
};

export function useAssets(organizationId?: string | null) {
  const [assets, setAssets] = useState<any[]>([]);
  const [stats, setStats] = useState<AssetStats>(DEFAULT_STATS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canLoad = useMemo(() => Boolean(organizationId), [organizationId]);

  const loadAssets = useCallback(async () => {
    if (!organizationId) return;

    setLoading(true);
    setError("");

    try {
      const [assetRows, assetStats] = await Promise.all([
        fetchAssets(organizationId),
        fetchAssetDashboardStats(organizationId),
      ]);

      setAssets(assetRows);
      setStats(assetStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load assets.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!canLoad) return;
    void loadAssets();
  }, [canLoad, loadAssets]);

  const search = useCallback(
    async (term: string) => {
      if (!organizationId) return;

      setLoading(true);
      setError("");

      try {
        const results = await searchAssets(organizationId, term);
        setAssets(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to search assets.");
      } finally {
        setLoading(false);
      }
    },
    [organizationId]
  );

  const addAsset = useCallback(
    async (input: CreateAssetInput) => {
      setSaving(true);
      setError("");

      try {
        const created = await createSerializedAsset(input);
        await loadAssets();
        return created;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create asset.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [loadAssets]
  );

  const updateOneAsset = useCallback(
    async (assetId: string, input: UpdateAssetInput) => {
      setSaving(true);
      setError("");

      try {
        const updated = await editAsset(assetId, input);
        await loadAssets();
        return updated;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update asset.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [loadAssets]
  );

  const assignOneAsset = useCallback(
    async (input: {
      organization_id: string;
      asset_id: string;
      assigned_to?: string | null;
      assigned_project_id?: string | null;
      assigned_location_id?: string | null;
      assigned_by?: string | null;
      due_back_at?: string | null;
      notes?: string | null;
    }) => {
      setSaving(true);
      setError("");

      try {
        const result = await checkoutAsset(input);
        await loadAssets();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to assign asset.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [loadAssets]
  );

  const returnOneAsset = useCallback(
    async (input: {
      assignment_id: string;
      asset_id: string;
      returned_by?: string | null;
      location_id?: string | null;
    }) => {
      setSaving(true);
      setError("");

      try {
        const result = await checkinAsset(input);
        await loadAssets();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to return asset.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [loadAssets]
  );

  const moveAssetToRepair = useCallback(
    async (assetId: string) => {
      setSaving(true);
      setError("");

      try {
        const result = await sendAssetToRepair(assetId);
        await loadAssets();
        return result;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to send asset to repair."
        );
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [loadAssets]
  );

  const retireOneAsset = useCallback(
    async (assetId: string) => {
      setSaving(true);
      setError("");

      try {
        const result = await archiveAsset(assetId);
        await loadAssets();
        return result;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to retire asset.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [loadAssets]
  );

  const deleteOneAsset = useCallback(
    async (assetId: string) => {
      setSaving(true);
      setError("");

      try {
        await removeAsset(assetId);
        await loadAssets();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete asset.");
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [loadAssets]
  );

  return {
    assets,
    stats,
    loading,
    saving,
    error,
    reload: loadAssets,
    search,
    addAsset,
    updateAsset: updateOneAsset,
    assignAsset: assignOneAsset,
    returnAsset: returnOneAsset,
    markInRepair: moveAssetToRepair,
    retireAsset: retireOneAsset,
    deleteAsset: deleteOneAsset,
  };
}