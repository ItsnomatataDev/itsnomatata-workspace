import type { AIWorkspaceOutput } from "../types/aiWorkspace";

interface RecentOutputsPanelProps {
  outputs: AIWorkspaceOutput[];
  selectedOutputId?: string | null;
  onSelect?: (output: AIWorkspaceOutput) => void;
}

export default function RecentOutputsPanel({
  outputs,
  selectedOutputId,
  onSelect,
}: RecentOutputsPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-base font-semibold text-white">Recent Outputs</h3>

      <div className="mt-4 space-y-3">
        {outputs.length === 0 ? (
          <p className="text-sm text-gray-400">
            No outputs yet. Run a tool to see recent results here.
          </p>
        ) : (
          outputs.map((output) => {
            const active = output.id === selectedOutputId;

            return (
              <button
                key={output.id}
                type="button"
                onClick={() => onSelect?.(output)}
                className={`block w-full rounded-2xl border p-4 text-left transition ${
                  active
                    ? "border-orange-500 bg-orange-500/10"
                    : "border-white/10 bg-black/20 hover:bg-black/30"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-white">
                    {output.title}
                  </p>
                  <span className="text-xs text-gray-500">
                    {output.createdAt}
                  </span>
                </div>

                <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-300">
                  {output.content}
                </p>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
