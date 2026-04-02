import type { AIActivityItem } from "../types/aiWorkspace";

type RecentOutputsPanelProps = {
  items: AIActivityItem[];
};

export default function RecentOutputsPanel({ items }: RecentOutputsPanelProps) {
  const completedItems = items
    .filter((item) => item.status === "completed")
    .slice(0, 5);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-medium text-white">Recent Outputs</h2>

      <div className="mt-4 space-y-3">
        {completedItems.length === 0 ? (
          <p className="text-sm text-white/65">No completed AI outputs yet.</p>
        ) : (
          completedItems.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-white/10 bg-black/20 p-4"
            >
              <p className="text-sm font-medium text-white">
                {item.actionType}
              </p>
              {item.outputSummary ? (
                <p className="mt-2 text-sm text-white/65">
                  {item.outputSummary}
                </p>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
