import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Lock,
  MailPlus,
  Plus,
  RefreshCw,
  Shield,
  Trash2,
  XCircle,
} from "lucide-react";

import Sidebar from "../../../components/dashboard/components/Sidebar";
import AuditLogTable from "../components/AuditLogTable";
import BrandingForm from "../components/BrandingForm";
import FeatureToggleCard from "../components/FeatureToggleCard";
import OrganizationTable from "../components/OrganizationTable";
import RoleManagementTable from "../components/RoleManagementTable";
import SubscriptionPanel from "../components/SubscriptionPanel";
import {
  checkIsPlatformAdmin,
  createOrganization,
  createOrganizationRole,
  deleteOrganization,
  createOrganizationInvitation,
  getOrganizationAnalytics,
  getOrganizationBranding,
  getOrganizationFeatures,
  getOrganizationInvitations,
  getOrganizationRoles,
  getOrganizationSubscription,
  getOrganizations,
  getPlatformAuditLogs,
  reactivateOrganization,
  suspendOrganization,
  updateOrganizationBranding,
  updateOrganizationFeature,
  updateOrganizationRole,
  updateOrganizationSubscription,
  DEFAULT_FEATURES,
} from "../services/platformAdminService";
import type {
  OrganizationAnalytics,
  OrganizationBranding,
  OrganizationFeature,
  OrganizationInvitation,
  OrganizationRole,
  OrganizationRow,
  OrganizationSubscription,
  PlatformAuditLog,
} from "../types/platformAdmin";

type BrandingValues = Partial<OrganizationBranding>;

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
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

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#181818] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold text-white">{value}</p>
      {hint ? <p className="text-xs text-white/45">{hint}</p> : null}
    </div>
  );
}

const defaultBranding: BrandingValues = {
  primary_color: "#000000",
  secondary_color: "#ffffff",
  accent_color: "#f97316",
  custom_terminology: {},
  onboarding_wording: {},
};

const createFeatureOptions = DEFAULT_FEATURES.map((feature) => ({
  key: feature.key,
  label: feature.label,
}));

