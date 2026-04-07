import { Sparkles } from "lucide-react";
import type { AIWorkspaceTool } from "../types/aiWorkspace";

export interface AIActionGridProps {
  tools: AIWorkspaceTool[];
  selectedToolId?: string | null;
  onSelect: (toolId: string) => void;
}

export default function AIActionGrid({
  tools,
  selectedToolId,
  onSelect,
}: AIActionGridProps) {
  if (!tools.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 p-6 text-sm text-gray-400">
        No AI tools available for this role yet.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {tools.map((tool) => {
        const active = tool.id === selectedToolId;

        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onSelect(tool.id)}
            className={`rounded-2xl border p-4 text-left transition ${
              active
                ? "border-orange-500 bg-orange-500/10"
                : "border-white/10 bg-white/5 hover:bg-white/10"
            }`}
          >
            <div className="mb-3 inline-flex rounded-xl bg-white/10 p-2 text-orange-400">
              <Sparkles size={16} />
            </div>

            <h3 className="text-sm font-semibold text-white">{tool.label}</h3>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              {tool.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-gray-300">
                {tool.category}
              </span>

              {tool.featured && (
                <span className="rounded-full bg-orange-500/15 px-2.5 py-1 text-xs text-orange-300">
                  featured
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
