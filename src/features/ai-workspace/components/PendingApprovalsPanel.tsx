import type { AIWorkspaceApprovalItem } from "../types/aiWorkspace";

interface PendingApprovalsPanelProps {
  items: AIWorkspaceApprovalItem[];
}

export default function PendingApprovalsPanel({
  items,
}: PendingApprovalsPanelProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-base font-semibold text-white">Pending Approvals</h3>

      <div className="mt-4 space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-gray-400">
            No pending approvals right now.
          </p>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-white">{item.title}</p>
                <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-xs text-amber-300">
                  {item.status}
                </span>
              </div>

              <p className="mt-2 text-sm leading-6 text-gray-300">
                {item.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
                <span>{item.createdAt}</span>
                {item.requestedBy && <span>• {item.requestedBy}</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
