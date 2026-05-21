import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Copy,
  Globe2,
  Image,
  Link2,
  MailPlus,
  Palette,
  RefreshCw,
  ShieldCheck,
  ToggleLeft,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useOrganizationBranding } from "../../../app/providers/OrganizationBrandingProvider";
import { useOrganizationFeatures } from "../../../lib/hooks/useOrganizationFeatures";
import { supabase } from "../../../lib/supabase/client";
import RoleManagementTable from "../../platform-admin/components/RoleManagementTable";
import {
  createOrganizationInvitation,
  createOrganizationRole,
  getOrganizationBranding,
  getOrganizationFeatures,
  getOrganizationInvitations,
  getOrganizationRoles,
  updateOrganizationRole,
  updateOrganizationBranding,
} from "../../platform-admin/services/platformAdminService";
import {
  connectOrganizationDomainToProvider,
  createOrganizationDomain,
  deleteOrganizationDomain,
  getOrganizationDomains,
  refreshOrganizationDomainProvider,
  verifyOrganizationDomainDns,
} from "../services/organizationDomainService";
import type {
  OrganizationBranding,
  OrganizationDomain,
  OrganizationFeature,
  OrganizationInvitation,
  OrganizationRole,
} from "../../platform-admin/types/platformAdmin";

type BrandingValues = Partial<OrganizationBranding>;

const defaultBranding: BrandingValues = {
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
  primary_color: "#000000",
  secondary_color: "#ffffff",
  accent_color: "#f97316",
  custom_terminology: {},
  onboarding_wording: {},
};

type SettingsTab = "general" | "branding" | "domains" | "roles" | "features";

const colorFields: Array<{
  key: keyof OrganizationBranding;
  label: string;
  fallback: string;
}> = [
  { key: "primary_color", label: "Primary", fallback: "#000000" },
  { key: "secondary_color", label: "Secondary", fallback: "#ffffff" },
  { key: "accent_color", label: "Accent", fallback: "#f97316" },
  { key: "background_color", label: "Background", fallback: "#020202" },
  { key: "card_color", label: "Card", fallback: "#070707" },
  { key: "sidebar_color", label: "Sidebar", fallback: "#020202" },
  { key: "topbar_color", label: "Topbar", fallback: "#020202" },
  { key: "text_color", label: "Text", fallback: "#ffffff" },
  { key: "muted_text_color", label: "Muted text", fallback: "#a3a3a3" },
  { key: "border_color", label: "Border", fallback: "#1f1f1f" },
  { key: "button_color", label: "Button", fallback: "#f97316" },
  { key: "button_text_color", label: "Button text", fallback: "#ffffff" },
  { key: "button_hover_color", label: "Button hover", fallback: "#ea580c" },
  { key: "link_color", label: "Link", fallback: "#fb923c" },
  { key: "link_hover_color", label: "Link hover", fallback: "#fdba74" },
  { key: "input_focus_color", label: "Input focus", fallback: "#f97316" },
];

