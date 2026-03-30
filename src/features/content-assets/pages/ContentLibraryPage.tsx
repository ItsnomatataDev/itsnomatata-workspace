import { useEffect, useState } from "react";
import { Image, Plus } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getContentAssets } from "../../../lib/supabase/queries/contentAssets";
import { createContentAsset } from "../../../lib/supabase/mutations/contentAssets";

export default function ContentLibraryPage() {
  const auth = useAuth();
  const [assets, setAssets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    client_id: "",
    campaign_id: "",
    task_id: "",
    file_name: "",
    file_path: "",
    file_url: "",
    mime_type: "",
    asset_type: "other",
    asset_status: "uploaded",
  });

  if (!auth?.user || !auth?.profile) return null;

  const { user, profile } = auth;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getContentAssets(profile.organization_id);
        setAssets(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile.organization_id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setBusy(true);

      const asset = await createContentAsset({
        organization_id: profile.organization_id,
        client_id: form.client_id || null,
        campaign_id: form.campaign_id || null,
        task_id: form.task_id || null,
        uploaded_by: user.id,
        file_name: form.file_name,
        file_path: form.file_path,
        file_url: form.file_url || null,
        mime_type: form.mime_type || null,
        asset_type: form.asset_type,
        asset_status: form.asset_status,
      });

      setAssets((prev) => [asset, ...prev]);

      setForm({
        client_id: "",
        campaign_id: "",
        task_id: "",
        file_name: "",
        file_path: "",
        file_url: "",
        mime_type: "",
        asset_type: "other",
        asset_status: "uploaded",
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create asset");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar role={profile.primary_role} />

        <main className="min-w-0 flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              Library
            </p>
            <h1 className="mt-2 text-3xl font-bold">Content Library</h1>
          </div>

          <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                  <Plus size={18} />
                </div>
                <h2 className="text-lg font-semibold">Add Asset</h2>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <input
                  value={form.client_id}
                  onChange={(e) =>
                    setForm({ ...form, client_id: e.target.value })
                  }
                  placeholder="Client ID"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                />
                <input
                  value={form.campaign_id}
                  onChange={(e) =>
                    setForm({ ...form, campaign_id: e.target.value })
                  }
                  placeholder="Campaign ID"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                />
                <input
                  value={form.task_id}
                  onChange={(e) =>
                    setForm({ ...form, task_id: e.target.value })
                  }
                  placeholder="Task ID"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                />
                <input
                  value={form.file_name}
                  onChange={(e) =>
                    setForm({ ...form, file_name: e.target.value })
                  }
                  placeholder="File Name"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                  required
                />
                <input
                  value={form.file_path}
                  onChange={(e) =>
                    setForm({ ...form, file_path: e.target.value })
                  }
                  placeholder="File Path"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                  required
                />
                <input
                  value={form.file_url}
                  onChange={(e) =>
                    setForm({ ...form, file_url: e.target.value })
                  }
                  placeholder="File URL"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                />
                <input
                  value={form.mime_type}
                  onChange={(e) =>
                    setForm({ ...form, mime_type: e.target.value })
                  }
                  placeholder="Mime Type"
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                />
                <select
                  value={form.asset_type}
                  onChange={(e) =>
                    setForm({ ...form, asset_type: e.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="document">Document</option>
                  <option value="audio">Audio</option>
                  <option value="design">Design</option>
                  <option value="other">Other</option>
                </select>
                <select
                  value={form.asset_status}
                  onChange={(e) =>
                    setForm({ ...form, asset_status: e.target.value })
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                >
                  <option value="uploaded">Uploaded</option>
                  <option value="processing">Processing</option>
                  <option value="ready">Ready</option>
                  <option value="archived">Archived</option>
                </select>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black"
                >
                  {busy ? "Saving..." : "Add Asset"}
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                  <Image size={18} />
                </div>
                <h2 className="text-lg font-semibold">All Assets</h2>
              </div>

              {loading ? (
                <p className="text-white/60">Loading assets...</p>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                {assets.map((asset) => (
                  <div
                    key={asset.id}
                    className="rounded-2xl border border-white/10 bg-black/40 p-4"
                  >
                    <h3 className="text-lg font-semibold">{asset.file_name}</h3>
                    <p className="mt-2 text-sm text-white/55">
                      {asset.file_url || asset.file_path}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-xs text-white/50">
                      <span>{asset.asset_type}</span>
                      <span>{asset.asset_status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
