import { useCallback, useEffect, useState } from "react";
import { Activity, RefreshCw } from "lucide-react";
import {
  getAutomationHealthSummary,
  type AutomationHealthSummary,
} from "../services/automationFlowService";

type AutomationHealthCardProps = {
  organizationId: string;
  workflowName: string;
};

function riskClasses(level: "low" | "medium" | "high") {
  if (level === "low") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (level === "medium") {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  return "border border-red-500/20 bg-red-500/10 text-red-300";
}

function formatDateTime(value?: string | null) {
  if (!value) return "No runs yet";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function AutomationHealthCard({
  organizationId,
  workflowName,
}: AutomationHealthCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<AutomationHealthSummary | null>(null);

  const loadHealth = useCallback(async () => {
    if (!organizationId || !workflowName) return;

    try {
      setLoading(true);
      setError("");

      const data = await getAutomationHealthSummary(
        organizationId,
        workflowName,
      );

      setSummary(data);
    } catch (err: any) {
      console.error("AUTOMATION HEALTH LOAD ERROR:", err);
      setError(err?.message || "Failed to load automation health.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, workflowName]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

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
              Automation health and risk status
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadHealth()}
          className="rounded-xl border border-white/10 p-2 text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-white/60">
          Loading automation health...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-sm text-white/60">Risk Level</span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${riskClasses(
                summary?.riskLevel || "high",
              )}`}
            >
              {summary?.riskLevel || "high"}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wide text-white/45">
                Total Runs
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {summary?.totalRuns ?? 0}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wide text-white/45">
                Success Rate
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {summary?.successRate ?? 0}%
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wide text-white/45">
                Successful
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
              Last Run
            </p>
            <p className="mt-2 text-sm text-white/80">
              {formatDateTime(summary?.lastRunAt)}
            </p>
            <p className="mt-2 text-sm text-white/60">
              Latest status: {summary?.latestStatus || "No runs yet"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