const brandPresets: Array<{
  label: string;
  description: string;
  values: Pick<
    BrandingValues,
    | "primary_color"
    | "secondary_color"
    | "accent_color"
    | "background_color"
    | "card_color"
    | "sidebar_color"
    | "topbar_color"
    | "text_color"
    | "muted_text_color"
    | "border_color"
    | "button_color"
    | "button_text_color"
    | "button_hover_color"
    | "link_color"
    | "link_hover_color"
    | "input_focus_color"
  >;
}> = [
  {
    label: "Tech",
    description: "Crisp dark workspace for software, IT and support teams.",
    values: {
      primary_color: "#020617",
      secondary_color: "#f8fafc",
      accent_color: "#38bdf8",
      background_color: "#020617",
      card_color: "#0f172a",
      sidebar_color: "#020617",
      topbar_color: "#0f172a",
      text_color: "#f8fafc",
      muted_text_color: "#94a3b8",
      border_color: "#1e293b",
      button_color: "#38bdf8",
      button_text_color: "#020617",
      button_hover_color: "#0ea5e9",
      link_color: "#7dd3fc",
      link_hover_color: "#bae6fd",
      input_focus_color: "#38bdf8",
    },
  },
  {
    label: "Tourism",
    description: "Warm operational palette for tours, lodges and hospitality.",
    values: {
      primary_color: "#052e2b",
      secondary_color: "#fff7ed",
      accent_color: "#14b8a6",
      background_color: "#071f1d",
      card_color: "#0f2f2c",
      sidebar_color: "#052e2b",
      topbar_color: "#0f2f2c",
      text_color: "#f8fafc",
      muted_text_color: "#a7f3d0",
      border_color: "#134e4a",
      button_color: "#14b8a6",
      button_text_color: "#042f2e",
      button_hover_color: "#0d9488",
      link_color: "#5eead4",
      link_hover_color: "#99f6e4",
      input_focus_color: "#14b8a6",
    },
  },
  {
    label: "Creative",
    description: "Studio palette for media, campaigns and review workflows.",
    values: {
      primary_color: "#18111f",
      secondary_color: "#faf5ff",
      accent_color: "#ec4899",
      background_color: "#111016",
      card_color: "#1f1726",
      sidebar_color: "#18111f",
      topbar_color: "#1f1726",
      text_color: "#faf5ff",
      muted_text_color: "#c4b5fd",
      border_color: "#3b2748",
      button_color: "#ec4899",
      button_text_color: "#ffffff",
      button_hover_color: "#db2777",
      link_color: "#f9a8d4",
      link_hover_color: "#fbcfe8",
      input_focus_color: "#ec4899",
    },
  },
];

