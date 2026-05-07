import { Link, Navigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-10">
        <div className="w-full rounded-3xl border border-white/10 bg-neutral-950 p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/15 text-orange-400">
            <ShieldCheck size={26} />
          </div>
          <p className="mt-6 text-xs uppercase tracking-[0.28em] text-orange-500">
            Approval Required
          </p>
          <h1 className="mt-3 text-2xl font-bold">Public signup is closed</h1>
          <p className="mt-3 text-sm leading-6 text-white/60">
            New workspace accounts must be requested first and approved by the workspace owner.
          </p>
          <div className="mt-7 grid gap-3">
            <Link
              to="/request-access"
              className="rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400"
            >
              Request access
            </Link>
            <Link
              to="/login"
              className="rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/70 transition hover:bg-white/5 hover:text-white"
            >
              Back to login
            </Link>
          </div>
        </div>
      </div>
      <Navigate to="/request-access" replace />
    </div>
  );
}
