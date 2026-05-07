import { useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { submitAccountAccessRequest } from "../../it-workspace/services/warRoomService";

export default function RequestAccessPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [requestedRole, setRequestedRole] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess(false);

    if (!fullName.trim() || !email.trim()) {
      setError("Full name and email are required.");
      return;
    }

    try {
      setBusy(true);
      await submitAccountAccessRequest({
        fullName,
        email,
        phone,
        company,
        requestedRole,
        message,
      });
      setSuccess(true);
      setFullName("");
      setEmail("");
      setPhone("");
      setCompany("");
      setRequestedRole("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit access request.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-10">
        <div className="w-full rounded-3xl border border-white/10 bg-neutral-950 p-6 shadow-2xl sm:p-8">
          <div className="mb-7 flex items-center gap-3">
            <div className="rounded-2xl bg-orange-500/15 p-3 text-orange-400">
              <ShieldCheck size={22} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-orange-500">
                Access Request
              </p>
              <h1 className="mt-1 text-2xl font-bold">Request workspace access</h1>
            </div>
          </div>

          {success ? (
            <div className="mb-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              Request submitted. The workspace owner will review it before an account is created.
            </div>
          ) : null}
          {error ? (
            <div className="mb-5 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : null}

          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-white/60">
                Full name
                <input
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </label>
              <label className="block text-sm text-white/60">
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </label>
              <label className="block text-sm text-white/60">
                Phone
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </label>
              <label className="block text-sm text-white/60">
                Company / team
                <input
                  value={company}
                  onChange={(event) => setCompany(event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
                />
              </label>
            </div>

            <label className="block text-sm text-white/60">
              Requested role
              <input
                value={requestedRole}
                onChange={(event) => setRequestedRole(event.target.value)}
                placeholder="Optional"
                className="mt-2 w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none placeholder:text-white/30 focus:border-orange-500"
              />
            </label>

            <label className="block text-sm text-white/60">
              Reason / message
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                rows={4}
                className="mt-2 w-full resize-none rounded-2xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
              />
            </label>

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black transition hover:bg-orange-400 disabled:opacity-60"
            >
              {busy ? "Submitting..." : "Submit request"}
            </button>
          </form>

          <Link to="/login" className="mt-5 block text-center text-sm text-white/50 hover:text-orange-400">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
