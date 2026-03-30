import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  getProjectActivity,
  type ProjectActivityItem,
} from "../services/itWorkspaceService";

type ProjectActivityListProps = {
  projectId: string;
  limit?: number;
  refreshKey?: number;
};

function formatDateTime(value: string) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

function formatDetails(details: Record<string, any> | null) {
  if (!details) return null;

  const values = Object.entries(details)
    .filter(([, value]) => value != null && value !== "")
    .slice(0, 4);

  if (values.length === 0) return null;

  return values.map(([key, value]) => `${key}: ${String(value)}`).join(" • ");
}

export default function ProjectActivityList({
  projectId,
  limit = 10,
  refreshKey = 0,
}: ProjectActivityListProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [items, setItems] = useState<ProjectActivityItem[]>([]);

  const loadActivity = useCallback(async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      setError("");

      const data = await getProjectActivity(projectId, limit);
      setItems(data);
    } catch (err: any) {
      console.error("PROJECT ACTIVITY LOAD ERROR:", err);
      setError(err?.message || "Failed to load project activity.");
    } finally {
      setLoading(false);
    }
  }, [projectId, limit]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity, refreshKey]);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-white">Project Activity</h3>
          <p className="text-sm text-white/50">
            Recent collaboration and project events
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadActivity()}
          className="rounded-xl border border-white/10 p-2 text-white/70 transition hover:bg-white/5 hover:text-white"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div className="mt-4 text-sm text-white/60">Loading activity...</div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/30 px-4 py-4 text-sm text-white/60">
          No activity found for this project yet.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.map((item) => {
            const actor = item.full_name || item.email || "Unknown user";
            const detailsText = formatDetails(item.details);

            return (
              <div
                key={item.id}
                className="rounded-xl border border-white/10 bg-black/30 px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-white">{item.action}</p>
                  <span className="text-xs text-white/45">
                    {formatDateTime(item.created_at)}
                  </span>
                </div>

                <p className="mt-2 text-sm text-white/65">By: {actor}</p>

                {detailsText ? (
                  <p className="mt-2 text-sm text-white/55">{detailsText}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
