import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { getDefaultAuthenticatedPath, signUpUser } from "../../../lib/supabase/auth";
import type { PublicSignupRole } from "../../../lib/supabase/auth";
import { OFFICE_OPTIONS, OFFICE_SLUGS, type OfficeSlug } from "../../../lib/offices";
import { supabase } from "../../../lib/supabase/client";
import { useOrganizationBranding } from "../../../app/providers/OrganizationBrandingProvider";
import { getOrganizationSignupRoles } from "../../platform-admin/services/platformAdminService";

type SignupRoleOption = {
  value: PublicSignupRole;
  label: string;
  isDefault?: boolean;
};

type InvitePreview = {
  id: string;
  organization_id: string;
  email: string;
  full_name: string | null;
  role_key: string;
  status: string;
  expires_at: string | null;
  organization_name: string | null;
  organization_slug: string | null;
};

export default function SignupPage() {
  const navigate = useNavigate();
  const { branding } = useOrganizationBranding();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite");
  const requestedOrgSlug =
    searchParams.get("org") ?? searchParams.get("organization") ?? "";
  const requestedOrgId = searchParams.get("organization_id") ?? "";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<PublicSignupRole>("employee");
  const [organizationRoleOptions, setOrganizationRoleOptions] =
    useState<SignupRoleOption[]>([{ value: "employee", label: "Employee", isDefault: true }]);
  const [organizationSlug, setOrganizationSlug] = useState(requestedOrgSlug);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState(requestedOrgId);
  const [selectedOrganizationName, setSelectedOrganizationName] = useState("");
  const [rolesLoading, setRolesLoading] = useState(false);
  const [officeSlug, setOfficeSlug] = useState<OfficeSlug>(OFFICE_SLUGS.itsNoMatata);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [inviteLoading, setInviteLoading] = useState(Boolean(inviteToken));
  const normalizedEmail = email.trim().toLowerCase();
  const isInternalEmail = normalizedEmail.endsWith("@itsnomatata.com");
  const isInviteSignup = Boolean(inviteToken);
  const brandName =
    invitePreview?.organization_name ||
    branding.brand_name ||
    "ITsNomatata";
  const logoUrl = branding.logo_url;
  const welcomeText =
    branding.company_welcome_text ||
    "Join the workspace to start managing clients, campaigns, tasks, reports, assets, and collaboration.";
  const accentColor = branding.accent_color || "#f97316";
  const panelBackground = branding.login_background_url
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,.82), rgba(0,0,0,.82)), url(${branding.login_background_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  useEffect(() => {
    async function loadInvite() {
      if (!inviteToken) return;

      try {
        setInviteLoading(true);
        setError("");

        const { data, error: inviteError } = await supabase
          .rpc("get_organization_invitation_by_token", {
            invitation_token: inviteToken,
          })
          .maybeSingle();

        if (inviteError) throw inviteError;
        if (!data) throw new Error("This invitation was not found or has expired.");

        const invite = data as unknown as InvitePreview;
        setInvitePreview(invite);
        setEmail(invite.email);
        if (invite.full_name) setFullName(invite.full_name);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load invitation.");
      } finally {
        setInviteLoading(false);
      }
    }

    void loadInvite();
  }, [inviteToken]);

  useEffect(() => {
    async function loadSignupRoles() {
      if (isInviteSignup) {
        return;
      }

      const targetSlug = isInternalEmail ? "its-nomatata" : organizationSlug.trim();
      const targetId = selectedOrganizationId.trim();
      if (!targetSlug && !targetId) {
        setOrganizationRoleOptions([
          { value: "employee", label: "Employee", isDefault: true },
        ]);
        setRole("employee");
        setSelectedOrganizationName("");
        return;
      }

      try {
        setRolesLoading(true);
        const data = await getOrganizationSignupRoles({
          organizationId: targetId || null,
          organizationSlug: targetSlug || null,
        });

        if (data.length === 0) {
          throw new Error("Organization was not found or does not allow signup.");
        }

        const nextOptions = data.map((item) => ({
          value: item.role_key,
          label: item.role_label,
          isDefault: item.is_default_signup_role,
        }));

        setOrganizationRoleOptions(nextOptions);
        setSelectedOrganizationId(data[0].organization_id);
        setSelectedOrganizationName(data[0].organization_name);
        setOrganizationSlug(data[0].organization_slug);
        const defaultRole =
          nextOptions.find((item) => item.isDefault) ?? nextOptions[0];
        setRole(defaultRole.value);
      } catch (err) {
        console.warn("SIGNUP ROLE LOAD ERROR:", err);
        setOrganizationRoleOptions([
          { value: "employee", label: "Employee", isDefault: true },
        ]);
        setSelectedOrganizationName("");
      } finally {
        setRolesLoading(false);
      }
    }

    void loadSignupRoles();
  }, [isInternalEmail, isInviteSignup, organizationSlug, selectedOrganizationId]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setApprovalRequired(false);

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isInviteSignup && !isInternalEmail && !selectedOrganizationId) {
      setError("Choose your organization before creating an account.");
      return;
    }

    try {
      setBusy(true);

      if (invitePreview && normalizedEmail !== invitePreview.email.toLowerCase()) {
        setError("Use the email address that was invited to this organization.");
        return;
      }

      const result = await signUpUser({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role: isInviteSignup ? invitePreview?.role_key : role,
        officeSlug: isInternalEmail ? officeSlug : undefined,
        inviteToken,
        organizationId: !isInviteSignup ? selectedOrganizationId || null : null,
        organizationSlug: !isInviteSignup ? organizationSlug || null : null,
      });

      if (result?.approvalRequired) {
        setApprovalRequired(true);
      }

      setSuccess(true);
      if (inviteToken && result.session) {
        navigate(
          result.defaultPath ?? getDefaultAuthenticatedPath(invitePreview?.role_key),
          { replace: true },
        );
        return;
      }
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("employee");
      if (!requestedOrgSlug) setOrganizationSlug("");
      if (!requestedOrgId) setSelectedOrganizationId("");
      setOfficeSlug(OFFICE_SLUGS.itsNoMatata);
    } catch (err) {
      console.error("SIGNUP ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div
          className="hidden flex-col items-start justify-between border-r border-orange-500/20 bg-linear-to-br from-black via-black to-orange-950/20 p-10 lg:flex"
          style={{
            borderRightColor: `${accentColor}33`,
            ...panelBackground,
          }}
        >
          <div className="flex flex-col items-start">
            <div className="w-20 h-20">
              {logoUrl ? (
                <img src={logoUrl} alt={brandName} className="h-full w-full object-contain object-left" />
              ) : null}
            </div>

            <h1 className="mt-8 max-w-md text-5xl font-bold leading-tight">
              Create your {brandName} account.
            </h1>

            <p className="mt-5 max-w-lg text-base text-white/70">
              {welcomeText}
            </p>

            <div className="relative mt-8 flex justify-start self-start">
              <div className="absolute -inset-20 z-0 rounded-full bg-black blur-[100px] opacity-90 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md rounded-3xl border border-orange-500/20 bg-white/5 p-5 shadow-2xl sm:p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white">
                {invitePreview ? `Join ${brandName}` : "Sign Up"}
              </h2>
              <p className="mt-2 text-sm text-white/60">
                {invitePreview
                  ? `Create your ${invitePreview.role_key} account for this organization.`
                  : "Create your account to get started."}
              </p>
            </div>

            {error ? (
              <div className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mb-4 border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                {approvalRequired
                  ? "Account created successfully! Your account is awaiting admin approval. You will be notified when your account is approved."
                  : "Account created successfully! Redirecting to login..."}
              </div>
            ) : null}

            {inviteLoading ? (
              <div className="rounded-2xl border border-white/10 bg-black px-4 py-3 text-sm text-white/60">
                Loading invitation...
              </div>
            ) : !success ? (
              <form onSubmit={handleSignup} className="space-y-4">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                  required
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  readOnly={Boolean(invitePreview)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                  required
                />

                {!isInviteSignup && isInternalEmail ? (
                  <select
                    value={officeSlug}
                    onChange={(e) => setOfficeSlug(e.target.value as OfficeSlug)}
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                    required
                  >
                    {OFFICE_OPTIONS.map((option) => (
                      <option key={option.slug} value={option.slug}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                ) : null}

                {!isInviteSignup && !isInternalEmail ? (
                  <div>
                    <input
                      type="text"
                      value={organizationSlug}
                      onChange={(e) => {
                        setOrganizationSlug(e.target.value);
                        setSelectedOrganizationId("");
                      }}
                      placeholder="Organization slug"
                      className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                      required
                    />
                    <p className="mt-2 text-xs text-white/45">
                      {rolesLoading
                        ? "Loading roles for this organization..."
                        : selectedOrganizationName
                          ? `Signing up for ${selectedOrganizationName}.`
                          : "Enter the organization slug provided by your administrator."}
                    </p>
                  </div>
                ) : null}

                {!isInviteSignup && (isInternalEmail || selectedOrganizationId) ? (
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as PublicSignupRole)}
                    disabled={rolesLoading}
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500 disabled:opacity-60"
                    required
                  >
                    {organizationRoleOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : null}

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 pr-12 text-white outline-none transition focus:border-orange-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 pr-12 text-white outline-none transition focus:border-orange-500"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                  style={{ backgroundColor: accentColor }}
                >
                  {busy ? "Creating account..." : "Create Account"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    inviteToken
                      ? getDefaultAuthenticatedPath(invitePreview?.role_key)
                      : "/login",
                    { replace: true },
                  )
                }
                className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400"
                style={{ backgroundColor: accentColor }}
              >
                {inviteToken ? "Open Workspace" : "Go to Login"}
              </button>
            )}

            <p className="mt-6 text-center text-sm text-white/60">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-orange-400 hover:text-orange-300"
                style={{ color: accentColor }}
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
