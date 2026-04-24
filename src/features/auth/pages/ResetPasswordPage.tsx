import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "../../../lib/supabase/client";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if we have an access token in the URL (from the reset email)
    // Supabase puts tokens in the hash (#) not query params
    const hash = window.location.hash;
    const accessTokenMatch = hash.match(/access_token=([^&]+)/);
    const refreshTokenMatch = hash.match(/refresh_token=([^&]+)/);

    const accessToken = accessTokenMatch ? accessTokenMatch[1] : searchParams.get("access_token");
    const refreshToken = refreshTokenMatch ? refreshTokenMatch[1] : searchParams.get("refresh_token");

    if (accessToken) {
      // Set the session from the access token
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || "",
      }).then(({ error }) => {
        if (error) {
          setError("Invalid or expired reset link. Please request a new password reset.");
        }
        setLoading(false);
      });
    } else {
      // Check if user already has a session
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session) {
          setError("No active session. Please request a new password reset.");
        }
        setLoading(false);
      });
    }
  }, [searchParams]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    try {
      setBusy(true);

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;

      setSuccessMessage("Password updated successfully. Redirecting to login...");

      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2000);
    } catch (err) {
      console.error("RESET PASSWORD ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to update password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between border-r border-orange-500/20 bg-linear-to-br from-black via-black to-orange-950/20 p-10">
          <div>
            <div className="inline-flex items-center border border-orange-500/40 px-4 py-2 text-sm text-orange-400">
              ITsNomatata Workspace
            </div>

            <h1 className="mt-8 max-w-md text-5xl font-bold leading-tight">
              Set your new password.
            </h1>

            <p className="mt-5 max-w-lg text-base text-white/70">
              Enter your new password below to complete the password reset
              process.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md border border-orange-500/20 bg-white/5 p-8 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white">Reset Password</h2>
              <p className="mt-2 text-sm text-white/60">
                Create a new secure password for your account.
              </p>
            </div>

            {loading ? (
              <div className="mb-4 border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">
                Verifying reset link...
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mb-4 border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                {successMessage}
              </div>
            ) : null}

            {!loading && !error && (
              <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="New Password"
                  className="w-full border border-white/10 bg-black px-4 py-3 pr-12 text-white outline-none transition focus:border-orange-500"
                  required
                  disabled={busy}
                  minLength={6}
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
                  placeholder="Confirm New Password"
                  className="w-full border border-white/10 bg-black px-4 py-3 pr-12 text-white outline-none transition focus:border-orange-500"
                  required
                  disabled={busy}
                  minLength={6}
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
                className="w-full bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
              >
                {busy ? "Updating..." : "Update Password"}
              </button>
            </form>
            )}

            <p className="mt-6 text-center text-sm text-white/60">
              Remember your password?{" "}
              <Link
                to="/login"
                className="font-semibold text-orange-400 hover:text-orange-300"
              >
                Back to Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
