import { useCallback, useEffect, useState } from "react";
import { Database, RefreshCw, ServerCog, Workflow } from "lucide-react";
import {
  getSystemHealthSummary,
  type SystemHealthSummary,
} from "../services/itWorkspaceService";

type SystemHealthCardProps = {
  organizationId: string;
  refreshKey?: number;
};

function statusPill(status: "healthy" | "degraded" | "down") {
  if (status === "healthy") {
    return "border border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  }

  if (status === "degraded") {
    return "border border-amber-500/20 bg-amber-500/10 text-amber-300";
  }

  return "border border-red-500/20 bg-red-500/10 text-red-300";
}

function latencyText(value: number | null) {
  if (value == null) return "--";
  return `${value} ms`;
}

export default function SystemHealthCard({
  organizationId,
  refreshKey = 0,
}: SystemHealthCardProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<SystemHealthSummary | null>(null);

  const loadHealth = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);
      setError("");

      const data = await getSystemHealthSummary(organizationId);
      setSummary(data);
    } catch (err: any) {
      console.error("SYSTEM HEALTH LOAD ERROR:", err);
      setError(err?.message || "Failed to load system health.");
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth, refreshKey]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">System Health</h3>
          <p className="text-sm text-white/50">
            Live checks from your Supabase-backed workspace
          </p>
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
          Checking system health...
        </div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : (
        <>
          <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center gap-3">
                <Database size={18} className="text-orange-500" />
                <div>
                  <p className="font-medium text-white">Database</p>
                  <p className="text-xs text-white/45">
                    Latency: {latencyText(summary?.databaseLatencyMs ?? null)}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill(
                  summary?.databaseStatus || "down",
                )}`}
              >
                {summary?.databaseStatus || "down"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center gap-3">
                <ServerCog size={18} className="text-orange-500" />
                <div>
                  <p className="font-medium text-white">Workspace Access</p>
                  <p className="text-xs text-white/45">
                    Latency: {latencyText(summary?.workspaceLatencyMs ?? null)}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill(
                  summary?.workspaceStatus || "down",
                )}`}
              >
                {summary?.workspaceStatus || "down"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 p-4">
              <div className="flex items-center gap-3">
                <Workflow size={18} className="text-orange-500" />
                <div>
                  <p className="font-medium text-white">Automations</p>
                  <p className="text-xs text-white/45">
                    Latency: {latencyText(summary?.automationLatencyMs ?? null)}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${statusPill(
                  summary?.automationStatus || "down",
                )}`}
              >
                {summary?.automationStatus || "down"}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wide text-white/45">
                Projects
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {summary?.projectCount ?? 0}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wide text-white/45">
                Members
              </p>
              <p className="mt-2 text-xl font-bold text-white">
                {summary?.memberCount ?? 0}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/30 p-3">
              <p className="text-xs uppercase tracking-wide text-white/45">
                Failed 24h
              </p>
              <p className="mt-2 text-xl font-bold text-red-300">
                {summary?.recentFailedRuns ?? 0}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
