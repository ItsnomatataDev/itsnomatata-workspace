import { Navigate, useLocation } from "react-router-dom";

/**
 * Fallback when no route matches. Content Studio URLs must never land on
 * /dashboard because of a stray splat match or trailing-slash mismatch.
 */
export default function CatchAllRedirect() {
  const { pathname } = useLocation();

  if (pathname.startsWith("/admin/content-studio")) {
    return <Navigate to="/admin/content-studio/clients" replace />;
  }

  if (pathname.startsWith("/content-studio")) {
    const legacyClient = pathname.replace(/^\/content-studio\/?/, "");
    if (legacyClient) {
      return (
        <Navigate
          to={`/admin/content-studio/clients/${legacyClient}`}
          replace
        />
      );
    }
    return <Navigate to="/admin/content-studio/clients" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}
