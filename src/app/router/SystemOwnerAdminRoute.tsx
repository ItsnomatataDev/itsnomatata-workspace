import { useEffect, useState, type ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { checkIsPlatformAdmin } from "../../features/platform-admin/services/platformAdminService";

function isSystemOwnerOrganization(profile: Record<string, unknown> | null | undefined) {
  const organization = profile?.organization;

  if (!organization || typeof organization !== "object") return false;

  const org = organization as Record<string, unknown>;
  return Boolean(
    org.slug === "its-nomatata" ||
      org.is_system_organization ||
      org.is_system_owner,
  );
}

export default function SystemOwnerAdminRoute({
  children,
}: {
  children: ReactNode;
}) {
  const auth = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    async function checkAccess() {
      if (!auth?.user || !auth.profile) {
        if (mounted) setAllowed(false);
        return;
      }

      const platformAdmin = await checkIsPlatformAdmin();
      const systemOwnerOrg = isSystemOwnerOrganization(auth.profile);

      if (mounted) setAllowed(platformAdmin && systemOwnerOrg);
    }

    void checkAccess();

    return () => {
      mounted = false;
    };
  }, [auth?.user, auth?.profile]);

  if (!auth || auth.loading || allowed === null) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Checking platform access...
      </div>
    );
  }

  if (!allowed) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <>{children}</>;
}
