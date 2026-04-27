import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil } from "lucide-react";
import Sidebar from "../../../components/dashboard/components/Sidebar";
import { useAuth } from "../../../app/providers/AuthProvider";
import AutomationFlowCard from "../components/AutomationFlowCard";
import AutomationHealthCard from "../components/AutomationHealthCard";
import CreateAutomationFlowModal from "../components/CreateAutomationFlowModal";
import EditAutomationFlowModal from "../components/EditAutomationFlowModal";
import AIAssistantPanel from "../components/AIAssistantPanel";
import {
  getAutomationFlows,
  triggerAutomationFlow,
  type AutomationFlowRow,
} from "../services/automationFlowService";
import {
  getITDashboardStats,
  type ITDashboardStats,
} from "../../it-workspace/services/itWorkspaceService";
import { getAutomationRuns } from "../services/automationRunService";

export default function AutomationFlowsPage() {
  const auth = useAuth();
  const user = auth?.user ?? null;
  const profile = auth?.profile ?? null;
  const authLoading = auth?.loading ?? true;

  const organizationId = profile?.organization_id ?? null;
  const userId = user?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [stats, setStats] = useState<ITDashboardStats | null>(null);
  const [flows, setFlows] = useState<AutomationFlowRow[]>([]);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<AutomationFlowRow | null>(
    null,
  );
  const [failedRuns24h, setFailedRuns24h] = useState(0);

  const loadPage = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const [statsData, flowsData, runsData] = await Promise.all([
        getITDashboardStats(organizationId),
        getAutomationFlows(organizationId),
        getAutomationRuns(organizationId),
      ]);

      setStats(statsData);
      setFlows(flowsData);
      setFailedRuns24h(
        runsData.filter((run) => run.status !== "success").length,
      );
    } catch (err: any) {
      console.error("AUTOMATION FLOWS LOAD ERROR:", err);
      setError(err?.message || "Failed to load automation flows.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    if (!organizationId) return;
    void loadPage();
  }, [organizationId, loadPage]);

  const handleTrigger = async (flow: AutomationFlowRow) => {
    if (!organizationId || !userId) return;

    try {
      setTriggeringId(flow.id);
      setError("");

      await triggerAutomationFlow({
        flow,
        organizationId,
        triggeredBy: userId,
      });

      await loadPage();
    } catch (err: any) {
      console.error("AUTOMATION FLOW TRIGGER ERROR:", err);
      setError(err?.message || "Failed to trigger automation flow.");
    } finally {
      setTriggeringId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Loading automation flows...
      </div>
    );
  }

  if (!user || !profile || !organizationId || !userId) {
    return (
      <div className="min-h-screen bg-black p-6 text-white">
        Missing automation workspace context.
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
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-orange-500">
                IT Workspace
              </p>
              <h1 className="mt-2 text-3xl font-bold">Automation Flows</h1>
              <p className="mt-2 text-sm text-white/50">
                Connect, trigger, and monitor n8n workflows without touching the
                database.
              </p>
            </div>

            <button
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400"
            >
              <Plus size={16} />
              New Automation
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              Loading automation flows...
            </div>
          ) : error ? (
            <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/10 p-6 text-red-300">
              {error}
            </div>
          ) : null}

          {!loading ? (
            <div className="mb-6">
              <AIAssistantPanel
                role={profile.primary_role || "it"}
                projectsCount={stats?.activeProjects ?? 0}
                openIssues={stats?.openIssues ?? 0}
                pendingInvites={stats?.pendingInvites ?? 0}
                failedRuns24h={failedRuns24h}
                flows={flows}
                onTriggerFlow={handleTrigger}
              />
            </div>
          ) : null}

          {flows.length === 0 && !loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60">
              No automation flows found yet. Create your first one from the UI.
            </div>
          ) : (
            <div className="space-y-8">
              <div className="grid gap-6 xl:grid-cols-2">
                {flows.map((flow) => (
                  <div key={flow.id} className="space-y-4">
                    <AutomationFlowCard
                      flow={flow}
                      onTrigger={handleTrigger}
                      isTriggering={triggeringId === flow.id}
                    />

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => setEditingFlow(flow)}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-white/75 hover:bg-white/5"
                      >
                        <Pencil size={14} />
                        Edit Flow
                      </button>
                    </div>

                    <AutomationHealthCard
                      organizationId={organizationId}
                      workflowName={flow.name}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      <CreateAutomationFlowModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        organizationId={organizationId}
        userId={userId}
        onCreated={loadPage}
      />

      <EditAutomationFlowModal
        open={!!editingFlow}
        onClose={() => setEditingFlow(null)}
        flow={editingFlow}
        onUpdated={loadPage}
      />
    </div>
  );
}
