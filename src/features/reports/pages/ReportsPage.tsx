import { useEffect, useState } from "react";
import { FileText, Plus } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import { getReports } from "../../../lib/supabase/queries/reports";
import { createReport } from "../../../lib/supabase/mutations/reports";

export default function ReportsPage() {
  const auth = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    campaign_id: "",
    title: "",
    period_start: "",
    period_end: "",
    summary: "",
    status: "draft",
  });

  if (!auth?.user || !auth?.profile) return null;

  const { user, profile } = auth;
  const organizationId = profile.organization_id ?? undefined;

  useEffect(() => {
    const load = async () => {
      if (!organizationId) {
        setReports([]);
        setLoading(false);
        return;
      }

      try {
        const data = await getReports(organizationId);
        setReports(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [organizationId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!organizationId) {
      alert("Your account is not linked to an organization yet.");
      return;
    }

    try {
      setBusy(true);

      const report = await createReport({
        organization_id: organizationId,
        client_id: form.client_id,
        campaign_id: form.campaign_id || null,
        title: form.title,
        period_start: form.period_start || null,
        period_end: form.period_end || null,
        summary: form.summary || null,
        status: form.status as any,
        generated_by: user.id,
      });

      setReports((prev) => [report, ...prev]);

      setForm({
        client_id: "",
        campaign_id: "",
        title: "",
        period_start: "",
        period_end: "",
        summary: "",
        status: "draft",
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create report");
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
              Reports
            </p>
            <h1 className="mt-2 text-3xl font-bold">Reports Workspace</h1>
          </div>

          {!organizationId ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-red-300">
              Your account is not linked to an organization yet.
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-5 flex items-center gap-3">
                  <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                    <Plus size={18} />
                  </div>
                  <h2 className="text-lg font-semibold">Create Report</h2>
                </div>

                <form onSubmit={handleCreate} className="space-y-4">
                  <input
                    value={form.client_id}
                    onChange={(e) =>
                      setForm({ ...form, client_id: e.target.value })
                    }
                    placeholder="Client ID"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                    required
                  />
                  <input
                    value={form.campaign_id}
                    onChange={(e) =>
                      setForm({ ...form, campaign_id: e.target.value })
                    }
                    placeholder="Campaign ID (optional)"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                  />
                  <input
                    value={form.title}
                    onChange={(e) =>
                      setForm({ ...form, title: e.target.value })
                    }
                    placeholder="Report Title"
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                    required
                  />
                  <input
                    type="date"
                    value={form.period_start}
                    onChange={(e) =>
                      setForm({ ...form, period_start: e.target.value })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                  />
                  <input
                    type="date"
                    value={form.period_end}
                    onChange={(e) =>
                      setForm({ ...form, period_end: e.target.value })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                  />
                  <textarea
                    value={form.summary}
                    onChange={(e) =>
                      setForm({ ...form, summary: e.target.value })
                    }
                    placeholder="Summary"
                    rows={4}
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                  />
                  <select
                    value={form.status}
                    onChange={(e) =>
                      setForm({ ...form, status: e.target.value })
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black px-4 py-3 text-white"
                  >
                    <option value="draft">Draft</option>
                    <option value="generated">Generated</option>
                    <option value="approved">Approved</option>
                    <option value="sent">Sent</option>
                  </select>

                  <button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-2xl bg-orange-500 px-4 py-3 font-semibold text-black"
                  >
                    {busy ? "Saving..." : "Create Report"}
                  </button>
                </form>
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="mb-4 flex items-center gap-3">
                  <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
                    <FileText size={18} />
                  </div>
                  <h2 className="text-lg font-semibold">All Reports</h2>
                </div>

                {loading ? (
                  <p className="text-white/60">Loading reports...</p>
                ) : null}

                <div className="grid gap-4 md:grid-cols-2">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="rounded-2xl border border-white/10 bg-black/40 p-4"
                    >
                      <h3 className="text-lg font-semibold">{report.title}</h3>
                      <p className="mt-2 text-sm text-white/55">
                        {report.summary || "No summary"}
                      </p>
                      <div className="mt-4 flex items-center justify-between text-xs text-white/50">
                        <span>{report.status}</span>
                        <span>{report.period_start || "No period"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
