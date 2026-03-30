import { useCallback, useEffect, useState } from "react";
import Sidebar from "../../../components/dashboard/components/Siderbar";
import { useAuth } from "../../../app/providers/AuthProvider";
import SystemHealthCard from "../components/SystemHealthCard";
import WorkflowStatusCard from "../components/WorkflowStatusCard";
import {
  getITDashboardStats,
  type ITDashboardStats,
} from "../services/itWorkspaceService";

export default function ITSystemMonitorPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;

  const organizationId = profile?.organization_id ?? null;

  const [stats, setStats] = useState<ITDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const statsData = await getITDashboardStats(organizationId);
      setStats(statsData);
    } catch (err: any) {
      console.error("IT SYSTEM MONITOR LOAD ERROR:", err);
      setError(err?.message || "Failed to load system monitor.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    void loadStats();
  }, [organizationId, loadStats]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading system monitor...
      </div>
    );
  }

  if (!user || !profile || !organizationId) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Missing IT workspace context.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="flex min-h-screen">
        <Sidebar
          role={profile.primary_role}
          counts={{
            projects: stats?.activeProjects ?? 0,
            pendingInvites: stats?.pendingInvites ?? 0,
            openIssues: stats?.openIssues ?? 0,
          }}
        />

        <main className="flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
              IT Workspace
            </p>
            <h1 className="mt-2 text-3xl font-bold">IT System Monitor</h1>
            <p className="mt-2 text-sm text-white/50">
              Live system health and workflow visibility from Supabase data.
            </p>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading system monitor...
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : (
            <div className="grid gap-6 xl:grid-cols-2">
              <SystemHealthCard organizationId={organizationId} />
              <WorkflowStatusCard
                organizationId={organizationId}
                workflowName="Social Reply Agent"
              />
              <WorkflowStatusCard
                organizationId={organizationId}
                workflowName="Campaign Reporting Workflow"
              />
              <WorkflowStatusCard
                organizationId={organizationId}
                workflowName="Issue Escalation Workflow"
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
