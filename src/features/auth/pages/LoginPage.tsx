import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInUser, signInWithGoogle } from "../../../lib/supabase/auth";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setWarning("");

    try {
      setBusy(true);

      const result = await signInUser({ email, password });

      if (result?.workspace?.organizationFound === false) {
        setWarning(
          'Login succeeded, but the organization with slug "its-nomatata" was not found. Ask admin to create it in Supabase.',
        );
      }

      navigate("/dashboard", { replace: true });
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
      await signInWithGoogle();
    } catch (err) {
      console.error("GOOGLE LOGIN ERROR:", err);
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setGoogleBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="hidden lg:flex flex-col justify-between border-r border-orange-500/20 bg-linear-to-br from-black via-black to-orange-950/20 p-10">
          <div>
            <div className="inline-flex items-center rounded-full border border-orange-500/40 px-4 py-2 text-sm text-orange-400">
              ITsNomatata Workspace
            </div>
            <h1 className="mt-8 max-w-md text-5xl font-bold leading-tight">
              Welcome back to your workspace.
            </h1>
            <p className="mt-5 max-w-lg text-base text-white/70">
              Login to continue managing clients, campaigns, tasks, reports, and
              assets.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-orange-500/20 bg-white/5 p-8 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white">Login</h2>
              <p className="mt-2 text-sm text-white/60">
                Access your dashboard and continue your work.
              </p>
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {warning ? (
              <div className="mb-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
                {warning}
              </div>
            ) : null}

            <form onSubmit={handleLogin} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                required
              />

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                required
              />

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
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
                className="font-semibold text-orange-400 hover:text-orange-300"
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
