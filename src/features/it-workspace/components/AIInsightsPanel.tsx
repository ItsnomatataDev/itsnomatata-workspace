import { useCallback, useState } from "react";
import { Sparkles, RefreshCw, AlertCircle } from "lucide-react";
import { generateDashboardSummary } from "../../../lib/api/ai";
import type {
  ModuleHealthItem,
  EscalationItem,
  KPITile,
} from "../services/controlCentreService";

type Props = {
  organizationId: string;
  userId: string;
  role: string;
  userName: string | null;
  modules: ModuleHealthItem[];
  escalations: EscalationItem[];
  kpis: KPITile[];
};

export default function AIInsightsPanel({
  organizationId,
  userId,
  role,
  userName,
  modules,
  escalations,
  kpis,
}: Props) {
  const [insight, setInsight] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await generateDashboardSummary({
        organizationId,
        userId,
        role,
        userName,
        currentModule: "it-control-centre",
      });

      setInsight(result.summary);
      setSuggestions(result.suggestions ?? []);
    } catch (err: any) {
      // Fallback: generate local insights from available data
      const redModules = modules.filter((m) => m.signal === "red");
      const amberModules = modules.filter((m) => m.signal === "amber");
      const criticalEscalations = escalations.filter(
        (e) => e.severity === "critical",
      );

      const lines: string[] = [];

      if (criticalEscalations.length > 0) {
        lines.push(
          `**${criticalEscalations.length} critical items** need immediate attention — ${criticalEscalations
            .map((e) => e.title)
            .slice(0, 3)
            .join(", ")}.`,
        );
      }

      if (redModules.length > 0) {
        lines.push(
          `**${redModules.map((m) => m.module).join(", ")}** ${redModules.length === 1 ? "is" : "are"} showing red — ${redModules.map((m) => m.label).join("; ")}.`,
        );
      }

      if (amberModules.length > 0) {
        lines.push(
          `**${amberModules.map((m) => m.module).join(", ")}** ${amberModules.length === 1 ? "needs" : "need"} monitoring.`,
        );
      }

      const utilKpi = kpis.find((k) => k.label === "Utilisation");
      if (utilKpi) {
        lines.push(`Team utilisation is at **${utilKpi.value}** today.`);
      }

      if (lines.length === 0) {
        lines.push(
          "Everything looks healthy across all modules. Team is tracking well and no escalations detected.",
        );
      }

      const localSuggestions: string[] = [];
      if (criticalEscalations.length > 0) {
        localSuggestions.push("Resolve critical escalations before end of day");
      }
      if (redModules.find((m) => m.module === "Tasks")) {
        localSuggestions.push("Review blocked tasks and reassign if needed");
      }
      if (redModules.find((m) => m.module === "Automations")) {
        localSuggestions.push("Check failed automation logs and re-trigger");
      }
      if (utilKpi && parseInt(utilKpi.value) < 50) {
        localSuggestions.push("Low utilisation — check if timers are running");
      }

      setInsight(lines.join("\n\n"));
      setSuggestions(localSuggestions);

      // Only show error if we got no useful fallback
      if (lines.length === 0) {
        setError(err?.message ?? "AI unavailable");
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId, role, userName, modules, escalations, kpis]);

  return (
    <div className="rounded-2xl border border-white/10 bg-linear-to-br from-orange-500/5 via-white/5 to-purple-500/5 p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-orange-500/15 p-1.5">
            <Sparkles size={16} className="text-orange-500" />
          </div>
          <h3 className="text-sm font-semibold text-white">AI Insights</h3>
        </div>
        <button
          onClick={generateInsights}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          {insight ? "Refresh" : "Analyze"}
        </button>
      </div>

      {!insight && !loading && !error && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-center">
          <Sparkles size={20} className="mx-auto mb-2 text-orange-500/50" />
          <p className="text-sm text-white/50">
            Click <strong>Analyze</strong> to get AI-powered insights about your
            system health, team performance, and recommended actions.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/30 p-4">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="text-sm text-white/60">Generating AI insights...</p>
        </div>
      )}

      {error && !insight && (
        <div className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <AlertCircle size={16} className="text-red-400" />
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {insight && !loading && (
        <div className="space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="prose prose-sm prose-invert max-w-none text-sm text-white/75">
              {insight.split("\n\n").map((paragraph, i) => (
                <p
                  key={i}
                  dangerouslySetInnerHTML={{
                    __html: paragraph.replace(
                      /\*\*(.*?)\*\*/g,
                      '<strong class="text-white">$1</strong>',
                    ),
                  }}
                />
              ))}
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wider text-orange-500/70">
                Recommended Actions
              </p>
              {suggestions.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2 text-xs text-white/60"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-orange-500/20 text-[10px] text-orange-400">
                    {i + 1}
                  </span>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