export default function PlatformAdminPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationRow | null>(null);
  const [subscription, setSubscription] =
    useState<OrganizationSubscription | null>(null);
  const [features, setFeatures] = useState<OrganizationFeature[]>([]);
  const [roles, setRoles] = useState<OrganizationRole[]>([]);
  const [branding, setBranding] = useState<BrandingValues>(defaultBranding);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [auditLogs, setAuditLogs] = useState<PlatformAuditLog[]>([]);
  const [analytics, setAnalytics] = useState<OrganizationAnalytics | null>(null);
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgSubdomain, setNewOrgSubdomain] = useState("");
  const [newOrgCustomDomain, setNewOrgCustomDomain] = useState("");
  const [newOrgAdminName, setNewOrgAdminName] = useState("");
  const [newOrgAdminEmail, setNewOrgAdminEmail] = useState("");
  const [newOrgBrandName, setNewOrgBrandName] = useState("");
  const [newOrgLogoUrl, setNewOrgLogoUrl] = useState("");
  const [newOrgPrimaryColor, setNewOrgPrimaryColor] = useState("#000000");
  const [newOrgSecondaryColor, setNewOrgSecondaryColor] = useState("#ffffff");
  const [newOrgAccentColor, setNewOrgAccentColor] = useState("#f97316");
  const [newOrgWelcomeText, setNewOrgWelcomeText] = useState("");
  const [newOrgGreetingText, setNewOrgGreetingText] = useState("");
  const [newOrgFeatures, setNewOrgFeatures] = useState<string[]>(
    createFeatureOptions.map((feature) => feature.key),
  );
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [brandingSaving, setBrandingSaving] = useState(false);
  const [subscriptionSaving, setSubscriptionSaving] = useState(false);
  const [featureSavingId, setFeatureSavingId] = useState<string | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");

  const isSystemOrg = Boolean(
    selectedOrg?.is_system_organization || selectedOrg?.slug === "its-nomatata",
  );

  const onboardingSteps = useMemo(
    () => [
      ["Branding", Boolean(branding.brand_name)],
      ["Invite admin", invitations.length > 0],
      ["Enable modules", features.some((item) => item.enabled)],
      ["Create departments", roles.some((role) => role.department)],
      ["Configure roles", roles.length >= 3],
      ["Import data", false],
      ["Go live", selectedOrg?.access_status === "active"],
    ],
    [branding.brand_name, features, invitations.length, roles, selectedOrg],
  );

  async function loadOrganizationDetails(organizationId: string) {
    try {
      setDetailsLoading(true);
      setError("");

      const [
        sub,
        orgFeatures,
        orgRoles,
        orgBranding,
        orgInvitations,
        logs,
        orgAnalytics,
      ] = await Promise.all([
        getOrganizationSubscription(organizationId),
        getOrganizationFeatures(organizationId),
        getOrganizationRoles(organizationId),
        getOrganizationBranding(organizationId),
        getOrganizationInvitations(organizationId),
        getPlatformAuditLogs({ organizationId, limit: 20 }),
        getOrganizationAnalytics(organizationId),
      ]);

      setSubscription(sub);
      setFeatures(orgFeatures);
      setRoles(orgRoles);
      setBranding({ ...defaultBranding, ...(orgBranding ?? {}) });
      setInvitations(orgInvitations);
      setAuditLogs(logs);
      setAnalytics(orgAnalytics);
    } catch (err) {
      console.error("LOAD ORG DETAILS ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load organization details.",
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  async function loadOrganizations() {
    try {
      setLoading(true);
      setError("");

      const isAdmin = await checkIsPlatformAdmin();
      setAllowed(isAdmin);

      if (!isAdmin) return;

      const data = await getOrganizations();
      setOrganizations(data);

      const nextSelected =
        data.find((organization) => organization.id === selectedOrg?.id) ??
        data[0] ??
        null;

      setSelectedOrg(nextSelected);
      if (nextSelected) await loadOrganizationDetails(nextSelected.id);
    } catch (err) {
      console.error("LOAD PLATFORM ADMIN ERROR:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load platform admin dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNameChange(value: string) {
    setNewOrgName(value);
    if (!newOrgSlug.trim()) setNewOrgSlug(slugify(value));
  }

  async function handleCreateOrganization() {
    const name = newOrgName.trim();
    const slug = slugify(newOrgSlug || newOrgName);
    if (!name || !slug) return;

    try {
      setCreatingOrg(true);
      setError("");

      const created = await createOrganization({
        name,
        slug,
        timezone: "Africa/Harare",
        subdomain: newOrgSubdomain || null,
        customDomain: newOrgCustomDomain || null,
        adminEmail: newOrgAdminEmail || null,
        adminFullName: newOrgAdminName || null,
        adminRole: "admin",
        branding: {
          brandName: newOrgBrandName || name,
          logoUrl: newOrgLogoUrl || null,
          primaryColor: newOrgPrimaryColor,
          secondaryColor: newOrgSecondaryColor,
          accentColor: newOrgAccentColor,
          companyWelcomeText: newOrgWelcomeText || `Welcome to ${newOrgBrandName || name}.`,
          dashboardGreetingText:
            newOrgGreetingText || "Here is what needs attention today.",
        },
        enabledFeatureKeys: newOrgFeatures,
      });

      setNewOrgName("");
      setNewOrgSlug("");
      setNewOrgSubdomain("");
      setNewOrgCustomDomain("");
      setNewOrgAdminName("");
      setNewOrgAdminEmail("");
      setNewOrgBrandName("");
      setNewOrgLogoUrl("");
      setNewOrgPrimaryColor("#000000");
      setNewOrgSecondaryColor("#ffffff");
      setNewOrgAccentColor("#f97316");
      setNewOrgWelcomeText("");
      setNewOrgGreetingText("");
      setNewOrgFeatures(createFeatureOptions.map((feature) => feature.key));

      const data = await getOrganizations();
      setOrganizations(data);
      const createdOrg =
        data.find((organization) => organization.id === created.id) ?? created;
      setSelectedOrg(createdOrg);
      await loadOrganizationDetails(createdOrg.id);
    } catch (err) {
      console.error("CREATE ORGANIZATION ERROR:", err);
      setError(getErrorMessage(err, "Failed to create organization."));
    } finally {
      setCreatingOrg(false);
    }
  }

  async function handleSuspend(org: OrganizationRow) {
    if (org.is_system_organization) return;

    const reason =
      window.prompt(`Why are you suspending ${org.name}?`) ??
      "Suspended by platform admin";

    try {
      await suspendOrganization({ organizationId: org.id, reason });
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to suspend organization.");
    }
  }

  async function handleReactivate(org: OrganizationRow) {
    try {
      await reactivateOrganization(org.id);
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reactivate organization.");
    }
  }

  async function handleDeleteOrganization(org: OrganizationRow) {
    if (org.is_system_organization) return;
    const confirmed = window.confirm(
      `Delete ${org.name}? This removes the organization and dependent organization data.`,
    );
    if (!confirmed) return;

    try {
      setError("");
      await deleteOrganization(org.id);
      setSelectedOrg(null);
      await loadOrganizations();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete organization.");
    }
  }

  async function handleSaveBranding() {
    if (!selectedOrg) return;

    try {
      setBrandingSaving(true);
      setError("");

      const saved = await updateOrganizationBranding({
        organizationId: selectedOrg.id,
        brandName: branding.brand_name ?? selectedOrg.name,
        logoUrl: branding.logo_url ?? null,
        faviconUrl: branding.favicon_url ?? null,
        loginBackgroundUrl: branding.login_background_url ?? null,
        primaryColor: branding.primary_color ?? "#000000",
        secondaryColor: branding.secondary_color ?? "#ffffff",
        accentColor: branding.accent_color ?? "#f97316",
        companySlogan: branding.company_slogan ?? null,
        companyWelcomeText: branding.company_welcome_text ?? null,
        dashboardGreetingText: branding.dashboard_greeting_text ?? null,
        customTerminology: branding.custom_terminology ?? {},
        invitationTemplate: branding.invitation_template ?? null,
        onboardingWording: branding.onboarding_wording ?? {},
        customDomain: branding.custom_domain ?? null,
        subdomain: branding.subdomain ?? null,
        dnsTarget: branding.dns_target ?? "cname.itsnomatata.com",
        domainError: branding.domain_error ?? null,
      });

      setBranding(saved);
      setAuditLogs(await getPlatformAuditLogs({ organizationId: selectedOrg.id, limit: 20 }));
    } catch (err) {
      console.error("SAVE BRANDING ERROR:", err);
      setError(getErrorMessage(err, "Failed to save branding."));
    } finally {
      setBrandingSaving(false);
    }
  }

  async function handleSubscriptionChange(updates: {
    status?: string;
    planName?: string;
    billingInterval?: string;
    amountUsd?: number;
    paymentMethod?: string;
    notes?: string | null;
  }) {
    if (!selectedOrg) return;

    try {
      setSubscriptionSaving(true);
      setError("");
      const next = await updateOrganizationSubscription({
        organizationId: selectedOrg.id,
        status: updates.status ?? subscription?.status ?? "active",
        planName: updates.planName ?? subscription?.plan_name ?? "enterprise",
        billingInterval:
          updates.billingInterval ?? subscription?.billing_interval ?? "manual",
        amountUsd: updates.amountUsd ?? subscription?.amount_usd ?? 0,
        paymentMethod:
          updates.paymentMethod ?? subscription?.payment_method ?? "manual",
        notes: updates.notes ?? subscription?.notes ?? null,
      });
      setSubscription(next);
    } catch (err) {
      console.error("SAVE SUBSCRIPTION ERROR:", err);
      setError(
        err instanceof Error ? err.message : "Failed to update subscription.",
      );
    } finally {
      setSubscriptionSaving(false);
    }
  }

  async function handleToggleFeature(feature: OrganizationFeature) {
    if (!selectedOrg) return;

    try {
      setFeatureSavingId(feature.id);
      setError("");
      const updated = await updateOrganizationFeature({
        featureId: feature.id,
        enabled: !feature.enabled,
      });
      setFeatures((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      setAuditLogs(await getPlatformAuditLogs({ organizationId: selectedOrg.id, limit: 20 }));
    } catch (err) {
      console.error("TOGGLE FEATURE ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to update module.");
    } finally {
      setFeatureSavingId(null);
    }
  }

  async function handleToggleRole(role: OrganizationRole) {
    try {
      setRoleSaving(true);
      const updated = await updateOrganizationRole({
        roleId: role.id,
        isActive: !role.is_active,
      });
      setRoles((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (selectedOrg) {
        setAuditLogs(await getPlatformAuditLogs({ organizationId: selectedOrg.id, limit: 20 }));
      }
    } catch (err) {
      console.error("TOGGLE ROLE ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to update role.");
    } finally {
      setRoleSaving(false);
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
    if (!selectedOrg) return;

    try {
      setRoleSaving(true);
      setError("");
      await createOrganizationRole({
        organizationId: selectedOrg.id,
        ...payload,
      });
      setRoles(await getOrganizationRoles(selectedOrg.id));
      setAuditLogs(await getPlatformAuditLogs({ organizationId: selectedOrg.id, limit: 20 }));
    } catch (err) {
      console.error("CREATE ROLE ERROR:", err);
      setError(getErrorMessage(err, "Failed to create role."));
      throw err;
    } finally {
      setRoleSaving(false);
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
    if (!selectedOrg) return;

    try {
      setRoleSaving(true);
      setError("");
      await updateOrganizationRole({
        roleId: role.id,
        ...payload,
      });
      setRoles(await getOrganizationRoles(selectedOrg.id));
      setAuditLogs(await getPlatformAuditLogs({ organizationId: selectedOrg.id, limit: 20 }));
    } catch (err) {
      console.error("UPDATE ROLE ERROR:", err);
      setError(getErrorMessage(err, "Failed to update role."));
      throw err;
    } finally {
      setRoleSaving(false);
    }
  }

  async function handleInviteAdmin() {
    if (!selectedOrg || !inviteEmail.trim()) return;

    try {
      setInviting(true);
      setError("");
      await createOrganizationInvitation({
        organizationId: selectedOrg.id,
        email: inviteEmail,
        fullName: inviteName || null,
        roleKey: "admin",
      });
      setInviteEmail("");
      setInviteName("");
      setInvitations(await getOrganizationInvitations(selectedOrg.id));
      setAuditLogs(await getPlatformAuditLogs({ organizationId: selectedOrg.id, limit: 20 }));
    } catch (err) {
      console.error("INVITE ADMIN ERROR:", err);
      setError(getErrorMessage(err, "Failed to invite admin."));
    } finally {
      setInviting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen bg-[#090909] text-white">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="rounded-3xl border border-white/10 bg-[#111111] px-6 py-4 text-sm text-white/60 shadow-xl shadow-black/40">
            Loading Platform Admin...
          </div>
        </main>
      </div>
    );
  }

  if (allowed === false) {
    return (
      <div className="flex min-h-screen bg-[#090909] text-white">
        <Sidebar />
        <main className="flex flex-1 items-center justify-center p-6">
          <div className="max-w-md rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-center shadow-xl shadow-black/40">
            <Lock className="mx-auto mb-3 text-red-400" size={34} />
            <h1 className="text-lg font-semibold text-white">Unauthorized</h1>
            <p className="mt-2 text-sm text-white/60">
              You do not have platform admin access.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#090909] text-white">
      <Sidebar />

      <main className="flex-1 space-y-6 overflow-x-hidden p-4 sm:p-6">
        <div className="rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-xl shadow-black/30">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-500">
                <Shield size={18} />
                Platform Admin
              </div>
              <h1 className="mt-2 text-2xl font-bold text-white">
                Enterprise Companies Control Center
              </h1>
              <p className="mt-1 text-sm text-white/60">
                Manage organization lifecycle, branding, subscriptions, modules,
                onboarding, analytics and realtime operations.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadOrganizations()}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-[#111111] p-4 shadow-xl shadow-black/30">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Plus size={18} className="text-orange-500" />
                Create Organization
              </h2>
              <div className="mt-4 space-y-3">
                <input
                  value={newOrgName}
                  onChange={(event) => handleNameChange(event.target.value)}
                  placeholder="Organization name"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500"
                />
                <input
                  value={newOrgSlug}
                  onChange={(event) => setNewOrgSlug(slugify(event.target.value))}
                  placeholder="organization-slug"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    value={newOrgSubdomain}
                    onChange={(event) => setNewOrgSubdomain(slugify(event.target.value))}
                    placeholder="subdomain"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500"
                  />
                  <input
                    value={newOrgCustomDomain}
                    onChange={(event) => setNewOrgCustomDomain(event.target.value)}
                    placeholder="workspace.company.com"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500"
                  />
                </div>
                <input
                  value={newOrgAdminName}
                  onChange={(event) => setNewOrgAdminName(event.target.value)}
                  placeholder="First admin full name"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500"
                />
                <input
                  value={newOrgAdminEmail}
                  onChange={(event) => setNewOrgAdminEmail(event.target.value)}
                  placeholder="First admin email"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500"
                />
                <div className="rounded-2xl border border-white/10 bg-black p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
                    Branding
                  </p>
                  <div className="space-y-2">
                    <input
                      value={newOrgBrandName}
                      onChange={(event) => setNewOrgBrandName(event.target.value)}
                      placeholder="Brand name"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500"
                    />
                    <input
                      value={newOrgLogoUrl}
                      onChange={(event) => setNewOrgLogoUrl(event.target.value)}
                      placeholder="Logo URL"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500"
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input
                        type="color"
                        value={newOrgPrimaryColor}
                        onChange={(event) => setNewOrgPrimaryColor(event.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-white/5"
                      />
                      <input
                        type="color"
                        value={newOrgSecondaryColor}
                        onChange={(event) => setNewOrgSecondaryColor(event.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-white/5"
                      />
                      <input
                        type="color"
                        value={newOrgAccentColor}
                        onChange={(event) => setNewOrgAccentColor(event.target.value)}
                        className="h-10 w-full rounded-xl border border-white/10 bg-white/5"
                      />
                    </div>
                    <textarea
                      value={newOrgWelcomeText}
                      onChange={(event) => setNewOrgWelcomeText(event.target.value)}
                      placeholder="Welcome text"
                      rows={2}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500"
                    />
                    <textarea
                      value={newOrgGreetingText}
                      onChange={(event) => setNewOrgGreetingText(event.target.value)}
                      placeholder="Dashboard greeting text"
                      rows={2}
                      className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30 focus:border-orange-500"
                    />
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-black p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/45">
                    Enabled features
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {createFeatureOptions.map((feature) => (
                      <label
                        key={feature.key}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70"
                      >
                        <input
                          type="checkbox"
                          checked={newOrgFeatures.includes(feature.key)}
                          onChange={(event) => {
                            setNewOrgFeatures((current) =>
                              event.target.checked
                                ? [...current, feature.key]
                                : current.filter((key) => key !== feature.key),
                            );
                          }}
                        />
                        {feature.label}
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={
                    creatingOrg || !newOrgName.trim() || !newOrgSlug.trim()
                  }
                  onClick={() => void handleCreateOrganization()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={16} />
                  {creatingOrg ? "Creating..." : "Create Organization"}
                </button>
              </div>
            </section>

            <OrganizationTable
              organizations={organizations}
              selectedOrg={selectedOrg}
              onSelect={(org) => {
                setSelectedOrg(org);
                void loadOrganizationDetails(org.id);
              }}
            />
          </div>

          <section className="space-y-6 rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-xl shadow-black/30">
            {!selectedOrg ? (
              <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm text-white/45">
                Select an organization to view details.
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-4 border-b border-white/10 pb-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-white">
                      {selectedOrg.name}
                    </h2>
                    <p className="text-sm text-white/45">{selectedOrg.slug}</p>
                    {isSystemOrg ? (
                      <p className="mt-2 inline-flex rounded-full bg-orange-500 px-3 py-1 text-xs font-bold text-black">
                        Protected system organization
                      </p>
                    ) : null}
                    {selectedOrg.suspended_reason ? (
                      <p className="mt-2 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                        {selectedOrg.suspended_reason}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    {selectedOrg.access_status === "suspended" ? (
                      <button
                        type="button"
                        onClick={() => void handleReactivate(selectedOrg)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400"
                      >
                        <CheckCircle2 size={16} />
                        Reactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isSystemOrg}
                        onClick={() => void handleSuspend(selectedOrg)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <XCircle size={16} />
                        Suspend
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSystemOrg}
                      onClick={() => void handleDeleteOrganization(selectedOrg)}
                      className="inline-flex items-center gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-200 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Trash2 size={16} />
                      Delete
                    </button>
                  </div>
                </div>

                {detailsLoading ? (
                  <p className="text-sm text-white/45">
                    Loading organization details...
                  </p>
                ) : (
                  <>
                    <div className="grid gap-4 md:grid-cols-4">
                      <MetricCard
                        label="Users"
                        value={analytics?.usersCount ?? 0}
                        hint={`${analytics?.onlineUsers ?? 0} online now`}
                      />
                      <MetricCard
                        label="Modules"
                        value={`${features.filter((item) => item.enabled).length}/${features.length}`}
                        hint={isSystemOrg ? "Locked for system org" : "Enabled apps"}
                      />
                      <MetricCard
                        label="Tasks Done"
                        value={`${analytics?.taskCompletionRate ?? 0}%`}
                        hint={`${analytics?.tasksCompleted ?? 0}/${analytics?.tasksTotal ?? 0}`}
                      />
                      <MetricCard
                        label="Automations"
                        value={analytics?.automationUsage ?? 0}
                        hint={`${analytics?.failedAutomations ?? 0} failed`}
                      />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                      <SubscriptionPanel
                        subscription={subscription}
                        saving={subscriptionSaving}
                        onChange={(updates) => void handleSubscriptionChange(updates)}
                      />

                      <section className="rounded-2xl border border-white/10 bg-[#181818] p-4">
                        <h3 className="flex items-center gap-2 font-semibold text-white">
                          <MailPlus size={16} className="text-orange-500" />
                          Invite first admin
                        </h3>
                        <div className="mt-3 space-y-2">
                          <input
                            value={inviteName}
                            onChange={(event) => setInviteName(event.target.value)}
                            placeholder="Full name"
                            className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                          />
                          <input
                            value={inviteEmail}
                            onChange={(event) => setInviteEmail(event.target.value)}
                            placeholder="admin@company.com"
                            className="w-full rounded-xl border border-white/10 bg-black px-3 py-2 text-sm text-white outline-none focus:border-orange-500"
                          />
                          <button
                            type="button"
                            disabled={inviting || !inviteEmail.trim()}
                            onClick={() => void handleInviteAdmin()}
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <MailPlus size={15} />
                            {inviting ? "Inviting..." : "Invite admin"}
                          </button>
                        </div>
                        <p className="mt-3 text-xs text-white/45">
                          {invitations.length} invitations created.
                        </p>
                        <div className="mt-3 space-y-2">
                          {invitations.slice(0, 3).map((invitation) => (
                            <div
                              key={invitation.id}
                              className="rounded-xl border border-white/10 bg-black px-3 py-2 text-xs text-white/55"
                            >
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
                    </div>

                    <BrandingForm
                      values={branding}
                      saving={brandingSaving}
                      onChange={setBranding}
                      onSave={() => void handleSaveBranding()}
                    />

                    <section>
                      <h3 className="mb-3 font-semibold text-white">
                        Feature Modules
                      </h3>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {features.map((feature) => (
                          <FeatureToggleCard
                            key={feature.id}
                            feature={feature}
                            locked={isSystemOrg && feature.enabled}
                            busy={featureSavingId === feature.id}
                            onToggle={(next) => void handleToggleFeature(next)}
                          />
                        ))}
                      </div>
                    </section>

                    <section className="grid gap-6 xl:grid-cols-2">
                      <div>
                        <h3 className="mb-3 font-semibold text-white">
                          Organization Roles
                        </h3>
                        <RoleManagementTable
                          roles={roles}
                          canCreate
                          canEdit
                          saving={roleSaving}
                          onCreate={(payload) => handleCreateRole(payload)}
                          onUpdate={(role, payload) => handleUpdateRole(role, payload)}
                          onToggleActive={(role) => void handleToggleRole(role)}
                        />
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-[#181818] p-4">
                        <h3 className="flex items-center gap-2 font-semibold text-white">
                          <Activity size={16} className="text-orange-500" />
                          Onboarding Wizard
                        </h3>
                        <div className="mt-4 space-y-3">
                          {onboardingSteps.map(([label, done], index) => (
                            <div
                              key={String(label)}
                              className="flex items-center justify-between rounded-xl border border-white/10 bg-black px-3 py-2"
                            >
                              <span className="text-sm text-white/75">
                                Step {index + 1}: {label}
                              </span>
                              <span
                                className={[
                                  "rounded-full px-2 py-1 text-[11px] font-semibold",
                                  done
                                    ? "bg-orange-500 text-black"
                                    : "bg-white/10 text-white/45",
                                ].join(" ")}
                              >
                                {done ? "Ready" : "Open"}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </section>

                    <section>
                      <h3 className="mb-3 font-semibold text-white">
                        Platform Audit Logs
                      </h3>
                      <AuditLogTable logs={auditLogs} />
                    </section>
                  </>
                )}
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
