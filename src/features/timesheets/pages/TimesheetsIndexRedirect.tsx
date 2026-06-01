import { Navigate } from "react-router-dom";
import { useAuth } from "../../../app/providers/AuthProvider";
import type { AppRole } from "../../../lib/constants/roles";

const TEAM_TIMESHEET_ROLES: AppRole[] = [
  "admin",
  "org_admin",
  "super_admin",
  "superadmin",
  "manager",
  "it",
  "it-superadmin",
];

/**
 * Resolves bare /timesheets to the correct default timesheet view for the user.
 */
export default function TimesheetsIndexRedirect() {
  const auth = useAuth();

  if (!auth || auth.loading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading timesheets...
      </div>
    );
  }

  const role =
    auth.currentOrganization?.role ??
    auth.profile?.organization_role_key ??
    auth.profile?.primary_role ??
    null;

  if (role && TEAM_TIMESHEET_ROLES.includes(role as AppRole)) {
    return <Navigate to="/timesheets/team" replace />;
  }

  return <Navigate to="/timesheet" replace />;
}
