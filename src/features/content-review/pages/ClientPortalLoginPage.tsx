import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { loginContentClientPortal } from "../services/contentReviewService";

function inputClassName() {
  return "w-full rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm text-neutral-950 outline-none transition focus:border-orange-500";
}

function sessionKey(token: string) {
  return `content-client-session:${token}`;
}

export default function ClientPortalLoginPage() {
  const params = useParams();
  const navigate = useNavigate();
  const [clientToken, setClientToken] = useState(params.clientToken ?? "");
  const [email, setEmail] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!clientToken.trim() || !email.trim() || !pin.trim()) {
      setError("Enter your portal link code, email, and PIN.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const result = await loginContentClientPortal({
        clientToken: clientToken.trim(),
        email: email.trim(),
        pin: pin.trim(),
      });
      if (!result.ok || !result.session_token || !result.client) {
        setError(result.error === "pin_expired" ? "This PIN has expired." : "Invalid email or PIN.");
        return;
      }
      localStorage.setItem(
        sessionKey(clientToken.trim()),
        JSON.stringify({ sessionToken: result.session_token, email: email.trim().toLowerCase(), client: result.client }),
      );
      navigate(`/client-portal/${clientToken.trim()}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to login.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 p-4 text-neutral-950">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl">
        <p className="text-xs uppercase tracking-[0.3em] text-orange-500">Client Review Portal</p>
        <h1 className="mt-3 text-3xl font-bold">Sign in to reviews</h1>
        <p className="mt-2 text-sm text-neutral-600">Use the email and PIN provided by the content team.</p>
        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <div className="mt-5 space-y-3">
          {!params.clientToken ? (
            <input value={clientToken} onChange={(event) => setClientToken(event.target.value)} placeholder="Portal code" className={inputClassName()} />
          ) : null}
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className={inputClassName()} />
          <input inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} placeholder="6-digit PIN" className={inputClassName()} />
        </div>
        <button disabled={loading} className="mt-5 w-full rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-black hover:bg-orange-400 disabled:opacity-60">
          {loading ? "Signing in..." : "Open review portal"}
        </button>
      </form>
    </main>
  );
}

export { sessionKey as contentClientSessionKey };
