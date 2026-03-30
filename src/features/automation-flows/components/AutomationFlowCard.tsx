import { Loader2, Play, Link as LinkIcon } from "lucide-react";
import type { AutomationFlowRow } from "../services/automationFlowService";

type AutomationFlowCardProps = {
  flow: AutomationFlowRow;
  onTrigger: (flow: AutomationFlowRow) => Promise<void>;
  isTriggering?: boolean;
};

export default function AutomationFlowCard({
  flow,
  onTrigger,
  isTriggering = false,
}: AutomationFlowCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-white">{flow.name}</h3>
          <p className="mt-2 text-sm text-white/60">
            {flow.description || "No flow description yet."}
          </p>
        </div>

        <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-medium text-orange-400">
          {flow.status}
        </span>
      </div>

      <div className="mt-4 rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/45">
          <LinkIcon size={14} />
          Webhook
        </div>
        <p className="mt-2 break-all text-sm text-white/70">
          {flow.webhook_url || "Not configured"}
        </p>
      </div>

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          disabled={isTriggering || !flow.webhook_url}
          onClick={() => void onTrigger(flow)}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isTriggering ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Play size={16} />
          )}
          Trigger
        </button>
      </div>
    </div>
  );
}
