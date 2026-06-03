import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { rememberAuthReturnPath } from "../../lib/auth/returnPath";

function AccountGateMessage({
  title,
  message,
  tone = "amber",
  onCheck,
}: {
  title: string;
  message: string;
  tone?: "amber" | "red" | "zinc";
  onCheck?: () => void;
}) {
  const toneClasses = {
    amber: "border-amber-500/20 bg-amber-500/10 text-amber-200",
    red: "border-red-500/20 bg-red-500/10 text-red-200",
    zinc: "border-white/10 bg-white/5 text-white/70",
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className={`max-w-xl rounded-3xl border p-8 ${toneClasses[tone]}`}>
        <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
          Account Access
        </p>
        <h1 className="mt-3 text-2xl font-bold text-white">{title}</h1>
        <p className="mt-3 text-sm leading-6">{message}</p>
        {onCheck ? (
          <button
            type="button"
            onClick={onCheck}
            className="mt-6 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
          >
            Check approval status
          </button>
        ) : null}
      </div>
    </div>
  );
}

function getOrganizationAccess(profile: Record<string, unknown> | null | undefined) {
  const organization = profile?.organization;

  if (!organization || typeof organization !== "object") {
    return {
      isSystemOrganization: false,
      accessStatus: null,
      isActive: true,
    };
  }

  const org = organization as Record<string, unknown>;

  return {
    isSystemOrganization: Boolean(org.is_system_organization) || org.slug === "its-nomatata",
    accessStatus: typeof org.access_status === "string" ? org.access_status : null,
    isActive: org.is_active !== false,
  };
}

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const auth = useAuth();

  if (!auth) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading authentication...
      </div>
    );
  }

  const {
    user,
    profile,
    loading,
    refreshProfile,
    currentOrganization,
    resolvedHostOrganization,
    accessIssue,
  } = auth;

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading profile...
      </div>
    );
  }

  if (!user) {
    rememberAuthReturnPath();
    return <Navigate to="/login" replace />;
  }

  const accountStatus =
    profile?.account_status ??
    (profile?.is_suspended
      ? "suspended"
      : profile?.is_active === false
        ? "pending"
        : "active");

  if (accountStatus === "pending" || accountStatus === "pending_approval") {
    return (
      <AccountGateMessage
        title="Waiting for admin approval"
        message="Your account has been created, but an administrator needs to approve it before you can access the workspace."
        onCheck={() => void refreshProfile()}
      />
    );
  }

  if (accessIssue === "no_membership") {
    return (
      <AccountGateMessage
        title="No organization access"
        message="Your account is signed in, but it is not connected to an active organization. Ask your organization admin for an invitation or approval."
        tone="amber"
        onCheck={() => void refreshProfile()}
      />
    );
  }

  if (accessIssue === "wrong_organization") {
    return (
      <AccountGateMessage
        title="You do not have access to this organization"
        message={`This domain belongs to ${
          resolvedHostOrganization?.name ?? "another organization"
        }, but your active membership is for ${
          currentOrganization?.organization_name ?? "a different organization"
        }.`}
        tone="red"
      />
    );
  }

  if (accountStatus === "suspended") {
    return (
      <AccountGateMessage
        title="Account suspended"
        message="Your access has been paused by an administrator. Contact your organization admin if you believe this is a mistake."
        tone="red"
      />
    );
  }

  if (accountStatus === "rejected") {
    return (
      <AccountGateMessage
        title="Signup rejected"
        message="This signup request was rejected by an administrator."
        tone="red"
      />
    );
  }

  if (accountStatus === "deleted") {
    return (
      <AccountGateMessage
        title="Account removed"
        message="This account has been removed from the workspace."
        tone="zinc"
      />
    );
  }

  const organizationAccess = getOrganizationAccess(profile);

  if (
    !organizationAccess.isSystemOrganization &&
    (accessIssue === "suspended_organization" ||
      organizationAccess.accessStatus === "suspended" ||
      organizationAccess.accessStatus === "cancelled" ||
      !organizationAccess.isActive)
  ) {
    return (
      <AccountGateMessage
        title="Organization access paused"
        message="This organization is suspended or cancelled. Platform support must reactivate it before users can enter the workspace."
        tone="red"
      />
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
