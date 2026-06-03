export const AUTH_RETURN_PATH_KEY = "auth_return_path";

const AUTH_ENTRY_PATHS = new Set([
  "/login",
  "/signup",
  "/forgot-password",
  "/resetpassword",
]);

/** Remember where the user was before login so we can restore it after auth. */
export function rememberAuthReturnPath() {
  const path = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (AUTH_ENTRY_PATHS.has(window.location.pathname)) return;
  if (!path.startsWith("/")) return;
  sessionStorage.setItem(AUTH_RETURN_PATH_KEY, path);
}

export function peekAuthReturnPath() {
  const stored = sessionStorage.getItem(AUTH_RETURN_PATH_KEY);
  return stored && stored.startsWith("/") ? stored : null;
}

export function consumeAuthReturnPath(fallback: string) {
  const stored = peekAuthReturnPath();
  sessionStorage.removeItem(AUTH_RETURN_PATH_KEY);
  return stored ?? fallback;
}
