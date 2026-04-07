import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Play, Sparkles, Workflow } from "lucide-react";
import type { AutomationFlowRow } from "../services/automationFlowService";
import {
  generateDashboardSummary,
  type AIUserRole,
  type DashboardSummaryResult,
} from "../../ai-assistant/services/aiAssistantService";

function isAIUserRole(value: unknown): value is AIUserRole {
  return (
    value === "admin" ||
    value === "manager" ||
    value === "it" ||
    value === "social_media" ||
    value === "media_team" ||
    value === "seo_specialist"
  );
}

function isFlowActive(flow: AutomationFlowRow): boolean {
  const raw = flow as AutomationFlowRow & {
    is_active?: boolean;
    isActive?: boolean;
    active?: boolean;
    status?: string;
  };

  if (typeof raw.is_active === "boolean") return raw.is_active;
  if (typeof raw.isActive === "boolean") return raw.isActive;
  if (typeof raw.active === "boolean") return raw.active;
  if (typeof raw.status === "string") {
    return ["active", "enabled", "running"].includes(raw.status.toLowerCase());
  }

  return false;
}

export default function AIAssistantPanel({
  role,
  projectsCount,
  openIssues,
  pendingInvites,
  failedRuns24h,
  flows,
  onTriggerFlow,
}: {
  role?: string;
  projectsCount: number;
  openIssues: number;
  pendingInvites: number;
  failedRuns24h: number;
  flows: AutomationFlowRow[];
  onTriggerFlow: (flow: AutomationFlowRow) => Promise<void> | void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<DashboardSummaryResult | null>(null);
  const [triggeringId, setTriggeringId] = useState<string | null>(null);

  const safeRole = useMemo<AIUserRole | undefined>(() => {
    return isAIUserRole(role) ? role : "it";
  }, [role]);

  const activeFlowsCount = flows.filter((flow) => isFlowActive(flow)).length;
  const inactiveFlowsCount = Math.max(0, flows.length - activeFlowsCount);

  const handleGenerateSummary = async () => {
    if (!safeRole) {
      setError("No valid AI user role found.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result = await generateDashboardSummary({
        role: safeRole,
        context: {
          role: safeRole,
          userId: "automation-workspace",
          organizationId: "automation-workspace",
        },
      });

      const extraSuggestions = [
        failedRuns24h > 0
          ? `Investigate ${failedRuns24h} failed automation run(s) from the last 24 hours.`
          : "No failed automation runs in the last 24 hours.",
        pendingInvites > 0
          ? `Follow up on ${pendingInvites} pending invite(s).`
          : "No pending invites right now.",
        inactiveFlowsCount > 0
          ? `${inactiveFlowsCount} flow(s) are inactive and may need review.`
          : "All listed flows are active.",
      ];

      setSummary({
        summary: result.summary,
        suggestions: [...result.suggestions, ...extraSuggestions],
      });
    } catch (err: any) {
      console.error("AUTOMATION AI SUMMARY ERROR:", err);
      setError(err?.message || "Failed to generate automation summary.");
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerFlow = async (flow: AutomationFlowRow) => {
    try {
      setTriggeringId((flow as { id?: string }).id ?? null);
      await onTriggerFlow(flow);
    } catch (err: any) {
      console.error("TRIGGER FLOW ERROR:", err);
      setError(err?.message || "Failed to trigger flow.");
    } finally {
      setTriggeringId(null);
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5 text-white">
      <div className="mb-5 flex items-center gap-3">
        <div className="rounded-xl bg-orange-500/15 p-2 text-orange-400">
          <Sparkles size={18} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Automation AI Assistant</h2>
          <p className="text-sm text-white/55">
            Review workspace automation health and get AI guidance.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm text-white/60">Projects</p>
          <p className="mt-2 text-2xl font-bold text-white">{projectsCount}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm text-white/60">Open Issues</p>
          <p className="mt-2 text-2xl font-bold text-white">{openIssues}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm text-white/60">Pending Invites</p>
          <p className="mt-2 text-2xl font-bold text-white">{pendingInvites}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-sm text-white/60">Failed Runs (24h)</p>
          <p className="mt-2 text-2xl font-bold text-white">{failedRuns24h}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void handleGenerateSummary()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Sparkles size={16} />
          )}
          {loading ? "Generating..." : "Generate AI Summary"}
        </button>

        <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/70">
          <Workflow size={16} />
          <span>{activeFlowsCount} active flow(s)</span>
        </div>

        <div className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-4 py-2 text-sm text-white/70">
          <AlertTriangle size={16} />
          <span>{inactiveFlowsCount} inactive flow(s)</span>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
        {!summary ? (
          <p className="text-sm text-white/50">
            No automation summary generated yet.
          </p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold text-orange-400">Summary</p>
              <p className="mt-2 text-sm leading-6 text-white/85">
                {summary.summary}
              </p>
            </div>

            {summary.suggestions.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-orange-400">
                  Suggestions
                </p>
                <ul className="mt-2 space-y-2 text-sm text-white/80">
                  {summary.suggestions.map((item, index) => (
                    <li
                      key={`${item}-${index}`}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {flows.length > 0 ? (
        <div className="mt-5">
          <p className="mb-3 text-sm font-semibold text-orange-400">
            Quick Trigger
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            {flows.slice(0, 4).map((flow) => {
              const active = isFlowActive(flow);
              const flowId =
                (flow as { id?: string }).id ?? crypto.randomUUID();

              return (
                <div
                  key={flowId}
                  className="rounded-2xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">
                        {(flow as { name?: string }).name ?? "Automation Flow"}
                      </p>
                      <p className="mt-1 text-sm text-white/55">
                        {(flow as { description?: string | null })
                          .description || "No description provided."}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        active
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-white/10 text-white/60"
                      }`}
                    >
                      {active ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleTriggerFlow(flow)}
                    disabled={triggeringId === flowId}
                    className="mt-4 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {triggeringId === flowId ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Play size={15} />
                    )}
                    {triggeringId === flowId ? "Running..." : "Trigger Flow"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}
