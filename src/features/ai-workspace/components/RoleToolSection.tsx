import AIActionGrid from "./AIActionGrid";
import type { AIWorkspaceTool } from "../types/aiWorkspace";

interface RoleToolSectionProps {
  title: string;
  description?: string;
  tools: AIWorkspaceTool[];
  selectedToolId?: string | null;
  onSelect: (toolId: string) => void;
}

export default function RoleToolSection({
  title,
  description,
  tools,
  selectedToolId,
  onSelect,
}: RoleToolSectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        ) : null}
      </div>

      <AIActionGrid
        tools={tools}
        selectedToolId={selectedToolId}
        onSelect={onSelect}
      />
    </section>
  );
}
