import type { AIWorkspaceHistoryItem } from "../types/aiWorkspace";

interface AIActionHistoryListProps {
  items: AIWorkspaceHistoryItem[];
  onItemClick?: (item: AIWorkspaceHistoryItem) => void;
}

export default function AIActionHistoryList({
  items,
  onItemClick,
}: AIActionHistoryListProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-base font-semibold text-white">Action History</h3>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">No AI action history yet.</p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 cursor-pointer hover:border-orange-500/30 hover:bg-black/30 transition-all"
              onClick={() => onItemClick?.(item)}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{item.title}</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${
                    item.status === "success"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : item.status === "failed"
                        ? "bg-red-500/15 text-red-300"
                        : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {item.status}
                </span>
              </div>

              <p className="mt-2 text-sm leading-6 text-gray-300">
                {item.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                <span>{item.createdAt}</span>
                {item.toolId && <span>• {item.toolId}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
