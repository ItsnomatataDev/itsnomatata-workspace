import { useCallback, useEffect, useState } from "react";
import { getCampaigns, type Campaign } from "../supabase/queries/campaigns";
import {
  createCampaign as createCampaignMutation,
  updateCampaign as updateCampaignMutation,
  deleteCampaign as deleteCampaignMutation,
  type CreateCampaignInput,
  type UpdateCampaignInput,
} from "../supabase/mutations/campaigns";

export const useCampaigns = ({
  organizationId,
}: {
  organizationId?: string | null;
}) => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchCampaigns = useCallback(async () => {
    if (!organizationId) {
      setLoading(false);
      setError("Missing organization id.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await getCampaigns(organizationId);
      setCampaigns(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch campaigns",
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const createCampaign = async (payload: CreateCampaignInput) => {
    const created = await createCampaignMutation(payload);
    setCampaigns((prev) => [created, ...prev]);
    return created;
  };

  const updateCampaign = async (
    campaignId: string,
    payload: UpdateCampaignInput,
  ) => {
    const updated = await updateCampaignMutation(campaignId, payload);
    setCampaigns((prev) =>
      prev.map((item) => (item.id === campaignId ? updated : item)),
    );
    return updated;
  };

  const deleteCampaign = async (campaignId: string) => {
    await deleteCampaignMutation(campaignId);
    setCampaigns((prev) => prev.filter((item) => item.id !== campaignId));
  };

  return {
    campaigns,
    loading,
    error,
    refetch: fetchCampaigns,
    createCampaign,
    updateCampaign,
    deleteCampaign,
  };
};
