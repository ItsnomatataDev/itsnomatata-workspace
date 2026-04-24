import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { signInWithGoogle, signUpUser } from "../../../lib/supabase/auth";
import type { AppRole } from "../../../lib/constants/roles";

type SignupFormState = {
  fullName: string;
  email: string;
  password: string;
  role: Exclude<AppRole, "admin">;
};

const SIGNUP_ROLE_OPTIONS: Array<{
  value: Exclude<AppRole, "admin">;
  label: string;
}> = [
  { value: "manager", label: "Administrator" },
  { value: "social_media", label: "Social Media" },
  { value: "media_team", label: "Media Team" },
  { value: "seo_specialist", label: "SEO Specialist" },
  { value: "it", label: "IT" },
];

export default function SignupPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<SignupFormState>({
    fullName: "",
    email: "",
    password: "",
    role: "social_media",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [warning, setWarning] = useState("");

  const updateForm = <K extends keyof SignupFormState>(
    key: K,
    value: SignupFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setWarning("");

    try {
      setBusy(true);

      const result = await signUpUser({
        email: form.email.trim(),
        password: form.password,
        fullName: form.fullName.trim(),
        role: form.role,
      });

      if (result?.workspace?.organizationFound === false) {
        setWarning(
          'Account created, but organization "its-nomatata" was not found. Ask an administrator to create it in Supabase.',
        );
      }

      if (result.session) {
        setSuccessMessage("Account created successfully. Redirecting...");
        navigate("/dashboard", { replace: true });
      } else {
        setSuccessMessage(
          "Account created. Please check your email to confirm your account, then log in.",
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
    setWarning("");

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
            <div className="inline-flex items-center border border-orange-500/40 px-4 py-2 text-sm text-orange-400">
              ITs Nomatata Workspace
            </div>

            <h1 className="mt-8 max-w-md text-5xl font-bold leading-tight">
              Create your workspace account and get started.
            </h1>

            <p className="mt-5 max-w-lg text-base text-white/70">
              Join the workspace for clients, campaigns, tasks, reports, assets,
              and internal collaboration.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center p-6">
          <div className="w-full max-w-md border border-orange-500/20 bg-white/5 p-8 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-white">Create Account</h2>
              <p className="mt-2 text-sm text-white/60">
                Set up your workspace account.
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

            {successMessage ? (
              <div className="mb-4 border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                {successMessage}
              </div>
            ) : null}

            <form onSubmit={handleSignup} className="space-y-4">
              <input
                type="text"
                value={form.fullName}
                onChange={(e) => updateForm("fullName", e.target.value)}
                placeholder="Full Name"
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                required
              />

              <input
                type="email"
                value={form.email}
                onChange={(e) => updateForm("email", e.target.value)}
                placeholder="Email"
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                required
              />

              <select
                value={form.role}
                onChange={(e) =>
                  updateForm(
                    "role",
                    e.target.value as Exclude<AppRole, "admin">,
                  )
                }
                className="w-full border border-white/10 bg-black px-4 py-3 text-white outline-none transition focus:border-orange-500"
                required
              >
                {SIGNUP_ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <p className="text-xs text-white/45">
                Super Admin cannot be selected during public signup.
              </p>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => updateForm("password", e.target.value)}
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

              <button
                type="submit"
                disabled={busy}
                className="w-full bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
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
              className="w-full border border-white/15 bg-white px-4 py-3 font-semibold text-black transition hover:bg-orange-50 disabled:opacity-60"
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

            <p className="mt-2 text-center text-sm text-white/60">
              <Link
                to="/forgot-password"
                className="text-orange-400 hover:text-orange-300"
              >
                Forgot password?
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
