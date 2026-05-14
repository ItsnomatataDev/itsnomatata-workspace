import { useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/client";
import { useAuth } from "../../app/providers/AuthProvider";
import { checkIsPlatformAdmin } from "../../features/platform-admin/services/platformAdminService";

export type FeatureKey =
  | "admin_dashboard"
  | "admin_users"
  | "admin_leave"
  | "admin_roster"
  | "leave_requests"
  | "boards"
  | "duty_roster"
  | "meetings"
  | "chat"
  | "assets"
  | "fleet"
  | "stock"
  | "finance"
  | "ai_agent"
  | "ai_workspace"
  | "attendance"
  | "timesheets"
  | "media_dashboard"
  | "social_media"
  | "automation"
  | "notifications"
  | "tasks"
  | "reports"
  | "clients"
  | "invoices"
  | "expenses"
  | "budgets"
  | "knowledge_base";

type FeatureRow = {
  feature_key: string;
  enabled: boolean;
};

export function useOrganizationFeatures() {
  const auth = useAuth();
  const organizationId = auth?.profile?.organization_id ?? null;
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const organization = auth?.profile?.organization as
    | {
        slug?: string;
        is_system_organization?: boolean;
        is_system_owner?: boolean;
      }
    | null
    | undefined;
  const isSystemOrganization = Boolean(
    organization?.slug === "its-nomatata" ||
      organization?.is_system_organization ||
      organization?.is_system_owner,
  );

  useEffect(() => {
    let mounted = true;

    async function loadFeatures() {
      if (!organizationId) {
        setFeatures({});
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [platformAllowed, featureResult] = await Promise.all([
          checkIsPlatformAdmin(),
          supabase
            .from("organization_features")
            .select("feature_key, enabled")
            .eq("organization_id", organizationId),
        ]);

        if (!mounted) return;
        setIsPlatformAdmin(platformAllowed);

        if (featureResult.error) throw featureResult.error;

        const nextFeatures = ((featureResult.data ?? []) as FeatureRow[]).reduce<
          Record<string, boolean>
        >((acc, feature) => {
          acc[feature.feature_key] = feature.enabled;
          return acc;
        }, {});

        setFeatures(nextFeatures);
      } catch (error) {
        console.error("LOAD ORGANIZATION FEATURES ERROR:", error);
        if (mounted) setFeatures({});
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadFeatures();

    return () => {
      mounted = false;
    };
  }, [organizationId]);

  return useMemo(
    () => ({
      features,
      loading,
      isPlatformAdmin,
      isEnabled: (featureKey?: FeatureKey | string | null) => {
        if (!featureKey || isSystemOrganization) return true;
        return features[featureKey] !== false;
      },
    }),
    [features, isPlatformAdmin, isSystemOrganization, loading],
  );
}
