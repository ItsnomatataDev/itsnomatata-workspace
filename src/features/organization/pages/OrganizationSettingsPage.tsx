import { useCallback, useEffect, useMemo, useState } from "react";
import { MailPlus, Palette, ShieldCheck, ToggleLeft, Users } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { useOrganizationBranding } from "../../../app/providers/OrganizationBrandingProvider";
import { useOrganizationFeatures } from "../../../lib/hooks/useOrganizationFeatures";
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
import type {
  OrganizationBranding,
  OrganizationFeature,
  OrganizationInvitation,
  OrganizationRole,
} from "../../platform-admin/types/platformAdmin";

type BrandingValues = Partial<OrganizationBranding>;

const defaultBranding: BrandingValues = {
  primary_color: "#000000",
  secondary_color: "#ffffff",
  accent_color: "#f97316",
  custom_terminology: {},
  onboarding_wording: {},
};

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
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [loading, setLoading] = useState(true);
  const [savingBranding, setSavingBranding] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadSettings = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [brandingData, featureData, roleData, inviteData] = await Promise.all([
        getOrganizationBranding(organizationId),
        getOrganizationFeatures(organizationId),
        getOrganizationRoles(organizationId),
        getOrganizationInvitations(organizationId),
      ]);

      setBranding({ ...defaultBranding, ...(brandingData ?? {}) });
      setFeatures(featureData);
      setRoles(roleData);
      setInvitations(inviteData);
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
    if (!currentRoleExists) {
      const defaultRole =
        activeRoles.find((role) => role.is_default_signup_role) ??
        activeRoles[0];
      setInviteRole(defaultRole.role_key);
    }
  }, [activeRoles, inviteRole]);

  async function handleSaveBranding() {
    if (!organizationId) return;

    try {
      setSavingBranding(true);
      setError("");
      setSuccess("");

      const saved = await updateOrganizationBranding({
        organizationId,
        brandName: branding.brand_name ?? organization?.name ?? null,
        logoUrl: branding.logo_url ?? null,
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

      setBranding({ ...defaultBranding, ...saved });
      await refreshBranding();
      setSuccess("Organization branding updated.");
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save branding."));
    } finally {
      setSavingBranding(false);
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

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading organization settings...
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <Palette size={18} className="text-orange-500" />
                  Branding and Domains
                </h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <input
                    value={branding.brand_name ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, brand_name: event.target.value }))}
                    placeholder="Company name"
                    className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <input
                    value={branding.logo_url ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, logo_url: event.target.value }))}
                    placeholder="Logo URL"
                    className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <input
                    value={branding.primary_color ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, primary_color: event.target.value }))}
                    placeholder="#000000"
                    className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <input
                    value={branding.secondary_color ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, secondary_color: event.target.value }))}
                    placeholder="#ffffff"
                    className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <input
                    value={branding.subdomain ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, subdomain: event.target.value }))}
                    placeholder="organization-slug"
                    className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                  <input
                    value={branding.custom_domain ?? ""}
                    onChange={(event) => setBranding((current) => ({ ...current, custom_domain: event.target.value }))}
                    placeholder="app.companydomain.com"
                    className="rounded-xl border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                  />
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
                  className="mt-4 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-50"
                >
                  {savingBranding ? "Saving..." : "Save Branding"}
                </button>
              </section>

              {isEnabled("admin_users") ? (
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
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
