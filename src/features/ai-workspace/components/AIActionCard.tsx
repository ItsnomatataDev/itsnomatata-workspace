import type { AIWorkspaceTool } from "../types/aiWorkspace";

interface AIActionCardProps {
  tool: AIWorkspaceTool;
  selected?: boolean;
  onSelect?: (toolId: string) => void;
  onRun?: (params: { toolId: string }) => void;
}

export default function AIActionCard({
  tool,
  selected = false,
  onSelect,
  onRun,
}: AIActionCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(tool.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect?.(tool.id);
      }}
      className={`cursor-pointer rounded-2xl border p-4 transition ${
        selected
          ? "border-orange-500/60 bg-orange-500/10"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{tool.icon}</span>
          <h4 className="text-sm font-semibold text-white">{tool.label}</h4>
        </div>

        {tool.featured && (
          <span className="rounded-full bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-300">
            Featured
          </span>
        )}
      </div>

      <p className="mt-2 text-xs leading-5 text-gray-400">{tool.description}</p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-gray-500">
          {tool.category}
        </span>

        {onRun && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRun({ toolId: tool.id });
            }}
            className="rounded-lg bg-orange-500/20 px-2.5 py-1 text-xs font-medium text-orange-300 transition hover:bg-orange-500/30"
          >
            Run
          </button>
        )}
      </div>

      {tool.requiresApproval && (
        <p className="mt-2 text-[10px] text-amber-400/70">
          Requires approval before execution
        </p>
      )}
    </div>
  );
}
