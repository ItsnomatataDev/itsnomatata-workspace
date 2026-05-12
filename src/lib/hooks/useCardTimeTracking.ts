import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../supabase/client";
import type { TimeEntryItem } from "../supabase/mutations/timeEntries";
import {
  getEntryDurationSeconds,
  getRunningEntryElapsedSeconds,
  getTodayCompletedSeconds,
  getZimbabweTodayRangeIso,
} from "../utils/timeMath";

// Cache for storing recent requests to prevent duplicates
const requestCache = new Map<string, Promise<any>>();
const REQUEST_DEBOUNCE_MS = 500; // 500ms debounce

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
  todayOnly?: boolean;
}

export function useCardTimeTracking({
  organizationId,
  userId,
  taskId,
  clientId,
  todayOnly = false,
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

  // Debounced request function with caching
  const makeRequest = useCallback(async (queryKey: string, queryFn: () => Promise<any>) => {
    // Check cache first
    if (requestCache.has(queryKey)) {
      return requestCache.get(queryKey);
    }

    // Create new request and cache it
    const request = queryFn();
    requestCache.set(queryKey, request);

    // Clear cache after request completes (success or fail)
    Promise.resolve(request).finally(() => {
      setTimeout(() => {
        requestCache.delete(queryKey);
      }, REQUEST_DEBOUNCE_MS);
    });

    return request;
  }, []);

  const loadTrackingData: () => Promise<void> = useCallback(async () => {
    if (!organizationId) return;

    try {
      setLoading(true);

      // Create unique cache key for this request
      const cacheKey = `tracking-${organizationId}-${userId || 'all'}-${taskId || 'all'}-${clientId || 'all'}-${todayOnly ? 'today' : 'all'}`;

      // Get active time entry for this card/task
      let activeQuery = supabase
        .from("time_entries")
        .select("*")
        .eq("organization_id", organizationId)
        .is("ended_at", null)
        .is("deleted_at", null);

      if (userId) activeQuery = activeQuery.eq("user_id", userId);
      if (taskId) activeQuery = activeQuery.eq("task_id", taskId);
      if (clientId) activeQuery = activeQuery.eq("client_id", clientId);

      const { data: activeData, error: activeError } = await makeRequest(
        `${cacheKey}-active`,
        () => Promise.resolve(activeQuery.order("started_at", { ascending: false }))
      );

      if (activeError) {
        throw activeError;
      }

      // Get total tracked time for this card/task
      let totalQuery = supabase
        .from("time_entries")
        .select("*")
        .eq("organization_id", organizationId)
        .is("deleted_at", null);

      if (taskId) totalQuery = totalQuery.eq("task_id", taskId);
      if (clientId) totalQuery = totalQuery.eq("client_id", clientId);
      if (todayOnly) {
        const todayRange = getZimbabweTodayRangeIso();
        totalQuery = totalQuery
          .gte("started_at", todayRange.start)
          .lt("started_at", todayRange.end);
      }

      const { data: totalData, error: totalError } = await makeRequest(
        `${cacheKey}-total`,
        () => Promise.resolve(totalQuery)
      );

      if (totalError) throw totalError;

      const totalEntries = (totalData ?? []) as TimeEntryItem[];
      const totalSeconds = todayOnly
        ? getTodayCompletedSeconds(totalEntries)
        : totalEntries
            .filter((entry) => entry.ended_at)
            .reduce((sum, entry) => sum + getEntryDurationSeconds(entry), 0);

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
    } catch (error: unknown) {
      console.error("Failed to load time tracking data:", error);
      
      // Retry logic with exponential backoff
      if (error instanceof Error && (error.message?.includes('fetch') || error.message?.includes('network'))) {
        const retryDelay = Math.min(1000 * Math.pow(2, 2), 5000); // Max 5 second delay
        setTimeout(() => {
          console.log("Retrying time tracking request...");
          loadTrackingData();
        }, retryDelay);
      }
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId, taskId, clientId, todayOnly]);

  useEffect(() => {
    loadTrackingData();
  }, [organizationId, userId, taskId, clientId, todayOnly]);

  // Live timer update
  useEffect(() => {
    if (!tracking.isTracking) return;

    const updateLiveTime = () => {
      const nowMs = Date.now();
      const diffSeconds = tracking.activeEntries.reduce((sum, entry) => {
        return sum + getRunningEntryElapsedSeconds(entry, nowMs);
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
