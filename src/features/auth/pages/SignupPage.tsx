import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithGoogle, signUpUser } from "../../../lib/supabase/auth";

export default function SignupPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "social_media",
  });

  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setBusy(true);

    try {
      const result = await signUpUser({
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        role: form.role,
      });

      if (result.session) {
        setSuccessMessage("Account created successfully. Redirecting...");
        navigate("/dashboard", { replace: true });
      } else {
        setSuccessMessage(
          "Account created successfully. Please check your email to confirm your account, then log in.",
        );
      }
    } catch (err) {
      console.error("SIGNUP ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    setSuccessMessage("");

    try {
      setGoogleBusy(true);
      await signInWithGoogle();
    } catch (err) {
      console.error("GOOGLE SIGNUP ERROR:", err);
      setError(err instanceof Error ? err.message : "Google sign-up failed");
      setGoogleBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between border-r border-orange-500/20 bg-linear-to-br from-black via-black to-orange-950/20 p-10">
          <div>
            <div className="inline-flex items-center rounded-full border border-orange-500/40 px-4 py-2 text-sm text-orange-400">
              ITs Nomatata Workspace
            </div>
            <h1 className="mt-8 max-w-md text-5xl font-bold leading-tight">
              Create your workspace account and get started.
            </h1>
            <p className="mt-5 max-w-lg text-base text-white/70">
              Join the internal workspace for clients, campaigns, tasks,
              reports, and content.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-orange-500/20 bg-white/5 p-8 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white">Create Account</h2>
              <p className="mt-2 text-sm text-white/60">
                Set up your team account.
              </p>
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mb-4 rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                {successMessage}
              </div>
            ) : null}

            <form onSubmit={handleSignup} className="space-y-4">
              <input
                type="text"
                value={form.fullName}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, fullName: e.target.value }))
                }
                placeholder="Full Name"
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                required
              />

              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="Email"
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                required
              />

              <select
                value={form.role}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, role: e.target.value }))
                }
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              >
                <option value="social_media">Social Media</option>
                <option value="media_team">Media Team</option>
                <option value="seo_specialist">SEO Specialist</option>
                <option value="admin">Admin</option>
                <option value="it">IT</option>
                <option value="manager">Manager</option>
              </select>

              <input
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, password: e.target.value }))
                }
                placeholder="Password"
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                required
              />

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
              >
                {busy ? "Creating account..." : "Create Account"}
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
              onClick={handleGoogleSignup}
              disabled={googleBusy}
              className="w-full rounded-2xl border border-white/15 bg-white px-4 py-3 font-semibold text-black transition hover:bg-orange-50 disabled:opacity-60"
            >
              {googleBusy ? "Redirecting..." : "Continue with Google"}
            </button>

            <p className="mt-6 text-center text-sm text-white/60">
              Already have an account?{" "}
              <Link
                to="/login"
                className="font-semibold text-orange-400 hover:text-orange-300"
              >
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
