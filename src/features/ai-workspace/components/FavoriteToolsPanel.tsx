// src/features/ai-workspace/components/FavoriteToolsPanel.tsx

import type { AIWorkspaceTool } from "../types/aiWorkspace";

interface FavoriteToolsPanelProps {
  tools: AIWorkspaceTool[];
  selectedToolId?: string | null;
  onSelect: (toolId: string) => void;
}

export default function FavoriteToolsPanel({
  tools,
  selectedToolId,
  onSelect,
}: FavoriteToolsPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-base font-semibold text-white">Favorite Tools</h3>

      <div className="mt-4 flex flex-wrap gap-2">
        {tools.length === 0 ? (
          <p className="text-sm text-gray-400">
            No favorite tools available yet.
          </p>
        ) : (
          tools.map((tool) => {
            const active = tool.id === selectedToolId;

            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onSelect(tool.id)}
                className={`rounded-full px-3 py-2 text-sm transition ${
                  active
                    ? "bg-orange-500 text-white"
                    : "border border-white/10 bg-white/5 text-gray-200 hover:bg-white/10"
                }`}
              >
                {tool.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
