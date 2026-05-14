import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";
import { supabase } from "../../lib/supabase/client";
import type { OrganizationBranding } from "../../features/platform-admin/types/platformAdmin";

export type OrganizationBrandingContextValue = {
  branding: OrganizationBranding;
  loading: boolean;
  refreshBranding: () => Promise<void>;
};

const DEFAULT_BRANDING: OrganizationBranding = {
  id: "default",
  organization_id: "default",
  brand_name: "ITsNomatata",
  logo_url:
    "https://res.cloudinary.com/dnqjax5ut/image/upload/v1776754504/Itsnomatata-Logo-White-with-tagline-2-768x643_u3n4j0.png",
  favicon_url: null,
  login_background_url: null,
  primary_color: "#000000",
  secondary_color: "#ffffff",
  accent_color: "#f97316",
  company_slogan: null,
  company_welcome_text: "Welcome to ITsNomatata.",
  dashboard_greeting_text: "Here is what needs attention today.",
  custom_terminology: {},
  invitation_template: null,
  onboarding_wording: {},
  custom_domain: null,
  subdomain: null,
  domain_status: null,
  domain_verification_token: null,
  dns_target: "cname.itsnomatata.com",
  domain_error: null,
};

const OrganizationBrandingContext =
  createContext<OrganizationBrandingContextValue | null>(null);

function mergeBranding(
  branding?: Partial<OrganizationBranding> | null,
): OrganizationBranding {
  return {
    ...DEFAULT_BRANDING,
    ...(branding ?? {}),
    brand_name: branding?.brand_name || DEFAULT_BRANDING.brand_name,
    logo_url: branding?.logo_url || DEFAULT_BRANDING.logo_url,
    primary_color: branding?.primary_color || DEFAULT_BRANDING.primary_color,
    secondary_color: branding?.secondary_color || DEFAULT_BRANDING.secondary_color,
    accent_color: branding?.accent_color || DEFAULT_BRANDING.accent_color,
    custom_terminology: branding?.custom_terminology ?? {},
    onboarding_wording: branding?.onboarding_wording ?? {},
  };
}

function hostLookup() {
  if (typeof window === "undefined") return null;

  const host = window.location.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local")
  ) {
    return null;
  }

  if (host.endsWith(".itsnomatata.com")) {
    const subdomain = host.replace(".itsnomatata.com", "");
    if (subdomain && subdomain !== "www" && subdomain !== "app") {
      return { type: "subdomain" as const, value: subdomain };
    }
  }

  return { type: "custom_domain" as const, value: host };
}

async function fetchBrandingByHost() {
  const lookup = hostLookup();
  if (!lookup) return null;

  const { data, error } = await supabase
    .rpc("get_organization_branding_by_host", {
      host_name:
        lookup.type === "subdomain"
          ? `${lookup.value}.itsnomatata.com`
          : lookup.value,
    })
    .maybeSingle();
  if (error) {
    console.warn("HOST BRANDING LOOKUP ERROR:", error);
    return null;
  }

  return data as OrganizationBranding | null;
}

export function OrganizationBrandingProvider({
  children,
}: {
  children: ReactNode;
}) {
  const auth = useAuth();
  const organizationId = auth?.profile?.organization_id ?? null;
  const organizationName =
    (auth?.profile?.organization as { name?: string } | null | undefined)?.name ??
    null;
  const [branding, setBranding] = useState<OrganizationBranding>(
    mergeBranding(null),
  );
  const [loading, setLoading] = useState(false);

  const refreshBranding = useCallback(async () => {
    try {
      setLoading(true);

      if (organizationId) {
        const { data, error } = await supabase
          .from("organization_branding")
          .select("*")
          .eq("organization_id", organizationId)
          .maybeSingle();

        if (error) throw error;
        const organizationBranding = data as OrganizationBranding | null;
        setBranding(
          mergeBranding({
            ...(organizationBranding ?? {}),
            brand_name:
              organizationBranding?.brand_name ??
              organizationName ??
              DEFAULT_BRANDING.brand_name,
          }),
        );
        return;
      }

      const hostBranding = await fetchBrandingByHost();
      setBranding(mergeBranding(hostBranding));
    } catch (error) {
      console.warn("ORGANIZATION BRANDING LOAD ERROR:", error);
      setBranding(
        mergeBranding({
          brand_name: organizationName ?? DEFAULT_BRANDING.brand_name,
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId, organizationName]);

  useEffect(() => {
    void refreshBranding();
  }, [refreshBranding]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--org-primary", branding.primary_color ?? "#000000");
    root.style.setProperty("--org-secondary", branding.secondary_color ?? "#ffffff");
    root.style.setProperty("--org-accent", branding.accent_color ?? "#f97316");
    root.style.setProperty("--org-background", branding.primary_color ?? "#000000");
    root.style.setProperty("--org-text", branding.secondary_color ?? "#ffffff");
  }, [branding]);

  const value = useMemo(
    () => ({
      branding,
      loading,
      refreshBranding,
    }),
    [branding, loading, refreshBranding],
  );

  return (
    <OrganizationBrandingContext.Provider value={value}>
      {children}
    </OrganizationBrandingContext.Provider>
  );
}

export function useOrganizationBranding() {
  const context = useContext(OrganizationBrandingContext);
  if (!context) {
    throw new Error(
      "useOrganizationBranding must be used within an OrganizationBrandingProvider",
    );
  }
  return context;
}
