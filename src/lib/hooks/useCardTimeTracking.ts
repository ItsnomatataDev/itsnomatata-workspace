import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase/client";
import type { TimeEntryItem } from "../supabase/mutations/timeEntries";

export interface CardTimeTracking {
  isTracking: boolean;
  activeEntry: TimeEntryItem | null;
  activeEntryCount: number;
  activeEntries: TimeEntryItem[];
  totalTrackedSeconds: number;
  liveSeconds: number;
}

export interface UseCardTimeTrackingProps {
  organizationId: string;
  userId?: string;
  taskId?: string;
  clientId?: string;
}

export function useCardTimeTracking({
  organizationId,
  userId,
  taskId,
  clientId,
}: UseCardTimeTrackingProps) {
  const [tracking, setTracking] = useState<CardTimeTracking>({
    isTracking: false,
    activeEntry: null,
    activeEntryCount: 0,
    activeEntries: [],
    totalTrackedSeconds: 0,
    liveSeconds: 0,
  });
  const [loading, setLoading] = useState(true);

  const loadTrackingData = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      // Get active time entry for this card/task
      let activeQuery = supabase
        .from("time_entries")
        .select("*")
        .eq("organization_id", organizationId)
        .is("ended_at", null);

      if (userId) activeQuery = activeQuery.eq("user_id", userId);
      if (taskId) activeQuery = activeQuery.eq("task_id", taskId);
      if (clientId) activeQuery = activeQuery.eq("client_id", clientId);

      const { data: activeData, error: activeError } = await activeQuery
        .order("started_at", { ascending: false });

      if (activeError) {
        throw activeError;
      }

      // Get total tracked time for this card/task
      let totalQuery = supabase
        .from("time_entries")
        .select("duration_seconds")
        .eq("organization_id", organizationId)
        .not("duration_seconds", "is", null);

      if (taskId) totalQuery = totalQuery.eq("task_id", taskId);
      if (clientId) totalQuery = totalQuery.eq("client_id", clientId);

      const { data: totalData, error: totalError } = await totalQuery;

      if (totalError) throw totalError;

      const totalSeconds = (totalData ?? []).reduce(
        (sum, entry) => sum + Number(entry.duration_seconds || 0),
        0,
      );

      const activeEntries = (activeData ?? []) as TimeEntryItem[];
      const activeEntry = activeEntries[0] ?? null;
      const isTracking = activeEntries.length > 0;

      setTracking({
        isTracking,
        activeEntry,
        activeEntryCount: activeEntries.length,
        activeEntries,
        totalTrackedSeconds: totalSeconds,
        liveSeconds: 0,
      });
    } catch (error) {
      console.error("Failed to load time tracking data:", error);
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId, taskId, clientId]);

  useEffect(() => {
    loadTrackingData();
  }, [loadTrackingData]);

  // Live timer update
  useEffect(() => {
    if (!tracking.isTracking) return;

    const updateLiveTime = () => {
      const nowMs = Date.now();
      const diffSeconds = tracking.activeEntries.reduce((sum, entry) => {
        const startedAtMs = new Date(entry.started_at).getTime();
        if (Number.isNaN(startedAtMs)) return sum;
        return sum + Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));
      }, 0);
      
      setTracking(prev => ({
        ...prev,
        liveSeconds: diffSeconds,
      }));
    };

    updateLiveTime();
    const interval = window.setInterval(updateLiveTime, 1000);

    return () => window.clearInterval(interval);
  }, [tracking.activeEntries, tracking.activeEntry?.started_at, tracking.activeEntry, tracking.activeEntryCount, tracking.isTracking]);

  // Real-time subscription
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`card-time-tracking-${organizationId}-${taskId}-${clientId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "time_entries",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const entry = (payload.new ?? payload.old) as TimeEntryItem | undefined;
          if (!entry) return;
          
          // Check if this event is relevant to our card
          const isRelevant = 
            (!userId || entry.user_id === userId) &&
            (!taskId || entry.task_id === taskId) &&
            (!clientId || entry.client_id === clientId);

          if (isRelevant) {
            loadTrackingData();
          }
        },
      );

    const subscription = channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, userId, taskId, clientId, loadTrackingData]);

  return {
    ...tracking,
    loading,
    refetch: loadTrackingData,
  };
}
