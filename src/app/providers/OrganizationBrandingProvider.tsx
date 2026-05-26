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
  app_name: "ITsNomatata",
  logo_url:
    "https://res.cloudinary.com/dnqjax5ut/image/upload/v1776754504/Itsnomatata-Logo-White-with-tagline-2-768x643_u3n4j0.png",
  favicon_url: null,
  login_background_url: null,
  primary_color: "#000000",
  secondary_color: "#ffffff",
  accent_color: "#f97316",
  background_color: "#020202",
  card_color: "#070707",
  sidebar_color: "#020202",
  topbar_color: "#020202",
  text_color: "#ffffff",
  muted_text_color: "#a3a3a3",
  border_color: "#1f1f1f",
  button_color: "#f97316",
  button_text_color: "#ffffff",
  button_hover_color: "#ea580c",
  link_color: "#fb923c",
  link_hover_color: "#fdba74",
  input_focus_color: "#f97316",
  company_slogan: null,
  company_welcome_text: "Welcome to ITsNomatata.",
  dashboard_greeting_text: "Here is what needs attention today.",
  custom_terminology: {},
  invitation_template: null,
  onboarding_wording: {},
  custom_css: {},
  is_active: true,
  custom_domain: null,
  subdomain: null,
  domain_status: null,
  domain_verification_token: null,
  dns_target: "cname.vercel-dns.com",
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
    app_name:
      branding?.app_name ||
      branding?.brand_name ||
      DEFAULT_BRANDING.app_name,
    logo_url: branding?.logo_url || DEFAULT_BRANDING.logo_url,
    primary_color: branding?.primary_color || DEFAULT_BRANDING.primary_color,
    secondary_color: branding?.secondary_color || DEFAULT_BRANDING.secondary_color,
    accent_color: branding?.accent_color || DEFAULT_BRANDING.accent_color,
    background_color:
      branding?.background_color || DEFAULT_BRANDING.background_color,
    card_color: branding?.card_color || DEFAULT_BRANDING.card_color,
    sidebar_color: branding?.sidebar_color || DEFAULT_BRANDING.sidebar_color,
    topbar_color: branding?.topbar_color || DEFAULT_BRANDING.topbar_color,
    text_color: branding?.text_color || DEFAULT_BRANDING.text_color,
    muted_text_color:
      branding?.muted_text_color || DEFAULT_BRANDING.muted_text_color,
    border_color: branding?.border_color || DEFAULT_BRANDING.border_color,
    button_color: branding?.button_color || DEFAULT_BRANDING.button_color,
    button_text_color:
      branding?.button_text_color || DEFAULT_BRANDING.button_text_color,
    button_hover_color:
      branding?.button_hover_color || DEFAULT_BRANDING.button_hover_color,
    link_color: branding?.link_color || DEFAULT_BRANDING.link_color,
    link_hover_color:
      branding?.link_hover_color || DEFAULT_BRANDING.link_hover_color,
    input_focus_color:
      branding?.input_focus_color || DEFAULT_BRANDING.input_focus_color,
    custom_terminology: branding?.custom_terminology ?? {},
    onboarding_wording: branding?.onboarding_wording ?? {},
    custom_css: branding?.custom_css ?? {},
  };
}

function hostLookup() {
  if (typeof window === "undefined") return null;

  const host = window.location.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host.endsWith(".local") ||
    host.includes("vercel.app") ||
    host === "codex.itsnomatata.com"
  ) {
    return null;
  }

  if (host.endsWith(".itsnomatata.com")) {
    const subdomain = host.replace(".itsnomatata.com", "");
    if (subdomain && !["www", "app", "codex"].includes(subdomain)) {
      return { type: "subdomain" as const, value: subdomain };
    }
  }

  return { type: "custom_domain" as const, value: host };
}

function hexToRgbChannels(value?: string | null, fallback = "0 0 0") {
  if (!value) return fallback;

  const normalized = value.trim().replace("#", "");
  const hex =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fallback;

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  return `${red} ${green} ${blue}`;
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
  const organizationId =
    auth?.currentOrganization?.organization_id ??
    auth?.profile?.organization_id ??
    null;
  const organizationName =
    auth?.currentOrganization?.organization_name ??
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
    const body = document.body;
    root.style.setProperty("--org-primary", branding.primary_color ?? "#000000");
    root.style.setProperty("--org-secondary", branding.secondary_color ?? "#ffffff");
    root.style.setProperty("--org-accent", branding.accent_color ?? "#f97316");
    root.style.setProperty("--org-bg", branding.background_color ?? "#020202");
    root.style.setProperty("--org-background", branding.background_color ?? "#020202");
    root.style.setProperty("--org-card", branding.card_color ?? "#070707");
    root.style.setProperty("--org-sidebar", branding.sidebar_color ?? "#020202");
    root.style.setProperty("--org-topbar", branding.topbar_color ?? "#020202");
    root.style.setProperty("--org-text", branding.text_color ?? "#ffffff");
    root.style.setProperty("--org-muted", branding.muted_text_color ?? "#a3a3a3");
    root.style.setProperty("--org-border", branding.border_color ?? "#1f1f1f");
    root.style.setProperty("--org-button", branding.button_color ?? "#f97316");
    root.style.setProperty("--org-button-text", branding.button_text_color ?? "#ffffff");
    root.style.setProperty("--org-button-hover", branding.button_hover_color ?? "#ea580c");
    root.style.setProperty("--org-link", branding.link_color ?? "#fb923c");
    root.style.setProperty("--org-link-hover", branding.link_hover_color ?? "#fdba74");
    root.style.setProperty("--org-input-focus", branding.input_focus_color ?? "#f97316");
    root.style.setProperty(
      "--org-primary-rgb",
      hexToRgbChannels(branding.primary_color, "0 0 0"),
    );
    root.style.setProperty(
      "--org-secondary-rgb",
      hexToRgbChannels(branding.secondary_color, "255 255 255"),
    );
    root.style.setProperty(
      "--org-accent-rgb",
      hexToRgbChannels(branding.accent_color, "249 115 22"),
    );
    root.style.setProperty(
      "--org-bg-rgb",
      hexToRgbChannels(branding.background_color, "2 2 2"),
    );
    root.style.setProperty(
      "--org-card-rgb",
      hexToRgbChannels(branding.card_color, "7 7 7"),
    );
    root.style.setProperty(
      "--org-text-rgb",
      hexToRgbChannels(branding.text_color, "255 255 255"),
    );
    root.style.setProperty(
      "--org-muted-rgb",
      hexToRgbChannels(branding.muted_text_color, "163 163 163"),
    );
    root.style.setProperty(
      "--org-border-rgb",
      hexToRgbChannels(branding.border_color, "31 31 31"),
    );
    root.style.setProperty(
      "--org-button-rgb",
      hexToRgbChannels(branding.button_color, "249 115 22"),
    );
    body.classList.add("org-theme-active");
    root.style.colorScheme = "dark";
    document.title = branding.app_name || branding.brand_name || "ITsNomatata";

    const themeColor =
      document.querySelector<HTMLMetaElement>("meta[name='theme-color']") ??
      document.createElement("meta");
    themeColor.name = "theme-color";
    themeColor.content = branding.topbar_color || branding.background_color || "#020202";
    if (!themeColor.parentElement) document.head.appendChild(themeColor);

    const faviconUrl = branding.favicon_url;
    const favicon = document.querySelector<HTMLLinkElement>("link[rel='icon']") ??
      document.createElement("link");
    favicon.rel = "icon";
    if (faviconUrl) favicon.href = faviconUrl;
    if (!favicon.parentElement) document.head.appendChild(favicon);
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
