import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../../../lib/supabase/client";
import {
  getDefaultPathForUser,
  signInUser,
  signInWithGoogle,
} from "../../../lib/supabase/auth";
import {
  consumeAuthReturnPath,
  peekAuthReturnPath,
  rememberAuthReturnPath,
} from "../../../lib/auth/returnPath";
import { useOrganizationBranding } from "../../../app/providers/OrganizationBrandingProvider";

export default function LoginPage() {
  const navigate = useNavigate();
  const { branding } = useOrganizationBranding();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  useEffect(() => {
    const disabledMessage = window.localStorage.getItem("account_disabled_message");
    if (disabledMessage) {
      setError(disabledMessage);
      window.localStorage.removeItem("account_disabled_message");
    }
  }, []);

  useEffect(() => {
    rememberAuthReturnPath();
    void supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) return;

      const stored = peekAuthReturnPath();
      if (stored) {
        navigate(consumeAuthReturnPath("/dashboard"), { replace: true });
        return;
      }

      const defaultPath = await getDefaultPathForUser(
        session.user.id,
        session.user.email,
      );
      navigate(defaultPath, { replace: true });
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setWarning("");

    try {
      setBusy(true);

      const result = await signInUser({
        email: email.trim(),
        password,
      });

      const returnTo = consumeAuthReturnPath(
        result.defaultPath ?? "/dashboard",
      );
      navigate(returnTo, { replace: true });
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to login");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setWarning("");

    try {
      setGoogleBusy(true);
      rememberAuthReturnPath();
      await signInWithGoogle();
    } catch (err) {
      console.error("GOOGLE LOGIN ERROR:", err);
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleBusy(false);
    }
  };

  const brandName = branding.brand_name || "ITsNomatata";
  const logoUrl = branding.logo_url;
  const welcomeText =
    branding.company_welcome_text ||
    "Login to continue managing clients, campaigns, tasks, reports, assets, and collaboration.";
  const accentColor = branding.accent_color || "#f97316";
  const panelBackground = branding.login_background_url
    ? {
        backgroundImage: `linear-gradient(rgba(0,0,0,.82), rgba(0,0,0,.82)), url(${branding.login_background_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }
    : undefined;

  return (
    <div className="min-h-screen text-white" style={{ backgroundColor: "var(--org-bg)" }}>
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
              Welcome back to {brandName}.
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
          <div className="w-full max-w-md rounded-3xl border p-5 shadow-2xl sm:p-8" style={{ backgroundColor: "var(--org-card)", borderColor: "var(--org-border)" }}>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white">Login</h2>
              <p className="mt-2 text-sm text-white/60">
                Access {brandName} and continue your work.
              </p>
            </div>

            {error ? (
              <div className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {warning ? (
              <div className="mb-4 border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
                {warning}
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="org-branded-input w-full rounded-2xl border px-4 py-3 outline-none transition"
                required
              />

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="org-branded-input w-full rounded-2xl border px-4 py-3 pr-12 outline-none transition"
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

              <div className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="org-branded-link text-sm"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="org-branded-button w-full rounded-2xl px-4 py-3 font-semibold transition disabled:opacity-60"
              >
                {busy ? "Logging in..." : "Login"}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-white/10" />
              <span className="text-xs uppercase tracking-wider text-white/40">
                or
              </span>
              <div className="h-px flex-1 bg-white/10" />
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleBusy}
              className="w-full rounded-2xl border border-white/15 bg-white px-4 py-3 font-semibold text-black transition hover:bg-orange-50 disabled:opacity-60"
            >
              {googleBusy ? "Redirecting..." : "Continue with Google"}
            </button>

            <p className="mt-6 text-center text-sm text-white/60">
              Don’t have an account?{" "}
              <Link
                to="/signup"
                className="org-branded-link font-semibold"
              >
                Create one
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
