import { useCallback, useEffect, useState } from "react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import AutomationRunTable from "../components/AutomationRunTable";
import {
  getAutomationRuns,
  type AutomationRunRow,
} from "../services/automationRunService";
import {
  getITDashboardStats,
  type ITDashboardStats,
} from "../../it-workspace/services/itWorkspaceService";

export default function AutomationRunsPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;

  const organizationId = profile?.organization_id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ITDashboardStats | null>(null);
  const [runs, setRuns] = useState<AutomationRunRow[]>([]);

  const loadPage = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [statsData, runsData] = await Promise.all([
        getITDashboardStats(organizationId),
        getAutomationRuns(organizationId),
      ]);

      setStats(statsData);
      setRuns(runsData);
    } catch (err: any) {
      console.error("AUTOMATION RUNS LOAD ERROR:", err);
      setError(err?.message || "Failed to load automation runs.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    void loadPage();
  }, [organizationId, loadPage]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Loading automation runs...
      </div>
    );
  }

  if (!user || !profile || !organizationId) {
    return (
      <div className="min-h-screen bg-black px-4 py-6 text-white sm:px-6">
        Missing automation workspace 
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <Sidebar
          role={profile.primary_role}
          counts={{
            projects: stats?.activeProjects ?? 0,
            pendingInvites: stats?.pendingInvites ?? 0,
            openIssues: stats?.openIssues ?? 0,
          }}
        />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              IT Workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold">Automation Runs</h1>
            <p className="mt-2 text-sm text-white/50">
              Real workflow execution history logged into Supabase.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-white/60 sm:px-6">
              Loading automation runs...
            </div>
          ) : error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : null}

          {!loading ? <AutomationRunTable runs={runs} /> : null}
        </main>
      </div>
    </div>
  );
}