function canManageOrganization(role?: string | null) {
  return ["admin", "org_admin", "super_admin", "superadmin", "it-superadmin"].includes(
    String(role ?? ""),
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;

  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const message = record.message ?? record.details ?? record.hint ?? record.code;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}

function DnsRecord({
  label,
  name,
  fqdn,
  value,
}: {
  label: string;
  name: string;
  fqdn?: string | null;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
        {label}
      </p>
      <div className="mt-3 space-y-2 text-xs">
        <div>
          <p className="text-white/35">Name / Host</p>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(name)}
            className="mt-1 w-full rounded-lg bg-black px-3 py-2 text-left text-white/80 hover:bg-white/5"
          >
            {name}
          </button>
          {fqdn && fqdn !== name ? (
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(fqdn)}
              className="mt-2 w-full break-all rounded-lg bg-black/60 px-3 py-2 text-left text-white/55 hover:bg-white/5"
            >
              FQDN: {fqdn}
            </button>
          ) : null}
        </div>
        <div>
          <p className="text-white/35">Target / Value</p>
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(value)}
            className="mt-1 w-full break-all rounded-lg bg-black px-3 py-2 text-left text-white/80 hover:bg-white/5"
          >
            {value}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OrganizationSettingsPage() {
  const auth = useAuth();
  const { refreshBranding } = useOrganizationBranding();
  const { isEnabled } = useOrganizationFeatures();
  const profile = auth?.profile ?? null;
  const organizationId = profile?.organization_id ?? null;
  const organization = profile?.organization as
    | { name?: string; slug?: string }
    | null
    | undefined;

  const [branding, setBranding] = useState<BrandingValues>(defaultBranding);
  const [features, setFeatures] = useState<OrganizationFeature[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [domains, setDomains] = useState<OrganizationDomain[]>([]);
  const [activeTab, setActiveTab] = useState<SettingsTab>("branding");
  const [newDomain, setNewDomain] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [domainBusyId, setDomainBusyId] = useState<string | null>(null);
  const [addingDomain, setAddingDomain] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState<"logo" | "favicon" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [brandingData, featureData, roleData, inviteData, domainData] = await Promise.all([
        getOrganizationBranding(organizationId),
        getOrganizationFeatures(organizationId),
        getOrganizationRoles(organizationId),
        getOrganizationInvitations(organizationId),
        getOrganizationDomains(organizationId).catch((domainError) => {
          console.warn("ORGANIZATION DOMAINS LOAD ERROR:", domainError);
          return [] as OrganizationDomain[];
        }),
      ]);

      setBranding({ ...defaultBranding, ...(brandingData ?? {}) });
      setFeatures(featureData);
      setRoles(roleData);
      setInvitations(inviteData);
      setDomains(domainData);
    } catch (err) {
      console.error("LOAD ORGANIZATION SETTINGS ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to load organization settings.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const activeRoles = useMemo(
    () => roles.filter((role) => role.is_active),
    [roles],
  );

  useEffect(() => {
    if (activeRoles.length === 0) return;

    const currentRoleExists = activeRoles.some(
      (role) => role.role_key === inviteRole,
    );
    const adminRole = activeRoles.find((role) => role.role_key === "admin");

    if (invitations.length === 0 && adminRole && inviteRole !== adminRole.role_key) {
      setInviteRole(adminRole.role_key);
      return;
    }

    if (!currentRoleExists) {
      const defaultRole =
        activeRoles.find((role) => role.is_default_signup_role) ??
        activeRoles[0];
      setInviteRole(defaultRole.role_key);
    }
  }, [activeRoles, invitations.length, inviteRole]);

  async function handleSaveBranding() {
    if (!organizationId) return;

    try {
      setSavingBranding(true);
      setError("");
      setSuccess("");

      const saved = await updateOrganizationBranding({
        organizationId,
        brandName: branding.brand_name ?? organization?.name ?? null,
        appName: branding.app_name ?? branding.brand_name ?? organization?.name ?? null,
        logoUrl: branding.logo_url ?? null,
        faviconUrl: branding.favicon_url ?? null,
        primaryColor: branding.primary_color ?? "#000000",
        secondaryColor: branding.secondary_color ?? "#ffffff",
        accentColor: branding.accent_color ?? "#f97316",
        backgroundColor: branding.background_color ?? "#020202",
        cardColor: branding.card_color ?? "#070707",
        sidebarColor: branding.sidebar_color ?? "#020202",
        topbarColor: branding.topbar_color ?? "#020202",
        textColor: branding.text_color ?? "#ffffff",
        mutedTextColor: branding.muted_text_color ?? "#a3a3a3",
        borderColor: branding.border_color ?? "#1f1f1f",
        buttonColor: branding.button_color ?? "#f97316",
        buttonTextColor: branding.button_text_color ?? "#ffffff",
        buttonHoverColor: branding.button_hover_color ?? "#ea580c",
        linkColor: branding.link_color ?? "#fb923c",
        linkHoverColor: branding.link_hover_color ?? "#fdba74",
        inputFocusColor: branding.input_focus_color ?? "#f97316",
        companySlogan: branding.company_slogan ?? null,
        companyWelcomeText: branding.company_welcome_text ?? null,
        dashboardGreetingText: branding.dashboard_greeting_text ?? null,
        customTerminology: branding.custom_terminology ?? {},
        invitationTemplate: branding.invitation_template ?? null,
        onboardingWording: branding.onboarding_wording ?? {},
        customDomain: branding.custom_domain ?? null,
        subdomain: branding.subdomain ?? null,
        dnsTarget: branding.dns_target ?? "cname.vercel-dns.com",
        domainError: branding.domain_error ?? null,
      });

      setBranding({ ...defaultBranding, ...saved });
      await refreshBranding();
      setSuccess("Organization branding updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save branding."));
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleUploadBrandingAsset(
    kind: "logo" | "favicon",
    file: File | null,
  ) {
    if (!organizationId || !file) return;

    const allowed =
      kind === "logo"
        ? ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
        : ["image/png", "image/x-icon", "image/vnd.microsoft.icon", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setError(kind === "logo" ? "Logo must be png, jpg, webp, or svg." : "Favicon must be ico, png, or svg.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Branding assets must be smaller than 2MB.");
      return;
    }

    try {
      setUploadingAsset(kind);
      setError("");
      setSuccess("");
      const extension = file.name.split(".").pop() || (kind === "favicon" ? "png" : "webp");
      const path = `${organizationId}/${kind}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("organization-branding")
        .upload(path, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: "3600",
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("organization-branding")
        .getPublicUrl(path);
      setBranding((current) => ({
        ...current,
        [kind === "logo" ? "logo_url" : "favicon_url"]: data.publicUrl,
      }));
      setSuccess(`${kind === "logo" ? "Logo" : "Favicon"} uploaded. Save branding to apply it.`);
    } catch (err) {
      setError(getErrorMessage(err, `Failed to upload ${kind}.`));
    } finally {
      setUploadingAsset(null);
    }
  }

  async function handleAddDomain() {
    if (!organizationId || !newDomain.trim()) return;

    try {
      setAddingDomain(true);
      setError("");
      setSuccess("");
      const created = await createOrganizationDomain({
        organizationId,
        domain: newDomain,
      });
      setDomains((current) => [created, ...current]);
      setNewDomain("");
      setSuccess("Domain added. Add the DNS records below, then check verification.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to add domain."));
    } finally {
      setAddingDomain(false);
    }
  }

  async function handleVerifyDomain(domain: OrganizationDomain) {
    try {
      setDomainBusyId(domain.id);
      setError("");
      setSuccess("");
      const result = await verifyOrganizationDomainDns(domain.id);
      if (!result.ok) throw new Error(result.error || "DNS verification failed.");
      setDomains(await getOrganizationDomains(organizationId!));
      setSuccess("DNS verified. You can now connect the provider.");
    } catch (err) {
      setDomains(await getOrganizationDomains(organizationId!));
      setError(getErrorMessage(err, "Failed to verify DNS."));
    } finally {
      setDomainBusyId(null);
    }
  }

  async function handleConnectDomain(domain: OrganizationDomain) {
    try {
      setDomainBusyId(domain.id);
      setError("");
      setSuccess("");
      const result = await connectOrganizationDomainToProvider(domain.id);
      setDomains(await getOrganizationDomains(organizationId!));
      if (!result.ok) throw new Error(result.error || "Provider connection failed.");
      setSuccess("Domain connected to provider.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to connect provider."));
    } finally {
      setDomainBusyId(null);
    }
  }

  async function handleRefreshProvider(domain: OrganizationDomain) {
    try {
      setDomainBusyId(domain.id);
      setError("");
      setSuccess("");
      const result = await refreshOrganizationDomainProvider(domain.id);
      setDomains(await getOrganizationDomains(organizationId!));
      if (!result.ok) throw new Error(result.error || "Provider refresh failed.");
      setSuccess("Provider status refreshed.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to refresh provider."));
    } finally {
      setDomainBusyId(null);
    }
  }

  async function handleDeleteDomain(domain: OrganizationDomain) {
    if (!window.confirm(`Remove ${domain.domain}?`)) return;
    try {
      setDomainBusyId(domain.id);
      setError("");
      setSuccess("");
      await deleteOrganizationDomain(domain.id);
      setDomains((current) => current.filter((item) => item.id !== domain.id));
      setSuccess("Domain removed.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to remove domain."));
    } finally {
      setDomainBusyId(null);
    }
  }

  async function handleInviteUser() {
    if (!organizationId || !inviteEmail.trim()) return;

    try {
      setInviting(true);
      setError("");
      setSuccess("");

      await createOrganizationInvitation({
        organizationId,
        email: inviteEmail.trim(),
        roleKey: inviteRole,
      });

      setInviteEmail("");
      setInviteRole("user");
      setInvitations(await getOrganizationInvitations(organizationId));
      setSuccess("Invitation created.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to invite user.");
    } finally {
      setInviting(false);
    }
  }

  async function handleToggleRole(role: OrganizationRole) {
    try {
      setSavingRole(true);
      setError("");
      setSuccess("");

      const updated = await updateOrganizationRole({
        roleId: role.id,
        isActive: !role.is_active,
      });

      setRoles((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setSuccess("Organization role updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setSavingRole(false);
    }
  }

  async function handleCreateRole(payload: {
    roleKey: string;
    roleLabel: string;
    description?: string | null;
    department?: string | null;
    isAdminRole?: boolean;
    isManagerRole?: boolean;
    isDefaultSignupRole?: boolean;
    requiresApproval?: boolean;
    permissions?: Record<string, unknown>;
    onboardingConfig?: Record<string, unknown>;
    departmentAccess?: Record<string, unknown>;
  }) {
    if (!organizationId) return;

    try {
      setSavingRole(true);
      setError("");
      setSuccess("");
      await createOrganizationRole({
        organizationId,
        ...payload,
      });
      setRoles(await getOrganizationRoles(organizationId));
      setSuccess("Organization role created.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to create role."));
      throw err;
    } finally {
      setSavingRole(false);
    }
  }

  async function handleUpdateRole(
    role: OrganizationRole,
    payload: {
      roleLabel?: string;
      description?: string | null;
      department?: string | null;
      isAdminRole?: boolean;
      isManagerRole?: boolean;
      isDefaultSignupRole?: boolean;
      requiresApproval?: boolean;
      isActive?: boolean;
      permissions?: Record<string, unknown>;
      onboardingConfig?: Record<string, unknown>;
      departmentAccess?: Record<string, unknown>;
    },
  ) {
    if (!organizationId) return;

    try {
      setSavingRole(true);
      setError("");
      setSuccess("");
      await updateOrganizationRole({
        roleId: role.id,
        ...payload,
      });
      setRoles(await getOrganizationRoles(organizationId));
      setSuccess("Organization role updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to update role."));
      throw err;
    } finally {
      setSavingRole(false);
    }
  }

  if (!profile || !organizationId) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Missing organization context.
      </div>
    );
  }

  if (!canManageOrganization(profile.primary_role)) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar role={profile.primary_role} />
          <main className="flex flex-1 items-center justify-center p-6">
            <div className="max-w-md rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-center text-red-200">
              <ShieldCheck className="mx-auto mb-3" size={32} />
              Organization settings are only available to organization admins.
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={profile.primary_role} />
        <main className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Organization Admin
            </p>
            <h1 className="mt-2 text-3xl font-bold">Organization Settings</h1>
            <p className="mt-2 text-sm text-white/50">
              Manage branding, users, roles, domains, and enabled features for {organization?.name ?? "your organization"}.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {success}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
            {[
              ["general", "General"],
              ["branding", "Branding"],
              ["domains", "Domains"],
              ["roles", "Roles"],
              ["features", "Features"],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveTab(key as SettingsTab)}
                className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                  activeTab === key
                    ? "bg-orange-500 text-black"
                    : "text-white/55 hover:bg-white/8 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading organization settings...
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              {activeTab === "general" ? (
                <section className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
                  <h2 className="flex items-center gap-2 text-lg font-semibold">
                    <ShieldCheck size={18} className="text-orange-500" />
                    General
                  </h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/35">Organization</p>
                      <p className="mt-2 text-xl font-semibold">{organization?.name ?? "Organization"}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-black p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/35">Slug</p>
                      <p className="mt-2 text-xl font-semibold">{organization?.slug ?? "Not set"}</p>
                    </div>
                  </div>
                </section>
              ) : null}

              {activeTab === "branding" ? (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Palette size={18} className="text-orange-500" />
                  Branding
                </h2>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {brandPresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        setBranding((current) => ({
                          ...current,
                          ...preset.values,
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-black p-4 text-left transition hover:border-orange-500/40 hover:bg-white/5"
                    >
                      <span className="font-semibold text-white">
                        {preset.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-white/45">
                        {preset.description}
                      </span>
                      <span className="mt-3 flex gap-1">
                        <span
                          className="h-4 w-8 rounded-full"
                          style={{ backgroundColor: preset.values.primary_color ?? "#000" }}
                        />
                        <span
                          className="h-4 w-8 rounded-full"
                          style={{ backgroundColor: preset.values.accent_color ?? "#f97316" }}
                        />
                        <span
                          className="h-4 w-8 rounded-full"
                          style={{ backgroundColor: preset.values.card_color ?? "#070707" }}
                        />
                      </span>
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input
                    value={branding.brand_name ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, brand_name: event.target.value }))}
                    placeholder="Company name"
                    className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <input
                    value={branding.app_name ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, app_name: event.target.value }))}
                    placeholder="App name / browser title"
                    className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <input
                    value={branding.logo_url ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, logo_url: event.target.value }))}
                    placeholder="Logo URL"
                    className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <input
                    value={branding.favicon_url ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, favicon_url: event.target.value }))}
                    placeholder="Favicon URL"
                    className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white/70 transition hover:border-orange-500/40">
                    <Upload size={16} />
                    {uploadingAsset === "logo" ? "Uploading logo..." : "Upload logo"}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(event) => void handleUploadBrandingAsset("logo", event.target.files?.[0] ?? null)}
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white/70 transition hover:border-orange-500/40">
                    <Image size={16} />
                    {uploadingAsset === "favicon" ? "Uploading favicon..." : "Upload favicon"}
                    <input
                      type="file"
                      accept="image/png,image/x-icon,image/vnd.microsoft.icon,image/svg+xml"
                      className="hidden"
                      onChange={(event) => void handleUploadBrandingAsset("favicon", event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {colorFields.map((field) => (
                    <label key={field.key} className="space-y-1">
                      <span className="text-xs text-white/45">{field.label}</span>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={(branding[field.key] as string | null) ?? field.fallback}
                          onChange={(event) => setBranding((current) => ({ ...current, [field.key]: event.target.value }))}
                          className="h-11 w-14 rounded-lg border border-white/10 bg-black p-1"
                        />
                        <input
                          value={(branding[field.key] as string | null) ?? field.fallback}
                          onChange={(event) => setBranding((current) => ({ ...current, [field.key]: event.target.value }))}
                          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                        />
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard.writeText(String(branding[field.key] ?? field.fallback))}
                          className="rounded-xl border border-white/10 px-3 text-white/45 hover:bg-white/5 hover:text-white"
                          title="Copy color"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </label>
                  ))}
                  <textarea
                    value={branding.company_welcome_text ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, company_welcome_text: event.target.value }))}
                    placeholder="Welcome text"
                    rows={3}
                    className="resize-none rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500 md:col-span-2"
                  />
                  <textarea
                    value={branding.dashboard_greeting_text ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, dashboard_greeting_text: event.target.value }))}
                    placeholder="Dashboard greeting text"
                    rows={3}
                    className="resize-none rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500 md:col-span-2"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleSaveBranding()}
                  disabled={savingBranding}
                  className="org-branded-button mt-4 rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {savingBranding ? "Saving..." : "Save Branding"}
                </button>
              </section>
              ) : null}

              {activeTab === "branding" ? (
              <section
                className="rounded-2xl border p-5"
                style={{
                  backgroundColor: branding.card_color ?? "#070707",
                  borderColor: branding.border_color ?? "#1f1f1f",
                  color: branding.text_color ?? "#ffffff",
                }}
              >
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Palette size={18} />
                  Live preview
                </h2>
                <div
                  className="mt-4 rounded-2xl border p-4"
                  style={{
                    backgroundColor: branding.background_color ?? "#020202",
                    borderColor: branding.border_color ?? "#1f1f1f",
                  }}
                >
                  <div
                    className="rounded-xl p-3"
                    style={{ backgroundColor: branding.sidebar_color ?? "#020202" }}
                  >
                    {branding.logo_url ? (
                      <img src={branding.logo_url} alt="" className="h-10 w-auto object-contain" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                        <Image size={18} />
                      </div>
                    )}
                    <p className="mt-3 font-semibold">{branding.app_name || branding.brand_name || organization?.name}</p>
                    <p style={{ color: branding.muted_text_color ?? "#a3a3a3" }} className="text-sm">
                      Sidebar, card, text and button colors update after save.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="mt-4 rounded-xl px-4 py-3 text-sm font-semibold"
                    style={{
                      backgroundColor: branding.button_color ?? "#f97316",
                      color: branding.button_text_color ?? "#ffffff",
                    }}
                  >
                    Button sample
                  </button>
                  <input
                    placeholder="Input sample"
                    className="mt-4 w-full rounded-xl border bg-transparent px-4 py-3 text-sm"
                    style={{ borderColor: branding.input_focus_color ?? "#f97316" }}
                  />
                </div>
              </section>
              ) : null}

              {activeTab === "domains" ? (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5 xl:col-span-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Globe2 size={18} className="text-orange-500" />
                  Domains
                </h2>
                <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                  <input
                    value={newDomain}
                    onChange={(event) => setNewDomain(event.target.value)}
                    placeholder="portal.tmctechsolutions.com"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <button
                    type="button"
                    disabled={addingDomain || !newDomain.trim()}
                    onClick={() => void handleAddDomain()}
                    className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                  >
                    {addingDomain ? "Adding..." : "Add domain"}
                  </button>
                </div>
                <p className="mt-3 text-xs text-white/45">
                  Add both records at your DNS host. Use the short Host/Name first; if your provider rejects it, use the FQDN shown under the record.
                </p>

                <div className="mt-5 space-y-4">
                  {domains.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-white/45">
                      No custom domains connected yet.
                    </div>
                  ) : domains.map((domain) => (
                    <div key={domain.id} className="rounded-2xl border border-white/10 bg-black p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="flex items-center gap-2 font-semibold">
                            <Link2 size={16} className="text-orange-400" />
                            {domain.domain}
                          </p>
                          <p className="mt-1 text-xs text-white/45">
                            Status: {domain.status} / SSL: {domain.ssl_status}
                            {domain.last_error ? ` / ${domain.last_error}` : ""}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={domainBusyId === domain.id}
                            onClick={() => void handleVerifyDomain(domain)}
                            className="rounded-xl border border-orange-500/30 px-3 py-2 text-xs font-semibold text-orange-200 hover:bg-orange-500/10 disabled:opacity-50"
                          >
                            <RefreshCw size={13} className="mr-1 inline" />
                            Check verification
                          </button>
                          <button
                            type="button"
                            disabled={domainBusyId === domain.id || !["verified", "connected"].includes(domain.status)}
                            onClick={() => void handleConnectDomain(domain)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 disabled:opacity-40"
                          >
                            Connect provider
                          </button>
                          <button
                            type="button"
                            disabled={domainBusyId === domain.id || domain.status !== "connected"}
                            onClick={() => void handleRefreshProvider(domain)}
                            className="rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-white/70 hover:bg-white/5 disabled:opacity-40"
                          >
                            Refresh SSL
                          </button>
                          <button
                            type="button"
                            disabled={domainBusyId === domain.id}
                            onClick={() => void handleDeleteDomain(domain)}
                            className="rounded-xl border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-200 hover:bg-red-500/10 disabled:opacity-40"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <DnsRecord
                          label="CNAME"
                          name={domain.cname_host}
                          fqdn={domain.cname_fqdn ?? domain.domain}
                          value={domain.cname_target}
                        />
                        <DnsRecord
                          label="TXT"
                          name={domain.txt_host}
                          fqdn={domain.txt_fqdn ?? `_itsnomatata-verify.${domain.domain}`}
                          value={domain.txt_value}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              ) : null}

              {activeTab === "roles" && isEnabled("admin_users") ? (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <MailPlus size={18} className="text-orange-500" />
                  Invite Users
                </h2>
                <div className="mt-4 space-y-3">
                  <input
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder="user@company.com"
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <select
                    value={inviteRole}
                    onChange={(event) => setInviteRole(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  >
                    {activeRoles.map((role) => (
                      <option key={role.id} value={role.role_key}>
                        {role.role_label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={inviting || !inviteEmail.trim()}
                    onClick={() => void handleInviteUser()}
                    className="w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                  >
                    {inviting ? "Creating invite..." : "Create Invite"}
                  </button>
                </div>
                <p className="mt-4 text-xs text-white/45">
                  {invitations.length} organization invitation{invitations.length === 1 ? "" : "s"} created.
                </p>
                <div className="mt-3 space-y-2">
                  {invitations.slice(0, 4).map((invitation) => (
                    <div key={invitation.id} className="rounded-xl border border-white/10 bg-black p-3 text-xs text-white/55">
                      <div className="font-medium text-white/80">
                        {invitation.email} / {invitation.status}
                      </div>
                      {invitation.status === "pending" && invitation.token_hash ? (
                        <div className="mt-1 break-all text-orange-300">
                          {`${window.location.origin}/invite/${invitation.token_hash}`}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
              ) : null}

              {activeTab === "features" ? (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <ToggleLeft size={18} className="text-orange-500" />
                  Enabled Features
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {features.map((feature) => (
                    <div key={feature.id} className="rounded-xl border border-white/10 bg-black p-4">
                      <p className="font-medium text-white">
                        {feature.module_label || feature.feature_key}
                      </p>
                      <p className="mt-1 text-xs text-white/45">
                        {feature.module_category || "Feature"}
                      </p>
                      <span
                        className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          feature.enabled
                            ? "bg-emerald-500/10 text-emerald-300"
                            : "bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {feature.enabled ? "Enabled" : "Request feature"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
              ) : null}

              {activeTab === "roles" ? (
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Users size={18} className="text-orange-500" />
                  Roles and Departments
                </h2>
                <div className="mt-4">
                  <RoleManagementTable
                    roles={roles}
                    canCreate
                    canEdit
                    saving={savingRole}
                    onCreate={(payload) => handleCreateRole(payload)}
                    onUpdate={(role, payload) => handleUpdateRole(role, payload)}
                    onToggleActive={(role) => void handleToggleRole(role)}
                  />
                </div>
              </section>
              ) : null}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
