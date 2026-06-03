import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { rememberAuthReturnPath } from "../../lib/auth/returnPath";

/**
 * Keeps the current URL in session storage so login/OAuth can restore it
 * instead of always falling back to /dashboard.
 */
export default function AuthReturnPathListener() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    rememberAuthReturnPath();
  }, [pathname, search, hash]);

  return null;
}
