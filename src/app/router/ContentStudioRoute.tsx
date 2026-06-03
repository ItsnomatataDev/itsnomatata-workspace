import type { ReactNode } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import { useOrganizationFeatures } from "../../lib/hooks/useOrganizationFeatures";
import {
  canAccessContentStudio,
  collectAuthRoleCandidates,
} from "../../lib/auth/contentStudioAccess";
import Sidebar from "../../components/dashboard/components/Sidebar";

function ContentStudioAccessDenied({
  roles,
}: {
  roles: string[];
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar role={roles[0] ?? null} />
        <main className="flex min-w-0 flex-1 flex-col items-center justify-center px-6 py-12">
          <p className="text-lg font-semibold">Content Studio access required</p>
          <p className="mt-2 max-w-md text-center text-sm text-white/55">
            Your account roles ({roles.join(", ") || "none"}) are not allowed for
            Content Studio. Ask an admin to set your role to social media, media
            team, or admin.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/75"
          >
            Back to dashboard
          </Link>
        </main>
      </div>
    </div>
  );
}

/**
 * Content Studio guard — never silently redirects to /dashboard (that caused
 * “kicked out” of client URLs). Shows access denied or login instead.
 */
export default function ContentStudioRoute({
  children,
}: {
  children: ReactNode;
}) {
  const auth = useAuth();
  const { loading: featuresLoading, isEnabled } = useOrganizationFeatures();

  if (!auth || auth.loading || featuresLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading Content Studio...
      </div>
    );
  }

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  if (!isEnabled("content_review")) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="flex min-h-screen flex-col lg:flex-row">
          <Sidebar
            role={
              auth.profile?.primary_role ??
              auth.currentOrganization?.role ??
              null
            }
          />
          <main className="flex min-w-0 flex-1 items-center justify-center p-6">
            <div className="max-w-md rounded-3xl border border-white/10 bg-white/5 p-6 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                Feature disabled
              </p>
              <h1 className="mt-3 text-2xl font-bold">
                Content Studio is not enabled
              </h1>
              <p className="mt-3 text-sm text-white/60">
                Contact your organization admin to enable content review for
                your workspace.
              </p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!canAccessContentStudio(auth)) {
    return (
      <ContentStudioAccessDenied roles={collectAuthRoleCandidates(auth)} />
    );
  }

  return <>{children}</>;
}
