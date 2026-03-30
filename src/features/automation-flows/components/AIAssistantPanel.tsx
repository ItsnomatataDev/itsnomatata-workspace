import { useMemo, useState } from "react";
import { Bot, Loader2, Play, ShieldCheck } from "lucide-react";
import type { AutomationFlowRow } from "../services/automationFlowService";
import { generateITWorkspaceSummary } from "../../../lib/api/ai";

type AIAssistantPanelProps = {
  role: string;
  projectsCount: number;
  openIssues: number;
  pendingInvites: number;
  failedRuns24h: number;
  flows: AutomationFlowRow[];
  onTriggerFlow: (flow: AutomationFlowRow) => Promise<void>;
};

export default function AIAssistantPanel({
  role,
  projectsCount,
  openIssues,
  pendingInvites,
  failedRuns24h,
  flows,
  onTriggerFlow,
}: AIAssistantPanelProps) {
  const [summary, setSummary] = useState("");
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState("");
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState("");

  const topFailingFlows = useMemo(() => {
    return flows.slice(0, 3).map((flow) => flow.name);
  }, [flows]);

  const selectedFlow = flows.find((flow) => flow.id === selectedFlowId) ?? null;

  const handleGenerateSummary = async () => {
    try {
      setLoadingSummary(true);
      setError("");

      const text = await generateITWorkspaceSummary({
        role,
        projectsCount,
        openIssues,
        pendingInvites,
        failedRuns24h,
        topFailingFlows,
      });

      setSummary(text);
    } catch (err: any) {
      console.error("AI SUMMARY ERROR:", err);
      setError(err?.message || "Failed to generate assistant summary.");
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleTriggerSelected = async () => {
    if (!selectedFlow) return;

    try {
      setTriggering(true);
      setError("");
      await onTriggerFlow(selectedFlow);
    } catch (err: any) {
      console.error("AI PANEL TRIGGER ERROR:", err);
      setError(err?.message || "Failed to trigger selected automation.");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-orange-500/15 p-2 text-orange-500">
          <Bot size={18} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">AI Assistant</h3>
          <p className="text-sm text-white/50">
            Summarizes workspace state and helps trigger approved automations.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void handleGenerateSummary()}
          disabled={loadingSummary}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-black hover:bg-orange-400 disabled:opacity-60"
        >
          {loadingSummary ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Bot size={16} />
          )}
          Generate IT Summary
        </button>
      </div>

      {summary ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-4">
          <pre className="whitespace-pre-wrap text-sm text-white/75">
            {summary}
          </pre>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="mb-3 flex items-center gap-2 text-white">
          <ShieldCheck size={16} className="text-orange-500" />
          <p className="font-medium">Safe Automation Trigger</p>
        </div>

        <p className="mb-4 text-sm text-white/55">
          The assistant does not auto-run actions. A human must choose a flow
          and click trigger manually.
        </p>

        <select
          value={selectedFlowId}
          onChange={(e) => setSelectedFlowId(e.target.value)}
          className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none focus:border-orange-500"
        >
          <option value="">Select automation flow</option>
          {flows.map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.name}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={!selectedFlow || triggering}
          onClick={() => void handleTriggerSelected()}
          className="mt-4 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-60"
        >
          {triggering ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          Trigger Selected Flow
        </button>
      </div>
    </div>
  );
}
