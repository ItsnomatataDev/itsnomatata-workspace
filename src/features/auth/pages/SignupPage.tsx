import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { signUpUser } from "../../../lib/supabase/auth";
import type { PublicSignupRole } from "../../../lib/supabase/auth";

const ROLE_OPTIONS: { value: PublicSignupRole; label: string }[] = [
  { value: "manager", label: "Manager" },
  { value: "it", label: "IT" },
  { value: "social_media", label: "Social Media" },
  { value: "media_team", label: "Media Team" },
  { value: "seo_specialist", label: "SEO Specialist" },
];

export default function SignupPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<PublicSignupRole>("social_media");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [approvalRequired, setApprovalRequired] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setApprovalRequired(false);

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }

    if (!email.trim()) {
      setError("Email is required.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setBusy(true);

      const result = await signUpUser({
        email: email.trim(),
        password,
        fullName: fullName.trim(),
        role,
      });

      if (result?.approvalRequired) {
        setApprovalRequired(true);
      }

      setSuccess(true);
      setFullName("");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setRole("social_media");
    } catch (err) {
      console.error("SIGNUP ERROR:", err);
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="grid min-h-screen lg:grid-cols-2">
        <div className="hidden flex-col items-start justify-between border-r border-orange-500/20 bg-linear-to-br from-black via-black to-orange-950/20 p-10 lg:flex">
          <div className="flex flex-col items-start">
            <div className="w-20 h-20">
              <img
                src="https://res.cloudinary.com/dnqjax5ut/image/upload/v1776754504/Itsnomatata-Logo-White-with-tagline-2-768x643_u3n4j0.png"
                alt="IT's Nomatata"
              />
            </div>

            <h1 className="mt-8 max-w-md text-5xl font-bold leading-tight">
              Create your account.
            </h1>

            <p className="mt-5 max-w-lg text-base text-white/70">
              Join the workspace to start managing clients, campaigns, tasks,
              reports, assets, and collaboration.
            </p>

            <div className="relative mt-8 flex justify-start self-start">
              <div className="absolute -inset-20 z-0 rounded-full bg-black blur-[100px] opacity-90 animate-pulse" />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center p-4 sm:p-6">
          <div className="w-full max-w-md rounded-3xl border border-orange-500/20 bg-white/5 p-5 shadow-2xl sm:p-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white">Sign Up</h2>
              <p className="mt-2 text-sm text-white/60">
                Create your account to get started.
              </p>
            </div>

            {error ? (
              <div className="mb-4 border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            ) : null}

            {success ? (
              <div className="mb-4 border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                {approvalRequired
                  ? "Account created successfully! Your account is awaiting admin approval. You will be notified when your account is approved."
                  : "Account created successfully! Redirecting to login..."}
              </div>
            ) : null}

            {!success ? (
              <form onSubmit={handleSignup} className="space-y-4">
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                  required
                />

                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                  required
                />

                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as PublicSignupRole)}
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                  required
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 pr-12 text-white outline-none transition focus:border-orange-500"
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

                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm Password"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 pr-12 text-white outline-none transition focus:border-orange-500"
                    required
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
                  className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
                >
                  {busy ? "Creating account..." : "Create Account"}
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => navigate("/login", { replace: true })}
                className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400"
              >
                Go to Login
              </button>
            )}

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