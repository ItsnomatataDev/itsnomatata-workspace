import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../supabase/client";
import {
  createManualTimeEntry,
  deleteTimeEntry,
  getActiveTimeEntry,
  getTimeEntriesForUser,
  type ManualTimeEntryInput,
  resumeTimeEntry,
  startTimeEntry,
  type StartTimeEntryInput,
  stopTimeEntry,
  type TimeEntryItem,
  updateTimeEntry,
  type UpdateTimeEntryInput,
} from "../supabase/mutations/timeEntries";

interface UseTimeEntriesParams {
  organizationId?: string | null;
  userId?: string | null;
  startDate?: string;
  endDate?: string;
  autoLoad?: boolean;
}

export function useTimeEntries({
  organizationId,
  userId,
  startDate,
  endDate,
  autoLoad = true,
}: UseTimeEntriesParams) {
  const [entries, setEntries] = useState<TimeEntryItem[]>([]);
  const [activeEntry, setActiveEntry] = useState<TimeEntryItem | null>(null);
  const [loading, setLoading] = useState(autoLoad);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canQuery = Boolean(organizationId && userId);

  const loadEntries = useCallback(async () => {
    if (!organizationId || !userId) {
      setEntries([]);
      setActiveEntry(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [entriesData, activeData] = await Promise.all([
        getTimeEntriesForUser({
          organizationId,
          userId,
          startDate,
          endDate,
        }),
        getActiveTimeEntry({
          organizationId,
          userId,
        }),
      ]);

      setEntries(entriesData);
      setActiveEntry(activeData);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Failed to load time entries.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [organizationId, userId, startDate, endDate]);

  useEffect(() => {
    if (!autoLoad) return;
    void loadEntries();
  }, [autoLoad, loadEntries]);

  // Realtime subscription so cross-session timer changes reflect immediately
  useEffect(() => {
    if (!organizationId || !userId) return;

    const channel = supabase
      .channel("my-time-entries")
      .on(
        "postgres_changes" as any,
        {
          event: "*",
          schema: "public",
          table: "time_entries",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          loadEntries();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, userId, loadEntries]);

  const handleStart = useCallback(
    async (payload: Omit<StartTimeEntryInput, "organizationId" | "userId">) => {
      if (!organizationId || !userId) {
        throw new Error("organizationId and userId are required.");
      }

      setMutating(true);
      setError(null);

      try {
        const entry = await startTimeEntry({
          organizationId,
          userId,
          ...payload,
        });

        setActiveEntry(entry);
        setEntries((
          prev,
        ) => [entry, ...prev.filter((item) => item.id !== entry.id)]);
        return entry;
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : "Failed to start timer.";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [organizationId, userId],
  );

  const handleStop = useCallback(async () => {
    if (!activeEntry?.id) {
      return null;
    }

    setMutating(true);
    setError(null);

    try {
      const entry = await stopTimeEntry(activeEntry.id, {
        userId: activeEntry.user_id,
        organizationId: activeEntry.organization_id,
      });

      setActiveEntry(null);
      setEntries((prev) =>
        prev.map((item) => (item.id === entry.id ? entry : item))
      );
      return entry;
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "Failed to stop timer.";
      setError(message);
      throw err;
    } finally {
      setMutating(false);
    }
  }, [activeEntry]);

  const handleResume = useCallback(
    async (entryId: string) => {
      if (!organizationId || !userId) {
        throw new Error("organizationId and userId are required.");
      }

      setMutating(true);
      setError(null);

      try {
        const entry = await resumeTimeEntry({
          entryId,
          organizationId,
          userId,
        });

        setActiveEntry(entry);
        setEntries((
          prev,
        ) => [entry, ...prev.filter((item) => item.id !== entry.id)]);
        return entry;
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : "Failed to resume timer.";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [organizationId, userId],
  );

  const handleCreateManual = useCallback(
    async (
      payload: Omit<ManualTimeEntryInput, "organizationId" | "userId">,
    ) => {
      if (!organizationId || !userId) {
        throw new Error("organizationId and userId are required.");
      }

      setMutating(true);
      setError(null);

      try {
        const entry = await createManualTimeEntry({
          organizationId,
          userId,
          ...payload,
        });

        setEntries((prev) => [entry, ...prev]);
        return entry;
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : "Failed to create manual time entry.";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [organizationId, userId],
  );

  const handleUpdate = useCallback(
    async (entryId: string, payload: UpdateTimeEntryInput) => {
      setMutating(true);
      setError(null);

      try {
        const entry = await updateTimeEntry({
          entryId,
          payload,
        });

        setEntries((prev) =>
          prev.map((item) => (item.id === entry.id ? entry : item))
        );

        if (activeEntry?.id === entry.id) {
          setActiveEntry(entry);
        }

        return entry;
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : "Failed to update time entry.";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [activeEntry],
  );

  const handleDelete = useCallback(
    async (entryId: string) => {
      setMutating(true);
      setError(null);

      try {
        await deleteTimeEntry(entryId);

        setEntries((prev) => prev.filter((item) => item.id !== entryId));

        if (activeEntry?.id === entryId) {
          setActiveEntry(null);
        }
      } catch (err) {
        const message = err instanceof Error
          ? err.message
          : "Failed to delete time entry.";
        setError(message);
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [activeEntry],
  );

  const totals = useMemo(() => {
    const totalSeconds = entries.reduce(
      (sum, entry) => sum + (entry.duration_seconds ?? 0),
      0,
    );

    const billableSeconds = entries
      .filter((entry) => entry.is_billable)
      .reduce((sum, entry) => sum + (entry.duration_seconds ?? 0), 0);

    const nonBillableSeconds = totalSeconds - billableSeconds;

    return {
      totalSeconds,
      billableSeconds,
      nonBillableSeconds,
    };
  }, [entries]);

  return {
    entries,
    activeEntry,
    loading,
    mutating,
    error,
    canQuery,
    totals,
    refresh: loadEntries,
    startEntry: handleStart,
    stopActiveEntry: handleStop,
    resumeEntry: handleResume,
    createManualEntry: handleCreateManual,
    updateEntry: handleUpdate,
    deleteEntry: handleDelete,
    hasRunningTimer: Boolean(activeEntry),
  };
}
