import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import {
  getWorkflowStatusSummary,
  type WorkflowStatusSummary,
} from "../services/itWorkspaceService";

type WorkflowStatusCardProps = {
  organizationId: string;
  workflowName: string;
  projectId?: string | null;
  refreshKey?: number;
};

function formatDateTime(value?: string | null) {
  if (!value) return "No runs yet";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function statusClasses(status?: string | null) {
  if (status === "success") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status) {
    return "border border-red-500/20 bg-red-500/10 text-red-300";
  }

  return "border border-white/10 bg-white/5 text-white/60";
}

export default function WorkflowStatusCard({
  organizationId,
  workflowName,
  projectId = null,
  refreshKey = 0,
}: WorkflowStatusCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<WorkflowStatusSummary | null>(null);

  const loadWorkflow = useCallback(async () => {
    if (!organizationId || !workflowName) return;

    try {
      setLoading(true);
      setError("");

      const data = await getWorkflowStatusSummary({
        organizationId,
        workflowName,
        projectId,
      });

      setSummary(data);
    } catch (err: any) {
      console.error("WORKFLOW STATUS LOAD ERROR:", err);
      setError(err?.message || "Failed to load workflow status.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, workflowName, projectId]);

  useEffect(() => {
    void loadWorkflow();
  }, [loadWorkflow, refreshKey]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
            <Activity size={18} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">{workflowName}</h3>
            <p className="text-sm text-white/50">
              Workflow health and recent runs
            </p>
          </div>
        </div>

        <button
          onClick={() => void loadWorkflow()}
          className="rounded-xl border border-white/10 p-2 text-white/70 transition hover:bg-white/5 hover:text-white"
          type="button"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-white/60">
          Loading workflow status...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm text-white/60">Latest status</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                summary?.latestStatus,
              )}`}
            >
              {summary?.latestStatus || "No runs"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wide text-white/45">
                Runs
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {summary?.totalRuns ?? 0}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wide text-white/45">
                Success
              </p>
              <p className="mt-2 text-xl font-bold text-emerald-300">
                {summary?.successCount ?? 0}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wide text-white/45">
                Failed
              </p>
              <p className="mt-2 text-xl font-bold text-red-300">
                {summary?.failedCount ?? 0}
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
            <p className="text-xs uppercase tracking-wide text-white/45">
              Last run
            </p>
            <p className="mt-2 text-sm text-white/80">
              {formatDateTime(summary?.latestRunAt)}
            </p>

            {summary?.latestMessage ? (
              <p className="mt-3 text-sm text-white/60">
                {summary.latestMessage}
              </p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
