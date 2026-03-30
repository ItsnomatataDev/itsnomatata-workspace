import { useCallback, useEffect, useState } from "react";
import {
  getITDashboardStats,
  getITProjectsForDashboard,
  getRecentITActivity,
  getSystemHealthSummary,
  type ITDashboardStats,
  type ITProjectDashboardItem,
  type ITRecentActivityItem,
  type SystemHealthSummary,
} from "../../features/it-workspace/services/itWorkspaceService";

type UseITWorkspaceParams = {
  organizationId?: string | null;
  userId?: string | null;
  enabled?: boolean;
};

export function useITWorkspace({
  organizationId,
  userId,
  enabled = true,
}: UseITWorkspaceParams) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [stats, setStats] = useState<ITDashboardStats | null>(null);
  const [projects, setProjects] = useState<ITProjectDashboardItem[]>([]);
  const [activity, setActivity] = useState<ITRecentActivityItem[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealthSummary | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setError("");
      return;
    }

    if (!organizationId || !userId) {
      setLoading(false);
      setError("Missing IT workspace context.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [statsData, projectsData, activityData, healthData] =
        await Promise.all([
          getITDashboardStats(organizationId),
          getITProjectsForDashboard(organizationId, userId),
          getRecentITActivity(organizationId, 8),
          getSystemHealthSummary(organizationId),
        ]);

      setStats(statsData);
      setProjects(projectsData);
      setActivity(activityData);
      setSystemHealth(healthData);
    } catch (err: any) {
      console.error("USE IT WORKSPACE LOAD ERROR:", err);
      setError(err?.message || "Failed to load IT workspace.");
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    loading,
    error,
    stats,
    projects,
    activity,
    systemHealth,
    reload: load,
  };
}
