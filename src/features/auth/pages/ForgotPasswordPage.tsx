import { useState } from "react";
import { Link } from "react-router-dom";
import { resetPassword } from "../../../lib/supabase/auth";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    try {
      setBusy(true);
      await resetPassword(email.trim());
      setSuccessMessage(
        "Password reset email sent. Please check your inbox and follow the instructions to reset your password.",
      );
      setEmail("");
    } catch (err) {
      console.error("RESET PASSWORD ERROR:", err);
      const errorMessage = err instanceof Error ? err.message : JSON.stringify(err);
      setError(errorMessage || "Failed to send reset email");
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
              Reset your password.
            </h1>

            <p className="mt-5 max-w-lg text-base text-white/70">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md border border-orange-500/20 bg-white/5 p-8 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white">Forgot Password</h2>
              <p className="mt-2 text-sm text-white/60">
                We'll send you a reset link to your email.
              </p>
            </div>

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

            <form onSubmit={handleResetPassword} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                required
                disabled={busy}
              />

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
              >
                {busy ? "Sending..." : "Send Reset Link"}
              </button>
            </form>

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
