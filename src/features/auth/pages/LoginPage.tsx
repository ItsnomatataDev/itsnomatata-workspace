import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { signInUser, signInWithGoogle } from "../../../lib/supabase/auth";
import { TimeTrackingService } from "../../time-tracking/services/timeTrackingService";
import { useAuth } from "../../../app/providers/AuthProvider";

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

      const result = await signInUser({
        email: email.trim(),
        password,
      });

      if (result?.workspace?.organizationFound === false) {
        setWarning(
          'Login succeeded, but the organization with slug "its-nomatata" was not found. Ask an administrator to create it in Supabase.',
        );
      }

      if (auth?.user?.id && auth?.profile?.organization_id) {
        try {
          const activeSession = await TimeTrackingService.getActiveSession(
            auth.user.id,
          );
          if (!activeSession) {
            await TimeTrackingService.clockIn({
              userId: auth.user.id,
              organizationId: auth.profile.organization_id,
              notes: "Auto clocked in on login",
            });
          }
        } catch (clockInError) {
          console.error("Auto clock in failed:", clockInError);
        }
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
        <div className="hidden lg:flex flex-col items-start justify-between border-r border-orange-500/20 bg-linear-to-br from-black via-black to-orange-950/20 p-10">
          <div className="flex flex-col items-start">
            <div className="w-20 h-20">
              <img
                src="https://res.cloudinary.com/dnqjax5ut/image/upload/v1776754504/Itsnomatata-Logo-White-with-tagline-2-768x643_u3n4j0.png"
                alt="IT's Nomatata"
              />
            </div>

            <h1 className="mt-8 max-w-md text-5xl font-bold leading-tight">
              Welcome back to your workspace.
            </h1>

            <p className="mt-5 max-w-lg text-base text-white/70">
              Login to continue managing clients, campaigns, tasks, reports,
              assets, and collaboration.
            </p>

            <div className="relative mt-8 flex justify-start self-start">
              <div className="absolute -inset-20 z-0 rounded-full bg-black blur-[100px] opacity-90 animate-pulse" />
           
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md border border-orange-500/20 bg-white/5 p-8 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white">Login</h2>
              <p className="mt-2 text-sm text-white/60">
                Access your dashboard and continue your work.
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
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                required
              />

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full border border-white/10 bg-black px-4 py-3 pr-12 text-white outline-none transition focus:border-orange-500"
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
                  className="text-sm text-orange-400 hover:text-orange-300"
                >
                  Forgot password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
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
              className="w-full border border-white/15 bg-white px-4 py-3 font-semibold text-black transition hover:bg-orange-50 disabled:opacity-60"
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
