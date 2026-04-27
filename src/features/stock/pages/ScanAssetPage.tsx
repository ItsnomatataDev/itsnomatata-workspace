import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";

export default function ScanAssetPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const [value, setValue] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleaned = value.trim();
    if (!cleaned) return;

    navigate(`/assets/${cleaned}`);
  }

  if (!user || !profile) return null;

  return (
    <div className="min-h-screen bg-black text-white lg:flex">
      <Sidebar role={profile.primary_role} />

      <main className="flex-1 px-4 pt-4 pb-8 md:px-6">
        <div className="max-w-2xl space-y-6">
          <section className="border border-white/10 bg-black p-5">
            <p className="text-sm uppercase tracking-wide text-orange-300">
              Asset Scan
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Scan or Enter Asset ID
            </h1>
            <p className="mt-3 text-sm text-zinc-400">
              Scan a QR code or paste an asset ID to open the asset profile.
            </p>
          </section>

          <section className="border border-white/10 bg-black p-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm text-zinc-300">Asset ID</span>
                <input
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="Paste or scan asset ID"
                  className="w-full border border-white/10 bg-black px-4 py-3 text-sm text-white outline-none focus:border-orange-500"
                />
              </label>

              <button
                type="submit"
                className="border border-orange-500 bg-orange-500 px-5 py-3 text-sm font-medium text-black hover:bg-orange-400"
              >
                Open Asset
              </button>
            </form>
          </section>
        </div>
      </main>
    </div>
  );
}
